import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Check,
  Plus,
  Search,
  Trash2,
  Loader2,
  CreditCard,
  Calendar,
  X,
  CheckCircle2,
  Receipt,
  Building2,
  FileText,
  FileSpreadsheet,
  Download,
  Upload,
  Package,
  RotateCcw,
  Printer,
  AlertTriangle,
  Eye,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from "lucide-react";
import {
  createPurchase,
  fetchPurchases,
  markPurchaseAsPaid,
  deletePurchase,
  fetchPurchaseReturns,
  createPurchaseReturn,
} from "@shared/api/purchaseAPI";
import { getProducts, createProduct } from "@shared/api/productAPI";
import { fetchSuppliers } from "@shared/api/supplierAPI";
import { fmt } from "@shared/utils/format";
import { Toast, StepperInput, Modal, Input, Select, Btn, GstRateSelect, GST_RATES, GST_RATE_NUMBERS } from "@shared/components/common/ui";
import {
  parseExcelOrCsvFile,
  normalizePurchaseInvoiceRows,
  downloadPurchaseInvoiceTemplate,
} from "@shared/utils/csvHelper";
import PurchaseHistoryTable from "./purchase/PurchaseHistoryTable";
import PurchaseSupplierDetailsModal from "./purchase/PurchaseSupplierDetailsModal";

const GST_OPTIONS = GST_RATE_NUMBERS;
const PAYMENT_METHODS = [
  "Cash",
  "UPI",
  "Bank Transfer",
  "Card",
  "Cheque",
  "Other",
];

const RETURN_REASONS = [
  "Damaged / Defective",
  "Wrong Item Received",
  "Expired / Near Expiry",
  "Quality Not as Expected",
  "Overstocked / Excess Delivery",
  "Other",
];

const RETURN_CONDITIONS = ["Damaged", "Faulty", "Good / Resalable", "Opened / Incomplete"];

const SETTLEMENT_TYPES = [
  "Adjust from Supplier Balance",
  "Direct Cash / Bank Refund",
  "Replacement Expected",
];

