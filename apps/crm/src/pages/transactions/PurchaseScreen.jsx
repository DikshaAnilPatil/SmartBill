import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Check,
  Plus,
  Search,
  Trash2,
  Loader2,
  RotateCcw,
  FileText,
  AlertTriangle,
  Printer,
  Eye,
  X,
  DollarSign,
  Package,
  CreditCard,
  Calendar,
} from "lucide-react";
import {
  createPurchase,
  fetchPurchases,
  markPurchaseAsPaid,
  recordPurchasePayment,
  createPurchaseReturn,
  fetchPurchaseReturns,
} from "@shared/api/purchaseAPI";
import { getProducts } from "@shared/api/productAPI";
import { fetchSuppliers } from "@shared/api/supplierAPI";
import { fmt } from "@shared/utils/format";
import { Toast } from "@shared/components/common/ui";

const GST_OPTIONS = [0, 5, 12, 18, 28];
const RETURN_REASONS = [
  "Damaged / Defective",
  "Quality Defect",
  "Wrong Product Delivered",
  "Expired Goods",
  "Excess Stock / Over-delivered",
  "Other",
];
const RETURN_CONDITIONS = ["Damaged", "Faulty", "Opened", "Sealed", "Expired", "Other"];
const SETTLEMENT_TYPES = [
  "Adjust from Supplier Balance",
  "Cash Refund",
  "Bank Transfer",
  "Supplier Credit Note",
];

