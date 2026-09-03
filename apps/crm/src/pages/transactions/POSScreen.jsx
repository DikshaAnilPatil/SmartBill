import { useEffect, useState, useCallback, useMemo } from "react";
import {
  BarChart2,
  Download,
  Minus,
  Package,
  Plus,
  Printer,
  Receipt,
  ScanLine,
  ShoppingCart,
  Trash2,
  X,
  RefreshCw,
  RotateCcw,
  Tag,
  Percent,
  CheckCircle2,
  Edit3,
  QrCode,
  CreditCard,
  Landmark,
  ShieldCheck,
  Smartphone,
  Wallet,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { fmt } from "@shared/utils/format";
import { Badge, Btn, Card, Input, Select, Modal, StepperInput } from "@shared/components/common/ui";
import { fetchCustomers, createCustomer } from "@shared/api/customerAPI";
import { createOrder, createOrderReturn, fetchOrders } from "@shared/api/orderAPI";
import { getProducts } from "@shared/api/productAPI";
import { getInvoiceSettings } from "@shared/api/invoiceSettingsAPI";
import { fetchPartySettings } from "@shared/api/partySettingsAPI";
import { useTransactionSettings } from "@shared/hooks/useTransactionSettings";

export default function POSScreen() {
  const { settings: txSettings } = useTransactionSettings();

  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [productList, setProductList] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [customer, setCustomer] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentSettings, setPaymentSettings] = useState(() => {
    try {
      const stored = localStorage.getItem("smartbill_payment_settings");
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return null;
  });

  const [salesPaymentModes, setSalesPaymentModes] = useState(() => {
    try {
      const stored = localStorage.getItem("smartbill_payment_settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.sales) && parsed.sales.length > 0) {
          return parsed.sales;
        }
      }
    } catch (_) {}
    return ["Cash", "UPI & QR Code", "Credit / Debit Card", "Bank Transfer", "Store Credit / Khata"];
  });

  const [paymentMode, setPaymentMode] = useState(() => {
    try {
      const stored = localStorage.getItem("smartbill_payment_settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.defaultSalesMethod) return parsed.defaultSalesMethod;
      }
    } catch (_) {}
    return "Cash";
  });

  const [transactionRef, setTransactionRef] = useState("");
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitRows, setSplitRows] = useState([
    { id: 1, mode: "Cash", amount: "", ref: "" },
    { id: 2, mode: "UPI & QR Code", amount: "", ref: "" },
  ]);

  const handleAddSplitRow = () => {
    const nextId = splitRows.length > 0 ? Math.max(...splitRows.map((r) => r.id)) + 1 : 1;
    setSplitRows((prev) => [
      ...prev,
      {
        id: nextId,
        mode: "Credit / Debit Card",
        amount: "",
        ref: "",
      },
    ]);
  };

  const handleRemoveSplitRow = (id) => {
    if (splitRows.length <= 2) return;
    setSplitRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSplitRowChange = (id, field, value) => {
    setSplitRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleAutoFillRemaining = (id, targetTotal) => {
    const currentOthers = splitRows
      .filter((r) => r.id !== id)
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const needed = Math.max(0, targetTotal - currentOthers);
    handleSplitRowChange(id, "amount", String(needed));
  };

  // Listen to paymentSettingsUpdated events
  useEffect(() => {
    const handleUpdate = () => {
      try {
        const stored = localStorage.getItem("smartbill_payment_settings");
        if (stored) {
          const parsed = JSON.parse(stored);
          setPaymentSettings(parsed);
          if (Array.isArray(parsed.sales) && parsed.sales.length > 0) {
            setSalesPaymentModes(parsed.sales);
            if (!parsed.sales.includes(paymentMode)) {
              setPaymentMode(parsed.defaultSalesMethod || parsed.sales[0]);
            }
          }
        }
      } catch (_) {}
    };

    window.addEventListener("paymentSettingsUpdated", handleUpdate);
    return () => window.removeEventListener("paymentSettingsUpdated", handleUpdate);
  }, [paymentMode]);

  const [search, setSearch] = useState("");
  const [showInvoice, setShowInvoice] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [amountPaid, setAmountPaid] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [lastOrder, setLastOrder] = useState(null);
  const [invSettings, setInvSettings] = useState({});
  const [partySettings, setPartySettings] = useState({
    enableGrouping: true,
    trackBalance: false,
    shippingAddress: true,
  });

  // Global Invoice Discount state (for Entire Invoice mode)
  const [globalDiscount, setGlobalDiscount] = useState(0);

  // --- SALES RETURN MODAL STATES ---
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [pastOrders, setPastOrders] = useState([]);
  const [returnInvoiceNo, setReturnInvoiceNo] = useState("");
  const [selectedReturnOrder, setSelectedReturnOrder] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnPasscode, setReturnPasscode] = useState("");
  const [showReturnPasscode, setShowReturnPasscode] = useState(false);
  const [requirePasscode, setRequirePasscode] = useState(false);
  const [returnReason, setReturnReason] = useState("Customer Return");
  const [returnPaymentMode, setReturnPaymentMode] = useState("Cash");
  const [processingReturn, setProcessingReturn] = useState(false);
  const [returnError, setReturnError] = useState("");
  const [manualReturnProduct, setManualReturnProduct] = useState("");

  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(""), 4000);
  };

  // Helper to extract product ID safely (supporting MongoDB _id and legacy id)
  const getProductId = (p) => {
    if (!p) return undefined;
    return p._id || p.id;
  };

  // Pricing rule from Transaction Settings: Retail Price, Wholesale Price, or Minimum Sale Price
  const getProductDefaultPrice = useCallback(
    (p) => {
      if (!p) return 0;
      const mode = txSettings?.salePrice || "Retail Price";
      if (mode === "Wholesale Price") {
        return p.wholesalePrice && Number(p.wholesalePrice) > 0
          ? Number(p.wholesalePrice)
          : p.cost && Number(p.cost) > 0
            ? Math.round(Number(p.cost) * 1.15)
            : Number(p.price) || 0;
      }
      if (mode === "Minimum Sale Price") {
        return p.minPrice && Number(p.minPrice) > 0
          ? Number(p.minPrice)
          : p.cost && Number(p.cost) > 0
            ? Number(p.cost)
            : Number(p.price) || 0;
      }
      return Number(p.price) || 0;
    },
    [txSettings?.salePrice]
  );

  // Derived selected customer matching current customer input
  const selectedCustomer = (customers || []).find(
    (c) =>
      c &&
      c.name &&
      customer &&
      String(c.name).trim().toLowerCase() === String(customer).trim().toLowerCase()
  );

  // Load products from backend API with fallback
  const loadProductsList = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await getProducts();
      if (res && Array.isArray(res.products) && res.products.length > 0) {
        setProductList(res.products.filter((p) => p && (p.status === "Active" || !p.status)));
      }
    } catch {
      // Fallback
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // Load past orders for sales returns
  const loadPastOrders = useCallback(async () => {
    try {
      const res = await fetchOrders();
      if (res && Array.isArray(res.orders)) {
        setPastOrders(res.orders);
      }
    } catch (err) {
      console.warn("Failed to load past orders for return:", err);
    }
  }, []);

  // Load initial data on mount
  useEffect(() => {
    // Load invoice settings
    getInvoiceSettings().then(res => {
      if(res?.settings) setInvSettings(res.settings);
    }).catch(console.warn);

    // Load party settings
    fetchPartySettings().then(res => {
      if (res?.partySettings) setPartySettings(res.partySettings);
    }).catch(console.warn);

    const handleSettingsUpdated = (e) => {
      if (e.detail) setPartySettings(e.detail);
    };
    window.addEventListener("partySettingsUpdated", handleSettingsUpdated);

    // Load real customers from MongoDB
    fetchCustomers()
      .then((res) => {
        const list = Array.isArray(res?.customers) ? res.customers : Array.isArray(res) ? res : [];
        setCustomers(list);
      })
      .catch(console.warn);

    // Load past orders
    loadPastOrders();

    // Load products
    loadProductsList();

    return () => window.removeEventListener("partySettingsUpdated", handleSettingsUpdated);
  }, [loadProductsList, loadPastOrders]);

  const handleOpenReturnModal = () => {
    setShowReturnModal(true);
    setReturnError("");
    setReturnInvoiceNo("");
    setSelectedReturnOrder(null);
    setReturnItems([]);
    setReturnPasscode("");
    loadPastOrders();
  };

  const filteredProducts = (productList || []).filter(
    (p) =>
      p &&
      ((p.name && String(p.name).toLowerCase().includes((search || "").toLowerCase())) ||
        (p.sku && String(p.sku).toLowerCase().includes((search || "").toLowerCase())))
  );

  const allowNegativeStock = txSettings?.allowNegativeStock === true;
  const allowDiscount = txSettings?.allowDiscount !== false;
  const allowPriceEditing = txSettings?.allowPriceEditing === true;
  const discountAppliedOn = txSettings?.discountAppliedOn || "Item-wise";
  const discountType = txSettings?.discountType || "Percentage";
  const maxDiscountLimit = Number(txSettings?.maximumDiscount || 100);

  const addToCart = useCallback((p) => {
    const targetId = getProductId(p);
    const inStock = Number(p.stock) || 0;

    if (!allowNegativeStock && inStock <= 0) {
      setError(`"${p.name}" is out of stock! Enable Negative Stock in Transaction Settings to allow selling.`);
      return;
    }
    setError("");

    setCart((c) => {
      const ex = c.find((i) => getProductId(i.product) === targetId);
      if (ex) {
        if (!allowNegativeStock && ex.qty >= inStock) {
          setError(`Cannot add more than available stock (${inStock}) for ${p.name}.`);
          return c;
        }
        return c.map((i) =>
          getProductId(i.product) === targetId ? { ...i, qty: i.qty + 1 } : i
        );
      }
      const initialPrice = getProductDefaultPrice(p);
      return [
        ...c,
        {
          product: p,
          price: initialPrice,
          qty: 1,
          discount: 0,
        },
      ];
    });
  }, [allowNegativeStock, getProductDefaultPrice]);

  const handleScanBarcode = useCallback(
    (code) => {
      if (!code) return;
      const clean = String(code).trim().toLowerCase();
      const matched = productList.find(
        (p) =>
          (p.sku && String(p.sku).trim().toLowerCase() === clean) ||
          (p.barcode && String(p.barcode).trim().toLowerCase() === clean) ||
          (p.name && String(p.name).trim().toLowerCase() === clean) ||
          (p._id && String(p._id).toLowerCase() === clean)
      );
      if (matched) {
        addToCart(matched);
        showToast(`✓ Added "${matched.name}" via scan`);
      } else {
        setError(`No product found with barcode / SKU: "${code}"`);
      }
    },
    [productList, addToCart]
  );

  const updateQty = (id, delta) => {
    setError("");
    setCart((c) =>
      c
        .map((i) => {
          const itemPId = getProductId(i.product);
          if (itemPId === id) {
            const nextQty = i.qty + delta;
            const inStock = Number(i.product?.stock) || 0;
            if (!allowNegativeStock && delta > 0 && nextQty > inStock) {
              setError(`Cannot exceed available stock (${inStock}) for ${i.product?.name}.`);
              return i;
            }
            return { ...i, qty: Math.max(1, nextQty) };
          }
          return i;
        })
        .filter((i) => i.qty > 0)
    );
  };

  const updateExactQty = (id, val) => {
    setError("");
    setCart((c) =>
      c.map((i) => {
        const itemPId = getProductId(i.product);
        if (itemPId === id) {
          let nextQty = val === "" ? "" : Number(val);
          if (nextQty !== "" && nextQty < 1) nextQty = 1;
          const inStock = Number(i.product?.stock) || 0;
          if (!allowNegativeStock && nextQty !== "" && nextQty > inStock) {
            setError(`Cannot exceed available stock (${inStock}) for ${i.product?.name}.`);
            nextQty = Math.max(1, inStock);
          }
          return { ...i, qty: nextQty || 1 };
        }
        return i;
      })
    );
  };

  const updateItemPrice = (id, val) => {
    const numericPrice = Math.max(0, Number(val) || 0);
    setCart((c) =>
      c.map((i) =>
        getProductId(i.product) === id ? { ...i, price: numericPrice } : i
      )
    );
  };

  const updateItemDiscount = (id, val) => {
    const numericVal = Math.max(0, Number(val) || 0);
    if (discountType === "Percentage" && maxDiscountLimit < 100 && numericVal > maxDiscountLimit) {
      setError(`Discount cannot exceed ${maxDiscountLimit}% as per Transaction Settings.`);
    } else {
      setError("");
    }
    setCart((c) =>
      c.map((i) =>
        getProductId(i.product) === id ? { ...i, discount: numericVal } : i
      )
    );
  };

  const removeItem = (id) => {
    setError("");
    setCart((c) => c.filter((i) => getProductId(i.product) !== id));
  };

  // Financial Calculations
  const calculatedItems = useMemo(() => {
    return cart.map((i) => {
      const unitPrice =
        i.price !== undefined
          ? Number(i.price)
          : getProductDefaultPrice(i.product);
      const disc =
        allowDiscount && discountAppliedOn === "Item-wise"
          ? Number(i.discount) || 0
          : 0;

      let itemSubtotal = unitPrice * i.qty;
      if (disc > 0) {
        if (discountType === "Percentage") {
          itemSubtotal = itemSubtotal * (1 - disc / 100);
        } else if (discountType === "Flat Amount") {
          itemSubtotal = Math.max(0, itemSubtotal - disc);
        }
      }

      const productGstRate = Number(
        i?.product?.gst ?? i?.product?.gstRate ?? 18
      );
      const itemGst = (itemSubtotal * productGstRate) / 100;

      return {
        ...i,
        unitPrice,
        itemSubtotal,
        productGstRate,
        itemGst,
      };
    });
  }, [
    cart,
    allowDiscount,
    discountAppliedOn,
    discountType,
    getProductDefaultPrice,
  ]);

  const grossSubtotal = calculatedItems.reduce(
    (s, i) => s + i.itemSubtotal,
    0
  );

  // Global Invoice Discount (if applied on Entire Invoice)
  let invoiceDiscountAmount = 0;
  if (allowDiscount && discountAppliedOn === "Entire Invoice" && globalDiscount > 0) {
    if (discountType === "Percentage") {
      invoiceDiscountAmount = (grossSubtotal * globalDiscount) / 100;
    } else {
      invoiceDiscountAmount = Math.min(grossSubtotal, globalDiscount);
    }
  }

  // Cash Discount calculation
  let cashDiscountAmount = 0;
  const cashDiscountPct = Number(txSettings?.cashDiscountPercent || 0);
  if (paymentMode === "Cash" && cashDiscountPct > 0) {
    cashDiscountAmount = ((grossSubtotal - invoiceDiscountAmount) * cashDiscountPct) / 100;
  }

  const subtotal = Math.max(
    0,
    grossSubtotal - invoiceDiscountAmount - cashDiscountAmount
  );

  const gst = Math.round(
    calculatedItems.reduce((sum, i) => sum + i.itemGst, 0)
  );

  const enableRoundOff = txSettings?.enableRoundOff === true;
  const unroundedTotal = subtotal + gst;
  const total = enableRoundOff ? Math.round(unroundedTotal) : Number(unroundedTotal.toFixed(2));
  const roundOffAmount = enableRoundOff ? Number((total - unroundedTotal).toFixed(2)) : 0;

  const effectiveGstRate =
    subtotal > 0 ? Math.round((gst / subtotal) * 100) : 0;

  const isCash = paymentMode === "Cash" || paymentMode === "cash";
  const isCashRounding = Boolean(paymentSettings?.transactionRules?.cashRounding ?? true);
  const roundedTotal = isCash && isCashRounding ? Math.round(total) : total;
  const cashRoundOff = isCash && isCashRounding ? (roundedTotal - total) : 0;

  const paidValue = Number(amountPaid);
  const balanceDue = Number.isFinite(paidValue)
    ? Math.max(0, roundedTotal - paidValue)
    : roundedTotal;

  const isDigitalMode = ["UPI", "UPI & QR Code", "Credit / Debit Card", "Card", "Bank Transfer", "Digital Wallet", "Wallet"].includes(paymentMode);
  const requireRef = Boolean(paymentSettings?.transactionRules?.requireReferenceNumber && isDigitalMode);
  const allowSplit = Boolean(paymentSettings?.transactionRules?.allowSplitPayment ?? true);

  const totalSplitAllocated = splitRows.reduce(
    (sum, r) => sum + (Number(r.amount) || 0),
    0
  );
  const remainingSplitToAllocate = Math.max(0, roundedTotal - totalSplitAllocated);
  const splitChangeToReturn = Math.max(0, totalSplitAllocated - roundedTotal);

  const upiSplitTotal = splitRows
    .filter((r) => r.mode.toLowerCase().includes("upi") || r.mode.toLowerCase().includes("qr"))
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const cardSplitTotal = splitRows
    .filter((r) => r.mode.toLowerCase().includes("card"))
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const bankSplitTotal = splitRows
    .filter((r) => r.mode.toLowerCase().includes("bank"))
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const cashSplitTotal = splitRows
    .filter((r) => r.mode.toLowerCase().includes("cash"))
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const hasAnyDigitalInSplit = splitRows.some(
    (r) =>
      r.mode.toLowerCase().includes("upi") ||
      r.mode.toLowerCase().includes("qr") ||
      r.mode.toLowerCase().includes("card") ||
      r.mode.toLowerCase().includes("bank") ||
      r.mode.toLowerCase().includes("wallet")
  );

  const activeBiz = (() => {
    try {
      const rawUser = localStorage.getItem("smartbill_user");
      const u = rawUser ? JSON.parse(rawUser) : {};
      const id = u?._id || u?.id;
      const key = id ? `businessInfo_${id}` : "businessInfo";
      const rawB =
        localStorage.getItem(key) || localStorage.getItem("businessInfo");
      const b = rawB ? JSON.parse(rawB) : {};
      return { ...u, ...b };
    } catch {
      return {};
    }
  })();

  const bName = paymentSettings?.bankSettings?.accountHolderName || activeBiz.businessName || "Smart Bill Business";
  const bTagline = activeBiz.tagline || "";
  const bAddress = [
    activeBiz.address,
    activeBiz.city,
    activeBiz.state,
    activeBiz.pincode,
  ]
    .filter(Boolean)
    .join(", ");
  const bGstin = activeBiz.gstin ? `GSTIN: ${activeBiz.gstin}` : "";
  const bPhone = activeBiz.phone ? `Ph: ${activeBiz.phone}` : "";
  const bBankName = paymentSettings?.bankSettings?.bankName || activeBiz.bankName || "";
  const bAccNo = paymentSettings?.bankSettings?.accountNumber || activeBiz.accountNumber || "";
  const bIfsc = paymentSettings?.bankSettings?.ifscCode || activeBiz.ifscCode || "";
  const bAccType = paymentSettings?.bankSettings?.accountType || "Current";
  const bBranch = paymentSettings?.bankSettings?.branchName || activeBiz.branchName || "";
  const bUpiId = paymentSettings?.upiSettings?.upiId || activeBiz.upiId || "";
  const bTerms = activeBiz.invoiceTerms || "";
  const bFooter =
    activeBiz.invoiceFooter ||
    activeBiz.invoiceFooterNote ||
    "Thank you for your business! Visit Again 🙏";

  const handlePrintInvoice = (orderOverride) => {
    const order = orderOverride || lastOrder;
    const invoiceItems =
      order?.items && order.items.length > 0
        ? order.items
        : cart.map((i) => ({
          name: i.product?.name || "Item",
          sku: i.product?.sku || "",
          qty: i.qty,
          price:
            i.price !== undefined
              ? Number(i.price)
              : getProductDefaultPrice(i.product),
          amount:
            (i.price !== undefined
              ? Number(i.price)
              : getProductDefaultPrice(i.product)) * i.qty,
        }));

    const invoiceSubtotal = order?.subtotal ?? subtotal;
    const invoiceGst = order?.gst ?? gst;
    const invoiceTotal = order?.totalOrderValue ?? roundedTotal;
    const invoicePaid = order?.amountPaid ?? (paidValue > 0 ? paidValue : roundedTotal);
    const invoiceDue = order?.balanceDue ?? Math.max(0, invoiceTotal - invoicePaid);
    const invoiceNo = order?.invoiceNo || "INV-001";
    const dateStr = order?.createdAt
      ? new Date(order.createdAt).toLocaleDateString("en-IN")
      : new Date().toLocaleDateString("en-IN");
    const status =
      order?.status ||
      (invoicePaid >= invoiceTotal
        ? "Paid"
        : invoicePaid > 0
          ? "Partial"
          : "Due");

    const fmtVal = (v) => "₹" + (Number(v) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const s = invSettings || {};
    const tpl = s.template === "Modern" 
      ? { headerBg: s.primaryColor || '#2563eb', headerColor: '#ffffff', border: `1px solid ${s.primaryColor || '#2563eb'}` }
      : s.template === "Minimal"
      ? { headerBg: 'transparent', headerColor: '#333333', border: '1px solid #eeeeee' }
      : { headerBg: '#f8fafc', headerColor: '#0f172a', border: '1px solid #e2e8f0' };
      
    const pSize = s.paperSize || "A4";
    const isThermal = pSize.includes("Thermal") || pSize.includes("58") || pSize.includes("80");
    const isThermal58 = pSize.includes("58");

    // Dynamic UPI QR generation
    const upiCfg = paymentSettings?.upiSettings || {};
    const showUpiQr = (upiCfg.enabled ?? true) && (upiCfg.showDynamicQrOnInvoice ?? true) && (upiCfg.upiId || bUpiId);
    const resolvedUpiId = upiCfg.upiId || bUpiId;
    const resolvedPayee = upiCfg.payeeName || bName;
    const dynamicQrUrl = showUpiQr
      ? `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
          `upi://pay?pa=${resolvedUpiId}&pn=${resolvedPayee}&am=${invoiceTotal}&cu=INR`
        )}&margin=2`
      : "";

    // Bank details
    const bankCfg = paymentSettings?.bankSettings || {};
    const showBank = (bankCfg.enabled ?? true) && (bankCfg.showOnInvoice ?? true) && (bankCfg.bankName || bBankName);

    let printHtml = "";

    if (isThermal) {
      // DEDICATED THERMAL RECEIPT LAYOUT (58mm / 80mm POS Slip)
      const thermalWidth = isThermal58 ? "58mm" : "80mm";
      const thermalMaxW = isThermal58 ? "260px" : "340px";

      const thermalItemsHtml = invoiceItems
        .map(
          (item) => `
        <div style="margin-bottom: 6px;">
          <div style="font-weight: 700; font-size: 11px;">${item.name || "Item"}</div>
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #333;">
            <span>${item.qty || 1} x ${fmtVal(item.price || 0)}</span>
            <span style="font-weight: 700; font-family: monospace;">${fmtVal(item.amount || (item.price || 0) * (item.qty || 1))}</span>
          </div>
        </div>
      `
        )
        .join("");

      printHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Receipt - ${invoiceNo}</title>
            <style>
              @page { size: ${thermalWidth} auto; margin: 2mm; }
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body { font-family: 'Courier New', Courier, monospace, sans-serif; color: #000; background: #fff; padding: 6px; font-size: 11px; max-width: ${thermalMaxW}; margin: 0 auto; }
              .center { text-align: center; }
              .bold { font-weight: 700; }
              .divider { border-top: 1px dashed #000; margin: 6px 0; }
              .row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 10px; }
              .total-row { font-size: 13px; font-weight: 800; margin: 4px 0; }
              .qr-container { text-align: center; margin-top: 8px; }
              .qr-img { width: 110px; height: 110px; margin: 0 auto; display: block; }
            </style>
          </head>
          <body>
            <div class="center bold" style="font-size: 14px; text-transform: uppercase;">${activeBiz.businessName || "SmartBill Store"}</div>
            ${activeBiz.address ? `<div class="center" style="font-size: 9px; margin-top: 2px;">${activeBiz.address}, ${activeBiz.city}</div>` : ""}
            ${activeBiz.gstin ? `<div class="center" style="font-size: 9px;">GSTIN: ${activeBiz.gstin}</div>` : ""}
            ${activeBiz.phone ? `<div class="center" style="font-size: 9px;">Tel: ${activeBiz.phone}</div>` : ""}

            <div class="divider"></div>

            <div class="row"><span>Receipt #:</span><span class="bold">${invoiceNo}</span></div>
            <div class="row"><span>Date:</span><span>${dateStr}</span></div>
            <div class="row"><span>Customer:</span><span>${s.showCustomerName ? (order?.customerName || customer) : "Walk-in"}</span></div>
            <div class="row"><span>Status:</span><span class="bold">[${status.toUpperCase()}]</span></div>

            <div class="divider"></div>
            ${thermalItemsHtml}
            <div class="divider"></div>

            <div class="row"><span>Subtotal:</span><span>${fmtVal(invoiceSubtotal)}</span></div>
            ${s.showTax && invoiceGst > 0 ? `<div class="row"><span>GST:</span><span>+${fmtVal(invoiceGst)}</span></div>` : ""}
            <div class="divider"></div>
            <div class="row total-row"><span>TOTAL:</span><span>${fmtVal(invoiceTotal)}</span></div>
            <div class="row"><span>Paid:</span><span class="bold">${fmtVal(invoicePaid)}</span></div>
            ${invoiceDue > 0 ? `<div class="row bold" style="color: #000;"><span>Balance Due:</span><span>${fmtVal(invoiceDue)}</span></div>` : ""}

            ${showUpiQr && dynamicQrUrl ? `
              <div class="divider"></div>
              <div class="qr-container">
                <p style="font-size: 9px; font-weight: bold; margin-bottom: 3px;">SCAN & PAY VIA UPI</p>
                <img src="${dynamicQrUrl}" class="qr-img" />
                <p style="font-size: 8px; margin-top: 2px;">UPI ID: ${resolvedUpiId}</p>
              </div>
            ` : ""}

            <div class="divider"></div>
            <div class="center" style="font-size: 9px; margin-top: 6px;">
              ${s.invoiceFooter || bFooter || "Thank you for your business!"}
            </div>
          </body>
        </html>
      `;
    } else {
      // STANDARD CORPORATE A4 / A5 INVOICE LAYOUT
      const itemRows = invoiceItems
        .map(
          (item) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 8px; font-weight: 600; color: #0f172a; text-align: left;">
            ${item.name || "Item"}
            ${s.showDescription && item.sku ? `<div style="font-size:10px; color:#64748b; font-weight:normal;">SKU: ${item.sku}</div>` : ""}
          </td>
          ${s.showHSN ? `<td style="padding: 10px 8px; text-align: center; color: #475569; font-size:11px;">${item.hsn || "-"}</td>` : ""}
          <td style="padding: 10px 8px; text-align: center; color: #475569; font-family: monospace;">${item.qty || 1}</td>
          <td style="padding: 10px 8px; text-align: right; color: #475569; font-family: monospace;">${fmtVal(item.price || 0)}</td>
          <td style="padding: 10px 8px; text-align: right; font-weight: 700; color: #0f172a; font-family: monospace;">${fmtVal(item.amount || (item.price || 0) * (item.qty || 1))}</td>
        </tr>
      `
        )
        .join("");

      const statusBg = status === "Paid" ? "#dcfce7" : status === "Partial" ? "#fef9c3" : "#fee2e2";
      const statusColor = status === "Paid" ? "#15803d" : status === "Partial" ? "#a16207" : "#b91c1c";

      const bnk = (s.showBankDetails || showBank) ? `
        <div class="bank-info" style="margin-top: 20px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 11px;">
          <strong>Bank Account Details:</strong><br/>
          Bank: ${s.bankName || bankCfg.bankName || bBankName || "—"} | A/C Name: ${s.accountHolder || bankCfg.accountHolder || bName || "—"}<br/>
          A/C No: ${s.accountNumber || bankCfg.accountNumber || bAccNo || "—"} | IFSC: ${s.ifsc || bankCfg.ifsc || bIfsc || "—"}
        </div>
      ` : "";

      const upiBlock = showUpiQr && dynamicQrUrl ? `
        <div style="margin-top: 16px; display: inline-flex; align-items: center; gap: 12px; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <img src="${dynamicQrUrl}" style="width: 70px; height: 70px; border-radius: 4px;" />
          <div style="font-size: 10px; color: #334155;">
            <strong style="color: #0f172a; font-size: 11px;">Scan to Pay via UPI</strong><br/>
            UPI ID: <span style="font-family: monospace; font-weight: 600;">${resolvedUpiId}</span><br/>
            Amount: <span style="font-weight: 700; color: #2563eb;">${fmtVal(invoiceTotal)}</span>
          </div>
        </div>
      ` : "";

      const terms = s.termsAndConditions ? `<div style="font-size: 10px; color: #64748b; margin-top: 14px; white-space: pre-wrap;"><strong>Terms & Conditions:</strong><br/>${s.termsAndConditions}</div>` : "";

      printHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Invoice - ${invoiceNo}</title>
            <style>
              @page { size: ${pSize === "A5" ? "A5 landscape" : "A4"}; margin: 10mm; }
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body { font-family: sans-serif; color: #0f172a; background: #ffffff; padding: 20px; font-size: 13px; }
              .invoice-card { max-width: 680px; margin: 0 auto; border: ${tpl.border}; border-radius: 12px; padding: 28px; background: #ffffff; }
              .header-table { width: 100%; margin-bottom: 24px; padding: 16px; background-color: ${tpl.headerBg}; color: ${tpl.headerColor}; border-radius: 8px; }
              .brand { font-size: 22px; font-weight: 800; }
              .subtext { font-size: 12px; margin-top: 2px; opacity: 0.9; }
              .inv-title { font-size: 20px; font-weight: 800; font-family: monospace; text-align: right; text-transform: uppercase; }
              .status-pill { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; margin-top: 6px; background: ${statusBg}; color: ${statusColor}; }
              .bill-to { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
              .bill-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
              .bill-name { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 2px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; padding: 8px; text-align: right; }
              .totals-container { display: flex; justify-content: flex-end; }
              .totals-box { width: 260px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
              .row { display: flex; justify-content: space-between; font-size: 12px; color: #475569; margin-bottom: 6px; }
              .row.total { border-top: 2px solid #e2e8f0; padding-top: 8px; margin-top: 8px; font-size: 15px; font-weight: 800; color: #0f172a; }
              .row.due { border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 6px; font-weight: 700; }
              .footer-note { margin-top: 28px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; }
              .footer-greeting { font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
            </style>
          </head>
          <body>
            <div class="invoice-card">
              <table class="header-table">
                <tr>
                  <td style="border:none; padding:0;">
                    <div class="brand">${activeBiz.businessName || "Your Business Name"}</div>
                    ${activeBiz.address ? `<div class="subtext">${activeBiz.address}, ${activeBiz.city}</div>` : ""}
                    ${activeBiz.gstin ? `<div class="subtext">GSTIN: ${activeBiz.gstin}</div>` : ""}
                  </td>
                  <td style="border:none; padding:0; text-align:right;">
                    <div class="inv-title">${s.invoiceTitle || "Tax Invoice"}</div>
                    <div class="subtext">${invoiceNo}</div>
                    <div class="subtext">Date: ${dateStr}</div>
                    <div><span class="status-pill">${status}</span></div>
                  </td>
                </tr>
              </table>

              <div class="bill-to">
                <div class="bill-label">Billed To</div>
                <div class="bill-name">${s.showCustomerName ? (order?.customerName || customer) : "Customer"}</div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="text-align: left;">Item</th>
                    ${s.showHSN ? `<th style="text-align: center;">HSN</th>` : ""}
                    <th style="text-align: center;">Qty</th>
                    <th>Rate</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
              </table>

              <div class="totals-container">
                <div class="totals-box">
                  <div class="row">
                    <span>Subtotal</span>
                    <span style="font-family: monospace;">${fmtVal(invoiceSubtotal)}</span>
                  </div>
                  ${s.showTax ? `
                  <div class="row">
                    <span>GST Tax</span>
                    <span style="font-family: monospace; color: #16a34a;">+${fmtVal(invoiceGst)}</span>
                  </div>
                  ` : ""}
                  <div class="row total">
                    <span>Total Amount</span>
                    <span style="font-family: monospace; color: ${s.primaryColor || '#2563eb'};">${fmtVal(invoiceTotal)}</span>
                  </div>
                  <div class="row" style="margin-top: 4px;">
                    <span>Amount Paid</span>
                    <span style="font-family: monospace; color: #16a34a; font-weight: 700;">${fmtVal(invoicePaid)}</span>
                  </div>
                  ${s.showBalanceDue ? `
                  <div class="row due">
                    <span>Balance Due</span>
                    <span style="font-family: monospace; color: ${invoiceDue > 0 ? "#dc2626" : "#16a34a"};">${fmtVal(invoiceDue)}</span>
                  </div>
                  ` : ""}
                </div>
              </div>

              ${bnk}
              ${upiBlock}

              <div style="display: flex; justify-content: space-between; margin-top: 20px;">
                <div>
                  ${terms}
                </div>
                ${s.showSignature ? `
                <div style="text-align: right; width: 150px; display: flex; flex-direction: column; justify-content: flex-end;">
                  ${s.signatureUrl ? `<img src="${s.signatureUrl}" style="height: 50px; object-fit: contain; margin-bottom: 5px;" />` : `<div style="height: 50px; border-bottom: 1px dashed #ccc; margin-bottom: 5px;"></div>`}
                  <div style="font-size: 10px; font-weight: 600;">Authorized Signatory</div>
                </div>
                ` : ""}
              </div>

              <div class="footer-note">
                <div class="footer-greeting">${s.invoiceFooter || bFooter || "Thank you for your business!"}</div>
              </div>
            </div>
          </body>
        </html>
      `;
    }

    let printWin = null;
    try {
      printWin = window.open("", "_blank", "width=800,height=900");
    } catch (_) {}

    if (printWin) {
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 300);
    } else {
      // Fallback using invisible iframe so it NEVER gets blocked by popup blockers
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(printHtml);
        frameDoc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            try {
              document.body.removeChild(iframe);
            } catch (_) {}
          }, 1500);
        }, 300);
      }
    }
  };

  const handleGenerateInvoice = async () => {
    if (cart.length === 0) return;
    setError("");

    // Validate reference number if required by business rule
    if (!isSplitMode && requireRef && !transactionRef.trim()) {
      setError(`Please enter the UTR / Transaction Reference Number for ${paymentMode}.`);
      return;
    }

    // Validate discount restrictions
    if (discountType === "Percentage" && maxDiscountLimit < 100) {
      if (discountAppliedOn === "Item-wise") {
        for (const item of cart) {
          if (Number(item.discount || 0) > maxDiscountLimit) {
            setError(`Discount of ${item.discount}% on "${item.product?.name}" exceeds allowed limit of ${maxDiscountLimit}%.`);
            return;
          }
        }
      } else if (globalDiscount > maxDiscountLimit) {
        setError(`Invoice discount of ${globalDiscount}% exceeds allowed limit of ${maxDiscountLimit}%.`);
        return;
      }
    }

    let finalPaymentMode = paymentMode;
    let effectivePaid = paidValue > 0 ? paidValue : roundedTotal;
    let splitPaymentsPayload = [];

    if (isSplitMode) {
      const validSplits = splitRows.filter((r) => Number(r.amount) > 0);
      if (validSplits.length === 0) {
        setError("Please enter payment amounts for at least one split method.");
        return;
      }
      effectivePaid = validSplits.reduce((sum, r) => sum + Number(r.amount), 0);
      splitPaymentsPayload = validSplits.map((r) => ({
        mode: r.mode,
        amount: Number(r.amount),
        referenceNo: r.ref || "",
      }));
      finalPaymentMode = `Split (${validSplits.map((r) => `${r.mode}: ₹${Number(r.amount).toLocaleString("en-IN")}`).join(", ")})`;
    }

    const items = calculatedItems.map((i) => ({
      productId: getProductId(i.product),
      name: i.product?.name || "Item",
      sku: i.product?.sku || "",
      price: i.unitPrice,
      qty: i.qty,
      discount: Number(i.discount) || 0,
      amount: i.itemSubtotal,
    }));

    let currentCustomerId = selectedCustomer
      ? selectedCustomer._id || selectedCustomer.id
      : null;
    let currentCustomerName = customer || "Walk-in Customer";
    let currentCustomerEmail = selectedCustomer?.email || customerEmail.trim();

    if (!selectedCustomer && customer.trim()) {
      try {
        const newCust = await createCustomer({
          name: customer.trim(),
          phone: customerPhone.trim(),
          city: customerCity.trim(),
          email: customerEmail.trim(),
        });
        currentCustomerId =
          newCust.customer?._id ||
          newCust.customer?.id ||
          newCust._id ||
          null;
        currentCustomerName =
          newCust.customer?.name || newCust.name || customer.trim();
        fetchCustomers()
          .then((res) => {
            if (res && Array.isArray(res.customers))
              setCustomers(res.customers);
          })
          .catch(() => {});
      } catch (err) {
        console.error("Failed to auto-create customer", err);
      }
    }

    const payload = {
      customerId: currentCustomerId,
      customerName: currentCustomerName,
      customerEmail: currentCustomerEmail,
      items,
      subtotal: Math.round(subtotal),
      gstRate: effectiveGstRate,
      gst,
      discount: invoiceDiscountAmount,
      cashDiscount: cashDiscountAmount,
      totalOrderValue: Math.round(roundedTotal),
      amountPaid: Math.round(effectivePaid),
      balanceDue: Math.max(0, Math.round(roundedTotal) - Math.round(effectivePaid)),
      paymentMode: finalPaymentMode,
      splitPayments: splitPaymentsPayload,
      transactionRef: transactionRef.trim() || undefined,
    };

    setSaving(true);
    try {
      const res = await createOrder(payload);
      setLastOrder(res.order);
      setPaymentModalOpen(false);

      // Trigger real-time low-stock and inventory event dispatch
      window.dispatchEvent(new CustomEvent("stockUpdated"));
      window.dispatchEvent(new CustomEvent("orderCreated", { detail: res.order }));

      // Behavior: Print After Saving
      if (txSettings?.printAfterSaving) {
        handlePrintInvoice(res.order);
      }

      // Behavior: Show Print Preview
      if (txSettings?.showPrintPreview !== false) {
        setShowInvoice(true);
      } else {
        // Direct reset for quick billing
        setCart([]);
        setAmountPaid("");
        setGlobalDiscount(0);
        showToast("✓ Invoice created successfully!");
      }
      loadProductsList();
    } catch (err) {
      setError(err?.message || "Failed to save order. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleInitiatePayment = () => {
    if (cart.length === 0) {
      setError("Please add at least one product to the cart before generating an invoice.");
      return;
    }
    setError("");

    if (isSplitMode) {
      // In split mode: if any digital payment method exists (UPI, QR, Card, Bank, Wallet), open the modal
      if (hasAnyDigitalInSplit || upiSplitTotal > 0 || cardSplitTotal > 0 || bankSplitTotal > 0) {
        setPaymentModalOpen(true);
      } else {
        handleGenerateInvoice();
      }
      return;
    }

    if (isDigitalMode) {
      setPaymentModalOpen(true);
    } else {
      handleGenerateInvoice();
    }
  };

  // --- SALES RETURN EXECUTION ---
  const handleSelectOrderForReturn = (order) => {
    setSelectedReturnOrder(order);
    setReturnInvoiceNo(order.invoiceNo);
    const initialItems = (order.items || []).map((it) => ({
      ...it,
      returnQty: it.qty,
      selected: true,
    }));
    setReturnItems(initialItems);
  };

  const handleProcessSalesReturn = async () => {
    setReturnError("");
    setProcessingReturn(true);

    try {
      const activeItemsToReturn = returnItems
        .filter((it) => it.selected && Number(it.returnQty) > 0)
        .map((it) => ({
          productId: it.productId,
          name: it.name,
          sku: it.sku,
          price: it.price,
          qty: Number(it.returnQty),
          amount: (Number(it.price) || 0) * Number(it.returnQty),
        }));

      if (activeItemsToReturn.length === 0) {
        setReturnError("Please select at least one item and quantity to return.");
        setProcessingReturn(false);
        return;
      }

      const totalRefund = activeItemsToReturn.reduce(
        (s, i) => s + (i.amount || 0),
        0
      );

      const payload = {
        orderId: selectedReturnOrder?._id,
        invoiceNo: returnInvoiceNo.trim(),
        items: activeItemsToReturn,
        reason: returnReason,
        refundAmount: totalRefund,
        paymentMode: returnPaymentMode,
        passcode: returnPasscode,
      };

      const res = await createOrderReturn(payload);

      showToast(
        `✓ Sales Return processed! Refund: ${fmt(res.refundAmount)}${
          res.restoredStock ? " (Stock restored to inventory)" : ""
        }`
      );
      setShowReturnModal(false);
      loadProductsList();
    } catch (err) {
      setReturnError(
        err?.response?.data?.message || err?.message || "Failed to process sales return."
      );
    } finally {
      setProcessingReturn(false);
    }
  };

  if (showInvoice) {
    const order = lastOrder;
    const invoiceItems =
      order?.items && order.items.length > 0
        ? order.items
        : cart.map((i) => ({
            name: i.product?.name || "Item",
            qty: i.qty,
            price:
              i.price !== undefined
                ? Number(i.price)
                : getProductDefaultPrice(i.product),
            amount:
              (i.price !== undefined
                ? Number(i.price)
                : getProductDefaultPrice(i.product)) * i.qty,
          }));

    const invoiceSubtotal = order?.subtotal ?? subtotal;
    const invoiceGst = order?.gst ?? gst;
    const invoiceTotal = order?.totalOrderValue ?? total;
    const invoicePaid =
      order?.amountPaid ?? (paidValue > 0 ? paidValue : total);
    const invoiceDue =
      order?.balanceDue ?? Math.max(0, invoiceTotal - invoicePaid);

    return (
      <div className="max-w-2xl mx-auto">
        <Btn
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowInvoice(false);
            setCart([]);
            setAmountPaid("");
            setGlobalDiscount(0);
            setLastOrder(null);
          }}
          className="mb-4"
        >
          ← Back to Billing
        </Btn>
        <Card className="p-8">
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                {activeBiz.logoUrl ? (
                  <img
                    src={activeBiz.logoUrl}
                    alt="Logo"
                    className="w-10 h-10 object-contain rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                    <BarChart2 className="w-5 h-5 text-white" />
                  </div>
                )}
                <div>
                  <h2 className="font-extrabold text-gray-900 dark:text-white text-lg tracking-tight">
                    {activeBiz.businessName || "Smart Bill"}
                  </h2>
                  {activeBiz.tagline && (
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      {activeBiz.tagline}
                    </p>
                  )}
                </div>
              </div>
              {bAddress && (
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                  {bAddress}
                </p>
              )}
              {bGstin && (
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  {bGstin}
                </p>
              )}
              {bPhone && (
                <p className="text-xs font-mono text-slate-400">{bPhone}</p>
              )}
            </div>
            <div className="text-right">
              <p className="font-bold text-blue-600 dark:text-blue-400 font-mono text-xl tracking-tight">
                {order?.invoiceNo || "INV-001"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Date:{" "}
                {order?.createdAt
                  ? new Date(order.createdAt).toLocaleDateString("en-IN")
                  : new Date().toLocaleDateString("en-IN")}
              </p>
              <div className="mt-1.5 flex justify-end">
                <Badge
                  label={
                    order?.status ||
                    (invoicePaid >= invoiceTotal
                      ? "Paid"
                      : invoicePaid > 0
                        ? "Partial"
                        : "Due")
                  }
                  variant={
                    (order?.status ||
                      (invoicePaid >= invoiceTotal
                        ? "Paid"
                        : invoicePaid > 0
                          ? "Partial"
                          : "Due")) === "Paid"
                      ? "green"
                      : (order?.status ||
                            (invoicePaid >= invoiceTotal
                              ? "Paid"
                              : invoicePaid > 0
                                ? "Partial"
                                : "Due")) === "Partial"
                        ? "yellow"
                        : "red"
                  }
                />
              </div>
            </div>
          </div>

          <div className="mb-6 bg-slate-50/80 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Billed To
            </p>
            <p className="font-bold text-slate-900 dark:text-white text-sm">
              {order?.customerName || customer}
            </p>
          </div>

          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="text-left pb-2.5">Item</th>
                <th className="text-center pb-2.5">Qty</th>
                <th className="text-right pb-2.5">Rate</th>
                <th className="text-right pb-2.5">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {invoiceItems.map((i, idx) => (
                <tr key={idx}>
                  <td className="py-3 text-xs font-bold text-slate-800 dark:text-slate-200">
                    {i.name}
                  </td>
                  <td className="py-3 text-xs text-center font-mono font-medium text-slate-600 dark:text-slate-300">
                    {i.qty}
                  </td>
                  <td className="py-3 text-xs text-right font-mono text-slate-600 dark:text-slate-400">
                    {fmt(i.price)}
                  </td>
                  <td className="py-3 text-xs text-right font-mono font-bold text-slate-900 dark:text-white">
                    {fmt(i.amount || i.price * i.qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end pt-2">
            <div className="w-64 space-y-2 text-xs bg-slate-50/60 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="font-mono font-medium">
                  {fmt(invoiceSubtotal)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>GST Tax</span>
                <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                  +{fmt(invoiceGst)}
                </span>
              </div>
              <div className="flex justify-between font-extrabold text-slate-900 dark:text-white text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>Total Amount</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-extrabold text-base">
                  {fmt(invoiceTotal)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300 pt-1">
                <span>Amount Paid</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {fmt(invoicePaid)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-100 dark:border-slate-700/60">
                <span>Balance Due</span>
                <span
                  className={`font-mono font-bold ${
                    invoiceDue > 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {fmt(invoiceDue)}
                </span>
              </div>
            </div>
          </div>

          {(bBankName || bUpiId) && (
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs bg-slate-50/60 dark:bg-slate-800/40 p-3.5 rounded-xl">
              <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                Bank & Payment Details
              </p>
              {bBankName && (
                <p className="text-slate-500 dark:text-slate-400">
                  Bank: {bBankName} {bAccNo ? `| A/C: ${bAccNo}` : ""}{" "}
                  {bIfsc ? `| IFSC: ${bIfsc}` : ""}
                </p>
              )}
              {bUpiId && (
                <p className="text-blue-600 dark:text-blue-400 font-mono font-semibold mt-0.5">
                  UPI ID: {bUpiId}
                </p>
              )}
            </div>
          )}

          {bTerms && (
            <div className="mt-4 text-xs bg-slate-50/60 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
              <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                Terms & Conditions
              </p>
              <p className="text-slate-500 dark:text-slate-400 whitespace-pre-line text-[11px] leading-relaxed">
                {bTerms}
              </p>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <div className="p-3 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-100/60 dark:border-blue-900/40 inline-block max-w-md w-full">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {bFooter}
              </p>
            </div>
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-2">
              Powered by SmartBill Pro
            </p>
          </div>

          {/* Payment Method & Split Details */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs bg-slate-50/60 dark:bg-slate-800/40 p-3.5 rounded-xl">
            <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
              Payment Method: <span className="text-blue-600 dark:text-blue-400 font-semibold">{order?.paymentMode || paymentMode}</span>
            </p>
            {Array.isArray(order?.splitPayments) && order.splitPayments.length > 0 && (
              <div className="mt-2 space-y-1 pl-2 border-l-2 border-blue-500">
                {order.splitPayments.map((sp, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                    <span>{sp.mode} {sp.referenceNo ? `(Ref: ${sp.referenceNo})` : ""}:</span>
                    <span className="font-mono font-bold">{fmt(sp.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 no-print">
            <Btn
              variant="primary"
              onClick={() => handlePrintInvoice(order)}
              icon={<Printer className="w-4 h-4" />}
            >
              Print Invoice
            </Btn>
            <Btn
              variant="outline"
              onClick={() => handlePrintInvoice(order)}
              icon={<Download className="w-4 h-4" />}
            >
              Download PDF
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => {
                setShowInvoice(false);
                setCart([]);
                setAmountPaid("");
                setGlobalDiscount(0);
                setLastOrder(null);
              }}
            >
              New Invoice
            </Btn>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex gap-5 h-[calc(100vh-110px)] relative">
      {/* Success Notification */}
      {successToast && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Left: Products List */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="flex items-center gap-2.5">
          <Input
            value={search}
            onChange={setSearch}
            icon={<ScanLine className="w-4 h-4" />}
            className="flex-1"
          />
          <Btn
            variant="outline"
            size="md"
            onClick={loadProductsList}
            disabled={loadingProducts}
            icon={
              <RefreshCw
                className={`w-4 h-4 ${loadingProducts ? "animate-spin" : ""}`}
              />
            }
          >
            Refresh
          </Btn>
          <Btn
            variant="secondary"
            size="md"
            onClick={handleOpenReturnModal}
            icon={<RotateCcw className="w-4 h-4" />}
          >
            Sales Return
          </Btn>
        </div>

        {/* Pricing tier notification badge if wholesale / min price configured */}
        {txSettings?.salePrice && txSettings.salePrice !== "Retail Price" && (
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg px-3 py-1.5 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between">
            <span className="font-semibold">
              Pricing Tier: {txSettings.salePrice}
            </span>
            <span className="text-[11px] text-blue-500">
              Active in Transaction Settings
            </span>
          </div>
        )}

        {loadingProducts ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Loading products from database...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-sm bg-gray-50 rounded-md border border-dashed border-gray-200 p-6">
            <Package className="w-10 h-10 text-gray-300 mb-2" />
            <p className="font-medium text-gray-700">No products found</p>
            <p className="text-xs text-gray-400">
              Add products in the Products section to sell here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 overflow-y-auto pr-2">
            {filteredProducts.map((p, idx) => {
              const pId = getProductId(p) || idx;
              const stockCount = Number(p.stock) || 0;
              const isOut = !allowNegativeStock && stockCount <= 0;
              const defaultPrice = getProductDefaultPrice(p);

              return (
                <button
                  key={pId}
                  onClick={() => addToCart(p)}
                  disabled={isOut}
                  className={`bg-white border rounded-md p-3 text-left transition-colors group flex items-center gap-4 ${
                    isOut
                      ? "opacity-60 border-gray-200 cursor-not-allowed bg-gray-50"
                      : "border-gray-200 hover:border-blue-400"
                  }`}
                >
                  <div className="w-12 h-12 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center">
                    <Package className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {p.name}
                    </p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {p.sku || "NO-SKU"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-sm font-bold text-blue-600">
                      {fmt(defaultPrice)}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        stockCount <= 0
                          ? allowNegativeStock
                            ? "bg-purple-50 text-purple-600"
                            : "bg-red-50 text-red-500"
                          : stockCount < 10
                            ? "bg-amber-50 text-amber-600"
                            : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      {stockCount <= 0
                        ? allowNegativeStock
                          ? `Backorder (${stockCount})`
                          : "Out of Stock"
                        : `Stock: ${stockCount}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Current Bill Sidebar */}
      <Card className="w-[440px] flex-shrink-0 flex flex-col h-full rounded-md border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
        {/* Header & Customer Selection */}
        <div className="p-3.5 bg-gray-50/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800 space-y-2.5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm leading-snug tracking-tight">
                  Current Bill
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    {cart.length} {cart.length === 1 ? "item" : "items"} •{" "}
                    {cart.reduce((s, i) => s + i.qty, 0)} units
                  </span>
                </div>
              </div>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCart([]);
                  setGlobalDiscount(0);
                }}
                className="text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2.5 py-1 rounded-lg transition-all font-semibold border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 cursor-pointer"
                title="Clear all items in cart"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">
              Customer
            </label>
            <input
              list="pos-customers-list"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <datalist id="pos-customers-list">
              <option value="Walk-in Customer">Walk-in Customer</option>
              {customers.map((c) => (
                <option key={c._id || c.name} value={c.name} />
              ))}
            </datalist>
          </div>

          {!selectedCustomer && customer.trim() !== "" && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Phone
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  City
                </label>
                <input
                  type="text"
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {selectedCustomer && (
            <div className="rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-2.5 space-y-2 text-[11px] shadow-2xs">
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-100 dark:border-slate-700/60">
                <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                  {selectedCustomer.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {selectedCustomer.phone || "No phone"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="bg-slate-50 dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] font-semibold text-slate-400 block uppercase tracking-wider">
                    Orders
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {fmt(selectedCustomer.totalOrderValue || 0)}
                  </span>
                </div>
                <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                  <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 block uppercase tracking-wider">
                    Paid
                  </span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                    {fmt(selectedCustomer.totalPaid || 0)}
                  </span>
                </div>
                <div className="bg-rose-50/60 dark:bg-rose-950/30 p-1.5 rounded-lg border border-rose-100 dark:border-rose-900/40">
                  <span className="text-[9px] font-semibold text-rose-600 dark:text-rose-400 block uppercase tracking-wider">
                    Due
                  </span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
                    {fmt(Math.abs(selectedCustomer.balance || 0))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cart Item Scrollable List */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-12 h-12 rounded bg-gray-100 dark:bg-gray-800/80 flex items-center justify-center mb-2.5 text-gray-400 dark:text-gray-500">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                Your cart is empty
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[190px]">
                Click products on the left to add items
              </p>
            </div>
          ) : (
            cart.map((item, idx) => {
              const itemId =
                item && item.product ? getProductId(item.product) || idx : idx;
              const prodName = item?.product?.name || "Item";
              const unitPrice =
                item.price !== undefined
                  ? Number(item.price)
                  : getProductDefaultPrice(item.product);

              return (
                <div
                  key={itemId}
                  className="bg-slate-50/90 dark:bg-slate-800/70 hover:bg-slate-100/90 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3 transition-all shadow-2xs group space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate flex-1 leading-snug">
                      {prodName}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeItem(itemId)}
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Remove item"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    {/* Qty Counter */}
                    <StepperInput
                      min={1}
                      value={item.qty}
                      onChange={(val) => updateExactQty(itemId, val)}
                      inputClassName="w-10 py-1"
                    />

                    {/* Unit Price (Editable if allowPriceEditing is true) */}
                    <div className="flex items-center gap-1">
                      {allowPriceEditing ? (
                        <div className="flex items-center bg-white dark:bg-slate-900 border border-blue-300 rounded px-1.5 py-0.5">
                          <span className="text-[10px] text-slate-400 font-mono">@₹</span>
                          <input
                            type="number"
                            min={0}
                            value={item.price !== undefined ? item.price : unitPrice}
                            onChange={(e) => updateItemPrice(itemId, e.target.value)}
                            className="w-16 text-xs font-mono font-bold text-blue-600 bg-transparent outline-none text-right"
                            title="Edit Unit Price (Allowed in Settings)"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-mono font-medium">
                          @{fmt(unitPrice)}
                        </span>
                      )}
                    </div>

                    {/* Item-wise Discount Input (if enabled) */}
                    {allowDiscount && discountAppliedOn === "Item-wise" && (
                      <div className="flex items-center gap-1 bg-amber-50/70 border border-amber-200 rounded px-1.5 py-0.5">
                        <span className="text-[10px] text-amber-700 font-medium">
                          {discountType === "Percentage" ? "%" : "₹"}
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={item.discount || 0}
                          onChange={(e) =>
                            updateItemDiscount(itemId, e.target.value)
                          }
                          className="w-12 text-xs font-mono font-bold text-amber-800 bg-transparent outline-none text-right"
                        />
                      </div>
                    )}

                    {/* Line Total */}
                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                        {fmt(
                          (unitPrice * item.qty) *
                            (discountType === "Percentage"
                              ? 1 - (Number(item.discount) || 0) / 100
                              : 1) -
                            (discountType === "Flat Amount"
                              ? Number(item.discount) || 0
                              : 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer & Financial Controls */}
        <div className="p-3.5 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5 flex-shrink-0">
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3 space-y-1.5 text-xs shadow-2xs">
            <div className="flex justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Subtotal</span>
              <span className="font-mono font-medium">
                {fmt(grossSubtotal)}
              </span>
            </div>

            {/* Global Invoice Discount Field (if Entire Invoice mode) */}
            {allowDiscount && discountAppliedOn === "Entire Invoice" && (
              <div className="flex justify-between items-center text-amber-700 text-xs py-1 border-t border-dashed border-slate-100">
                <span className="flex items-center gap-1 font-medium">
                  <Tag className="w-3.5 h-3.5" />
                  Invoice Discount ({discountType === "Percentage" ? "%" : "₹"})
                </span>
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                  <input
                    type="number"
                    min={0}
                    value={globalDiscount}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      if (
                        discountType === "Percentage" &&
                        maxDiscountLimit < 100 &&
                        val > maxDiscountLimit
                      ) {
                        setError(`Invoice discount cannot exceed ${maxDiscountLimit}%.`);
                      } else {
                        setError("");
                      }
                      setGlobalDiscount(val);
                    }}
                    className="w-14 text-xs font-mono font-bold text-amber-900 bg-transparent outline-none text-right"
                  />
                  <span className="text-[10px] font-bold text-amber-700">
                    -{fmt(invoiceDiscountAmount)}
                  </span>
                </div>
              </div>
            )}

            {/* Cash Discount Display */}
            {paymentMode === "Cash" && cashDiscountPct > 0 && cashDiscountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 text-xs">
                <span>
                  Cash Discount ({cashDiscountPct}%)
                </span>
                <span className="font-mono font-medium">
                  -{fmt(cashDiscountAmount)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>GST Tax</span>
              <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                +{fmt(gst)}
              </span>
            </div>

            {enableRoundOff && roundOffAmount !== 0 && (
              <div className="flex justify-between text-slate-500 dark:text-slate-400 text-xs">
                <span>Round-off</span>
                <span className="font-mono font-medium">
                  {roundOffAmount > 0 ? `+${fmt(roundOffAmount)}` : `-${fmt(Math.abs(roundOffAmount))}`}
                </span>
              </div>
            )}
            {isCash && isCashRounding && cashRoundOff !== 0 && (
              <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400 font-medium">
                <span>Cash Rounding</span>
                <span className="font-mono">{cashRoundOff > 0 ? `+${fmt(cashRoundOff)}` : `-${fmt(Math.abs(cashRoundOff))}`}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-slate-900 dark:text-white text-sm pt-2 border-t border-slate-100 dark:border-slate-700/60">
              <span>Order Total</span>
              <span className="font-mono text-blue-600 dark:text-blue-400 font-extrabold text-base">
                {fmt(roundedTotal)}
              </span>
            </div>
          </div>

          {/* Split Payment Toggle */}
          {allowSplit && (
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Split Multi-Payment
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = !isSplitMode;
                  setIsSplitMode(next);
                  if (next && splitRows.length === 2 && !splitRows[0].amount) {
                    const half = Math.floor(roundedTotal / 2);
                    setSplitRows([
                      { id: 1, mode: "Cash", amount: String(half), ref: "" },
                      { id: 2, mode: "UPI & QR Code", amount: String(roundedTotal - half), ref: "" },
                    ]);
                  }
                }}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  isSplitMode
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300"
                }`}
              >
                {isSplitMode ? "✓ Split Active" : "Enable Multi-Split"}
              </button>
            </div>
          )}

          {isSplitMode ? (
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 rounded-xl space-y-2.5 text-xs shadow-2xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-blue-200/60 dark:border-blue-800/60">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                  Multi-Split Allocations
                </span>
                <span className="text-[10px] font-bold font-mono text-blue-700 dark:text-blue-300">
                  ₹{totalSplitAllocated.toLocaleString("en-IN")} / ₹{roundedTotal.toLocaleString("en-IN")}
                </span>
              </div>

              {/* Split Rows */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {splitRows.map((row) => (
                  <div
                    key={row.id}
                    className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-blue-100 dark:border-slate-800 space-y-1.5 shadow-2xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <select
                        value={row.mode}
                        onChange={(e) => handleSplitRowChange(row.id, "mode", e.target.value)}
                        className="text-[10px] font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-slate-800 dark:text-slate-200 flex-1 outline-none"
                      >
                        {(salesPaymentModes.length > 0
                          ? salesPaymentModes
                          : ["Cash", "UPI & QR Code", "Credit / Debit Card", "Bank Transfer", "Store Credit / Khata", "Digital Wallet"]
                        ).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>

                      <div className="relative w-24">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono">₹</span>
                        <input
                          type="number"
                          min={0}
                          value={row.amount}
                          onChange={(e) => handleSplitRowChange(row.id, "amount", e.target.value)}
                          placeholder="0"
                          className="w-full text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 pl-4 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                        />
                      </div>

                      {splitRows.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSplitRow(row.id)}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded transition cursor-pointer"
                          title="Remove method"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[10px]">
                      {row.mode !== "Cash" ? (
                        <input
                          type="text"
                          value={row.ref}
                          onChange={(e) => handleSplitRowChange(row.id, "ref", e.target.value)}
                          placeholder="UTR / Ref No (Optional)"
                          className="flex-1 text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-300 font-mono outline-none"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Cash Tender</span>
                      )}
                      
                      {(row.mode.toLowerCase().includes("upi") || row.mode.toLowerCase().includes("qr")) && (
                        <button
                          type="button"
                          onClick={() => setPaymentModalOpen(true)}
                          className="text-[9px] font-bold text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded flex items-center gap-0.5 cursor-pointer"
                          title="Open dynamic UPI QR Code for this amount"
                        >
                          <QrCode className="w-2.5 h-2.5" />
                          <span>QR</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleAutoFillRemaining(row.id, roundedTotal)}
                        className="text-[9px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.5 rounded cursor-pointer"
                        title="Auto-balance remaining amount into this row"
                      >
                        Auto-Fill
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Split Row Button */}
              <button
                type="button"
                onClick={handleAddSplitRow}
                className="w-full py-1.5 border border-dashed border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>+ Add Split Payment Method</span>
              </button>

              {/* Split Summary & Status */}
              <div className="pt-1.5 border-t border-blue-200/60 dark:border-blue-800/60 flex items-center justify-between text-[11px] font-bold">
                {totalSplitAllocated === roundedTotal ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Exactly Balanced
                  </span>
                ) : totalSplitAllocated < roundedTotal ? (
                  <span className="text-amber-600 dark:text-amber-400 font-mono">
                    ₹{remainingSplitToAllocate.toLocaleString("en-IN")} Remaining
                  </span>
                ) : (
                  <span className="text-blue-600 dark:text-blue-400 font-mono">
                    ₹{splitChangeToReturn.toLocaleString("en-IN")} Change
                  </span>
                )}
                <span className="font-mono text-slate-900 dark:text-white">
                  {Math.round((totalSplitAllocated / (roundedTotal || 1)) * 100)}%
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                    Amount Paid
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setAmountPaid(String(roundedTotal))}
                      className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 rounded-md hover:bg-blue-100 transition-all cursor-pointer"
                    >
                      Exact
                    </button>
                    {[500, 1000, 2000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAmountPaid(String(amt))}
                        className="text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md hover:bg-slate-100 transition-all font-mono cursor-pointer"
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-extrabold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white pl-7 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [appearance:textfield]"
                  />
                </div>
              </div>

              {paidValue > roundedTotal ? (
                <div className="flex justify-between items-center text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl px-3 py-2 text-emerald-700 dark:text-emerald-400 shadow-2xs">
                  <span>Change Return</span>
                  <span className="font-mono text-sm">{fmt(paidValue - roundedTotal)}</span>
                </div>
              ) : (
                <div className="flex justify-between items-center text-xs font-bold bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl px-3 py-2 text-rose-700 dark:text-rose-400 shadow-2xs">
                  <span>Balance Due</span>
                  <span className="font-mono text-sm">{fmt(balanceDue)}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                >
                  {(salesPaymentModes.length > 0
                    ? salesPaymentModes
                    : ["Cash", "UPI & QR Code", "Credit / Debit Card", "Bank Transfer"]
                  ).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* UTR / Reference Input when required */}
              {requireRef && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center justify-between">
                    <span>UTR / Ref No</span>
                    <span className="text-red-500 font-bold">*Required</span>
                  </label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    className="w-full border border-amber-300 dark:border-amber-700 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 text-xs font-mono text-slate-900 dark:text-white px-3 py-1.5 outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}
            </>
          )}

          {error && (
            <div className="flex items-center justify-between gap-1 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl px-3 py-1.5 shadow-2xs">
              <span className="truncate flex-1 font-medium">{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                className="text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 p-0.5 rounded cursor-pointer"
                title="Dismiss error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleInitiatePayment}
            disabled={cart.length === 0 || saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-3 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            {isSplitMode ? (
              upiSplitTotal > 0 ? (
                <>
                  <QrCode className="w-4 h-4 text-white" />
                  <span>
                    {saving
                      ? "Processing..."
                      : `Show UPI QR (₹${upiSplitTotal.toLocaleString("en-IN")}) & Pay`}
                  </span>
                </>
              ) : hasAnyDigitalInSplit ? (
                <>
                  <CreditCard className="w-4 h-4 text-white" />
                  <span>
                    {saving
                      ? "Processing..."
                      : `Collect Split Payment (₹${roundedTotal.toLocaleString("en-IN")})`}
                  </span>
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4 text-white" />
                  <span>
                    {saving
                      ? "Saving..."
                      : `Collect Cash & Generate Invoice (₹${roundedTotal.toLocaleString("en-IN")})`}
                  </span>
                </>
              )
            ) : isDigitalMode ? (
              <>
                <QrCode className="w-4 h-4 text-white" />
                <span>{saving ? "Processing..." : `Scan QR & Pay ₹${roundedTotal.toLocaleString("en-IN")}`}</span>
              </>
            ) : (
              <>
                <Receipt className="w-4 h-4 text-white" />
                <span>{saving ? "Saving..." : `Collect Cash & Generate Invoice (₹${roundedTotal.toLocaleString("en-IN")})`}</span>
              </>
            )}
          </button>
        </div>
      </Card>

      {/* --- SALES RETURN MODAL --- */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Process Sales Return
                  </h3>
                  <p className="text-xs text-slate-500">
                    Return sold items and restore inventory according to Transaction Settings.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Return Settings Summary Badge */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap gap-2 justify-between">
              <span>
                Stock Restoral:{" "}
                <strong>
                  {txSettings?.restoreStockAfterReturn !== false
                    ? "Automatic"
                    : "Disabled"}
                </strong>
              </span>
              <span>
                Partial Return:{" "}
                <strong>
                  {txSettings?.allowPartialReturn !== false ? "Allowed" : "Full Only"}
                </strong>
              </span>
              <span>
                Passcode:{" "}
                <strong>
                  {txSettings?.requireReturnPasscode ? "Required" : "Not Required"}
                </strong>
              </span>
            </div>

            {/* Invoice Lookup */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Select Invoice / Enter Invoice No.
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={returnInvoiceNo}
                  onChange={(e) => setReturnInvoiceNo(e.target.value)}
                  className="flex-1 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Btn
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const match = pastOrders.find(
                      (o) =>
                        o.invoiceNo?.toLowerCase() ===
                        returnInvoiceNo.trim().toLowerCase()
                    );
                    if (match) {
                      handleSelectOrderForReturn(match);
                      setReturnError("");
                    } else {
                      setReturnError("No order found with this invoice number.");
                    }
                  }}
                >
                  Lookup
                </Btn>
              </div>
            </div>

            {/* Quick list of past orders */}
            {!selectedReturnOrder && pastOrders.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Recent Invoices
                </p>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {pastOrders.slice(0, 5).map((o) => (
                    <button
                      key={o._id}
                      type="button"
                      onClick={() => handleSelectOrderForReturn(o)}
                      className="w-full text-left text-xs p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 flex justify-between items-center"
                    >
                      <span className="font-mono font-bold text-blue-600">
                        {o.invoiceNo}
                      </span>
                      <span className="text-slate-500">
                        {o.customerName} • {fmt(o.totalOrderValue)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Direct product return if allowReturnWithoutInvoice is true */}
            {!selectedReturnOrder && txSettings?.allowReturnWithoutInvoice && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="text-xs font-semibold text-slate-700 block">
                  Or Add Direct Item to Return (No Invoice Mode)
                </label>
                <div className="flex gap-2">
                  <select
                    value={manualReturnProduct}
                    onChange={(e) => setManualReturnProduct(e.target.value)}
                    className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                  >
                    <option value="">Select product to return...</option>
                    {productList.map((p) => (
                      <option key={p._id || p.name} value={p._id || p.name}>
                        {p.name} ({fmt(p.price)})
                      </option>
                    ))}
                  </select>
                  <Btn
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const prod = productList.find(
                        (p) => (p._id || p.name) === manualReturnProduct
                      );
                      if (prod) {
                        setReturnItems((prev) => [
                          ...prev,
                          {
                            productId: prod._id,
                            name: prod.name,
                            sku: prod.sku,
                            price: prod.price,
                            qty: 1,
                            returnQty: 1,
                            selected: true,
                          },
                        ]);
                      }
                    }}
                  >
                    Add
                  </Btn>
                </div>
              </div>
            )}

            {/* Items list for Return */}
            {returnItems.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Select Items & Return Quantities:
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {returnItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-2">
                        {txSettings?.allowPartialReturn !== false && (
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setReturnItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, selected: checked } : it
                                )
                              );
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                        )}
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            @{fmt(item.price)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Return Qty:</span>
                        {txSettings?.allowPartialReturn !== false ? (
                          <input
                            type="number"
                            min={1}
                            max={item.qty || 999}
                            value={item.returnQty}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              setReturnItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, returnQty: val } : it
                                )
                              );
                            }}
                            className="w-16 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-right"
                          />
                        ) : (
                          <span className="font-mono font-bold">
                            {item.qty || 1} (Full)
                          </span>
                        )}
                        <span className="font-mono font-bold text-rose-600 min-w-[60px] text-right">
                          {fmt((item.price || 0) * (item.returnQty || 1))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Passcode input if requireReturnPasscode is enabled */}
            {txSettings?.requireReturnPasscode && (
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  Authorization Passcode / Password (Required)
                </label>
                <div className="relative">
                  <input
                    type={showReturnPasscode ? "text" : "password"}
                    value={returnPasscode}
                    onChange={(e) => setReturnPasscode(e.target.value)}
                    className="w-full border border-amber-300 bg-amber-50/40 rounded-lg px-3 py-2 pr-10 text-xs outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowReturnPasscode(!showReturnPasscode)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600/70 hover:text-amber-700 focus:outline-none"
                    tabIndex="-1"
                  >
                    {showReturnPasscode ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Reason & Refund Mode */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  Return Reason
                </label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  Refund Method
                </label>
                <select
                  value={returnPaymentMode}
                  onChange={(e) => setReturnPaymentMode(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                >
                  {["Cash", "UPI", "Bank Transfer", "Credit Note"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {returnError && (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-medium">
                {returnError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => setShowReturnModal(false)}
              >
                Cancel
              </Btn>
              <Btn
                variant="danger"
                size="md"
                onClick={handleProcessSalesReturn}
                disabled={processingReturn || returnItems.length === 0}
              >
                {processingReturn ? "Processing..." : "Confirm & Process Return"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENT COLLECTION MODAL ── */}
      {paymentModalOpen && (
        <Modal
          title={isSplitMode ? "Collect Split Multi-Payment" : `Collect Payment: ${paymentMode}`}
          onClose={() => setPaymentModalOpen(false)}
          className="max-w-md"
        >
          <div className="space-y-4">
            {/* Header Amount Box */}
            {isSplitMode ? (
              <div className="bg-blue-50/90 dark:bg-blue-950/50 p-4 rounded-xl border border-blue-200 dark:border-blue-800 text-center shadow-xs">
                {upiSplitTotal > 0 ? (
                  <>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-300 block mb-1">
                      UPI Amount to Collect via QR
                    </span>
                    <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                      ₹{upiSplitTotal.toLocaleString("en-IN")}
                    </span>
                    <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      <span>Total Bill: ₹{roundedTotal.toLocaleString("en-IN")}</span>
                      <span>·</span>
                      <span className="text-emerald-700 dark:text-emerald-400">Cash: ₹{cashSplitTotal.toLocaleString("en-IN")}</span>
                      {cardSplitTotal > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-purple-700 dark:text-purple-400">Card: ₹{cardSplitTotal.toLocaleString("en-IN")}</span>
                        </>
                      )}
                      {bankSplitTotal > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-indigo-700 dark:text-indigo-400">Bank: ₹{bankSplitTotal.toLocaleString("en-IN")}</span>
                        </>
                      )}
                    </div>
                  </>
                ) : cardSplitTotal > 0 ? (
                  <>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300 block mb-1">
                      Card Amount to Swipe on POS
                    </span>
                    <span className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">
                      ₹{cardSplitTotal.toLocaleString("en-IN")}
                    </span>
                    <div className="mt-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Total Bill: ₹{roundedTotal.toLocaleString("en-IN")} · Cash: ₹{cashSplitTotal.toLocaleString("en-IN")}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                      Total Split Bill
                    </span>
                    <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                      ₹{roundedTotal.toLocaleString("en-IN")}
                    </span>
                    <div className="mt-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      Cash Tender: ₹{cashSplitTotal.toLocaleString("en-IN")}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Total Payable Amount
                </span>
                <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                  ₹{roundedTotal.toLocaleString("en-IN")}
                </span>
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Ready for Customer Scan & Payment
                  </span>
                </div>
              </div>
            )}

            {/* Multi-Split Mode Views */}
            {isSplitMode ? (
              <div className="space-y-3">
                {/* UPI QR Code specifically for the UPI split portion */}
                {(upiSplitTotal > 0 || splitRows.some((r) => r.mode.toLowerCase().includes("upi") || r.mode.toLowerCase().includes("qr"))) && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center shadow-xs space-y-2">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs inline-block mx-auto">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                          `upi://pay?pa=${bUpiId || "smartbill@upi"}&pn=${encodeURIComponent(
                            bName || "SmartBill Store"
                          )}&am=${upiSplitTotal > 0 ? upiSplitTotal : roundedTotal}&cu=INR`
                        )}&margin=4`}
                        alt="UPI QR Code"
                        className="w-44 h-44 mx-auto rounded-lg"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {bName || "SmartBill Enterprise Store"}
                      </p>
                      <p className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                        {bUpiId || "merchant@upi"}
                      </p>
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-lg py-1 px-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      QR encoded for UPI portion: ₹{upiSplitTotal > 0 ? upiSplitTotal.toLocaleString("en-IN") : roundedTotal.toLocaleString("en-IN")}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Scan with <strong>GPay, PhonePe, Paytm, BHIM, Amazon Pay</strong>, or any UPI app.
                    </p>
                  </div>
                )}

                {/* Card Swipe Section */}
                {cardSplitTotal > 0 && (
                  <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-xl p-3.5 text-center space-y-1.5">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 flex items-center justify-center mx-auto">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-bold text-purple-900 dark:text-purple-200">
                      Swipe Card on POS EDC Terminal
                    </p>
                    <p className="text-xs text-purple-800 dark:text-purple-300 font-mono font-bold">
                      Enter Card Amount: <strong>₹{cardSplitTotal.toLocaleString("en-IN")}</strong>
                    </p>
                  </div>
                )}

                {/* Bank Transfer Section */}
                {bankSplitTotal > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1 text-xs">
                    <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Landmark className="w-4 h-4 text-purple-600" />
                      <span>Bank IMPS/NEFT Amount: <strong className="text-blue-600 font-mono">₹{bankSplitTotal.toLocaleString("en-IN")}</strong></span>
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                      Bank: {bBankName || "HDFC Bank"} | A/C: {bAccNo || "50200012345678"} | IFSC: {bIfsc || "HDFC0001234"}
                    </p>
                  </div>
                )}

                {/* Split Breakdown List */}
                <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 rounded-xl p-3 space-y-2 text-xs">
                  <p className="font-bold text-blue-900 dark:text-blue-200">Split Breakdown Allocations</p>
                  <div className="space-y-1 divide-y divide-blue-100 dark:divide-blue-900/40">
                    {splitRows
                      .filter((r) => Number(r.amount) > 0)
                      .map((row) => (
                        <div key={row.id} className="pt-1 flex items-center justify-between text-slate-800 dark:text-slate-200">
                          <span className="font-medium">{row.mode} {row.ref ? `(${row.ref})` : ""}:</span>
                          <span className="font-mono font-bold">₹{Number(row.amount).toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Single Payment Mode Views (When not in split mode) */
              <>
                {/* UPI & QR Code View */}
                {(paymentMode.toLowerCase().includes("upi") || paymentMode.toLowerCase().includes("qr")) && (
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center shadow-xs">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs inline-block mx-auto mb-2">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                            `upi://pay?pa=${bUpiId || "smartbill@upi"}&pn=${encodeURIComponent(
                              bName || "SmartBill Store"
                            )}&am=${roundedTotal}&cu=INR`
                          )}&margin=4`}
                          alt="UPI QR Code"
                          className="w-44 h-44 mx-auto rounded-lg"
                        />
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {bName || "SmartBill Enterprise Store"}
                        </p>
                        <p className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                          {bUpiId || "merchant@upi"}
                        </p>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                        Scan with <strong>GPay, PhonePe, Paytm, BHIM, Amazon Pay</strong>, or any UPI banking app.
                      </p>
                    </div>
                  </div>
                )}

                {/* Card / POS Terminal View */}
                {paymentMode.toLowerCase().includes("card") && (
                  <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-xl p-4 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 flex items-center justify-center mx-auto">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-purple-900 dark:text-purple-200">
                      Swipe / Tap Card on POS EDC Machine
                    </p>
                    <p className="text-[11px] text-purple-700 dark:text-purple-300">
                      Enter <strong>₹{roundedTotal}</strong> on terminal and swipe customer's Visa, Mastercard, or RuPay card.
                    </p>
                  </div>
                )}

                {/* Bank Transfer View */}
                {paymentMode.toLowerCase().includes("bank") && (
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-1 text-xs">
                    <p className="font-bold text-slate-900 dark:text-white mb-1.5 flex items-center gap-1.5">
                      <Landmark className="w-4 h-4 text-purple-600" />
                      <span>Business Bank Details</span>
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      <strong>Bank:</strong> {bBankName || "HDFC Bank"} ({bAccType || "Current"})
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      <strong>Account No:</strong> {bAccNo || "50200012345678"}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      <strong>IFSC:</strong> {bIfsc || "HDFC0001234"}
                    </p>
                  </div>
                )}

                {/* UTR / Transaction Reference Input */}
                {requireRef && (
                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block flex items-center justify-between">
                      <span>UTR / Transaction Reference No</span>
                      <span className="text-red-500 font-bold">*Required</span>
                    </label>
                    <input
                      type="text"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder="e.g. UPI Ref / Approval Code / UTR"
                      className="w-full border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}
              </>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <Btn
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPaymentModalOpen(false)}
                className="flex-1 text-xs"
              >
                Change Mode / Back
              </Btn>

              <button
                type="button"
                onClick={handleGenerateInvoice}
                disabled={saving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 px-3 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>{saving ? "Generating..." : "Payment Received → Generate Invoice"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}



