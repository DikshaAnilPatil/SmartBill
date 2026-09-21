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
  FileText,
  History,
  Maximize2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  User,
  UserCheck,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { fmt } from "@shared/utils/format";
import { Badge, Btn, Card, Input, Select, Modal, StepperInput, GST_RATES } from "@shared/components/common/ui";
import { createOrder } from "@shared/api/orderAPI";
import { fetchCustomers, createCustomer } from "@shared/api/customerAPI";
import { getProducts } from "@shared/api/productAPI";
import { getInvoiceSettings } from "@shared/api/invoiceSettingsAPI";
import { fetchPartySettings } from "@shared/api/partySettingsAPI";
import { useTransactionSettings } from "@shared/hooks/useTransactionSettings";
import CameraBarcodeScanner from "@shared/components/common/CameraBarcodeScanner";
import { getProductCategoriesForIndustry } from "@shared/utils/businessCategories";
import POSInvoiceModal from "./pos/POSInvoiceModal";

export default function POSScreen() {
  const { settings: txSettings } = useTransactionSettings();

  const activeBiz = useMemo(() => {
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
  }, []);

  const [posMode, setPosMode] = useState(() => {
    try {
      const rawUser = localStorage.getItem("smartbill_user");
      const u = rawUser ? JSON.parse(rawUser) : {};
      return String(u?.businessType || "").toLowerCase() === "wholesale" ? "Wholesale" : "Retail";
    } catch {
      return "Retail";
    }
  });
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);

  const [cart, setCart] = useState([]);
  const [isBillingSideOpen, setIsBillingSideOpen] = useState(true);
  const [lastAddedItemId, setLastAddedItemId] = useState(null);
  const [showDetailedBilledModal, setShowDetailedBilledModal] = useState(false);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [showSummaryBreakdown, setShowSummaryBreakdown] = useState(false);
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
    return ["Cash", "UPI", "Credit Card", "Debit Card"];
  });

  const [paymentMode, setPaymentMode] = useState("Cash");

  const [transactionRef, setTransactionRef] = useState("");
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitRows, setSplitRows] = useState([
    { id: 1, mode: "Cash", amount: "", ref: "" },
    { id: 2, mode: "UPI", amount: "", ref: "" },
  ]);

  const handleAddSplitRow = () => {
    const nextId = splitRows.length > 0 ? Math.max(...splitRows.map((r) => r.id)) + 1 : 1;
    setSplitRows((prev) => [
      ...prev,
      {
        id: nextId,
        mode: "Credit Card",
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
          const validModes = ["Cash", "UPI", "Credit Card", "Debit Card"];
          setSalesPaymentModes(validModes);
          if (!validModes.includes(paymentMode)) {
            setPaymentMode(validModes[0]);
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
      if (posMode === "Wholesale") {
        return p.wholesalePrice && Number(p.wholesalePrice) > 0
          ? Number(p.wholesalePrice)
          : p.cost && Number(p.cost) > 0
            ? Math.round(Number(p.cost) * 1.15)
            : Number(p.price) || 0;
      }
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
    [posMode, txSettings?.salePrice]
  );

  const handleTogglePosMode = (newMode) => {
    setPosMode(newMode);
    setCart((prev) =>
      prev.map((item) => {
        const newPrice =
          newMode === "Wholesale"
            ? item.product?.wholesalePrice && Number(item.product.wholesalePrice) > 0
              ? Number(item.product.wholesalePrice)
              : Number(item.product?.price) || item.price
            : Number(item.product?.price) || item.price;
        return { ...item, price: newPrice };
      })
    );
    showToast(`✓ Switched to ${newMode === "Wholesale" ? "🏢 Wholesale B2B Mode" : "🛒 Retail B2C Mode"}`);
  };

  // Derived selected customer matching current customer input
  const selectedCustomer = useMemo(() => {
    if (!customer || !customer.trim() || customer === "Walk-in Customer") return null;
    return (customers || []).find(
      (c) =>
        c &&
        c.name &&
        String(c.name).trim().toLowerCase() === String(customer).trim().toLowerCase()
    );
  }, [customers, customer]);

  const isNewCustomer = Boolean(
    customer &&
    customer.trim() !== "" &&
    customer !== "Walk-in Customer" &&
    !selectedCustomer
  );

  const handleCustomerChange = (val) => {
    setCustomer(val);
    if (!val || val.trim() === "" || val === "Walk-in Customer") {
      setCustomerPhone("");
      setCustomerCity("");
      setCustomerEmail("");
    }
  };

  // Auto-sync customer contact details when an existing customer is selected
  useEffect(() => {
    if (selectedCustomer) {
      setCustomerPhone(selectedCustomer.phone || "");
      setCustomerCity(selectedCustomer.city || "");
      setCustomerEmail(selectedCustomer.email || "");
    }
  }, [selectedCustomer]);

  // Load products from backend API with fallback
  const loadProductsList = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await getProducts();
      if (res && Array.isArray(res.products)) {
        setProductList(res.products.filter((p) => p && (p.status === "Active" || !p.status)));
      }
    } catch (err) {
      console.warn("Failed to load POS products:", err);
    } finally {
      setLoadingProducts(false);
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

    // Load products
    loadProductsList();

    const handleProductsOrStockUpdated = () => {
      loadProductsList();
    };

    window.addEventListener("stockUpdated", handleProductsOrStockUpdated);
    window.addEventListener("productUpdated", handleProductsOrStockUpdated);
    window.addEventListener("orderCreated", handleProductsOrStockUpdated);
    window.addEventListener("purchaseCreated", handleProductsOrStockUpdated);

    return () => {
      window.removeEventListener("partySettingsUpdated", handleSettingsUpdated);
      window.removeEventListener("stockUpdated", handleProductsOrStockUpdated);
      window.removeEventListener("productUpdated", handleProductsOrStockUpdated);
      window.removeEventListener("orderCreated", handleProductsOrStockUpdated);
      window.removeEventListener("purchaseCreated", handleProductsOrStockUpdated);
    };
  }, [loadProductsList]);

  const [stockFilter, setStockFilter] = useState("in_stock"); // "in_stock" | "all"

  const allowNegativeStock = txSettings?.allowNegativeStock === true;

  const inStockCount = useMemo(
    () => (productList || []).filter((p) => (Number(p.stock) || 0) > 0).length,
    [productList]
  );
  const outOfStockCount = useMemo(
    () => (productList || []).filter((p) => (Number(p.stock) || 0) <= 0).length,
    [productList]
  );

  const availableCategories = useMemo(() => {
    const bizCategory = activeBiz?.businessCategory || "";
    const industryPresets = getProductCategoriesForIndustry(bizCategory, posMode);
    const cats = new Set(industryPresets);
    (productList || []).forEach((p) => {
      if (p.category && String(p.category).trim()) {
        cats.add(String(p.category).trim());
      }
    });
    return ["All", ...Array.from(cats)];
  }, [productList, activeBiz?.businessCategory, posMode]);

  const filteredProducts = (productList || []).filter((p) => {
    if (!p) return false;
    if (selectedCategory !== "All" && p.category !== selectedCategory) return false;
    const searchClean = (search || "").toLowerCase().trim();
    const matchesSearch =
      !searchClean ||
      (p.name && String(p.name).toLowerCase().includes(searchClean)) ||
      (p.sku && String(p.sku).toLowerCase().includes(searchClean)) ||
      (p.barcode && String(p.barcode).toLowerCase().includes(searchClean)) ||
      (p.batchNo && String(p.batchNo).toLowerCase().includes(searchClean)) ||
      (p.size && String(p.size).toLowerCase().includes(searchClean));
    if (!matchesSearch) return false;

    const inStock = Number(p.stock) || 0;
    if (stockFilter === "in_stock" && !allowNegativeStock) {
      return inStock > 0;
    }
    return true;
  });
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

    // Auto-open billing side panel & highlight newly added product
    setIsBillingSideOpen(true);
    setLastAddedItemId(targetId);
    setTimeout(() => {
      setLastAddedItemId((prev) => (prev === targetId ? null : prev));
    }, 2200);
    showToast(`✓ Added "${p.name}" to Bill`);
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

  const updateItemGstRate = (id, val) => {
    const numericGst = Math.max(0, Number(val) || 0);
    setCart((c) =>
      c.map((i) =>
        getProductId(i.product) === id ? { ...i, gstRate: numericGst } : i
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
        i?.gstRate !== undefined
          ? i.gstRate
          : (i?.product?.gst ?? i?.product?.gstRate ?? 18)
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

  const cashSuggestions = useMemo(() => {
    if (roundedTotal <= 0) return [];
    const suggestions = [roundedTotal];
    const standardNotes = [50, 100, 200, 500, 2000, 5000];
    for (const note of standardNotes) {
      if (note > roundedTotal && !suggestions.includes(note)) {
        suggestions.push(note);
      }
    }
    const next100 = Math.ceil(roundedTotal / 100) * 100;
    if (next100 > roundedTotal && !suggestions.includes(next100)) {
      suggestions.push(next100);
    }
    return suggestions.sort((a, b) => a - b).slice(0, 4);
  }, [roundedTotal]);

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
      : s.template === "Bold"
      ? { headerBg: '#0f172a', headerColor: '#f8fafc', border: '2px solid #0f172a' }
      : s.template === "GST_Detailed"
      ? { headerBg: '#f1f5f9', headerColor: '#0f172a', border: '1px solid #94a3b8' }
      : s.template === "Minimal"
      ? { headerBg: 'transparent', headerColor: '#333333', border: '1px solid #eeeeee' }
      : { headerBg: '#f8fafc', headerColor: '#0f172a', border: '1px solid #e2e8f0' };
      
    const pSize = s.paperSize || "A4";
    const isThermal = s.template === "Thermal" || pSize.includes("Thermal") || pSize.includes("58") || pSize.includes("80");
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
      gstRate: i.productGstRate,
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

      // Show Print Preview
      setShowInvoice(true);
      showToast(`✓ Invoice ${res.order?.invoiceNo || ""} generated successfully!`);
      loadPastOrders();
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

  if (showInvoice) {
    return (
      <POSInvoiceModal
        order={lastOrder}
        cart={cart}
        customer={customer}
        subtotal={subtotal}
        gst={gst}
        total={total}
        paidValue={paidValue}
        paymentMode={paymentMode}
        activeBiz={activeBiz}
        paymentSettings={paymentSettings}
        handlePrintInvoice={handlePrintInvoice}
        getProductDefaultPrice={getProductDefaultPrice}
        onClose={() => {
          setShowInvoice(false);
          setCart([]);
          setAmountPaid("");
          setGlobalDiscount(0);
          setLastOrder(null);
        }}
      />
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
      <div className="flex-1 flex flex-col gap-3.5 min-w-0">
        {/* Top Bar: Mode Switcher & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Mode Switcher Buttons */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex-shrink-0">
            <button
              type="button"
              onClick={() => handleTogglePosMode("Retail")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                posMode === "Retail"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-extrabold ring-1 ring-blue-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <span>🛒 Retail B2C</span>
            </button>
            <button
              type="button"
              onClick={() => handleTogglePosMode("Wholesale")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                posMode === "Wholesale"
                  ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-2xs font-extrabold ring-1 ring-purple-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <span>🏢 Wholesale B2B</span>
            </button>
          </div>

          <div className="flex-1 flex items-center gap-2">
            <Input
              value={search}
              onChange={setSearch}
              icon={<ScanLine className="w-4 h-4" />}
              placeholder="Search products, SKU, barcode, batch..."
              className="flex-1"
            />
            <Btn
              variant="outline"
              size="md"
              onClick={() => setCameraScannerOpen(true)}
              icon={<ScanLine className="w-4 h-4 text-emerald-600" />}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 font-bold"
              title="Open camera barcode scanner"
            >
              Scan Barcode
            </Btn>
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
          </div>
        </div>

        {/* Category Filter Pills (Horizontal Scrollable) */}
        {availableCategories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {availableCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? posMode === "Wholesale"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Stock Filter Tabs & Active Mode Banner */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setStockFilter("in_stock")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                stockFilter === "in_stock"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              In Stock for Sale ({inStockCount})
            </button>
            <button
              type="button"
              onClick={() => setStockFilter("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                stockFilter === "all"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              All Items ({productList.length})
            </button>
          </div>

          {posMode === "Wholesale" ? (
            <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-lg px-2.5 py-1 text-[11px] text-purple-700 dark:text-purple-300 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <span>Wholesale Bulk Pricing Active (Auto-applying Wholesale Rates)</span>
            </div>
          ) : (
            outOfStockCount > 0 && stockFilter === "in_stock" && (
              <span className="text-[11px] text-slate-400">
                ({outOfStockCount} out-of-stock items hidden)
              </span>
            )
          )}
        </div>

        {loadingProducts ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Loading products from database...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-sm bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 p-8 text-center space-y-3">
            <Package className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-1" />
            <div>
              <p className="font-bold text-gray-800 dark:text-slate-200 text-base">
                {search ? `No in-stock products match "${search}"` : "No in-stock products available for sale"}
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                {outOfStockCount > 0 && stockFilter === "in_stock"
                  ? `You have ${outOfStockCount} item(s) in your catalog awaiting stock. Record a Purchase Bill from a supplier to inward inventory and enable billing!`
                  : "Please check your search keyword or add products and purchase stock from suppliers."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 overflow-y-auto pr-2 flex-1">
            {filteredProducts.map((p, idx) => {
              const pId = getProductId(p) || idx;
              const stockCount = Number(p.stock) || 0;
              const isOut = !allowNegativeStock && stockCount <= 0;
              const defaultPrice = getProductDefaultPrice(p);
              const hasWholesalePrice = p.wholesalePrice && Number(p.wholesalePrice) > 0;

              return (
                <button
                  key={pId}
                  onClick={() => addToCart(p)}
                  disabled={isOut}
                  className={`bg-white dark:bg-slate-900 border rounded-xl p-3 text-left transition-all group flex items-center gap-3.5 shadow-2xs hover:shadow-sm ${
                    isOut
                      ? "opacity-60 border-gray-200 dark:border-slate-800 cursor-not-allowed bg-gray-50 dark:bg-slate-900/60"
                      : posMode === "Wholesale"
                      ? "border-purple-200/80 dark:border-slate-700 hover:border-purple-400 hover:bg-purple-50/20"
                      : "border-slate-200/80 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/20"
                  }`}
                >
                  <div className={`w-11 h-11 rounded-lg flex-shrink-0 flex items-center justify-center ${
                    posMode === "Wholesale" ? "bg-purple-100/70 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400" : "bg-blue-100/70 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
                  }`}>
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {p.name}
                      </p>
                      {p.category && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {p.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                      <span className="text-slate-400 font-mono text-[11px]">
                        {p.sku || "NO-SKU"}
                      </span>
                      {p.barcode && (
                        <span className="text-slate-400 font-mono text-[10px]">
                          • {p.barcode}
                        </span>
                      )}

                      {/* Pharmacy Details */}
                      {(p.batchNo || p.expiryDate) && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800">
                          {p.batchNo ? `Lot: ${p.batchNo}` : ""} {p.expiryDate ? `Exp: ${p.expiryDate}` : ""}
                        </span>
                      )}

                      {/* Apparel Details */}
                      {(p.size || p.color) && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300 rounded border border-pink-200 dark:border-pink-800">
                          {p.size ? `Size: ${p.size}` : ""} {p.color ? `• ${p.color}` : ""}
                        </span>
                      )}

                      {/* Wholesale MOQ details */}
                      {posMode === "Wholesale" && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-800">
                          MOQ: {p.minOrderQty || 1} {p.packSize ? `(Pack: ${p.packSize})` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-sm font-extrabold font-mono ${posMode === "Wholesale" ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"}`}>
                      {fmt(defaultPrice)}
                    </span>
                    {posMode !== "Wholesale" && hasWholesalePrice && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        Bulk: {fmt(p.wholesalePrice)}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
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
                        : `Stock: ${stockCount} ${p.unit || "pcs"}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile / Tablet Backdrop when side billing panel is open */}
      {isBillingSideOpen && (
        <div
          onClick={() => setIsBillingSideOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 lg:hidden animate-in fade-in"
        />
      )}

      {/* Floating Billed Products Trigger when side panel is closed */}
      {!isBillingSideOpen && (
        <button
          type="button"
          onClick={() => setIsBillingSideOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 cursor-pointer animate-in fade-in"
        >
          <ShoppingBag className="w-5 h-5 animate-bounce" />
          <div className="text-left">
            <p className="text-xs font-bold leading-tight">
              Billed Products ({cart.length})
            </p>
            <p className="text-[10px] font-mono opacity-90">{fmt(roundedTotal)} • Tap to Open</p>
          </div>
        </button>
      )}

      {/* Right: Billed Products Side Panel / Drawer */}
      <Card
        className={`${
          isBillingSideOpen ? "flex" : "hidden lg:flex"
        } fixed lg:static inset-y-0 right-0 z-40 lg:z-auto w-full sm:w-[460px] lg:w-[440px] xl:w-[480px] flex-shrink-0 flex-col h-full rounded-none lg:rounded-md border-l lg:border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-2xl lg:shadow-sm transition-all`}
      >
        {/* Header & Compact Customer Selection */}
        <div className="p-3 bg-gray-50/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 space-y-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg text-white flex items-center justify-center ${
                posMode === "Wholesale" ? "bg-purple-600" : "bg-blue-600"
              }`}>
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-xs leading-snug tracking-tight">
                  {posMode === "Wholesale" ? "Wholesale B2B Bill" : "Products to Bill"}
                </h3>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {cart.length} {cart.length === 1 ? "product" : "products"} •{" "}
                  {cart.reduce((s, i) => s + i.qty, 0)} units
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {cart.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowDetailedBilledModal(true)}
                    className="text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2 py-1 rounded-lg transition-all font-bold border border-transparent hover:border-blue-200 dark:hover:border-blue-900/50 cursor-pointer"
                    title="Open full detailed table breakdown"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span className="hidden sm:inline">Table View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCart([]);
                      setGlobalDiscount(0);
                    }}
                    className="text-[10px] text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2 py-1 rounded-lg transition-all font-bold border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 cursor-pointer"
                    title="Clear all items in cart"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setIsBillingSideOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition lg:hidden cursor-pointer"
                title="Close billing panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Enhanced Customer Bar with Automatic Contact Info for New Customers */}
          <div className="bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80 rounded-xl p-2.5 shadow-2xs space-y-2 transition-all">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  selectedCustomer
                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400"
                    : isNewCustomer
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400 animate-pulse"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                }`}
              >
                {selectedCustomer ? (
                  <UserCheck className="w-4 h-4" />
                ) : isNewCustomer ? (
                  <UserPlus className="w-4 h-4" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>

              <div className="relative flex-1 min-w-0">
                <input
                  list="pos-customers-list"
                  value={customer}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  placeholder={posMode === "Wholesale" ? "Select Wholesale Party / Buyer (or type name...)" : "Walk-in Customer (or search/type customer name...)"}
                  className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-lg pl-2.5 pr-7 py-1.5 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
                />
                {customer && customer !== "Walk-in Customer" && (
                  <button
                    type="button"
                    onClick={() => handleCustomerChange("Walk-in Customer")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition cursor-pointer"
                    title="Reset to Walk-in Customer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <datalist id="pos-customers-list">
                  <option value="Walk-in Customer">Walk-in Customer</option>
                  {customers.map((c) => (
                    <option key={c._id || c.name} value={c.name} />
                  ))}
                </datalist>
              </div>

              {/* Verified or New Status Badge */}
              {selectedCustomer ? (
                <button
                  type="button"
                  onClick={() => setShowCustomerDetails(!showCustomerDetails)}
                  className="text-[10px] font-bold px-2 py-1 rounded-lg border bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition flex items-center gap-1 flex-shrink-0 cursor-pointer"
                  title="Toggle client details"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">Verified</span>
                  {showCustomerDetails ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              ) : isNewCustomer ? (
                <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1 flex-shrink-0 shadow-2xs">
                  <Sparkles className="w-3 h-3 text-blue-500" />
                  <span>New Client</span>
                </span>
              ) : null}
            </div>

            {/* AUTOMATIC CONTACT INPUTS FOR NEW CUSTOMER */}
            {isNewCustomer && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 animate-in fade-in slide-in-from-top-1 duration-200 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold px-0.5">
                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                    <UserPlus className="w-3 h-3" />
                    Customer Details (Auto-saved to CRM):
                  </span>
                  <span className="text-[9px] text-slate-400 font-normal">
                    On billing
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div className="relative">
                    <Phone className="w-3 h-3 absolute left-2 top-2 text-slate-400 pointer-events-none" />
                    <input
                      type="tel"
                      placeholder="Mobile / Phone *"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full pl-6 pr-2 py-1 text-[11px] font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="relative">
                    <MapPin className="w-3 h-3 absolute left-2 top-2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="City / Area"
                      value={customerCity}
                      onChange={(e) => setCustomerCity(e.target.value)}
                      className="w-full pl-6 pr-2 py-1 text-[11px] font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="col-span-2 relative">
                    <Mail className="w-3 h-3 absolute left-2 top-2 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      placeholder="Email Address (Optional)"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full pl-6 pr-2 py-1 text-[11px] font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* EXISTING CUSTOMER SUMMARY (Automatic) */}
            {selectedCustomer && (
              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700/60 space-y-1 animate-in fade-in">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 truncate font-medium">
                    {selectedCustomer.phone ? (
                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-200 font-semibold">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {selectedCustomer.phone}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">No phone saved</span>
                    )}
                    {selectedCustomer.city && (
                      <span className="flex items-center gap-0.5 text-slate-500 text-[10px]">
                        • <MapPin className="w-2.5 h-2.5 text-slate-400" />{" "}
                        {selectedCustomer.city}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 text-[10px]">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                      Paid: {fmt(selectedCustomer.totalPaid || 0)}
                    </span>
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded ${
                        Number(selectedCustomer.balance) !== 0
                          ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      }`}
                    >
                      Due: {fmt(Math.abs(selectedCustomer.balance || 0))}
                    </span>
                  </div>
                </div>

                {/* If toggled, also allow editing existing details */}
                {showCustomerDetails && (
                  <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700/60 animate-in fade-in">
                    <input
                      type="tel"
                      placeholder="Edit Phone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[11px] bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Edit City"
                      value={customerCity}
                      onChange={(e) => setCustomerCity(e.target.value)}
                      className="border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[11px] bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                    />
                    <input
                      type="email"
                      placeholder="Edit Email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="col-span-2 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[11px] bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cart Item Scrollable List - Maximized Height */}
        <div className="flex-1 overflow-y-auto min-h-[160px] p-3 space-y-2 bg-slate-50/40 dark:bg-slate-900/40">
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
                  className={`border rounded-xl p-3 transition-all shadow-2xs group space-y-2 ${
                    lastAddedItemId === itemId
                      ? "bg-blue-50/90 dark:bg-blue-950/50 border-blue-400 dark:border-blue-500 ring-2 ring-blue-400/40 animate-pulse"
                      : "bg-slate-50/90 dark:bg-slate-800/70 hover:bg-slate-100/90 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate leading-snug">
                          {prodName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          SKU: {item.product?.sku || "NO-SKU"}
                        </p>
                      </div>
                    </div>
                    {lastAddedItemId === itemId && (
                      <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-full">
                        Just Added
                      </span>
                    )}
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

                    {/* Item GST Slab Dropdown */}
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5" title="GST Rate Slab">
                      <span className="text-[9px] text-slate-400 font-mono">GST</span>
                      <select
                        value={item.gstRate !== undefined ? item.gstRate : (item.product?.gst ?? item.product?.gstRate ?? 18)}
                        onChange={(e) => updateItemGstRate(itemId, e.target.value)}
                        className="bg-transparent text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                      >
                        {GST_RATES.map((g) => (
                          <option key={g.value} value={g.value}>
                            {g.value}%
                          </option>
                        ))}
                      </select>
                    </div>

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
        <div className="p-3 bg-slate-50/90 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 space-y-2 flex-shrink-0">
          {/* Quick Summary Card with Collapsible Details */}
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-2.5 shadow-2xs space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                  Payable:
                </span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-extrabold text-base">
                  {fmt(roundedTotal)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSummaryBreakdown(!showSummaryBreakdown)}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>{showSummaryBreakdown ? "Hide Tax/Discount" : "Tax & Discount ▾"}</span>
              </button>
            </div>

            {/* Collapsible Breakdown (Subtotal, GST, Discounts, Rounding) */}
            {showSummaryBreakdown && (
              <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 space-y-1 text-[11px] animate-in fade-in">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono">{fmt(grossSubtotal)}</span>
                </div>
                {allowDiscount && discountAppliedOn === "Entire Invoice" && (
                  <div className="flex justify-between items-center text-amber-700">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      Invoice Discount ({discountType === "Percentage" ? "%" : "₹"})
                    </span>
                    <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded px-1.5 py-0.5">
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
                        className="w-12 text-[10px] font-mono font-bold text-amber-900 dark:text-amber-300 bg-transparent outline-none text-right"
                      />
                      <span className="text-[10px] font-bold text-amber-700">
                        -{fmt(invoiceDiscountAmount)}
                      </span>
                    </div>
                  </div>
                )}
                {paymentMode === "Cash" && cashDiscountPct > 0 && cashDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Cash Discount ({cashDiscountPct}%)</span>
                    <span className="font-mono">-{fmt(cashDiscountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>GST Tax</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    +{fmt(gst)}
                  </span>
                </div>
                {enableRoundOff && roundOffAmount !== 0 && (
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Round-off</span>
                    <span className="font-mono">
                      {roundOffAmount > 0 ? `+${fmt(roundOffAmount)}` : `-${fmt(Math.abs(roundOffAmount))}`}
                    </span>
                  </div>
                )}
                {isCash && isCashRounding && cashRoundOff !== 0 && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400">
                    <span>Cash Rounding</span>
                    <span className="font-mono">
                      {cashRoundOff > 0 ? `+${fmt(cashRoundOff)}` : `-${fmt(Math.abs(cashRoundOff))}`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Split Payment Toggle */}
          {allowSplit && (
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
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
                      { id: 2, mode: "UPI", amount: String(roundedTotal - half), ref: "" },
                    ]);
                  }
                }}
                className={`px-2 py-0.5 text-[9px] font-bold rounded-lg transition-all cursor-pointer ${
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
            <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 rounded-xl space-y-2 text-xs shadow-2xs">
              <div className="flex items-center justify-between pb-1 border-b border-blue-200/60 dark:border-blue-800/60">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                  Split Allocations
                </span>
                <span className="text-[10px] font-bold font-mono text-blue-700 dark:text-blue-300">
                  ₹{totalSplitAllocated.toLocaleString("en-IN")} / ₹{roundedTotal.toLocaleString("en-IN")}
                </span>
              </div>

              {/* Split Rows */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {splitRows.map((row) => (
                  <div
                    key={row.id}
                    className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-blue-100 dark:border-slate-800 space-y-1 shadow-2xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <select
                        value={row.mode}
                        onChange={(e) => handleSplitRowChange(row.id, "mode", e.target.value)}
                        className="text-[10px] font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-slate-800 dark:text-slate-200 flex-1 outline-none"
                      >
                        {["Cash", "UPI", "Credit Card", "Debit Card"].map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>

                      <div className="relative w-20">
                        <span className="absolute left-1 top-0.5 text-[10px] text-slate-400 font-mono">₹</span>
                        <input
                          type="number"
                          min={0}
                          value={row.amount}
                          onChange={(e) => handleSplitRowChange(row.id, "amount", e.target.value)}
                          placeholder="0"
                          className="w-full text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 pl-4 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                        />
                      </div>

                      {splitRows.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSplitRow(row.id)}
                          className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition cursor-pointer"
                          title="Remove method"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[10px]">
                      <input
                        type="text"
                        value={row.ref}
                        onChange={(e) => handleSplitRowChange(row.id, "ref", e.target.value)}
                        placeholder="Ref (Opt)"
                        className="flex-1 text-[9px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-slate-700 dark:text-slate-300 outline-none"
                      />
                      
                      {(row.mode.toLowerCase().includes("upi") || row.mode.toLowerCase().includes("qr")) && (
                        <button
                          type="button"
                          onClick={() => setPaymentModalOpen(true)}
                          className="text-[9px] font-bold text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-1 py-0.5 rounded flex items-center gap-0.5 cursor-pointer"
                          title="Open dynamic UPI QR Code"
                        >
                          <QrCode className="w-2.5 h-2.5" />
                          <span>QR</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleAutoFillRemaining(row.id, roundedTotal)}
                        className="text-[9px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.5 rounded cursor-pointer"
                        title="Auto-balance remaining amount"
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
                className="w-full py-1 border border-dashed border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>+ Add Method</span>
              </button>

              {/* Split Summary & Status */}
              <div className="pt-1 border-t border-blue-200/60 dark:border-blue-800/60 flex items-center justify-between text-[10px] font-bold">
                {totalSplitAllocated === roundedTotal ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Balanced
                  </span>
                ) : totalSplitAllocated < roundedTotal ? (
                  <span className="text-amber-600 dark:text-amber-400 font-mono">
                    ₹{remainingSplitToAllocate.toLocaleString("en-IN")} Rem.
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
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">
                    Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    {["Cash", "UPI", "Credit Card", "Debit Card"].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-0.5">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">
                    Amount Paid
                  </label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={amountPaid}
                      placeholder={roundedTotal}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white pl-5 pr-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 1-Click Fast Cash Tender Shortcuts for Cashier */}
              {isCash && cashSuggestions.length > 0 && (
                <div className="space-y-1 pt-0.5 pb-1">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">
                    ⚡ 1-Click Fast Cash Tender
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {cashSuggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setAmountPaid(String(sug))}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          Number(amountPaid) === sug
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {sug === roundedTotal ? `Exact: ₹${sug}` : `₹${sug}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {paidValue > roundedTotal ? (
                <div className="flex justify-between items-center text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-lg px-2.5 py-1 text-emerald-700 dark:text-emerald-400 shadow-2xs">
                  <span>Change Return:</span>
                  <span className="font-mono">{fmt(paidValue - roundedTotal)}</span>
                </div>
              ) : balanceDue > 0 ? (
                <div className="flex justify-between items-center text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg px-2.5 py-1 text-rose-700 dark:text-rose-400 shadow-2xs">
                  <span>Balance Due:</span>
                  <span className="font-mono">{fmt(balanceDue)}</span>
                </div>
              ) : null}

              {/* UTR / Reference Input when required */}
              {requireRef && (
                <div className="space-y-0.5">
                  <label className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center justify-between">
                    <span>UTR / Ref No</span>
                    <span className="text-red-500">*Required</span>
                  </label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="Enter Reference/UTR No"
                    className="w-full border border-amber-300 dark:border-amber-700 rounded-lg bg-amber-50/40 dark:bg-amber-950/20 text-xs font-mono text-slate-900 dark:text-white px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between gap-1 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl px-2.5 py-1 shadow-2xs">
              <span className="truncate flex-1 font-medium">{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                className="text-rose-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                title="Dismiss error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Primary Billing CTA Button */}
          <button
            type="button"
            onClick={handleInitiatePayment}
            disabled={saving || cart.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer hover:shadow-lg active:scale-[0.99]"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Processing Bill...</span>
              </>
            ) : isSplitMode ? (
              hasAnyDigitalInSplit ? (
                <>
                  <CreditCard className="w-4 h-4 text-white" />
                  <span>Collect Split Payment ({fmt(roundedTotal)})</span>
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4 text-white" />
                  <span>Generate Invoice ({fmt(roundedTotal)})</span>
                </>
              )
            ) : isDigitalMode ? (
              <>
                <QrCode className="w-4 h-4 text-white" />
                <span>Scan QR & Pay {fmt(roundedTotal)}</span>
              </>
            ) : (
              <>
                <Receipt className="w-4 h-4 text-white" />
                <span>Generate & Print Invoice ({fmt(roundedTotal)})</span>
              </>
            )}
          </button>
        </div>
      </Card>

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

            {error && (
              <div className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-2.5 rounded-xl font-medium">
                {error}
              </div>
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

      {/* CAMERA BARCODE SCANNER MODAL */}
      <CameraBarcodeScanner
        isOpen={cameraScannerOpen}
        onClose={() => setCameraScannerOpen(false)}
        onScan={handleScanBarcode}
        title="Scan Barcode to Add to Bill"
      />

    </div>
  );
}