export default function PurchaseScreen() {
  const [productList, setProductList] = useState([]);
  const [supplierList, setSupplierList] = useState([]);
  const [purchaseList, setPurchaseList] = useState([]);
  const [purchaseReturnsList, setPurchaseReturnsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("entry"); // "entry" | "history" | "returns"

  // Form states for New Purchase
  const [supplier, setSupplier] = useState("");
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [purchaseOrderNo, setPurchaseOrderNo] = useState("");
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
    return [
      "Cash",
      "Bank Transfer",
      "Cheque / DD",
      "Credit / Debit Card",
      "UPI & QR Code",
    ];
  });

  const [dueDate, setDueDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Unpaid");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [notes, setNotes] = useState("");

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
    },
  ]);

  const [searchHistory, setSearchHistory] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all"); // "all" | "due" | "partial" | "cleared"
  const [toast, setToast] = useState(null);

  // Pay Due Modal States (Record Installment or Full Payment on Due Purchase)
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingPurchase, setPayingPurchase] = useState(null);
  const [payAmountInput, setPayAmountInput] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // View Purchase Order Modal State
  const [viewPurchaseModal, setViewPurchaseModal] = useState(null);

  // Purchase Return Modal States
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnSupplier, setReturnSupplier] = useState("");
  const [returnSupplierId, setReturnSupplierId] = useState("");
  const [returnPurchaseId, setReturnPurchaseId] = useState("");
  const [returnInvoiceNo, setReturnInvoiceNo] = useState("");
  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [returnSettlementType, setReturnSettlementType] = useState(
    "Adjust from Supplier Balance"
  );
  const [returnNotes, setReturnNotes] = useState("");
  const [returnItems, setReturnItems] = useState([]);
  const [savingReturn, setSavingReturn] = useState(false);

  // Debit Note View Modal State
  const [activeDebitNote, setActiveDebitNote] = useState(null);
  const [searchReturns, setSearchReturns] = useState("");
  const [filterReturnReason, setFilterReturnReason] = useState("");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load initial data from APIs
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, suppRes, purchRes, retRes] = await Promise.allSettled([
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
      if (retRes.status === "fulfilled") {
        setPurchaseReturnsList(retRes.value?.purchaseReturns || []);
      }
    } catch (err) {
      console.error("Failed to load purchase page data", err);
    } finally {
      setLoading(false);
    }
  }, [supplier]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle reorder auto-fill from Inventory
  useEffect(() => {
    const reorderData = localStorage.getItem("reorderProduct");
    if (reorderData && productList.length > 0) {
      try {
        const p = JSON.parse(reorderData);
        const selectedProduct = productList.find(
          (prod) => prod.name === p.name
        );

        if (selectedProduct) {
          const qty = p.minStock || 10;
          const rate =
            selectedProduct.cost !== undefined && selectedProduct.cost > 0
              ? selectedProduct.cost
              : selectedProduct.price || 0;
          const gstRate =
            selectedProduct.gst !== undefined ? selectedProduct.gst : 18;
          const amount = qty * rate;
          const gstAmount = amount * (gstRate / 100);

          setItems([
            {
              productId: selectedProduct._id || selectedProduct.id || "",
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

  // Update item field and recalculate values for Purchase
  const updateItem = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const next = { ...item, [field]: value };

        if (field === "product") {
          const selected = productList.find(
            (p) => p.name === value || (p._id || p.id) === value
          );
          if (selected) {
            next.productId = selected._id || selected.id;
            next.product = selected.name;
            next.unit = selected.unit || "pcs";
            next.rate =
              selected.cost !== undefined && selected.cost > 0
                ? selected.cost
                : selected.price || 0;
            next.gstRate = selected.gst !== undefined ? selected.gst : 18;
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
      },
    ]);
  };

  const removeItemRow = (index) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Payment Summary calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [items]);

  const totalGst = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + (Number(item.gstAmount) || 0),
      0
    );
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

  const resetForm = () => {
    setSupplier(supplierList[0]?.name || "");
    setSupplierInvoiceNo("");
    setPurchaseOrderNo("");
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
      },
    ]);
  };

  const handleSavePurchase = async () => {
    if (!supplier || !supplier.trim()) {
      showToast("Please select a supplier.", "error");
      return;
    }
    if (!purchaseDate) {
      showToast("Please select a purchase date.", "error");
      return;
    }
    const invalidItem = items.find(
      (item) => !item.product || Number(item.qty) <= 0 || Number(item.rate) < 0
    );
    if (invalidItem) {
      showToast(
        "Please provide a valid product name, quantity (> 0), and rate (≥ 0) for all items.",
        "error"
      );
      return;
    }

    const payload = {
      supplierName: supplier.trim(),
      supplierInvoiceNo: supplierInvoiceNo.trim(),
      purchaseOrderNo: purchaseOrderNo.trim(),
      purchaseDate,
      dueDate: dueDate || null,
      items: items.map((item) => ({
        productId: item.productId || null,
        productName: item.product.trim(),
        quantity: Number(item.qty),
        unit: item.unit || "pcs",
        purchaseRate: Number(item.rate),
        gstRate: Number(item.gstRate) || 0,
        discount: Number(item.discount) || 0,
      })),
      subtotal,
      gstTotal: totalGst,
      totalAmount,
      paymentStatus,
      paymentMethod:
        paymentStatus === "Unpaid" ? "Cash" : paymentMethod,
      amountPaid,
      remainingAmount,
      notes: notes.trim(),
    };

    setSaving(true);
    try {
      await createPurchase(payload);
      showToast("Purchase saved successfully!", "success");
      window.dispatchEvent(new CustomEvent("stockUpdated"));
      window.dispatchEvent(
        new CustomEvent("purchaseCreated", { detail: payload })
      );
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

  const handleMarkAsPaid = async (purchaseId) => {
    try {
      await markPurchaseAsPaid(purchaseId);
      showToast("Purchase payment marked as fully cleared!", "success");
      await loadData();
      if (viewPurchaseModal && (viewPurchaseModal._id === purchaseId || viewPurchaseModal.id === purchaseId)) {
        setViewPurchaseModal((prev) =>
          prev
            ? {
                ...prev,
                paymentStatus: "Paid",
                amountPaid: prev.totalAmount,
                remainingAmount: 0,
              }
            : null
        );
      }
    } catch (err) {
      console.error("MARK PURCHASE PAID ERROR:", err);
      showToast(
        err.response?.data?.message ||
          err.message ||
          "Failed to mark purchase as paid",
        "error"
      );
    }
  };

  const openPayModal = (purchase) => {
    setPayingPurchase(purchase);
    const due =
      purchase.remainingAmount !== undefined && purchase.remainingAmount !== null
        ? Number(purchase.remainingAmount)
        : Math.max(0, Number(purchase.totalAmount || 0) - Number(purchase.amountPaid || 0));
    setPayAmountInput(String(due));
    setPayMethod(purchase.paymentMethod || "Cash");
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayRef("");
    setPayNotes("");
    setShowPayModal(true);
  };

  const handleRecordPaymentSubmit = async () => {
    if (!payingPurchase) return;
    const amount = Number(payAmountInput);
    const due =
      payingPurchase.remainingAmount !== undefined && payingPurchase.remainingAmount !== null
        ? Number(payingPurchase.remainingAmount)
        : Math.max(0, Number(payingPurchase.totalAmount || 0) - Number(payingPurchase.amountPaid || 0));

    if (isNaN(amount) || amount <= 0) {
      showToast("Please enter a valid payment amount greater than 0.", "error");
      return;
    }
    if (amount > due) {
      showToast(`Payment amount cannot exceed remaining due of ${fmt(due)}.`, "error");
      return;
    }

    setSubmittingPayment(true);
    try {
      const res = await recordPurchasePayment(payingPurchase._id || payingPurchase.id, {
        amount,
        paymentMethod: payMethod,
        paymentDate: payDate,
        referenceNo: payRef,
        notes: payNotes,
      });
      showToast(res.message || "Payment recorded successfully!", "success");
      setShowPayModal(false);
      setPayingPurchase(null);
      await loadData();
      if (viewPurchaseModal && (viewPurchaseModal._id === payingPurchase._id || viewPurchaseModal.id === payingPurchase.id)) {
        setViewPurchaseModal(res.purchase || null);
      }
    } catch (err) {
      console.error("RECORD PAYMENT ERROR:", err);
      showToast(err.response?.data?.message || err.message || "Failed to record payment.", "error");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const openViewPurchaseModal = (purchase) => {
    setViewPurchaseModal(purchase);
  };

  // ─────────────────────────────────────────────────────────────
  // PURCHASE RETURN HANDLERS & MODAL SETUP
  // ─────────────────────────────────────────────────────────────

  const openReturnModalForPurchase = (purchase) => {
    setReturnPurchaseId(purchase._id || purchase.id || "");
    setReturnSupplier(purchase.supplierName || purchase.supplier || "");
    setReturnSupplierId(purchase.supplierId || "");
    setReturnInvoiceNo(purchase.supplierInvoiceNo || purchase.invoiceNo || "");
    setReturnDate(new Date().toISOString().slice(0, 10));
    setReturnSettlementType("Adjust from Supplier Balance");
    setReturnNotes(`Return against Invoice #${purchase.supplierInvoiceNo || "Bill"}`);

    const mappedItems = (purchase.items || []).map((it) => {
      const q = Number(it.quantity || it.qty) || 1;
      const r = Number(it.purchaseRate || it.rate) || 0;
      const gst = Number(it.gstRate ?? it.gst) || 0;
      const amt = q * r;
      const gstAmt = amt * (gst / 100);

      return {
        productId: it.productId || it._id || null,
        productName: it.productName || it.product || "Product",
        quantity: String(q),
        maxQuantity: q,
        unit: it.unit || "pcs",
        purchaseRate: String(r),
        gstRate: gst,
        gstAmount: gstAmt,
        itemAmount: amt,
        reason: "Damaged / Defective",
        condition: "Damaged",
      };
    });

    if (mappedItems.length === 0) {
      mappedItems.push({
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
      });
    }

    setReturnItems(mappedItems);
    setShowReturnModal(true);
  };

  const openNewBlankReturnModal = () => {
    setReturnPurchaseId("");
    setReturnSupplier(supplierList[0]?.name || "");
    setReturnSupplierId(supplierList[0]?._id || "");
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
      const q = searchHistory.toLowerCase().trim();
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
      const hasItem = (purchase.items || []).some((it) =>
        (it.productName || it.product || "").toLowerCase().includes(q)
      );

      const searchMatch = !q || inv.includes(q) || supp.includes(q) || po.includes(q) || hasItem;

      let dateMatch = true;
      if (filterMonth) {
        const pDate = purchase.purchaseDate || purchase.date || "";
        dateMatch = pDate.startsWith(filterMonth);
      }

      const tot = Number(purchase.totalAmount || purchase.total || 0);
      const paid = Number(purchase.amountPaid || 0);
      const rem =
        purchase.remainingAmount !== undefined && purchase.remainingAmount !== null
          ? Number(purchase.remainingAmount)
          : Math.max(0, tot - paid);

      const isCleared = rem === 0 || (purchase.paymentStatus === "Paid" && rem === 0);
      const isPartial = rem > 0 && paid > 0;
      const isDue = rem > 0 && paid === 0;

      let statusMatch = true;
      if (historyStatusFilter === "due") statusMatch = isDue;
      else if (historyStatusFilter === "partial") statusMatch = isPartial;
      else if (historyStatusFilter === "cleared") statusMatch = isCleared;

      return searchMatch && dateMatch && statusMatch;
    });
  }, [purchaseList, searchHistory, filterMonth, historyStatusFilter]);

  // Summary Metrics for Purchase History Tab
  const historyStats = useMemo(() => {
    let totalPurchasesAmount = 0;
    let totalPaidAmount = 0;
    let totalDueAmount = 0;
    let dueCount = 0;
    let partialCount = 0;
    let clearedCount = 0;

    purchaseList.forEach((p) => {
      const tot = Number(p.totalAmount || p.total || 0);
      const paid = Number(p.amountPaid || 0);
      const rem =
        p.remainingAmount !== undefined && p.remainingAmount !== null
          ? Number(p.remainingAmount)
          : Math.max(0, tot - paid);

      totalPurchasesAmount += tot;
      totalPaidAmount += paid;
      totalDueAmount += rem;

      if (rem === 0 || p.paymentStatus === "Paid") {
        clearedCount += 1;
      } else if (paid > 0) {
        partialCount += 1;
      } else {
        dueCount += 1;
      }
    });

    return {
      totalPurchasesAmount,
      totalPaidAmount,
      totalDueAmount,
      totalCount: purchaseList.length,
      dueCount,
      partialCount,
      clearedCount,
    };
  }, [purchaseList]);

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
      const damaged = (r.items || []).reduce((isum, it) => {
        return (
          isum +
          (it.reason === "Damaged / Defective" || it.condition === "Damaged"
            ? Number(it.quantity) || 0
            : 0)
        );
      }, 0);
      return sum + damaged;
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

      {/* ── Page Header & 3 Navigation Tabs ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div className="flex items-center gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab("entry")}
            className={`pb-2.5 text-sm font-semibold transition-colors cursor-pointer border-b-2 -mb-[9px] whitespace-nowrap ${
              activeTab === "entry"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            New Purchase
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-2.5 text-sm font-semibold transition-colors cursor-pointer border-b-2 -mb-[9px] flex items-center gap-1.5 whitespace-nowrap ${
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
            className={`pb-2.5 text-sm font-semibold transition-colors cursor-pointer border-b-2 -mb-[9px] flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "returns"
                ? "border-amber-600 text-amber-600 dark:text-amber-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Purchase Returns (Debit Notes)</span>
            <span className="text-xs px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-mono font-bold">
              {purchaseReturnsList.length}
            </span>
          </button>
        </div>

        {activeTab === "returns" && (
          <button
            onClick={openNewBlankReturnModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Purchase Return</span>
          </button>
        )}
      </div>

      {/* ── TAB 1: NEW PURCHASE ENTRY ── */}
      {activeTab === "entry" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Column: Details & Items */}
          <div className="lg:col-span-2 space-y-5">
            {/* Purchase Details Form */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-4">
                Purchase Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Supplier */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select Supplier</option>
                    {supplierList.map((s) => (
                      <option key={s._id || s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Supplier Invoice No */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Supplier Invoice No.
                  </label>
                  <input
                    type="text"
                    value={supplierInvoiceNo}
                    onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Purchase Order No */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Purchase Order No. (Optional)
                  </label>
                  <input
                    type="text"
                    value={purchaseOrderNo}
                    onChange={(e) => setPurchaseOrderNo(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Purchase Date */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Purchase Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Due Date */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Due Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Products Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                  Products
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {items.length} item{items.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                      <th className="pb-2 min-w-[160px]">Product *</th>
                      <th className="pb-2 w-16 text-center">Qty *</th>
                      <th className="pb-2 w-24 text-right">Rate *</th>
                      <th className="pb-2 w-20 text-center">GST %</th>
                      <th className="pb-2 w-20 text-right">Discount</th>
                      <th className="pb-2 w-24 text-right">Amount</th>
                      <th className="pb-2 w-8 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((item, i) => (
                      <tr key={i} className="py-2">
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            list={`prod-list-${i}`}
                            value={item.product}
                            onChange={(e) =>
                              updateItem(i, "product", e.target.value)
                            }
                            placeholder="Type or select product..."
                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                          />
                          <datalist id={`prod-list-${i}`}>
                            {productList.map((p) => (
                              <option key={p._id || p.id} value={p.name}>
                                {p.name} (Stock: {p.stock})
                              </option>
                            ))}
                          </datalist>
                        </td>

                        <td className="py-2 px-1 text-center">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.qty}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.]/g, "");
                              updateItem(i, "qty", val);
                            }}
                            className="w-16 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1.5 text-xs text-center font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                          />
                        </td>

                        <td className="py-2 px-1 text-right">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.rate}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.]/g, "");
                              updateItem(i, "rate", val);
                            }}
                            placeholder="0.00"
                            className="w-24 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-right font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                          />
                        </td>

                        <td className="py-2 px-1 text-center">
                          <select
                            value={item.gstRate}
                            onChange={(e) =>
                              updateItem(i, "gstRate", e.target.value)
                            }
                            className="w-18 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1 py-1.5 text-xs text-center text-slate-900 dark:text-white outline-none focus:border-blue-500"
                          >
                            {GST_OPTIONS.map((g) => (
                              <option key={g} value={g}>
                                {g}%
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-2 px-1 text-right">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.discount}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.]/g, "");
                              updateItem(i, "discount", val);
                            }}
                            placeholder="0"
                            className="w-20 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-right font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                          />
                        </td>

                        <td className="py-2 pl-2 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {fmt(item.amount + item.gstAmount)}
                        </td>

                        <td className="py-2 pl-1 text-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItemRow(i)}
                              className="text-red-500 hover:text-red-700 p-1"
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
                onClick={addItemRow}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Product</span>
              </button>
            </div>
          </div>

          {/* Right Column: Payment & Summary */}
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm border-b border-slate-200 dark:border-slate-800 pb-3">
                Payment & Summary
              </h3>

              {/* Subtotal, GST, Grand Total */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {fmt(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>GST Total:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    +{fmt(totalGst)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span>Total Amount:</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">
                    {fmt(totalAmount)}
                  </span>
                </div>
              </div>

              {/* Payment Status */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="Unpaid">Payment Due (Credit / Unpaid)</option>
                    <option value="Partially Paid">Partially Paid (Advance / Installment)</option>
                    <option value="Paid">Fully Paid (Clear Payment)</option>
                  </select>
                </div>

                {/* Status Indicator Banner */}
                {paymentStatus === "Unpaid" && (
                  <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg p-2.5 flex items-center justify-between text-xs">
                    <span className="text-red-700 dark:text-red-300 font-medium flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" /> Total Payment Due:
                    </span>
                    <span className="font-mono font-bold text-red-700 dark:text-red-300">
                      {fmt(totalAmount)}
                    </span>
                  </div>
                )}

                {paymentStatus === "Paid" && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-lg p-2.5 flex items-center justify-between text-xs">
                    <span className="text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> Full Payment:
                    </span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                      {fmt(totalAmount)} (Cleared)
                    </span>
                  </div>
                )}

                {/* Payment Method */}
                {paymentStatus !== "Unpaid" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    >
                      {purchasePaymentMethods.map((m) => (
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
                      Amount Paid Now (₹) *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amountPaidInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, "");
                        setAmountPaidInput(val);
                      }}
                      placeholder="Enter advance amount..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-mono outline-none focus:border-blue-500"
                    />
                    <div className="flex justify-between text-xs font-semibold pt-1 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-slate-600 dark:text-slate-400">
                        Remaining Payment Due:
                      </span>
                      <span className="font-mono font-bold text-red-600 dark:text-red-400">
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
                    placeholder="Reference notes..."
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
      )}

      {/* ── TAB 2: PURCHASE HISTORY (SPACIOUS & MODERN) ── */}
      {activeTab === "history" && (
        <div className="space-y-5">
          {/* Top KPI Metrics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Purchases Card */}
            <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800/80 flex-shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Total Purchases ({historyStats.totalCount} Orders)
                </p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mt-0.5 truncate">
                  {fmt(historyStats.totalPurchasesAmount)}
                </p>
              </div>
            </div>

            {/* Total Paid Card */}
            <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/80 flex-shrink-0">
                <Check className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Total Amount Paid ({historyStats.clearedCount} Cleared)
                </p>
                <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 truncate">
                  {fmt(historyStats.totalPaidAmount)}
                </p>
              </div>
            </div>

            {/* Total Due / Payables Card */}
            <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-red-200/80 dark:border-red-900/60 bg-red-50/20 dark:bg-red-950/10 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/70 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-200 dark:border-red-800 flex-shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-red-600/90 dark:text-red-400">
                  Outstanding Due ({historyStats.dueCount + historyStats.partialCount} Pending)
                </p>
                <p className="text-xl font-extrabold text-red-600 dark:text-red-400 font-mono mt-0.5 truncate">
                  {fmt(historyStats.totalDueAmount)}
                </p>
              </div>
            </div>
          </div>

          {/* Main Table Container */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {/* Search, Filter Pills & Month Picker */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
              {/* Search input */}
              <div className="relative flex-1 min-w-[260px] max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  value={searchHistory}
                  onChange={(e) => setSearchHistory(e.target.value)}
                  placeholder="Search by supplier, invoice #, PO #, product..."
                  className="w-full pl-10 pr-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-blue-500 shadow-sm"
                />
                {searchHistory && (
                  <button
                    onClick={() => setSearchHistory("")}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    historyStatusFilter === "all"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  All ({historyStats.totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter("due")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    historyStatusFilter === "due"
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                  }`}
                >
                  Due ({historyStats.dueCount})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter("partial")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    historyStatusFilter === "partial"
                      ? "bg-amber-500 text-white shadow-sm"
                      : "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                  }`}
                >
                  Partial ({historyStats.partialCount})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter("cleared")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    historyStatusFilter === "cleared"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  }`}
                >
                  Cleared ({historyStats.clearedCount})
                </button>
              </div>

              {/* Month Picker */}
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 shadow-sm"
                />
                {filterMonth && (
                  <button
                    onClick={() => setFilterMonth("")}
                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Table or Empty State */}
            {filteredPurchases.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No matching purchase orders found
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Try adjusting your search terms or status filter to see other purchase records.
                </p>
                {(searchHistory || filterMonth || historyStatusFilter !== "all") && (
                  <button
                    onClick={() => {
                      setSearchHistory("");
                      setFilterMonth("");
                      setHistoryStatusFilter("all");
                    }}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline pt-1 cursor-pointer"
                  >
                    Reset all filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                      <th className="px-5 py-3.5">Supplier & Bill Info</th>
                      <th className="px-5 py-3.5">Purchase Date</th>
                      <th className="px-5 py-3.5 text-right">Total Bill</th>
                      <th className="px-5 py-3.5 text-right">Paid Amount</th>
                      <th className="px-5 py-3.5">Status & Remaining Due</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredPurchases.map((purchase) => {
                      const suppName =
                        purchase.supplierName || purchase.supplier || "Supplier";
                      const invNo =
                        purchase.supplierInvoiceNo ||
                        purchase.invoiceNo ||
                        purchase._id ||
                        "-";
                      const poNo = purchase.purchaseOrderNo || "";
                      const dateStr = purchase.purchaseDate
                        ? new Date(purchase.purchaseDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : purchase.date || "-";
                      const dueDateStr = purchase.dueDate
                        ? new Date(purchase.dueDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : null;
                      const itemCount = Array.isArray(purchase.items)
                        ? purchase.items.length
                        : purchase.items || 0;
                      const totAmt = Number(purchase.totalAmount || purchase.total || 0);
                      const paidAmt = Number(purchase.amountPaid || 0);
                      const remAmt =
                        purchase.remainingAmount !== undefined && purchase.remainingAmount !== null
                          ? Number(purchase.remainingAmount)
                          : Math.max(0, totAmt - paidAmt);
                      const isFullyPaid = remAmt === 0 || (purchase.paymentStatus === "Paid" && remAmt === 0);
                      const isPartiallyPaid = remAmt > 0 && paidAmt > 0;

                      return (
                        <tr
                          key={purchase._id || purchase.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Column 1: Supplier & Bill Info */}
                          <td className="px-5 py-4">
                            <button
                              onClick={() => openViewPurchaseModal(purchase)}
                              className="text-left font-bold text-slate-900 dark:text-white text-sm hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer block"
                            >
                              {suppName}
                            </button>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
                              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                #{invNo}
                              </span>
                              {poNo && (
                                <span className="text-slate-400 text-[11px]">
                                  PO: {poNo}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Column 2: Dates */}
                          <td className="px-5 py-4 text-xs">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                              {dateStr}
                            </span>
                            {dueDateStr ? (
                              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 block mt-0.5">
                                Due: {dueDateStr}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 block mt-0.5">
                                No Due Date
                              </span>
                            )}
                          </td>

                          {/* Column 3: Total Bill & Items */}
                          <td className="px-5 py-4 text-right">
                            <div className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                              {fmt(totAmt)}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {itemCount} item{itemCount !== 1 ? "s" : ""}
                              {purchase.gstTotal > 0 && ` • GST ${fmt(purchase.gstTotal)}`}
                            </div>
                          </td>

                          {/* Column 4: Paid Amount */}
                          <td className="px-5 py-4 text-right">
                            <div className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                              {fmt(paidAmt)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">
                              {purchase.paymentMethod || "Cash"}
                            </div>
                          </td>

                          {/* Column 5: Status & Remaining Due */}
                          <td className="px-5 py-4">
                            <div>
                              {isFullyPaid ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Payment Cleared</span>
                                </span>
                              ) : isPartiallyPaid ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Partially Paid</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                                  <DollarSign className="w-3.5 h-3.5 text-red-600" />
                                  <span>Payment Due</span>
                                </span>
                              )}

                              <div className="mt-1 text-xs">
                                {remAmt > 0 ? (
                                  <span className="font-mono font-bold text-red-600 dark:text-red-400">
                                    {fmt(remAmt)} Due
                                  </span>
                                ) : (
                                  <span className="font-mono text-slate-400 text-[11px]">
                                    ₹0.00 Due
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Column 6: Actions */}
                          <td className="px-5 py-4 text-right">
                            <div className="inline-flex items-center justify-end gap-2">
                              {/* Prominent Pay Due Button if amount is unpaid/partial */}
                              {!isFullyPaid && (
                                <button
                                  type="button"
                                  onClick={() => openPayModal(purchase)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                                  title="Pay due amount (partial or full)"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Pay Due</span>
                                </button>
                              )}

                              {/* View Details Icon Button */}
                              <button
                                type="button"
                                onClick={() => openViewPurchaseModal(purchase)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                                title="View Purchase Order & Payment Details"
                              >
                                <Eye className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                              </button>

                              {/* Return Items Icon Button */}
                              <button
                                type="button"
                                onClick={() => openReturnModalForPurchase(purchase)}
                                className="p-1.5 rounded-lg border border-amber-200 hover:border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:border-amber-800 dark:hover:bg-amber-900/60 dark:text-amber-300 text-xs font-semibold transition-colors cursor-pointer"
                                title="Return damaged items to supplier"
                              >
                                <RotateCcw className="w-4 h-4 text-amber-600" />
                              </button>
                            </div>
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

      {/* ── TAB 3: PURCHASE RETURNS (DEBIT NOTES) ── */}
      {activeTab === "returns" && (
        <div className="space-y-5">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center border border-amber-200 dark:border-amber-800">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Total Return Value
                </p>
                <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                  {fmt(totalReturnsValue)}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center border border-blue-200 dark:border-blue-800">
                <FileText className="w-5 h-5" />
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

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: CREATE PURCHASE RETURN (DEBIT NOTE)
      ───────────────────────────────────────────────────────────── */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    Create Purchase Return (Debit Note)
                  </h3>
                  <p className="text-[11px] text-white/80">
                    Return damaged/faulty products, deduct stock, and adjust supplier balance.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReturnModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Top Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={returnSupplier}
                    onChange={(e) => {
                      setReturnSupplier(e.target.value);
                      const sObj = supplierList.find(
                        (s) => s.name === e.target.value
                      );
                      if (sObj) setReturnSupplierId(sObj._id || sObj.id);
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
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
                    Original Supplier Invoice #
                  </label>
                  <input
                    type="text"
                    value={returnInvoiceNo}
                    onChange={(e) => setReturnInvoiceNo(e.target.value)}
                    placeholder="e.g. INV-10482"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-amber-500"
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
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Items to Return Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-amber-500" />
                    <span>Returned Items & Reason Breakdown</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    {returnItems.length} item(s) selected
                  </span>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-semibold">
                      <tr>
                        <th className="p-2.5 min-w-[160px]">Product *</th>
                        <th className="p-2.5 w-20 text-center">Return Qty *</th>
                        <th className="p-2.5 w-24 text-right">Purchase Rate (₹)</th>
                        <th className="p-2.5 w-18 text-center">GST %</th>
                        <th className="p-2.5 min-w-[140px]">Reason for Return</th>
                        <th className="p-2.5 w-24">Condition</th>
                        <th className="p-2.5 w-24 text-right">Line Total</th>
                        <th className="p-2.5 w-8 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {returnItems.map((item, i) => (
                        <tr
                          key={i}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                        >
                          <td className="p-2.5">
                            <input
                              type="text"
                              list={`return-prod-${i}`}
                              value={item.productName}
                              onChange={(e) =>
                                updateReturnItem(i, "productName", e.target.value)
                              }
                              placeholder="Select or enter product..."
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 font-medium"
                            />
                            <datalist id={`return-prod-${i}`}>
                              {productList.map((p) => (
                                <option key={p._id || p.id} value={p.name}>
                                  {p.name} (Stock: {p.stock})
                                </option>
                              ))}
                            </datalist>
                          </td>

                          <td className="p-2.5 text-center">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9.]/g, "");
                                updateReturnItem(i, "quantity", val);
                              }}
                              className="w-18 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1.5 text-xs text-center font-mono text-slate-900 dark:text-white font-bold outline-none focus:border-amber-500"
                            />
                            {item.maxQuantity !== null &&
                              item.maxQuantity !== undefined && (
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  max: {item.maxQuantity}
                                </span>
                              )}
                          </td>

                          <td className="p-2.5 text-right">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.purchaseRate}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9.]/g, "");
                                updateReturnItem(i, "purchaseRate", val);
                              }}
                              className="w-22 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-right font-mono text-slate-900 dark:text-white outline-none focus:border-amber-500"
                            />
                          </td>

                          <td className="p-2.5 text-center">
                            <select
                              value={item.gstRate}
                              onChange={(e) =>
                                updateReturnItem(i, "gstRate", e.target.value)
                              }
                              className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1 py-1.5 text-xs text-center text-slate-900 dark:text-white outline-none focus:border-amber-500"
                            >
                              {GST_OPTIONS.map((g) => (
                                <option key={g} value={g}>
                                  {g}%
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
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 font-medium"
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
                                className="text-red-500 hover:text-red-700 p-1"
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
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
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

      {/* ── MODAL: RECORD PAYMENT FOR DUE PURCHASE ── */}
      {showPayModal && payingPurchase && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Record Purchase Payment
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {payingPurchase.supplierName || "Supplier"} • Invoice #{payingPurchase.supplierInvoiceNo || payingPurchase.purchaseOrderNo || "Bill"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPayModal(false);
                  setPayingPurchase(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Financial Balance Overview */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Total Purchase Bill:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {fmt(payingPurchase.totalAmount || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Already Paid:</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {fmt(payingPurchase.amountPaid || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-red-600 dark:text-red-400">
                    Current Outstanding Due:
                  </span>
                  <span className="font-mono text-sm text-red-600 dark:text-red-400">
                    {fmt(
                      payingPurchase.remainingAmount !== undefined && payingPurchase.remainingAmount !== null
                        ? payingPurchase.remainingAmount
                        : Math.max(0, (payingPurchase.totalAmount || 0) - (payingPurchase.amountPaid || 0))
                    )}
                  </span>
                </div>
              </div>

              {/* Quick Fill Full Due */}
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Payment Amount (₹) *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const due =
                      payingPurchase.remainingAmount !== undefined && payingPurchase.remainingAmount !== null
                        ? Number(payingPurchase.remainingAmount)
                        : Math.max(0, Number(payingPurchase.totalAmount || 0) - Number(payingPurchase.amountPaid || 0));
                    setPayAmountInput(String(due));
                  }}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  Pay Full Due ({fmt(
                    payingPurchase.remainingAmount !== undefined && payingPurchase.remainingAmount !== null
                      ? payingPurchase.remainingAmount
                      : Math.max(0, (payingPurchase.totalAmount || 0) - (payingPurchase.amountPaid || 0))
                  )})
                </button>
              </div>

              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">
                  ₹
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={payAmountInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, "");
                    setPayAmountInput(val);
                  }}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Mode
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                >
                  {purchasePaymentMethods.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Date & Reference */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ref / UTR / Cheque #
                  </label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="Optional ref..."
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Part payment for stock clearance..."
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowPayModal(false);
                    setPayingPurchase(null);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRecordPaymentSubmit}
                  disabled={submittingPayment}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submittingPayment ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Payment...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Record & Clear Payment</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW PURCHASE ORDER & PAYMENT HISTORY ── */}
      {viewPurchaseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Purchase Order Details
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    #{viewPurchaseModal.supplierInvoiceNo || viewPurchaseModal.purchaseOrderNo || "PO-Bill"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1"
                  title="Print Purchase Order"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setViewPurchaseModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Supplier & Date Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/70">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Supplier
                  </p>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">
                    {viewPurchaseModal.supplierName || "Supplier"}
                  </p>
                  {viewPurchaseModal.purchaseOrderNo && (
                    <p className="text-slate-500 mt-0.5">
                      PO Reference: <span className="font-mono font-medium">{viewPurchaseModal.purchaseOrderNo}</span>
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Dates
                  </p>
                  <p className="text-slate-700 dark:text-slate-300">
                    Purchase: <span className="font-mono font-semibold">{viewPurchaseModal.purchaseDate ? new Date(viewPurchaseModal.purchaseDate).toISOString().slice(0, 10) : "-"}</span>
                  </p>
                  {viewPurchaseModal.dueDate && (
                    <p className="text-slate-500 mt-0.5">
                      Payment Due: <span className="font-mono font-semibold text-red-600 dark:text-red-400">{new Date(viewPurchaseModal.dueDate).toISOString().slice(0, 10)}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Payment Status Banner */}
              {(() => {
                const tot = Number(viewPurchaseModal.totalAmount || 0);
                const paid = Number(viewPurchaseModal.amountPaid || 0);
                const rem =
                  viewPurchaseModal.remainingAmount !== undefined && viewPurchaseModal.remainingAmount !== null
                    ? Number(viewPurchaseModal.remainingAmount)
                    : Math.max(0, tot - paid);
                const isCleared = rem === 0;

                return (
                  <div
                    className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                      isCleared
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80"
                        : paid > 0
                        ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80"
                        : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        {isCleared ? (
                          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 font-bold" />
                        ) : (
                          <DollarSign className="w-4 h-4 text-red-600 dark:text-red-400 font-bold" />
                        )}
                        <span
                          className={`font-bold text-sm ${
                            isCleared
                              ? "text-emerald-800 dark:text-emerald-300"
                              : paid > 0
                              ? "text-amber-800 dark:text-amber-300"
                              : "text-red-800 dark:text-red-300"
                          }`}
                        >
                          {isCleared
                            ? "PAYMENT CLEARED (FULLY PAID)"
                            : paid > 0
                            ? `PARTIALLY PAID (${fmt(rem)} DUE)`
                            : `PAYMENT DUE (${fmt(rem)})`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                        Total Bill: <span className="font-mono font-semibold">{fmt(tot)}</span> • Paid: <span className="font-mono font-semibold text-emerald-600">{fmt(paid)}</span> • Remaining Due: <span className="font-mono font-bold text-red-600">{fmt(rem)}</span>
                      </p>
                    </div>

                    {!isCleared && (
                      <button
                        type="button"
                        onClick={() => {
                          openPayModal(viewPurchaseModal);
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Pay Outstanding Due</span>
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Items Table */}
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Purchased Items
                </h4>
                <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-8 text-center">#</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">Product</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center w-16">Qty</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-right w-20">Rate</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center w-14">GST</th>
                      <th className="p-2 text-right w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {(viewPurchaseModal.items || []).map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-2 text-center border-r border-slate-200 dark:border-slate-700 text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-white">
                          {it.productName || it.product || "Product"}
                        </td>
                        <td className="p-2 text-center border-r border-slate-200 dark:border-slate-700 font-mono">
                          {it.quantity || it.qty} {it.unit || "pcs"}
                        </td>
                        <td className="p-2 text-right border-r border-slate-200 dark:border-slate-700 font-mono">
                          {fmt(it.purchaseRate || it.rate || 0)}
                        </td>
                        <td className="p-2 text-center border-r border-slate-200 dark:border-slate-700 font-mono text-slate-500">
                          {it.gstRate || 0}%
                        </td>
                        <td className="p-2 text-right font-mono font-semibold text-slate-900 dark:text-white">
                          {fmt(
                            (it.itemAmount !== undefined
                              ? it.itemAmount + (it.gstAmount || 0)
                              : (Number(it.quantity || it.qty || 1) * Number(it.purchaseRate || it.rate || 0)) *
                                (1 + Number(it.gstRate || 0) / 100))
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1.5 border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {fmt(viewPurchaseModal.subtotal || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>GST Total:</span>
                    <span className="font-mono font-semibold text-emerald-600">
                      +{fmt(viewPurchaseModal.gstTotal || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-300 dark:border-slate-700">
                    <span>Grand Total:</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400 text-sm">
                      {fmt(viewPurchaseModal.totalAmount || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment History Log */}
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Payment Transactions & History</span>
                </h4>
                {Array.isArray(viewPurchaseModal.payments) && viewPurchaseModal.payments.length > 0 ? (
                  <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">Date</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">Mode</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">Ref / Note</th>
                        <th className="p-2 text-right">Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {viewPurchaseModal.payments.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-mono text-slate-600 dark:text-slate-300">
                            {p.paymentDate ? new Date(p.paymentDate).toISOString().slice(0, 10) : "-"}
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-medium">
                            {p.paymentMethod || "Cash"}
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-slate-500">
                            {p.referenceNo ? `#${p.referenceNo} ` : ""}
                            {p.notes || "-"}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {fmt(p.amount || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : Number(viewPurchaseModal.amountPaid || 0) > 0 ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg flex justify-between items-center text-xs">
                    <span className="text-emerald-800 dark:text-emerald-300 font-medium">
                      Initial Paid Amount ({viewPurchaseModal.paymentMethod || "Cash"}):
                    </span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                      {fmt(viewPurchaseModal.amountPaid)}
                    </span>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 text-center text-xs">
                    No payments have been recorded yet. Full balance of {fmt(viewPurchaseModal.totalAmount || 0)} is currently Due.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setViewPurchaseModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