export default function PurchaseScreen() {
  const [productList, setProductList] = useState([]);
  const [supplierList, setSupplierList] = useState([]);
  const [purchaseList, setPurchaseList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("entry"); // "entry" | "history"

  // Form states
  const [supplier, setSupplier] = useState("");
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [purchaseOrderNo, setPurchaseOrderNo] = useState("");
  const [eWayBillNo, setEWayBillNo] = useState("");
  const [taxType, setTaxType] = useState("GST Regular");
  const [itcEligible, setItcEligible] = useState(true);
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [purchasePaymentMethods, setPurchasePaymentMethods] = useState(() => {
    try {
      const stored = localStorage.getItem("smartbill_payment_settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.purchase) && parsed.purchase.length > 0) {
          return parsed.purchase;
        }
      }
    } catch (_) {}
    return ["Cash", "Bank Transfer", "Cheque / DD", "Credit / Debit Card", "UPI & QR Code"];
  });

  const [dueDate, setDueDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Unpaid");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [notes, setNotes] = useState("");
  const [showMoreVendorDetails, setShowMoreVendorDetails] = useState(false);
  const [showBatchCols, setShowBatchCols] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      try {
        const stored = localStorage.getItem("smartbill_payment_settings");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed.purchase) && parsed.purchase.length > 0) {
            setPurchasePaymentMethods(parsed.purchase);
          }
        }
      } catch (_) {}
    };
    window.addEventListener("paymentSettingsUpdated", handleUpdate);
    return () => window.removeEventListener("paymentSettingsUpdated", handleUpdate);
  }, []);

  const [items, setItems] = useState([
    {
      productId: "",
      product: "",
      qty: 1,
      unit: "pcs",
      rate: "",
      gstRate: 18,
      discount: 0,
      amount: 0,
      gstAmount: 0,
      hsnCode: "",
      batchNo: "",
      expiryDate: "",
      itcEligible: true,
    },
  ]);

  const [searchHistory, setSearchHistory] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [toast, setToast] = useState(null);

  // Professional Record Payment Modal States
  const [paymentModalPurchase, setPaymentModalPurchase] = useState(null);
  const [selectedSupplierPurchase, setSelectedSupplierPurchase] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentRefNo, setPaymentRefNo] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);


  // Quick Add Product Modal States
  const [showQuickAddProductModal, setShowQuickAddProductModal] = useState(false);
  const [quickProductForm, setQuickProductForm] = useState({
    name: "",
    sku: "",
    category: "General",
    cost: "",
    price: "",
    gst: "18",
    unit: "Piece",
    stock: "0",
    minStock: "10",
  });
  const [quickProductSaving, setQuickProductSaving] = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Purchase Returns / Debit Notes States
  const [purchaseReturnsList, setPurchaseReturnsList] = useState([]);
  const [searchReturns, setSearchReturns] = useState("");
  const [filterReturnReason, setFilterReturnReason] = useState("");

  // Create Purchase Return (Debit Note) Modal State
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [savingReturn, setSavingReturn] = useState(false);
  const [returnPurchaseId, setReturnPurchaseId] = useState(null);
  const [returnSupplierId, setReturnSupplierId] = useState(null);
  const [returnSupplier, setReturnSupplier] = useState("");
  const [returnInvoiceNo, setReturnInvoiceNo] = useState("");
  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [returnItems, setReturnItems] = useState([]);
  const [returnSettlementType, setReturnSettlementType] = useState(
    "Adjust from Supplier Balance"
  );
  const [returnNotes, setReturnNotes] = useState("");

  // Debit Note View Modal State
  const [activeDebitNote, setActiveDebitNote] = useState(null);

  // Import Supplier Bill / Invoice Modal States
  const [showImportBillModal, setShowImportBillModal] = useState(false);
  const [importBillFile, setImportBillFile] = useState(null);
  const [parsedBillItems, setParsedBillItems] = useState([]);
  const [billImportErrors, setBillImportErrors] = useState([]);
  const [billParsing, setBillParsing] = useState(false);

  // Handle Bill File Upload & Parse
  const handleBillFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportBillFile(file);
    setBillParsing(true);
    setBillImportErrors([]);

    try {
      const rawRows = await parseExcelOrCsvFile(file);
      const { items: normalized, errors } = normalizePurchaseInvoiceRows(rawRows, productList);
      setParsedBillItems(normalized);
      setBillImportErrors(errors);
    } catch (err) {
      console.error("Failed to parse supplier bill:", err);
      setBillImportErrors([`Failed to parse supplier bill: ${err.message}`]);
      setParsedBillItems([]);
    } finally {
      setBillParsing(false);
    }
  };

  const handleApplyImportedBill = () => {
    if (parsedBillItems.length === 0) {
      showToast("No valid items to load", "error");
      return;
    }
    setItems(parsedBillItems);
    setShowImportBillModal(false);
    setImportBillFile(null);
    setParsedBillItems([]);
    setBillImportErrors([]);
    showToast(`Loaded ${parsedBillItems.length} items from supplier bill into purchase entry!`, "success");
  };

  // Quick Add Product Handler
  const handleQuickAddProduct = async (e) => {
    if (e) e.preventDefault();
    const name = String(quickProductForm.name || "").trim();
    if (!name) {
      showToast("Product name is required", "error");
      return;
    }
    setQuickProductSaving(true);
    try {
      const res = await createProduct({
        name,
        sku: quickProductForm.sku ? String(quickProductForm.sku).trim() : `SKU-${Date.now().toString(36).toUpperCase()}`,
        category: quickProductForm.category || "General",
        cost: Number(quickProductForm.cost) || 0,
        price: Number(quickProductForm.price) || (Number(quickProductForm.cost) || 0) * 1.2,
        gst: Number(quickProductForm.gst) || 0,
        unit: quickProductForm.unit || "Piece",
        stock: Number(quickProductForm.stock) || 0,
        minStock: Number(quickProductForm.minStock) || 10,
        status: "Active",
      });

      const newProd = res?.product || res;
      setProductList((prev) => [newProd, ...prev]);

      // Automatically fill empty item row or append a new item row with this product
      setItems((prev) => {
        const emptyIdx = prev.findIndex((it) => !it.product || !it.product.trim());
        const costVal = newProd.cost !== undefined && Number(newProd.cost) > 0 ? newProd.cost : newProd.price || 0;
        const gstVal = newProd.gst !== undefined ? Number(newProd.gst) : 18;
        const newRow = {
          productId: newProd._id || newProd.id,
          product: newProd.name,
          qty: 1,
          unit: newProd.unit || "Piece",
          rate: costVal,
          gstRate: gstVal,
          discount: 0,
          amount: Number(costVal),
          gstAmount: Number(costVal) * (gstVal / 100),
        };
        if (emptyIdx !== -1) {
          return prev.map((it, i) => (i === emptyIdx ? newRow : it));
        }
        return [...prev, newRow];
      });

      showToast(`Product "${newProd.name}" created and selected!`, "success");
      setShowQuickAddProductModal(false);
      setQuickProductForm({
        name: "",
        sku: "",
        category: "General",
        cost: "",
        price: "",
        gst: "18",
        unit: "Piece",
        stock: "0",
        minStock: "10",
      });
      window.dispatchEvent(new CustomEvent("productUpdated"));
      window.dispatchEvent(new CustomEvent("stockUpdated"));
    } catch (err) {
      console.error("QUICK ADD PRODUCT ERROR:", err);
      showToast(err.response?.data?.message || err.message || "Failed to create product", "error");
    } finally {
      setQuickProductSaving(false);
    }
  };

  // Load initial data from APIs
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, suppRes, purchRes, returnRes] = await Promise.allSettled([
        getProducts(),
        fetchSuppliers(),
        fetchPurchases(),
        fetchPurchaseReturns(),
      ]);

      if (prodRes.status === "fulfilled") {
        setProductList(prodRes.value?.products || []);
      }
      if (suppRes.status === "fulfilled") {
        const raw = suppRes.value;
        const list = Array.isArray(raw?.suppliers)
          ? raw.suppliers
          : Array.isArray(raw)
            ? raw
            : [];
        setSupplierList(list);
        if (list.length > 0 && !supplier) {
          setSupplier(list[0].name);
        }
      }
      if (purchRes.status === "fulfilled") {
        setPurchaseList(purchRes.value?.purchases || []);
      }
      if (returnRes.status === "fulfilled") {
        setPurchaseReturnsList(returnRes.value?.purchaseReturns || returnRes.value || []);
      }
    } catch (err) {
      console.error("Failed to load purchase page data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener("stockUpdated", handleUpdate);
    window.addEventListener("productUpdated", handleUpdate);
    window.addEventListener("purchaseCreated", handleUpdate);
    window.addEventListener("purchaseReturnCreated", handleUpdate);
    window.addEventListener("orderCreated", handleUpdate);

    return () => {
      window.removeEventListener("stockUpdated", handleUpdate);
      window.removeEventListener("productUpdated", handleUpdate);
      window.removeEventListener("purchaseCreated", handleUpdate);
      window.removeEventListener("purchaseReturnCreated", handleUpdate);
      window.removeEventListener("orderCreated", handleUpdate);
    };
  }, [loadData]);

  // Handle reorder auto-fill from Inventory
  useEffect(() => {
    const reorderData = localStorage.getItem("reorderProduct");
    if (reorderData && productList.length > 0) {
      try {
        const p = JSON.parse(reorderData);
        const selectedProduct = productList.find((prod) => prod.name === p.name);

        if (selectedProduct) {
          const rate =
            selectedProduct.cost !== undefined && selectedProduct.cost > 0
              ? selectedProduct.cost
              : selectedProduct.price || 0;
          const gstRate =
            selectedProduct.gst !== undefined ? selectedProduct.gst : 18;
          const qty = p.minStock ? Math.max(1, p.minStock * 2) : 10;
          const amount = qty * rate;
          const gstAmount = amount * (gstRate / 100);

          setItems([
            {
              productId: selectedProduct._id || selectedProduct.id,
              product: selectedProduct.name,
              qty: qty,
              unit: selectedProduct.unit || "pcs",
              rate: rate,
              gstRate: gstRate,
              discount: 0,
              amount: amount,
              gstAmount: gstAmount,
            },
          ]);
          localStorage.removeItem("reorderProduct");
        }
      } catch (err) {
        console.error("Failed to parse reorder product", err);
      }
    }
  }, [productList]);

  // Update item field and recalculate values
  const updateItem = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const next = { ...item, [field]: value };

        if (field === "product") {
          const cleanVal = String(value || "").trim().toLowerCase();
          const selected = productList.find(
            (p) =>
              String(p.name || "").toLowerCase() === cleanVal ||
              (p._id || p.id) === value
          );
          if (selected) {
            next.productId = selected._id || selected.id;
            next.product = selected.name;
            next.unit = selected.unit || "Piece";
            next.rate =
              selected.cost !== undefined && Number(selected.cost) > 0
                ? selected.cost
                : selected.price || 0;
            next.gstRate = selected.gst !== undefined ? Number(selected.gst) : 18;
            next.hsnCode = selected.hsnCode || "";
            next.batchNo = selected.batchNo || "";
            if (selected.expiryDate) {
              next.expiryDate = new Date(selected.expiryDate).toISOString().slice(0, 10);
            }
          } else {
            // Free-form typed product name (manual new item)
            next.productId = null;
            next.product = value;
            if (!next.unit) next.unit = "Piece";
            if (next.gstRate === undefined || next.gstRate === null) next.gstRate = 18;
          }
        }

        const qty = Number(next.qty) || 0;
        const rate = Number(next.rate) || 0;
        const disc = Number(next.discount) || 0;
        const gstR = Number(next.gstRate) || 0;

        const baseAmount = Math.max(0, qty * rate - disc);
        const calculatedGst = baseAmount * (gstR / 100);

        next.amount = baseAmount;
        next.gstAmount = calculatedGst;

        return next;
      })
    );
  };

  const selectedProductNames = useMemo(() => {
    return items.map((it) => it.product).filter(Boolean);
  }, [items]);

  // Payment Summary calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [items]);

  const totalGst = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.gstAmount) || 0), 0);
  }, [items]);

  const totalDiscount = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.discount) || 0), 0);
  }, [items]);

  const totalAmount = useMemo(() => {
    return subtotal + totalGst;
  }, [subtotal, totalGst]);

  const { amountPaid, remainingAmount } = useMemo(() => {
    if (paymentStatus === "Paid") {
      return { amountPaid: totalAmount, remainingAmount: 0 };
    }
    if (paymentStatus === "Partially Paid") {
      const paidNum = Number(amountPaidInput) || 0;
      const remaining = Math.max(0, totalAmount - paidNum);
      return { amountPaid: paidNum, remainingAmount: remaining };
    }
    return { amountPaid: 0, remainingAmount: totalAmount };
  }, [paymentStatus, totalAmount, amountPaidInput]);

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: "",
        product: "",
        qty: 1,
        unit: "pcs",
        rate: "",
        gstRate: 18,
        discount: 0,
        amount: 0,
        gstAmount: 0,
        hsnCode: "",
        batchNo: "",
        expiryDate: "",
        itcEligible: true,
      },
    ]);
  };

  const removeItemRow = (index) => {
    if (items.length <= 1) {
      showToast("At least one product row is required", "error");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setSupplier(supplierList[0]?.name || "");
    setSupplierInvoiceNo("");
    setPurchaseOrderNo("");
    setEWayBillNo("");
    setTaxType("GST Regular");
    setItcEligible(true);
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setDueDate("");
    setPaymentStatus("Unpaid");
    setPaymentMethod("Cash");
    setAmountPaidInput("");
    setNotes("");
    setItems([
      {
        productId: "",
        product: "",
        qty: 1,
        unit: "pcs",
        rate: "",
        gstRate: 18,
        discount: 0,
        amount: 0,
        gstAmount: 0,
        hsnCode: "",
        batchNo: "",
        expiryDate: "",
        itcEligible: true,
      },
    ]);
  };


  // ==========================================
  // PROFESSIONAL RECORD PAYMENT MODAL HANDLERS
  // ==========================================
  const handleOpenPaymentModal = (purchase) => {
    if (!purchase) return;
    const remaining =
      purchase.remainingAmount !== undefined
        ? Number(purchase.remainingAmount)
        : Math.max(
            0,
            (Number(purchase.totalAmount || purchase.total) || 0) -
              (Number(purchase.amountPaid) || 0)
          );

    setPaymentModalPurchase(purchase);
    setPaymentAmount(remaining > 0 ? String(remaining) : "0");
    setPaymentMode(purchase.paymentMethod || "Cash");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentRefNo("");
    setPaymentNotes("");
  };

  const handleClosePaymentModal = () => {
    setPaymentModalPurchase(null);
    setPaymentAmount("");
    setRecordingPayment(false);
  };

  const handleConfirmPayment = async (e) => {
    if (e) e.preventDefault();
    if (!paymentModalPurchase) return;

    const purchaseId =
      paymentModalPurchase._id || paymentModalPurchase.id;
    const currentRemaining =
      paymentModalPurchase.remainingAmount !== undefined
        ? Number(paymentModalPurchase.remainingAmount)
        : Math.max(
            0,
            (Number(
              paymentModalPurchase.totalAmount || paymentModalPurchase.total
            ) || 0) -
              (Number(paymentModalPurchase.amountPaid) || 0)
          );

    const amountNum = Number(paymentAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      showToast("Please enter a valid payment amount greater than 0", "error");
      return;
    }

    if (amountNum > currentRemaining + 0.01) {
      showToast(
        `Payment amount (₹${amountNum}) cannot exceed remaining balance of ₹${currentRemaining.toLocaleString(
          "en-IN"
        )}`,
        "error"
      );
      return;
    }

    setRecordingPayment(true);
    try {
      const response = await markPurchaseAsPaid(purchaseId, {
        amount: amountNum,
        paymentMethod: paymentMode,
        paymentDate,
        referenceNo: paymentRefNo,
        notes: paymentNotes,
      });

      const updatedPurchase = response?.purchase;

      setPurchaseList((prev) =>
        prev.map((p) =>
          (p._id || p.id) === purchaseId ? updatedPurchase || p : p
        )
      );

      showToast(
        `Payment of ₹${amountNum.toLocaleString(
          "en-IN"
        )} recorded successfully!`,
        "success"
      );
      handleClosePaymentModal();
      await loadData();
    } catch (err) {
      console.error("RECORD PURCHASE PAYMENT ERROR:", err);
      showToast(
        err.response?.data?.message ||
          err.message ||
          "Failed to record payment",
        "error"
      );
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleDeletePurchase = async (purchaseId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this purchase bill? This will automatically reverse the added inventory stock and supplier credit balance."
      )
    ) {
      return;
    }
    try {
      await deletePurchase(purchaseId);
      showToast("Purchase bill deleted and stock reversed successfully!", "success");
      window.dispatchEvent(new CustomEvent("stockUpdated"));
      window.dispatchEvent(new CustomEvent("productUpdated"));
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || "Failed to delete purchase", "error");
    }
  };


  const handleSavePurchase = async () => {
    if (!supplier) {
      showToast("Please select a supplier", "error");
      return;
    }
    if (!purchaseDate) {
      showToast("Please select a purchase date", "error");
      return;
    }

    const validItems = [];
    for (const item of items) {
      if (!item.product) {
        showToast("Please select a product for all rows", "error");
        return;
      }
      const qty = Number(item.qty);
      if (!Number.isFinite(qty) || qty <= 0) {
        showToast(
          `Quantity for "${item.product}" must be greater than 0`,
          "error"
        );
        return;
      }
      const rate = Number(item.rate);
      if (!Number.isFinite(rate) || rate < 0) {
        showToast(
          `Purchase rate for "${item.product}" cannot be negative`,
          "error"
        );
        return;
      }
      const disc = Number(item.discount || 0);
      if (disc < 0) {
        showToast(
          `Discount for "${item.product}" cannot be negative`,
          "error"
        );
        return;
      }
      if (disc > qty * rate) {
        showToast(
          `Discount for "${item.product}" cannot exceed total item price`,
          "error"
        );
        return;
      }

      validItems.push({
        productId: item.productId,
        productName: item.product,
        quantity: qty,
        unit: item.unit || "pcs",
        purchaseRate: rate,
        gstRate: Number(item.gstRate) || 0,
        gstAmount: item.gstAmount,
        discount: disc,
        itemAmount: item.amount,
        hsnCode: item.hsnCode ? String(item.hsnCode).trim() : "",
        batchNo: item.batchNo ? String(item.batchNo).trim() : "",
        expiryDate: item.expiryDate || null,
        itcEligible: item.itcEligible !== false,
      });
    }

    if (validItems.length === 0) {
      showToast("Please add at least one product", "error");
      return;
    }

    if (paymentStatus === "Partially Paid") {
      const paid = Number(amountPaidInput);
      if (!Number.isFinite(paid) || paid <= 0) {
        showToast(
          "Enter amount paid for Partially Paid status",
          "error"
        );
        return;
      }
      if (paid > totalAmount) {
        showToast(
          "Amount paid cannot exceed total purchase amount",
          "error"
        );
        return;
      }
    }

    const selectedSupplierObj = supplierList.find((s) => s.name === supplier);

    const payload = {
      supplierId: selectedSupplierObj?._id || selectedSupplierObj?.id || null,
      supplierName: supplier,
      supplierInvoiceNo,
      purchaseOrderNo,
      eWayBillNo,
      taxType,
      itcEligible,
      purchaseDate,
      dueDate: dueDate || null,
      items: validItems,
      subtotal,
      gstTotal: totalGst,
      discountTotal: totalDiscount,
      totalAmount,
      paymentStatus,
      paymentMethod: ["Paid", "Partially Paid"].includes(paymentStatus)
        ? paymentMethod
        : "Cash",
      amountPaid,
      remainingAmount,
      notes,
    };

    setSaving(true);
    try {
      await createPurchase(payload);
      showToast("Purchase saved successfully!", "success");
      window.dispatchEvent(new CustomEvent("stockUpdated"));
      window.dispatchEvent(new CustomEvent("purchaseCreated", { detail: payload }));
      resetForm();
      await loadData();
      setActiveTab("history");
    } catch (err) {
      console.error("SAVE PURCHASE ERROR:", err);
      showToast(
        err.response?.data?.message || err.message || "Failed to save purchase",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  // Return Modal Openers
  const openReturnModalForPurchase = (purchase) => {
    setReturnPurchaseId(purchase._id || purchase.id);
    setReturnSupplierId(purchase.supplierId || null);
    setReturnSupplier(purchase.supplierName || purchase.supplier || "");
    setReturnInvoiceNo(purchase.supplierInvoiceNo || purchase.invoiceNo || "");
    setReturnDate(new Date().toISOString().slice(0, 10));
    setReturnSettlementType("Adjust from Supplier Balance");
    setReturnNotes("");

    if (Array.isArray(purchase.items) && purchase.items.length > 0) {
      setReturnItems(
        purchase.items.map((it) => {
          const qty = Number(it.quantity || it.qty || 1);
          const rate = Number(it.purchaseRate || it.rate || 0);
          const gstR = Number(it.gstRate || it.gst || 0);
          const base = qty * rate;
          return {
            productId: it.productId || null,
            productName: it.productName || it.product || "",
            quantity: String(qty),
            maxQuantity: qty,
            unit: it.unit || "pcs",
            purchaseRate: String(rate),
            gstRate: gstR,
            gstAmount: base * (gstR / 100),
            itemAmount: base,
            reason: "Damaged / Defective",
            condition: "Damaged",
          };
        })
      );
    } else {
      setReturnItems([
        {
          productId: null,
          productName: "",
          quantity: "1",
          maxQuantity: null,
          unit: "pcs",
          purchaseRate: "0",
          gstRate: 18,
          gstAmount: 0,
          itemAmount: 0,
          reason: "Damaged / Defective",
          condition: "Damaged",
        },
      ]);
    }
    setShowReturnModal(true);
  };

  const openNewBlankReturnModal = () => {
    setReturnPurchaseId(null);
    setReturnSupplierId(null);
    setReturnSupplier(supplierList[0]?.name || "");
    setReturnInvoiceNo("");
    setReturnDate(new Date().toISOString().slice(0, 10));
    setReturnSettlementType("Adjust from Supplier Balance");
    setReturnNotes("");
    setReturnItems([
      {
        productId: null,
        productName: "",
        quantity: "1",
        maxQuantity: null,
        unit: "pcs",
        purchaseRate: "0",
        gstRate: 18,
        gstAmount: 0,
        itemAmount: 0,
        reason: "Damaged / Defective",
        condition: "Damaged",
      },
    ]);
    setShowReturnModal(true);
  };

  const updateReturnItem = (index, field, value) => {
    setReturnItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const next = { ...item, [field]: value };

        if (field === "productName") {
          const selected = productList.find(
            (p) => p.name === value || (p._id || p.id) === value
          );
          if (selected) {
            next.productId = selected._id || selected.id;
            next.productName = selected.name;
            next.unit = selected.unit || "pcs";
            next.purchaseRate = String(
              selected.cost !== undefined && selected.cost > 0
                ? selected.cost
                : selected.price || 0
            );
            next.gstRate = selected.gst !== undefined ? selected.gst : 18;
          }
        }

        const qty = parseFloat(next.quantity) || 0;
        const rate = parseFloat(next.purchaseRate) || 0;
        const gstR = Number(next.gstRate) || 0;

        const baseAmount = qty * rate;
        const calculatedGst = baseAmount * (gstR / 100);

        next.itemAmount = baseAmount;
        next.gstAmount = calculatedGst;

        return next;
      })
    );
  };

  const addReturnItemRow = () => {
    setReturnItems((prev) => [
      ...prev,
      {
        productId: null,
        productName: "",
        quantity: "1",
        maxQuantity: null,
        unit: "pcs",
        purchaseRate: "0",
        gstRate: 18,
        gstAmount: 0,
        itemAmount: 0,
        reason: "Damaged / Defective",
        condition: "Damaged",
      },
    ]);
  };

  const removeReturnItemRow = (index) => {
    if (returnItems.length <= 1) return;
    setReturnItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Return calculation summaries
  const returnSubtotal = useMemo(() => {
    return returnItems.reduce(
      (sum, item) => sum + (Number(item.itemAmount) || 0),
      0
    );
  }, [returnItems]);

  const returnGstTotal = useMemo(() => {
    return returnItems.reduce(
      (sum, item) => sum + (Number(item.gstAmount) || 0),
      0
    );
  }, [returnItems]);

  const totalReturnAmount = useMemo(() => {
    return returnSubtotal + returnGstTotal;
  }, [returnSubtotal, returnGstTotal]);

  const handleSavePurchaseReturn = async () => {
    if (!returnSupplier || !returnSupplier.trim()) {
      showToast("Please select a supplier for the return.", "error");
      return;
    }
    if (returnItems.length === 0) {
      showToast("At least one product item is required for return.", "error");
      return;
    }

    const invalidItem = returnItems.find(
      (it) => !it.productName || Number(it.quantity) <= 0 || Number(it.purchaseRate) < 0
    );
    if (invalidItem) {
      showToast(
        "Please provide a valid product name, return quantity (> 0), and rate for all return items.",
        "error"
      );
      return;
    }

    const payload = {
      purchaseId: returnPurchaseId || null,
      supplierId: returnSupplierId || null,
      supplierName: returnSupplier.trim(),
      supplierInvoiceNo: returnInvoiceNo.trim(),
      returnDate,
      items: returnItems.map((it) => ({
        productId: it.productId || null,
        productName: it.productName.trim(),
        quantity: Number(it.quantity),
        unit: it.unit || "pcs",
        purchaseRate: Number(it.purchaseRate),
        gstRate: Number(it.gstRate) || 0,
        reason: it.reason || "Damaged / Defective",
        condition: it.condition || "Damaged",
      })),
      subtotal: returnSubtotal,
      gstTotal: returnGstTotal,
      totalReturnAmount,
      settlementType: returnSettlementType,
      notes: returnNotes.trim(),
    };

    setSavingReturn(true);
    try {
      const res = await createPurchaseReturn(payload);
      showToast("Purchase Return (Debit Note) created successfully!", "success");
      setShowReturnModal(false);
      window.dispatchEvent(new CustomEvent("stockUpdated"));
      window.dispatchEvent(new CustomEvent("purchaseReturnCreated", { detail: res }));
      await loadData();
      setActiveTab("returns");
      if (res?.purchaseReturn) {
        setActiveDebitNote(res.purchaseReturn);
      }
    } catch (err) {
      console.error("SAVE PURCHASE RETURN ERROR:", err);
      showToast(
        err.response?.data?.message ||
          err.message ||
          "Failed to process purchase return",
        "error"
      );
    } finally {
      setSavingReturn(false);
    }
  };

  // Filtered purchases for History tab
  const filteredPurchases = useMemo(() => {
    return purchaseList.filter((purchase) => {
      const q = searchHistory.toLowerCase();
      const inv = (
        purchase.supplierInvoiceNo ||
        purchase.invoiceNo ||
        purchase._id ||
        ""
      ).toLowerCase();
      const supp = (
        purchase.supplierName ||
        purchase.supplier ||
        ""
      ).toLowerCase();
      const po = (purchase.purchaseOrderNo || "").toLowerCase();

      const searchMatch =
        inv.includes(q) || supp.includes(q) || po.includes(q);

      let dateMatch = true;
      if (filterMonth) {
        const pDate = purchase.purchaseDate || purchase.date || "";
        dateMatch = pDate.startsWith(filterMonth);
      }

      return searchMatch && dateMatch;
    });
  }, [purchaseList, searchHistory, filterMonth]);

  // Filtered purchase returns
  const filteredReturns = useMemo(() => {
    return purchaseReturnsList.filter((ret) => {
      const q = searchReturns.toLowerCase();
      const dn = (ret.debitNoteNo || "").toLowerCase();
      const supp = (ret.supplierName || "").toLowerCase();
      const inv = (ret.supplierInvoiceNo || "").toLowerCase();
      const hasItem = (ret.items || []).some((it) =>
        (it.productName || "").toLowerCase().includes(q)
      );

      const searchMatch =
        dn.includes(q) || supp.includes(q) || inv.includes(q) || hasItem;

      let reasonMatch = true;
      if (filterReturnReason) {
        reasonMatch = (ret.items || []).some(
          (it) => it.reason === filterReturnReason
        );
      }

      return searchMatch && reasonMatch;
    });
  }, [purchaseReturnsList, searchReturns, filterReturnReason]);

  // KPI calculations for Returns tab
  const totalReturnsValue = useMemo(() => {
    return purchaseReturnsList.reduce(
      (sum, r) => sum + (Number(r.totalReturnAmount) || 0),
      0
    );
  }, [purchaseReturnsList]);

  const totalReturnedItemsCount = useMemo(() => {
    return purchaseReturnsList.reduce((sum, r) => {
      const itemCount = (r.items || []).reduce(
        (isum, it) => isum + (Number(it.quantity) || 0),
        0
      );
      return sum + itemCount;
    }, 0);
  }, [purchaseReturnsList]);

  const damagedItemsCount = useMemo(() => {
    return purchaseReturnsList.reduce((sum, r) => {
      const dCount = (r.items || []).reduce((isum, it) => {
        return (
          isum +
          (it.reason === "Damaged / Defective" || it.condition === "Damaged"
            ? Number(it.quantity) || 0
            : 0)
        );
      }, 0);
      return sum + dCount;
    }, 0);
  }, [purchaseReturnsList]);

  return (
    <div className="space-y-4">
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* ── Page Header & Simple Tabs ── */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab("entry")}
            className={`pb-2.5 text-sm font-semibold transition-colors cursor-pointer border-b-2 -mb-[9px] ${
              activeTab === "entry"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            New Purchase
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-2.5 text-sm font-semibold transition-colors cursor-pointer border-b-2 -mb-[9px] flex items-center gap-1.5 ${
              activeTab === "history"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span>Purchase History</span>
            <span className="text-xs px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
              {purchaseList.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("returns")}
            className={`pb-2.5 text-sm font-semibold transition-colors cursor-pointer border-b-2 -mb-[9px] flex items-center gap-1.5 ${
              activeTab === "returns"
                ? "border-amber-600 text-amber-600 dark:text-amber-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span>Purchase Returns (Debit Notes)</span>
            <span className="text-xs px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-mono font-bold">
              {purchaseReturnsList.length}
            </span>
          </button>
        </div>
      </div>

      {activeTab === "entry" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── Left Column: Details & Items ── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Purchase Details Form */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                  Supplier & Bill Details
                </h3>
                <button
                  type="button"
                  onClick={() => setShowMoreVendorDetails(!showMoreVendorDetails)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer"
                >
                  <span>{showMoreVendorDetails ? "Hide More Options" : "+ More Options"}</span>
                  {showMoreVendorDetails ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Main Clean Fields (4 items) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Supplier */}
                <div className="sm:col-span-1 lg:col-span-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Supplier / Vendor <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
                  >
                    <option value="">Select Supplier</option>
                    {supplierList.map((s) => (
                      <option key={s._id || s.id} value={s.name}>
                        {s.name} {s.gstin || s.gst ? `[${s.gstin || s.gst}]` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Supplier Invoice No */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Supplier Bill #
                  </label>
                  <input
                    type="text"
                    value={supplierInvoiceNo}
                    onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                    placeholder="e.g. TAX/2026/01"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                {/* Purchase Date */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Invoice Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Payment Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Collapsible More Options */}
              {showMoreVendorDetails && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 p-3 rounded-lg animate-fadeIn">
                  {/* Purchase Order No */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Purchase Order (PO) #
                    </label>
                    <input
                      type="text"
                      value={purchaseOrderNo}
                      onChange={(e) => setPurchaseOrderNo(e.target.value)}
                      placeholder="e.g. PO-2026-001"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  {/* E-Way Bill No */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      E-Way Bill # (Optional)
                    </label>
                    <input
                      type="text"
                      value={eWayBillNo}
                      onChange={(e) => setEWayBillNo(e.target.value)}
                      placeholder="e.g. 1210-9842-1100"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  {/* Tax Regime */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Tax Type / Regime
                    </label>
                    <select
                      value={taxType}
                      onChange={(e) => setTaxType(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    >
                      <option value="GST Regular">GST Regular (Standard)</option>
                      <option value="RCM">RCM (Reverse Charge)</option>
                      <option value="SEZ / Zero-Rated">SEZ / Zero-Rated</option>
                      <option value="Exempt">Exempt / Non-GST</option>
                    </select>
                  </div>

                  {/* ITC Toggle */}
                  <div className="flex flex-col justify-center">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Input Tax Credit (ITC)
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer mt-0.5">
                      <input
                        type="checkbox"
                        checked={itcEligible}
                        onChange={(e) => setItcEligible(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                      <span className="ml-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {itcEligible ? "ITC Eligible (GSTR-2B)" : "ITC Ineligible"}
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Products Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    Items & Pricing
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    ({items.length} item{items.length !== 1 ? "s" : ""})
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowBatchCols(!showBatchCols)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer shadow-2xs ${
                      showBatchCols
                        ? "bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{showBatchCols ? "Hide Batch / HSN" : "+ Batch & Expiry"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowImportBillModal(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-100 transition-colors cursor-pointer shadow-2xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Import Bill (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQuickAddProductModal(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Quick Add Product</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                      <th className="pb-2.5 min-w-[220px]">Product / Item *</th>
                      {showBatchCols && (
                        <>
                          <th className="pb-2.5 w-20">HSN</th>
                          <th className="pb-2.5 w-24">Batch #</th>
                          <th className="pb-2.5 w-24">Expiry</th>
                        </>
                      )}
                      <th className="pb-2.5 w-24 text-center">Qty *</th>
                      <th className="pb-2.5 w-24 text-right">Rate (₹) *</th>
                      <th className="pb-2.5 w-20 text-center">GST %</th>
                      <th className="pb-2.5 w-20 text-right">Disc (₹)</th>
                      <th className="pb-2.5 w-24 text-right">Amount (₹)</th>
                      <th className="pb-2.5 w-8 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 align-top">
                        {/* Product Search & WAC Impact Preview */}
                        <td className="py-2.5 pr-2">
                          <div className="relative">
                            <input
                              type="text"
                              list={`purchase-prod-datalist-${i}`}
                              value={item.product}
                              onChange={(e) =>
                                updateItem(i, "product", e.target.value)
                              }
                              placeholder="Type or select product..."
                              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium placeholder-slate-400"
                            />
                            <datalist id={`purchase-prod-datalist-${i}`}>
                              {productList.map((p) => (
                                <option key={p._id || p.id} value={p.name}>
                                  {p.sku ? `[${p.sku}] ` : ""}(Stock: {p.stock} {p.unit || "pcs"}) - ₹{p.cost || p.price || 0}
                                </option>
                              ))}
                            </datalist>
                          </div>
                          {(() => {
                            const trimmedName = String(item.product || "").trim();
                            if (!trimmedName) return null;
                            const matchedProduct = productList.find(
                              (p) =>
                                (item.productId && (p._id === item.productId || p.id === item.productId)) ||
                                (p.name && p.name.trim().toLowerCase() === trimmedName.toLowerCase())
                            );
                            if (matchedProduct) {
                              const curStock = Math.max(0, Number(matchedProduct.stock || 0));
                              const curCost = Number(matchedProduct.cost || 0);
                              const inQty = Number(item.qty || 0);
                              const inRate = Number(item.rate || 0);
                              const wac = (curStock + inQty > 0 && inRate > 0)
                                ? Math.round((((curStock * curCost) + (inQty * inRate)) / (curStock + inQty)) * 100) / 100
                                : inRate > 0 ? inRate : curCost;
                              const diffPercent = curCost > 0 ? (((wac - curCost) / curCost) * 100).toFixed(1) : 0;

                              return (
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-[10px]">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    Stock: <strong className="font-mono">{curStock}</strong> ➔ <strong className="text-emerald-600 font-mono">{curStock + inQty}</strong> {matchedProduct.unit || "Piece"}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                                    Cost: ₹{curCost} ➔ <strong>New WAC: ₹{wac.toFixed(2)}</strong> {diffPercent !== "0.0" && diffPercent !== 0 && `(${Number(diffPercent) > 0 ? "+" : ""}${diffPercent}%)`}
                                  </span>
                                </div>
                              );
                            } else {
                              return (
                                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                                  <Sparkles className="w-3 h-3" />
                                  <span>New item (auto-cataloged at ₹{Number(item.rate || 0)})</span>
                                </div>
                              );
                            }
                          })()}
                        </td>

                        {/* Optional HSN Code */}
                        {showBatchCols && (
                          <td className="py-2.5 px-1">
                            <input
                              type="text"
                              value={item.hsnCode || ""}
                              onChange={(e) => updateItem(i, "hsnCode", e.target.value)}
                              placeholder="HSN"
                              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-1.5 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-mono placeholder-slate-400"
                            />
                          </td>
                        )}

                        {/* Optional Batch No */}
                        {showBatchCols && (
                          <td className="py-2.5 px-1">
                            <input
                              type="text"
                              value={item.batchNo || ""}
                              onChange={(e) => updateItem(i, "batchNo", e.target.value)}
                              placeholder="Batch #"
                              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-1.5 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-mono placeholder-slate-400"
                            />
                          </td>
                        )}

                        {/* Optional Expiry Date */}
                        {showBatchCols && (
                          <td className="py-2.5 px-1">
                            <input
                              type="date"
                              value={item.expiryDate ? item.expiryDate.slice(0, 10) : ""}
                              onChange={(e) => updateItem(i, "expiryDate", e.target.value)}
                              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-1 py-1.5 text-[11px] text-slate-900 dark:text-white outline-none focus:border-blue-500"
                            />
                          </td>
                        )}

                        {/* Qty */}
                        <td className="py-2.5 px-1">
                          <StepperInput
                            min={1}
                            value={item.qty}
                            onChange={(val) => updateItem(i, "qty", val)}
                            inputClassName="w-14 py-1.5 font-mono text-center"
                          />
                        </td>

                        {/* Rate */}
                        <td className="py-2.5 px-1">
                          <input
                            type="number"
                            min={0}
                            value={item.rate}
                            onChange={(e) =>
                              updateItem(
                                i,
                                "rate",
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value)
                              )
                            }
                            placeholder="0.00"
                            className="w-full text-right bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-mono"
                          />
                        </td>

                        {/* GST % */}
                        <td className="py-2.5 px-1">
                          <select
                            value={item.gstRate}
                            onChange={(e) =>
                              updateItem(i, "gstRate", Number(e.target.value))
                            }
                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 text-center font-mono cursor-pointer"
                          >
                            {GST_RATES.map((g) => (
                              <option key={g.value} value={g.value}>
                                {g.value}%
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Discount */}
                        <td className="py-2.5 px-1">
                          <input
                            type="number"
                            min={0}
                            value={item.discount}
                            onChange={(e) =>
                              updateItem(
                                i,
                                "discount",
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value)
                              )
                            }
                            placeholder="0"
                            className="w-full text-right bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-mono"
                          />
                        </td>

                        {/* Amount */}
                        <td className="py-2.5 pl-2 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {fmt(item.amount)}
                        </td>

                        {/* Delete */}
                        <td className="py-2.5 pl-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeItemRow(i)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Row */}
              <div className="mt-3 pt-2">
                <button
                  type="button"
                  onClick={addItemRow}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Product Row</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Right Column: Payment & Tax Summary ── */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-4">
                Tax & Payment Summary
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Taxable Subtotal</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 font-medium">
                    {fmt(subtotal)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Total Inward GST</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                    + {fmt(totalGst)}
                  </span>
                </div>

                {totalDiscount > 0 && (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Discount</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400 font-medium">
                      - {fmt(totalDiscount)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-3 text-sm font-bold text-slate-900 dark:text-white">
                  <span>Gross Invoice Total</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">
                    {fmt(totalAmount)}
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                {/* Payment Status */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  >
                    <option value="Unpaid">Unpaid</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>

                {/* Payment Mode */}
                {["Paid", "Partially Paid"].includes(paymentStatus) && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    >
                      {(purchasePaymentMethods.length > 0
                        ? purchasePaymentMethods
                        : ["Cash", "Bank Transfer", "Cheque / DD", "Credit / Debit Card"]
                      ).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Partially Paid Section */}
                {paymentStatus === "Partially Paid" && (
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Amount Paid (₹) *
                    </label>
                    <input
                      type="number"
                      value={amountPaidInput}
                      onChange={(e) => setAmountPaidInput(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-mono outline-none focus:border-blue-500"
                    />
                    <div className="flex justify-between text-xs font-semibold pt-1 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-slate-600 dark:text-slate-400">Remaining:</span>
                      <span className="font-mono text-red-600 dark:text-red-400">
                        {fmt(remainingAmount)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any internal note..."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-blue-500"
                  />
                </div>

                {/* Save Button */}
                <button
                  type="button"
                  onClick={handleSavePurchase}
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Purchase</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "history" ? (
        /* ── Purchase History Tab ── */
        <PurchaseHistoryTable
          filteredPurchases={filteredPurchases}
          searchHistory={searchHistory}
          setSearchHistory={setSearchHistory}
          filterMonth={filterMonth}
          setFilterMonth={setFilterMonth}
          handleOpenPaymentModal={handleOpenPaymentModal}
          handleOpenSupplierDetails={(p) => setSelectedSupplierPurchase(p)}
          handleOpenReturnModal={openReturnModalForPurchase}
          handleDeletePurchase={handleDeletePurchase}
          fmt={fmt}
        />
      ) : (
        /* ── Purchase Returns / Debit Notes Tab ── */
        <div className="space-y-4">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center border border-amber-200 dark:border-amber-800">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Debit Notes Issued
                </p>
                <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                  {purchaseReturnsList.length}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center border border-rose-200 dark:border-rose-800">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Damaged / Faulty Goods
                </p>
                <p className="text-lg font-bold text-rose-600 dark:text-rose-400 font-mono">
                  {damagedItemsCount} units
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center border border-purple-200 dark:border-purple-800">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Total Items Returned
                </p>
                <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                  {totalReturnedItemsCount} items
                </p>
              </div>
            </div>
          </div>

          {/* Returns Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            {/* Search and Reason Filter */}
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px] max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  value={searchReturns}
                  onChange={(e) => setSearchReturns(e.target.value)}
                  placeholder="Search Debit Note #, supplier, or product..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                  Return Reason:
                </label>
                <select
                  value={filterReturnReason}
                  onChange={(e) => setFilterReturnReason(e.target.value)}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                >
                  <option value="">All Reasons</option>
                  {RETURN_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {filterReturnReason && (
                  <button
                    onClick={() => setFilterReturnReason("")}
                    className="text-xs text-amber-600 hover:underline whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}

                <button
                  onClick={openNewBlankReturnModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer ml-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ New Return</span>
                </button>
              </div>
            </div>

            {filteredReturns.length === 0 ? (
              <div className="py-14 text-center space-y-3">
                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No Purchase Returns / Debit Notes recorded yet
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  If products received from your supplier are damaged or faulty, you can return them to adjust your balance and deduct stock.
                </p>
                <button
                  onClick={openNewBlankReturnModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create First Purchase Return</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-semibold">
                      <th className="px-4 py-3">Debit Note #</th>
                      <th className="px-4 py-3">Return Date</th>
                      <th className="px-4 py-3">Supplier & Invoice</th>
                      <th className="px-4 py-3">Returned Items & Reason</th>
                      <th className="px-4 py-3">Settlement</th>
                      <th className="px-4 py-3 text-right">Subtotal</th>
                      <th className="px-4 py-3 text-right">GST Reversal</th>
                      <th className="px-4 py-3 text-right">Debit Total</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredReturns.map((ret) => {
                      const dateStr = ret.returnDate
                        ? new Date(ret.returnDate).toISOString().slice(0, 10)
                        : "-";

                      return (
                        <tr
                          key={ret._id || ret.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/30"
                        >
                          <td className="px-4 py-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                            {ret.debitNoteNo}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono">
                            {dateStr}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {ret.supplierName}
                            </p>
                            {ret.supplierInvoiceNo && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                Ref Bill: #{ret.supplierInvoiceNo}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1 max-w-xs">
                              {(ret.items || []).map((it, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-1.5 flex-wrap"
                                >
                                  <span className="font-medium text-slate-800 dark:text-slate-200">
                                    {it.productName} ({it.quantity} {it.unit || "pcs"})
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                      it.reason === "Damaged / Defective" ||
                                      it.condition === "Damaged"
                                        ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                    }`}
                                  >
                                    {it.reason || "Return"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {ret.settlementType || "Balance Adjusted"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300 text-right">
                            {fmt(ret.subtotal || 0)}
                          </td>
                          <td className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-400 text-right">
                            {fmt(ret.gstTotal || 0)}
                          </td>
                          <td className="px-4 py-3 font-bold text-amber-700 dark:text-amber-300 font-mono text-right text-sm">
                            {fmt(ret.totalReturnAmount || 0)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => setActiveDebitNote(ret)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition-colors cursor-pointer shadow-sm"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View Note</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SUPPLIER & PURCHASE PAYMENT DETAILS MODAL ── */}
      {selectedSupplierPurchase && (
        <PurchaseSupplierDetailsModal
          purchase={selectedSupplierPurchase}
          onClose={() => setSelectedSupplierPurchase(null)}
          onOpenPaymentModal={(p) => {
            setSelectedSupplierPurchase(null);
            handleOpenPaymentModal(p);
          }}
          onPurchaseUpdated={(updatedPurchase) => {
            setSelectedSupplierPurchase(updatedPurchase);
            setPurchaseList((prev) =>
              prev.map((p) =>
                (p._id || p.id) === (updatedPurchase._id || updatedPurchase.id)
                  ? updatedPurchase
                  : p
              )
            );
          }}
          fmt={fmt}
        />
      )}

      {/* ── PROFESSIONAL RECORD SUPPLIER PAYMENT MODAL ── */}
      {paymentModalPurchase && (() => {
        const total = Number(paymentModalPurchase.totalAmount || paymentModalPurchase.total) || 0;
        const paidSoFar = Number(paymentModalPurchase.amountPaid) || 0;
        const currentDue = paymentModalPurchase.remainingAmount !== undefined
          ? Number(paymentModalPurchase.remainingAmount)
          : Math.max(0, total - paidSoFar);

        const enteredAmount = Number(paymentAmount) || 0;
        const remainingAfterPayment = Math.max(0, currentDue - enteredAmount);
        const isFullPayment = enteredAmount >= currentDue && currentDue > 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col"
              style={{ animation: "scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Record Supplier Payment</h3>
                    <p className="text-xs text-blue-100">
                      Invoice #{paymentModalPurchase.supplierInvoiceNo || paymentModalPurchase.purchaseOrderNo || paymentModalPurchase._id?.slice(-6) || "Bill"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClosePaymentModal}
                  disabled={recordingPayment}
                  className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleConfirmPayment} className="p-6 space-y-5">
                {/* Supplier & Due Summary Card */}
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-700/60">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-500" />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Supplier
                      </span>
                    </div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {paymentModalPurchase.supplierName || paymentModalPurchase.supplier || "Supplier"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">Total Bill</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono mt-0.5">
                        {fmt(total)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">Paid So Far</p>
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                        {fmt(paidSoFar)}
                      </p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950/40 rounded-lg py-1 border border-red-100 dark:border-red-900/30">
                      <p className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400">Current Due</p>
                      <p className="text-xs font-black text-red-600 dark:text-red-400 font-mono mt-0.5">
                        {fmt(currentDue)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Amount Input with Quick Full Pay Button */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Payment Amount (₹) <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(String(currentDue))}
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Pay Full Due ({fmt(currentDue)})
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      max={currentDue}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono font-bold text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  {/* Real-time remaining preview */}
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                      Remaining after payment:
                    </span>
                    <span className={`font-mono font-bold ${isFullPayment ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                      {isFullPayment ? "₹0.00 (Fully Cleared ✓)" : fmt(remainingAfterPayment)}
                    </span>
                  </div>
                </div>

                {/* Payment Method & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Payment Mode
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      {purchasePaymentMethods.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Payment Date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Transaction Ref & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Ref / Cheque / UPI No. <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TXN987214"
                      value={paymentRefNo}
                      onChange={(e) => setPaymentRefNo(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Payment Notes <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cleared 50% advance"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleClosePaymentModal}
                    disabled={recordingPayment}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={recordingPayment || enteredAmount <= 0}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {recordingPayment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Recording...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Confirm Payment ({enteredAmount > 0 ? fmt(enteredAmount) : "₹0"})</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ── QUICK ADD NEW PRODUCT MODAL ── */}
      {showQuickAddProductModal && (
        <Modal
          title="Quick Add New Product"
          onClose={() => {
            setShowQuickAddProductModal(false);
          }}
        >
          <form onSubmit={handleQuickAddProduct} className="space-y-4">
            <Input
              label="Product Name *"
              placeholder="e.g. Wireless Ergonomic Mouse"
              value={quickProductForm.name}
              onChange={(v) => setQuickProductForm((f) => ({ ...f, name: v }))}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="SKU / Barcode"
                placeholder="Auto-generated if empty"
                value={quickProductForm.sku}
                onChange={(v) => setQuickProductForm((f) => ({ ...f, sku: v }))}
              />
              <Input
                label="Category"
                placeholder="e.g. Electronics, Hardware"
                value={quickProductForm.category}
                onChange={(v) => setQuickProductForm((f) => ({ ...f, category: v }))}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Purchase Cost (₹)"
                type="number"
                placeholder="0"
                value={quickProductForm.cost}
                onChange={(v) => setQuickProductForm((f) => ({ ...f, cost: v }))}
              />
              <Input
                label="Selling Price (₹)"
                type="number"
                placeholder="0"
                value={quickProductForm.price}
                onChange={(v) => setQuickProductForm((f) => ({ ...f, price: v }))}
              />
              <GstRateSelect
                label="GST Rate"
                value={quickProductForm.gst}
                onChange={(v) => setQuickProductForm((f) => ({ ...f, gst: v }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Unit"
                placeholder="Piece, Box, Kg, Liter..."
                value={quickProductForm.unit}
                onChange={(v) => setQuickProductForm((f) => ({ ...f, unit: v }))}
              />
              <Input
                label="Min. Stock Level"
                type="number"
                placeholder="10"
                value={quickProductForm.minStock}
                onChange={(v) => setQuickProductForm((f) => ({ ...f, minStock: v }))}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Btn
                variant="outline"
                type="button"
                onClick={() => setShowQuickAddProductModal(false)}
                className="flex-1 justify-center"
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                type="submit"
                disabled={quickProductSaving}
                className="flex-1 justify-center"
                icon={<Plus className="w-4 h-4" />}
              >
                {quickProductSaving ? "Creating..." : "Create & Add to Bill"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* ── IMPORT SUPPLIER BILL / INVOICE MODAL ── */}
      {showImportBillModal && (
        <Modal
          title="Import Supplier Bill / Invoice"
          onClose={() => {
            setShowImportBillModal(false);
            setImportBillFile(null);
            setParsedBillItems([]);
            setBillImportErrors([]);
          }}
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Template Download Banner */}
            <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-emerald-950 text-sm">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Download Supplier Bill Template</span>
                </div>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Template with Product Name, Quantity, Purchase Rate (₹), GST %, and Discount columns.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Btn
                  variant="outline"
                  size="sm"
                  onClick={() => downloadPurchaseInvoiceTemplate("xlsx")}
                  icon={<Download className="w-3.5 h-3.5 text-emerald-600" />}
                  className="bg-white hover:bg-emerald-50 hover:border-emerald-300 text-xs shadow-sm"
                >
                  Excel Template (.xlsx)
                </Btn>
                <Btn
                  variant="outline"
                  size="sm"
                  onClick={() => downloadPurchaseInvoiceTemplate("csv")}
                  icon={<Download className="w-3.5 h-3.5 text-blue-600" />}
                  className="bg-white hover:bg-blue-50 hover:border-blue-300 text-xs shadow-sm"
                >
                  CSV Template (.csv)
                </Btn>
              </div>
            </div>

            {/* File Upload Box */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Upload Supplier Invoice / Bill (.xlsx, .xls, .csv)
              </label>
              <div className="relative border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-slate-50/70 hover:bg-emerald-50/30 rounded-2xl p-4 transition-all text-center">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleBillFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-xs">
                    {importBillFile ? (
                      <span className="font-semibold text-emerald-700 flex items-center justify-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        {importBillFile.name} ({(importBillFile.size / 1024).toFixed(1)} KB)
                      </span>
                    ) : (
                      <>
                        <span className="font-semibold text-slate-700">Click to upload bill spreadsheet</span> or drag and drop
                        <span className="block text-[11px] text-slate-400 mt-0.5">Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Errors if any */}
            {billImportErrors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl max-h-32 overflow-y-auto">
                <p className="text-xs font-bold text-red-700 mb-1">Warnings / Errors ({billImportErrors.length}):</p>
                <ul className="text-[11px] text-red-600 space-y-0.5 list-disc pl-4">
                  {billImportErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Parsed Items Preview */}
            {parsedBillItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    ✓ {parsedBillItems.length} valid item{parsedBillItems.length !== 1 ? "s" : ""} detected from supplier bill:
                  </span>
                  <span className="font-mono text-emerald-700 font-bold">
                    Est. Total: ₹{parsedBillItems.reduce((sum, it) => sum + it.amount + it.gstAmount, 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="max-h-48 overflow-y-auto overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 sticky top-0 font-semibold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="px-3 py-2">Item Name</th>
                          <th className="px-3 py-2 text-center">Qty</th>
                          <th className="px-3 py-2 text-right">Rate (₹)</th>
                          <th className="px-3 py-2 text-center">GST %</th>
                          <th className="px-3 py-2 text-right">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedBillItems.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="px-3 py-2 font-medium text-slate-900 max-w-[180px] truncate">
                              {it.product}
                              {it.isExisting && (
                                <span className="ml-1.5 px-1 py-0.2 rounded text-[9px] bg-blue-50 text-blue-700 border border-blue-200">
                                  Matched
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center font-mono font-semibold text-slate-800">
                              {it.qty} {it.unit}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-700">
                              ₹{it.rate}
                            </td>
                            <td className="px-3 py-2 text-center text-slate-500">
                              {it.gstRate}%
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                              ₹{(it.amount + it.gstAmount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <Btn
                variant="outline"
                onClick={() => {
                  setShowImportBillModal(false);
                  setImportBillFile(null);
                  setParsedBillItems([]);
                  setBillImportErrors([]);
                }}
                className="flex-1 justify-center"
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                disabled={billParsing || parsedBillItems.length === 0}
                onClick={handleApplyImportedBill}
                className="flex-1 justify-center shadow-md shadow-emerald-600/20 bg-emerald-600 hover:bg-emerald-700 text-white"
                icon={<Check className="w-4 h-4" />}
              >
                {billParsing ? "Reading Bill..." : `Load Items into Bill (${parsedBillItems.length})`}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: CREATE PURCHASE RETURN (DEBIT NOTE)
      ───────────────────────────────────────────────────────────── */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-amber-500/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Create Purchase Return (Debit Note)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Deduct damaged/returned inventory stock and adjust supplier ledger balance.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReturnModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Supplier & Reference Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Supplier / Vendor <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={returnSupplier}
                    onChange={(e) => {
                      setReturnSupplier(e.target.value);
                      const sObj = supplierList.find(
                        (s) => s.name === e.target.value
                      );
                      setReturnSupplierId(sObj?._id || sObj?.id || null);
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 font-medium"
                  >
                    <option value="">Select Supplier</option>
                    {supplierList.map((s) => (
                      <option key={s._id || s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Original Bill / Invoice Ref #
                  </label>
                  <input
                    type="text"
                    value={returnInvoiceNo}
                    onChange={(e) => setReturnInvoiceNo(e.target.value)}
                    placeholder="e.g. BILL-9921"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Return Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Items to Return Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    Returned Line Items (Stock will be deducted from Inventory)
                  </label>
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                    ⚠️ Returning stock will decrease current inventory levels.
                  </span>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2.5 min-w-[200px]">Product / Item</th>
                        <th className="p-2.5 w-24 text-center">Return Qty</th>
                        <th className="p-2.5 w-28 text-right">Purchase Rate (₹)</th>
                        <th className="p-2.5 w-20 text-center">GST %</th>
                        <th className="p-2.5 min-w-[150px]">Return Reason</th>
                        <th className="p-2.5 min-w-[130px]">Condition</th>
                        <th className="p-2.5 w-28 text-right">Total (₹)</th>
                        <th className="p-2.5 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {returnItems.map((item, i) => (
                        <tr
                          key={i}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={item.productName}
                              onChange={(e) =>
                                updateReturnItem(i, "productName", e.target.value)
                              }
                              list={`return-products-${i}`}
                              placeholder="Type or select product..."
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 font-medium"
                            />
                            <datalist id={`return-products-${i}`}>
                              {productList.map((p) => (
                                <option key={p._id || p.id} value={p.name}>
                                  Stock: {p.stock} | Cost: ₹{p.cost || p.price}
                                </option>
                              ))}
                            </datalist>
                          </td>

                          <td className="p-2.5">
                            <input
                              type="number"
                              min="1"
                              max={item.maxQuantity || undefined}
                              value={item.quantity}
                              onChange={(e) =>
                                updateReturnItem(i, "quantity", e.target.value)
                              }
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-white font-mono text-center outline-none focus:border-amber-500"
                            />
                            {item.maxQuantity !== null && item.maxQuantity !== undefined && (
                              <span className="text-[10px] text-slate-400 text-center block mt-0.5">
                                max: {item.maxQuantity}
                              </span>
                            )}
                          </td>

                          <td className="p-2.5">
                            <input
                              type="number"
                              min="0"
                              value={item.purchaseRate}
                              onChange={(e) =>
                                updateReturnItem(i, "purchaseRate", e.target.value)
                              }
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-white font-mono text-right outline-none focus:border-amber-500"
                            />
                          </td>

                          <td className="p-2.5">
                            <select
                              value={item.gstRate}
                              onChange={(e) =>
                                updateReturnItem(i, "gstRate", Number(e.target.value))
                              }
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1.5 text-xs text-slate-900 dark:text-white text-center outline-none focus:border-amber-500 cursor-pointer font-mono"
                            >
                              {GST_RATES.map((g) => (
                                <option key={g.value} value={g.value}>
                                  {g.value}%
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="p-2.5">
                            <select
                              value={item.reason}
                              onChange={(e) =>
                                updateReturnItem(i, "reason", e.target.value)
                              }
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                            >
                              {RETURN_REASONS.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="p-2.5">
                            <select
                              value={item.condition}
                              onChange={(e) =>
                                updateReturnItem(i, "condition", e.target.value)
                              }
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                            >
                              {RETURN_CONDITIONS.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="p-2.5 text-right font-mono font-bold text-amber-700 dark:text-amber-300">
                            {fmt(item.itemAmount + item.gstAmount)}
                          </td>

                          <td className="p-2.5 text-center">
                            {returnItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeReturnItemRow(i)}
                                className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={addReturnItemRow}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another Item to Return</span>
                </button>
              </div>

              {/* Settlement & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Settlement Mode
                    </label>
                    <select
                      value={returnSettlementType}
                      onChange={(e) => setReturnSettlementType(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 font-medium"
                    >
                      {SETTLEMENT_TYPES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {returnSettlementType === "Adjust from Supplier Balance"
                        ? "✓ Automatically deducts this amount from the supplier's payable ledger."
                        : "✓ Records this return as a refund settlement."}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Notes / Damage Details
                    </label>
                    <textarea
                      rows={2}
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      placeholder="Specify packaging damage, serial numbers, or defect notes..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Return Total Calculation Summary */}
                <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Return Subtotal:</span>
                      <span className="font-mono text-slate-900 dark:text-white font-semibold">
                        {fmt(returnSubtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>GST Reversal:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        +{fmt(returnGstTotal)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-amber-200 dark:border-amber-800 flex justify-between items-baseline mt-3">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Total Debit Note Amount
                      </p>
                      <p className="text-[10px] text-slate-500">
                        (Stock will be deducted)
                      </p>
                    </div>
                    <span className="text-xl font-extrabold font-mono text-amber-700 dark:text-amber-300">
                      {fmt(totalReturnAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePurchaseReturn}
                disabled={savingReturn}
                className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {savingReturn ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Return & Stock Reversal...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Generate Debit Note</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: PRINTABLE GST DEBIT NOTE VOUCHER
      ───────────────────────────────────────────────────────────── */}
      {activeDebitNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[95vh] flex flex-col overflow-hidden">
            {/* Header / Action toolbar */}
            <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Debit Note Voucher: {activeDebitNote.debitNoteNo}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Note</span>
                </button>
                <button
                  onClick={() => setActiveDebitNote(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Voucher Paper */}
            <div
              id="printable-debit-note"
              className="p-8 overflow-y-auto space-y-6 flex-1 bg-white text-slate-900 text-xs font-sans"
            >
              {/* Top Banner */}
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase">
                    DEBIT NOTE / PURCHASE RETURN
                  </h1>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Issued under GST (Section 34 of CGST Act)
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-extrabold text-amber-700">
                    {activeDebitNote.debitNoteNo}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Date:{" "}
                    {activeDebitNote.returnDate
                      ? new Date(activeDebitNote.returnDate)
                          .toISOString()
                          .slice(0, 10)
                      : "-"}
                  </p>
                </div>
              </div>

              {/* Parties Section */}
              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Debit Issued To (Supplier)
                  </p>
                  <p className="font-bold text-slate-900 text-sm">
                    {activeDebitNote.supplierName}
                  </p>
                  {activeDebitNote.supplierInvoiceNo && (
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Against Invoice:{" "}
                      <span className="font-mono font-semibold">
                        #{activeDebitNote.supplierInvoiceNo}
                      </span>
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Settlement & Accounting Details
                  </p>
                  <p className="font-semibold text-slate-800">
                    Mode: {activeDebitNote.settlementType}
                  </p>
                  <p className="text-emerald-700 font-semibold text-[11px] mt-0.5">
                    Status: Settled (Inventory Stock Adjusted)
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full border-collapse border border-slate-200 text-left">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-2 border-r border-slate-200 w-8 text-center">
                      #
                    </th>
                    <th className="p-2 border-r border-slate-200">
                      Product Description
                    </th>
                    <th className="p-2 border-r border-slate-200 w-16 text-center">
                      Qty
                    </th>
                    <th className="p-2 border-r border-slate-200 w-20 text-right">
                      Rate (₹)
                    </th>
                    <th className="p-2 border-r border-slate-200 min-w-[120px]">
                      Reason / Condition
                    </th>
                    <th className="p-2 border-r border-slate-200 w-16 text-center">
                      GST
                    </th>
                    <th className="p-2 text-right w-24">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(activeDebitNote.items || []).map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-2 text-center border-r border-slate-200 font-mono text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-200 font-semibold">
                        {it.productName}
                      </td>
                      <td className="p-2 text-center border-r border-slate-200 font-mono font-bold">
                        {it.quantity} {it.unit || "pcs"}
                      </td>
                      <td className="p-2 text-right border-r border-slate-200 font-mono">
                        {fmt(it.purchaseRate)}
                      </td>
                      <td className="p-2 border-r border-slate-200">
                        <span className="font-semibold text-rose-600 block">
                          {it.reason || "Damaged"}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Condition: {it.condition || "Damaged"}
                        </span>
                      </td>
                      <td className="p-2 text-center border-r border-slate-200 font-mono">
                        {it.gstRate || 0}%
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">
                        {fmt(it.itemAmount + (it.gstAmount || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Financial Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1.5 border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Subtotal:</span>
                    <span className="font-mono font-semibold">
                      {fmt(activeDebitNote.subtotal || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total GST Reversal:</span>
                    <span className="font-mono font-semibold text-emerald-600">
                      {fmt(activeDebitNote.gstTotal || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-300">
                    <span>Net Debit Value:</span>
                    <span className="font-mono text-amber-700">
                      {fmt(activeDebitNote.totalReturnAmount || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {activeDebitNote.notes && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-[11px]">
                  <strong>Remarks / Note:</strong> {activeDebitNote.notes}
                </div>
              )}

              {/* Signature Blocks */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-slate-500 text-[11px]">
                <div>
                  <div className="border-t border-slate-300 pt-1 font-semibold text-slate-700">
                    Authorized Signatory
                  </div>
                  <p className="text-[10px] text-slate-400">SmartBill Business</p>
                </div>
                <div>
                  <div className="border-t border-slate-300 pt-1 font-semibold text-slate-700">
                    Supplier Acknowledgment
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {activeDebitNote.supplierName}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



