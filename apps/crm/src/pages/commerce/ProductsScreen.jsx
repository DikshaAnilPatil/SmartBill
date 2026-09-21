import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  Barcode,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  Edit2,
  Eye,
  FileSpreadsheet,
  Filter,
  Layers,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { fetchSuppliers } from "@shared/api/supplierAPI";
import { fmt } from "@shared/utils/format";
import {
  Badge,
  Btn,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  Toast,
  statusBadge,
} from "@shared/components/common/ui";
import {
  getProducts,
  createProduct,
  bulkCreateProducts,
  updateProduct,
  deleteProduct,
} from "@shared/api/productAPI";
import {
  exportToCsv,
  exportToExcel,
  parseExcelOrCsvFile,
  normalizeProductImportRows,
  downloadProductExcelTemplate,
  downloadProductCsvTemplate,
  downloadProductTemplate,
} from "@shared/utils/csvHelper";
import CameraBarcodeScanner from "@shared/components/common/CameraBarcodeScanner";
import { getProductCategoriesForIndustry } from "@shared/utils/businessCategories";
import * as XLSX from "xlsx";

export const generateProductBarcode = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(100000 + Math.random() * 900000);
  return `890${timestamp}${random}`.slice(0, 12);
};

export function BarcodeSVG({ value, height = 36 }) {
  if (!value) return null;
  const clean = String(value).trim();
  const bars = [];
  let x = 0;
  bars.push({ x: 0, w: 2 });
  bars.push({ x: 4, w: 1 });
  x = 8;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const pattern = [(code % 3) + 1, ((code >> 1) % 2) + 1, ((code >> 2) % 3) + 1, 1];
    pattern.forEach((w, idx) => {
      if (idx % 2 === 0) {
        bars.push({ x, w });
      }
      x += w + 1;
    });
    x += 1;
  }
  bars.push({ x: x + 2, w: 2 });
  bars.push({ x: x + 6, w: 1 });
  bars.push({ x: x + 9, w: 2 });
  const totalWidth = x + 12;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${totalWidth} ${height}`} className="w-full max-w-[170px] h-8">
        {bars.map((b, idx) => (
          <rect key={idx} x={b.x} y="0" width={b.w} height={height} fill="#000000" />
        ))}
      </svg>
      <span className="font-mono text-[10px] tracking-widest text-slate-800 font-bold mt-0.5">{clean}</span>
    </div>
  );
}

export const INDUSTRY_CATEGORIES = {
  "Kirana & Grocery Store": [
    "Grains, Rice & Atta", "Edible Oils & Ghee", "Spices & Masala", "Dairy & Milk Products",
    "Snacks & Biscuits", "Beverages & Tea/Coffee", "Cleaning & Detergents", "Personal Care"
  ],
  "Supermarket & Departmental": [
    "Packaged Foods", "Beverages & Cold Drinks", "Dairy & Frozen", "Personal & Beauty Care",
    "Household & Cleaning", "Baby Products", "Kitchen & Home Needs"
  ],
  "Pharmacy & Medical Store": [
    "Tablets & Capsules", "Syrups & Liquids", "Injections & Vaccines", "Ointments & Creams",
    "OTC Healthcare", "Medical Devices & First Aid", "Baby Care", "Health Supplements"
  ],
  "Clothing, Garments & Fashion": [
    "Men's Casual & Formal", "Women's Ethnic & Western", "Kids Wear", "Fabrics & Sarees",
    "Winter Wear", "Undergarments & Innerwear", "Fashion Accessories"
  ],
  "Footwear & Leather Goods": [
    "Men's Footwear", "Women's Footwear", "Kids Footwear", "Sports Shoes", "Bags & Wallets", "Belts & Leather"
  ],
  "Electronics & Mobile Store": [
    "Smartphones & Tablets", "Mobile Accessories", "Audio & Headphones", "Smartwatches",
    "Home Appliances", "Cables & Chargers", "Computer Peripherals"
  ],
  "Hardware, Paints & Sanitary": [
    "Hand & Power Tools", "Pipes & Fittings", "Paints & Primer", "Sanitaryware",
    "Fasteners, Screws & Nails", "Electrical Wiring & Switches", "Adhesives & Sealants"
  ],
  "FMCG & Grocery Wholesale / Distribution": [
    "Grains & Pulses (Bags)", "Packaged Foods (Cartons)", "Edible Oils (Tins)",
    "Beverages & Soft Drinks (Cases)", "Soaps & Toiletries (Boxes)", "Confectionery (Jars)"
  ],
  "Textile, Fabric & Garment Wholesale": [
    "Cotton & Synthetic Fabrics", "Readymade Garments (Lots)", "Sarees & Dress Materials (Bales)",
    "Yarn & Threads", "Uniform Fabrics"
  ],
  "Grain, Pulses & Commodity Trading (Mandi)": [
    "Wheat & Paddy (Bags)", "Pulses & Dal (Quintals)", "Oil Seeds & Mustard",
    "Spices & Dry Fruits", "Sugar & Jaggery (Sacks)"
  ],
  "Electronics & Electrical Goods Wholesale": [
    "Mobile Phones (Cartons)", "Cables & Wiring (Rolls)", "Lighting & LED (Boxes)",
    "Switchgear & Panels", "Electronics Spares (Bulk)"
  ],
  "Building Materials, Cement & Steel": [
    "Cement (Bags)", "TMT Steel & Iron Rods", "Sand & Aggregates", "Bricks & Blocks", "Tiles & Flooring"
  ],
  "Auto Parts & Tires Distribution": [
    "Engine Oils & Lubricants", "Tires & Tires", "Brake & Clutch Parts", "Electrical & Batteries", "Filters & Belts"
  ]
};

export default function ProductsScreen({ onNav }) {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [catFilter, setCatFilter] = useState("All");

  const user = (() => {
    try {
      const raw = localStorage.getItem("smartbill_user");
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  })();
  const userBizType = user?.businessType || "Retail";
  const userBizCat = user?.businessCategory || "";
  const isWholesale = String(userBizType).toLowerCase() === "wholesale";
  const isPharmacy = String(userBizCat).toLowerCase().includes("pharmacy") || String(userBizCat).toLowerCase().includes("medical");
  const isApparel = String(userBizCat).toLowerCase().includes("clothing") || String(userBizCat).toLowerCase().includes("garment") || String(userBizCat).toLowerCase().includes("fashion") || String(userBizCat).toLowerCase().includes("footwear") || String(userBizCat).toLowerCase().includes("textile");
  const isElectronics = String(userBizCat).toLowerCase().includes("electronic") || String(userBizCat).toLowerCase().includes("mobile");

  const [deleteId, setDeleteId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    sku: "",
    barcode: "",
    category: "General",
    supplier: "",
    cost: "0",
    price: "0",
    wholesalePrice: "0",
    minOrderQty: "1",
    packSize: "",
    batchNo: "",
    expiryDate: "",
    size: "",
    color: "",
    warrantyMonths: "0",
    isPrescriptionOnly: false,
    gst: "",
    stock: "0",
    minStock: "10",
    unit: isWholesale ? "Box" : "Piece",
  });
  const [printBarcodeProduct, setPrintBarcodeProduct] = useState(null);
  const [barcodeCopies, setBarcodeCopies] = useState(1);
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // CSV / Excel Import / Export State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [parsedProducts, setParsedProducts] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importSummary, setImportSummary] = useState({ total: 0, newCount: 0, updateCount: 0, errorCount: 0 });
  const [importMode, setImportMode] = useState("upsert"); // "upsert" | "update_stock" | "create_only"
  const [stockMode, setStockMode] = useState("replace"); // "replace" | "add"
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Products are loaded from the backend API.
  const [productList, setProductList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await getProducts();
      setProductList(data.products || []);
    } catch (err) {
      setLoadError(err.message || "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);
  
  const [supplierList, setSupplierList] = useState([]);

  // Load suppliers dynamically
  useEffect(() => {
    fetchSuppliers()
      .then((data) => {
        const list = Array.isArray(data.suppliers) ? data.suppliers : data;
        setSupplierList(list);
      })
      .catch((err) => console.error('Failed to load suppliers', err));
  }, []);

  // --- CAMERA BARCODE SCANNER STATE ---
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState("search"); // "search" | "add" | "edit"

  const handleBarcodeScanned = (scannedCode) => {
    if (!scannedCode) return;
    const clean = String(scannedCode).trim();
    if (scannerTarget === "search") {
      setSearch(clean);
      showToast(`Scanned: ${clean}`);
    } else if (scannerTarget === "add") {
      setForm((f) => ({ ...f, barcode: clean }));
      showToast(`Barcode set to ${clean}`);
    } else if (scannerTarget === "edit") {
      setEditForm((f) => ({ ...f, barcode: clean }));
      showToast(`Barcode updated to ${clean}`);
    }
  };

  // --- DYNAMIC INDUSTRY-SPECIFIC & RELATABLE PRODUCT CATEGORIES ---
  const [customCategories, setCustomCategories] = useState(() => {
    try {
      const saved = localStorage.getItem("smartbill_custom_categories");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  });

  // Calculate only relatable categories for the active business type & category:
  // 1. Industry standard preset categories for user's business
  // 2. Any active categories present in the user's loaded products
  // 3. Any custom categories added by the user
  const categories = useMemo(() => {
    const industryCats = getProductCategoriesForIndustry(userBizCat, userBizType);
    const catSet = new Set(industryCats);

    // Include categories actually used by products in inventory
    (productList || []).forEach((p) => {
      if (p?.category && String(p.category).trim() && String(p.category).trim().toLowerCase() !== "all") {
        catSet.add(String(p.category).trim());
      }
    });

    // Include custom user-defined categories
    (customCategories || []).forEach((c) => {
      if (c && String(c).trim() && String(c).trim().toLowerCase() !== "all") {
        catSet.add(String(c).trim());
      }
    });

    return Array.from(catSet);
  }, [userBizCat, userBizType, productList, customCategories]);

  const handleAddCategory = (catName) => {
    const clean = String(catName || "").trim();
    if (!clean) return;
    setCustomCategories((prev) => {
      const updated = Array.from(new Set([...prev, clean]));
      try {
        localStorage.setItem("smartbill_custom_categories", JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const [newCategory, setNewCategory] = useState("");
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [showEditCategoryInput, setShowEditCategoryInput] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [categoryToRemove, setCategoryToRemove] = useState(null);

  // =========================
  // EXPORT PRODUCTS
  // =========================
  const getExportColumns = () => [
    { key: "name", label: "Product Name" },
    { key: "sku", label: "SKU / Barcode" },
    { key: "category", label: "Category" },
    { key: "supplier", label: "Supplier" },
    { key: "price", label: "Selling Price (₹)" },
    { key: "cost", label: "Purchase Cost (₹)" },
    { key: "wholesalePrice", label: "Wholesale Price (₹)" },
    { key: "minPrice", label: "Min Price (₹)" },
    { key: "stock", label: "Stock Quantity" },
    { key: "minStock", label: "Min Stock Alert" },
    { key: "unit", label: "Unit" },
    { key: "gst", label: "GST (%)" },
    { key: "status", label: "Status" },
  ];

  const handleExportCsv = () => {
    if (productList.length === 0) {
      showToast("No products available to export.", "error");
      return;
    }
    exportToCsv("SmartBill_Products.csv", getExportColumns(), productList);
    showToast(`Exported ${productList.length} products to CSV successfully!`, "success");
    setShowExportMenu(false);
  };

  const handleExportExcel = () => {
    if (productList.length === 0) {
      showToast("No products available to export.", "error");
      return;
    }
    exportToExcel("SmartBill_Products.xlsx", "Products & Stock", getExportColumns(), productList);
    showToast(`Exported ${productList.length} products to Excel (.xlsx) successfully!`, "success");
    setShowExportMenu(false);
  };

  // =========================
  // PARSE CSV / EXCEL FILE
  // =========================
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setParsing(true);
    setImportErrors([]);

    try {
      const rawRows = await parseExcelOrCsvFile(file);
      const result = normalizeProductImportRows(rawRows, productList);
      setParsedProducts(result.valid);
      setImportErrors(result.errors);
      setImportSummary(result.summary);

      // Auto-register any new categories found in the import
      const discoveredCats = new Set([...categories]);
      result.valid.forEach((p) => {
        if (p.category && String(p.category).trim()) {
          discoveredCats.add(String(p.category).trim());
        }
      });
      setCategories(Array.from(discoveredCats));

      // Auto-register any new units found in the import
      const discoveredUnits = new Set([...units]);
      result.valid.forEach((p) => {
        if (p.unit && String(p.unit).trim()) {
          discoveredUnits.add(String(p.unit).trim());
        }
      });
      setUnits(Array.from(discoveredUnits));
    } catch (err) {
      console.error("Failed to parse file:", err);
      setImportErrors([`Failed to parse file: ${err.message}`]);
      setParsedProducts([]);
      setImportSummary({ total: 0, newCount: 0, updateCount: 0, errorCount: 1 });
    } finally {
      setParsing(false);
    }
  };

  // =========================
  // EXECUTE BULK IMPORT
  // =========================
  const handleExecuteImport = async () => {
    if (parsedProducts.length === 0) {
      showToast("No valid products to import.", "error");
      return;
    }
    setImporting(true);

    try {
      const res = await bulkCreateProducts(parsedProducts, {
        mode: importMode,
        stockMode: stockMode,
      });

      await loadProducts();
      window.dispatchEvent(new CustomEvent("stockUpdated"));
      window.dispatchEvent(new CustomEvent("productUpdated"));
      setImporting(false);
      setShowImportModal(false);
      setImportFile(null);
      setParsedProducts([]);
      setImportErrors([]);
      setImportSummary({ total: 0, newCount: 0, updateCount: 0, errorCount: 0 });

      const msg =
        res.message ||
        `Successfully imported ${res.count || parsedProducts.length} items (${res.createdCount || 0} created, ${res.updatedCount || 0} updated).`;
      showToast(msg, "success");
    } catch (bulkErr) {
      console.error("Bulk import failed:", bulkErr);
      showToast(
        bulkErr.response?.data?.message || bulkErr.message || "Bulk import failed. Please check your data.",
        "error"
      );
      setImporting(false);
    }
  };

  // --- DYNAMIC & PERSISTENT UNITS ---
  const [units, setUnits] = useState(() => {
    const saved = localStorage.getItem("smartbill_units");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return ["Piece", "Kg", "Litre", "Box", "Dozen", "Metre"];
  });
  const [newUnit, setNewUnit] = useState("");
  const [showUnitInput, setShowUnitInput] = useState(false);
  const [showEditUnitInput, setShowEditUnitInput] = useState(false);

  // Persist units list to localStorage
  useEffect(() => {
    localStorage.setItem("smartbill_units", JSON.stringify(units));
  }, [units]);

  // Automatically include any unit from loaded products into the units list
  useEffect(() => {
    if (productList.length > 0) {
      setUnits((prev) => {
        const set = new Set([...prev]);
        productList.forEach((p) => {
          if (p.unit && String(p.unit).trim()) {
            set.add(String(p.unit).trim());
          }
        });
        const updated = Array.from(set);
        return updated.length !== prev.length ? updated : prev;
      });
    }
  }, [productList]);

  // Remove category function with product auto-reassignment to General
  const confirmRemoveCategory = async (catName) => {
    const affectedProducts = productList.filter((p) => p.category === catName);

    // Remove custom category if present
    setCustomCategories((prev) => {
      const updated = prev.filter((c) => c !== catName);
      try {
        localStorage.setItem("smartbill_custom_categories", JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });

    if (catFilter === catName) {
      setCatFilter("All");
    }

    // Reassign any products under this category to "General"
    if (affectedProducts.length > 0) {
      for (const p of affectedProducts) {
        const pId = p._id || p.id;
        try {
          await updateProduct(pId, { category: "General" });
        } catch (err) {
          console.error("Failed to reassign product category:", err);
        }
      }
      await loadProducts();
      showToast(
        `Category "${catName}" removed. ${affectedProducts.length} product(s) updated to "General".`,
        "success"
      );
    } else {
      showToast(`Category "${catName}" removed successfully.`, "success");
    }
    setCategoryToRemove(null);
  };
  // -------------------------------------------------

  const [form, setForm] = useState({
    name: "",
    sku: "",
    barcode: "",
    category: "General",
    supplier: supplierList[0]?.name ?? "",
    cost: "0",
    price: "0",
    gst: "",
    stock: "0",
    minStock: "10",
    unit: "Piece",
  });

  const filtered = productList.filter((p) => {
    if (!p) return false;
    const nameStr = String(p.name || "").toLowerCase();
    const skuStr = String(p.sku || "").toLowerCase();
    const barcodeStr = String(p.barcode || "").toLowerCase();
    const searchStr = (search || "").toLowerCase().trim();
    const matchSearch =
      !searchStr ||
      nameStr.includes(searchStr) ||
      skuStr.includes(searchStr) ||
      barcodeStr.includes(searchStr);
    const matchCat = catFilter === "All" || p.category === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-5">
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {deleteId !== null && (
        <ConfirmDialog
          message="This will permanently delete the product."
          onConfirm={async () => {
            try {
              await deleteProduct(deleteId);
              setProductList((prev) => prev.filter((p) => p.id !== deleteId));
              setDeleteId(null);
              setShowEditModal(false);
              window.dispatchEvent(new CustomEvent("stockUpdated"));
              window.dispatchEvent(new CustomEvent("productUpdated"));
              showToast("Product deleted successfully", "success");
            } catch (err) {
              setDeleteId(null);
              showToast(err.message || "Failed to delete product.", "error");
            }
          }}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {/* REMOVE CATEGORY CONFIRM DIALOG */}
      {categoryToRemove !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Remove Category?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Are you sure you want to remove <strong>&quot;{categoryToRemove}&quot;</strong>?
                </p>
              </div>
            </div>
            {productList.filter((p) => p.category === categoryToRemove).length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                <p className="text-xs text-amber-700">
                  ⚠️ <strong>{productList.filter((p) => p.category === categoryToRemove).length} product(s)</strong> in this category will be moved to &quot;General&quot;.
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setCategoryToRemove(null)}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmRemoveCategory(categoryToRemove)}
                className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY MANAGER MODAL */}
      {showCategoryManager && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900">Manage Categories</h3>
                <p className="text-xs text-slate-500 mt-0.5">Add or remove product categories</p>
              </div>
              <button
                onClick={() => setShowCategoryManager(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {categories.map((cat) => (
                <div
                  key={cat}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm font-medium text-slate-800">{cat}</span>
                    {productList.filter((p) => p.category === cat).length > 0 && (
                      <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-mono">
                        {productList.filter((p) => p.category === cat).length} products
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setCategoryToRemove(cat);
                    }}
                    title={`Remove "${cat}" category`}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Add New Category Row */}
              <div className="border-t border-slate-100 pt-3">
                {!showCategoryInput ? (
                  <button
                    onClick={() => setShowCategoryInput(true)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-blue-300 text-blue-600 text-sm hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Category
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newCategory.trim()) {
                          if (!categories.includes(newCategory.trim())) {
                            setCategories([...categories, newCategory.trim()]);
                          }
                          setNewCategory("");
                          setShowCategoryInput(false);
                        }
                        if (e.key === "Escape") {
                          setShowCategoryInput(false);
                          setNewCategory("");
                        }
                      }}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => {
                        if (newCategory.trim()) {
                          handleAddCategory(newCategory.trim());
                        }
                        setNewCategory("");
                        setShowCategoryInput(false);
                      }}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setShowCategoryInput(false); setNewCategory(""); }}
                      className="px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setShowCategoryManager(false)}
                className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {showEditModal && editId !== null && (
        <Modal
          title="Edit Product"
          onClose={() => {
            setShowEditModal(false);
            setEditId(null);
            setShowEditCategoryInput(false);
          }}
        >
          <div className="space-y-4">
            <Input
              label="Product Name"
              value={editForm.name}
              onChange={(v) => setEditForm((f) => ({ ...f, name: v }))}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">Barcode</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setScannerTarget("edit");
                        setCameraScannerOpen(true);
                      }}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Barcode className="w-3 h-3" /> Camera Scan
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, barcode: generateProductBarcode() }))}
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" /> Auto
                    </button>
                  </div>
                </div>
                <Input
                  placeholder="e.g. 890123456789"
                  value={editForm.barcode}
                  onChange={(v) => setEditForm((f) => ({ ...f, barcode: v }))}
                />
              </div>
              <Input
                label="SKU (Item Code)"
                value={editForm.sku}
                onChange={(v) => setEditForm((f) => ({ ...f, sku: v }))}
              />
            </div>
            <div>
              <Select
                label="Category"
                value={editForm.category}
                onChange={(v) => {
                  if (v === "+ Add Category") {
                    setShowEditCategoryInput(true);
                  } else {
                    setEditForm((f) => ({ ...f, category: v }));
                    setShowEditCategoryInput(false);
                  }
                }}
                options={[...categories, "+ Add Category"]}
              />
            </div>

            {/* Conditionally rendered Add Category field in Edit Modal */}
            {showEditCategoryInput && (
              <div className="space-y-2 border border-blue-100 p-3 rounded-lg bg-slate-50/50">
                <Input
                  label="New Category"
                  value={newCategory}
                  onChange={setNewCategory}
                />
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (newCategory.trim()) {
                      handleAddCategory(newCategory.trim());
                      setEditForm((f) => ({ ...f, category: newCategory.trim() }));
                      setNewCategory("");
                      setShowEditCategoryInput(false);
                    }
                  }}
                >
                  Save Category
                </Btn>
              </div>
            )}

            <Select
              label="Supplier"
              value={editForm.supplier}
              onChange={(v) => setEditForm((f) => ({ ...f, supplier: v }))}
              options={supplierList.map((s) => s.name)}
            />

            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Cost Price (₹)"
                value={editForm.cost}
                onChange={(v) => setEditForm((f) => ({ ...f, cost: v }))}
              />
              <Input
                label="Selling Price (₹)"
                value={editForm.price}
                onChange={(v) => setEditForm((f) => ({ ...f, price: v }))}
              />
              <Input
                label="GST %"
                value={editForm.gst}
                onChange={(v) => setEditForm((f) => ({ ...f, gst: v }))}
              />
            </div>

            {/* Wholesale Pricing & Pack Tier */}
            {isWholesale && (
              <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-3">
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <span>🏢 Wholesale & Bulk Order Settings</span>
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    label="Wholesale Price (₹)"
                    type="number"
                    value={editForm.wholesalePrice}
                    onChange={(v) => setEditForm((f) => ({ ...f, wholesalePrice: v }))}
                    placeholder="e.g. 450"
                  />
                  <Input
                    label="Min Order Qty (MOQ)"
                    type="number"
                    value={editForm.minOrderQty}
                    onChange={(v) => setEditForm((f) => ({ ...f, minOrderQty: v }))}
                    placeholder="e.g. 10"
                  />
                  <Input
                    label="Case / Box Pack Qty"
                    value={editForm.packSize}
                    onChange={(v) => setEditForm((f) => ({ ...f, packSize: v }))}
                    placeholder="e.g. 24 Pcs/Box"
                  />
                </div>
              </div>
            )}

            {/* Pharmacy Compliance */}
            {isPharmacy && (
              <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-3">
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <span>💊 Pharmacy Drug & Batch Compliance</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Batch / Lot Number"
                    value={editForm.batchNo}
                    onChange={(v) => setEditForm((f) => ({ ...f, batchNo: v }))}
                    placeholder="e.g. BATCH-2026A"
                  />
                  <Input
                    label="Expiry Date"
                    type="date"
                    value={editForm.expiryDate ? String(editForm.expiryDate).split("T")[0] : ""}
                    onChange={(v) => setEditForm((f) => ({ ...f, expiryDate: v }))}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-emerald-900 dark:text-emerald-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={editForm.isPrescriptionOnly}
                    onChange={(e) => setEditForm((f) => ({ ...f, isPrescriptionOnly: e.target.checked }))}
                    className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
                  />
                  <span>Schedule H / Prescription Required (Rx)</span>
                </label>
              </div>
            )}

            {/* Apparel & Fashion Variants */}
            {isApparel && (
              <div className="p-3.5 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-xl space-y-3">
                <p className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                  <span>👗 Apparel & Size Variants</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Size (e.g. S, M, L, XL, 32, 40)"
                    value={editForm.size}
                    onChange={(v) => setEditForm((f) => ({ ...f, size: v }))}
                    placeholder="e.g. L / 42"
                  />
                  <Input
                    label="Color / Fabric Variant"
                    value={editForm.color}
                    onChange={(v) => setEditForm((f) => ({ ...f, color: v }))}
                    placeholder="e.g. Navy Blue / Cotton"
                  />
                </div>
              </div>
            )}

            {/* Electronics Warranty */}
            {isElectronics && (
              <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl space-y-3">
                <p className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <span>⚡ Electronics Warranty</span>
                </p>
                <Input
                  label="Warranty Period (in Months)"
                  type="number"
                  value={editForm.warrantyMonths}
                  onChange={(v) => setEditForm((f) => ({ ...f, warrantyMonths: v }))}
                  placeholder="e.g. 12"
                />
              </div>
            )}

            {/* Live Current Stock & Inward Action Card */}
            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-800/60 flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                  Current Stock Level
                </span>
                <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 font-mono">
                  {editForm.stock} <span className="text-xs font-normal text-slate-500">{editForm.unit}</span>
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Stock increases when recording <strong>Purchases</strong> from suppliers and decreases on <strong>POS Sales</strong>.
                </p>
              </div>
              <Btn
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.setItem(
                    "reorderProduct",
                    JSON.stringify({ name: editForm.name, minStock: editForm.minStock })
                  );
                  setShowEditModal(false);
                  if (onNav) onNav("purchase");
                  else window.location.href = "/app/purchase";
                }}
                icon={<ShoppingCart className="w-3.5 h-3.5 text-blue-600" />}
                className="bg-white hover:bg-blue-50 text-blue-700 border-blue-300 text-xs shadow-2xs font-semibold"
              >
                + Inward via Purchase
              </Btn>
            </div>

            <div>
              <Input
                label="Min. Stock Level (Low Stock Alert Threshold)"
                type="number"
                value={editForm.minStock}
                onChange={(v) => setEditForm((f) => ({ ...f, minStock: v }))}
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Alerts trigger automatically when stock falls below this quantity</p>
            </div>

            <Select
              label="Unit"
              value={editForm.unit}
              onChange={(v) => {
                if (v === "+ Add New Unit") {
                  setShowEditUnitInput(true);
                } else {
                  setEditForm((f) => ({ ...f, unit: v }));
                  setShowEditUnitInput(false);
                }
              }}
              options={[...units, "+ Add New Unit"]}
            />

            {showEditUnitInput && (
              <div className="space-y-2 border border-blue-100 p-3 rounded-lg bg-slate-50/50">
                <Input
                  label="New Unit Name"
                  value={newUnit}
                  onChange={setNewUnit}
                />
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const trimmed = newUnit.trim();
                    if (trimmed) {
                      if (!units.includes(trimmed)) {
                        setUnits([...units, trimmed]);
                      }
                      setEditForm((f) => ({ ...f, unit: trimmed }));
                      setNewUnit("");
                      setShowEditUnitInput(false);
                    }
                  }}
                >
                  Save Unit
                </Btn>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Btn
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  setEditId(null);
                  setShowEditCategoryInput(false);
                }}
                className="flex-1 justify-center"
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await updateProduct(editId, {
                      name: editForm.name,
                      sku: editForm.sku,
                      barcode: editForm.barcode,
                      category: editForm.category,
                      supplier: editForm.supplier,
                      cost: Number(editForm.cost || 0),
                      price: Number(editForm.price || 0),
                      wholesalePrice: Number(editForm.wholesalePrice || 0),
                      minOrderQty: Number(editForm.minOrderQty || 1),
                      packSize: editForm.packSize || "",
                      batchNo: editForm.batchNo || "",
                      expiryDate: editForm.expiryDate || null,
                      size: editForm.size || "",
                      color: editForm.color || "",
                      warrantyMonths: Number(editForm.warrantyMonths || 0),
                      isPrescriptionOnly: Boolean(editForm.isPrescriptionOnly),
                      gst: Number(editForm.gst || 0),
                      minStock: Number(editForm.minStock || 0),
                      unit: editForm.unit,
                      status: "Active",
                    });
                    await loadProducts();
                    setShowEditModal(false);
                    setEditId(null);
                    setShowEditCategoryInput(false);
                    window.dispatchEvent(new CustomEvent("stockUpdated"));
                    window.dispatchEvent(new CustomEvent("productUpdated"));
                    showToast("Product updated successfully", "success");
                  } catch (err) {
                    showToast(
                      err.message || "Failed to update product.",
                      "error",
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
                className="flex-1 justify-center"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ADD NEW PRODUCT MODAL */}
      {showModal && (
        <Modal
          title="Add New Product"
          onClose={() => {
            setShowModal(false);
            setShowCategoryInput(false);
          }}
        >
          <div className="space-y-4">
            <Input
              label="Product Name"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">Barcode</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setScannerTarget("add");
                        setCameraScannerOpen(true);
                      }}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Barcode className="w-3 h-3" /> Camera Scan
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, barcode: generateProductBarcode() }))}
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" /> Auto
                    </button>
                  </div>
                </div>
                <Input
                  placeholder="e.g. 890123456789"
                  value={form.barcode}
                  onChange={(v) => setForm((f) => ({ ...f, barcode: v }))}
                />
              </div>
              <Input
                label="SKU (Item Code)"
                value={form.sku}
                onChange={(v) => setForm((f) => ({ ...f, sku: v }))}
              />
            </div>
            <div>
              <Select
                label="Category"
                value={form.category}
                onChange={(v) => {
                  if (v === "+ Add Category") {
                    setShowCategoryInput(true);
                  } else {
                    setForm((f) => ({ ...f, category: v }));
                    setShowCategoryInput(false);
                  }
                }}
                options={[...categories, "+ Add Category"]}
              />
            </div>

            {/* Conditionally rendered Add Category field in Add Modal */}
            {showCategoryInput && (
              <div className="space-y-2 border border-blue-100 p-3 rounded-lg bg-slate-50/50">
                <Input
                  label="New Category"
                  value={newCategory}
                  onChange={setNewCategory}
                />
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (newCategory.trim()) {
                      handleAddCategory(newCategory.trim());
                      setForm((f) => ({ ...f, category: newCategory.trim() }));
                      setNewCategory("");
                      setShowCategoryInput(false);
                    }
                  }}
                >
                  Save Category
                </Btn>
              </div>
            )}

            <Select
              label="Supplier (Optional)"
              value={form.supplier || "None / Direct"}
              onChange={(v) => setForm((f) => ({ ...f, supplier: v === "None / Direct" ? "" : v }))}
              options={supplierList.length > 0 ? ["None / Direct", ...supplierList.map((s) => s.name)] : ["None / Direct"]}
            />
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Cost Price (₹)"
                type="number"
                value={form.cost}
                onChange={(v) => setForm((f) => ({ ...f, cost: v }))}
              />
              <Input
                label="Selling Price (₹)"
                type="number"
                value={form.price}
                onChange={(v) => setForm((f) => ({ ...f, price: v }))}
              />
              <Input
                label="GST %"
                type="number"
                placeholder="e.g. 18"
                value={form.gst}
                onChange={(v) => setForm((f) => ({ ...f, gst: v }))}
              />
            </div>

            {/* Wholesale Pricing & Pack Tier */}
            {isWholesale && (
              <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-3">
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <span>🏢 Wholesale & Bulk Order Settings</span>
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    label="Wholesale Price (₹)"
                    type="number"
                    value={form.wholesalePrice}
                    onChange={(v) => setForm((f) => ({ ...f, wholesalePrice: v }))}
                    placeholder="e.g. 450"
                  />
                  <Input
                    label="Min Order Qty (MOQ)"
                    type="number"
                    value={form.minOrderQty}
                    onChange={(v) => setForm((f) => ({ ...f, minOrderQty: v }))}
                    placeholder="e.g. 10"
                  />
                  <Input
                    label="Case / Box Pack Qty"
                    value={form.packSize}
                    onChange={(v) => setForm((f) => ({ ...f, packSize: v }))}
                    placeholder="e.g. 24 Pcs/Box"
                  />
                </div>
              </div>
            )}

            {/* Pharmacy Compliance */}
            {isPharmacy && (
              <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-3">
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <span>💊 Pharmacy Drug & Batch Compliance</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Batch / Lot Number"
                    value={form.batchNo}
                    onChange={(v) => setForm((f) => ({ ...f, batchNo: v }))}
                    placeholder="e.g. BATCH-2026A"
                  />
                  <Input
                    label="Expiry Date"
                    type="date"
                    value={form.expiryDate ? String(form.expiryDate).split("T")[0] : ""}
                    onChange={(v) => setForm((f) => ({ ...f, expiryDate: v }))}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-emerald-900 dark:text-emerald-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={form.isPrescriptionOnly}
                    onChange={(e) => setForm((f) => ({ ...f, isPrescriptionOnly: e.target.checked }))}
                    className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
                  />
                  <span>Schedule H / Prescription Required (Rx)</span>
                </label>
              </div>
            )}

            {/* Apparel & Fashion Variants */}
            {isApparel && (
              <div className="p-3.5 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-xl space-y-3">
                <p className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                  <span>👗 Apparel & Size Variants</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Size (e.g. S, M, L, XL, 32, 40)"
                    value={form.size}
                    onChange={(v) => setForm((f) => ({ ...f, size: v }))}
                    placeholder="e.g. L / 42"
                  />
                  <Input
                    label="Color / Fabric Variant"
                    value={form.color}
                    onChange={(v) => setForm((f) => ({ ...f, color: v }))}
                    placeholder="e.g. Navy Blue / Cotton"
                  />
                </div>
              </div>
            )}

            {/* Electronics Warranty */}
            {isElectronics && (
              <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl space-y-3">
                <p className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <span>⚡ Electronics Warranty</span>
                </p>
                <Input
                  label="Warranty Period (in Months)"
                  type="number"
                  value={form.warrantyMonths}
                  onChange={(v) => setForm((f) => ({ ...f, warrantyMonths: v }))}
                  placeholder="e.g. 12"
                />
              </div>
            )}

            {/* Informational Stock Notice */}
            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-800/60 flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                  Initial Stock
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  New products start at <strong>0 stock</strong>. Stock will be updated automatically when you record a supplier bill in <strong>Purchases</strong>.
                </p>
              </div>
              <span className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-mono font-bold text-sm rounded-lg flex-shrink-0">
                0 {form.unit || "Piece"}
              </span>
            </div>

            <div>
              <Input
                label="Min. Stock Level (Low Stock Alert Threshold)"
                type="number"
                value={form.minStock}
                onChange={(v) => setForm((f) => ({ ...f, minStock: v }))}
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Get notified automatically when stock drops below this quantity</p>
            </div>
            <Select
              label="Unit"
              value={form.unit}
              onChange={(v) => {
                if (v === "+ Add New Unit") {
                  setShowUnitInput(true);
                } else {
                  setForm((f) => ({ ...f, unit: v }));
                  setShowUnitInput(false);
                }
              }}
              options={[...units, "+ Add New Unit"]}
            />

            {showUnitInput && (
              <div className="space-y-2 border border-blue-100 p-3 rounded-lg bg-slate-50/50">
                <Input
                  label="New Unit Name"
                  value={newUnit}
                  onChange={setNewUnit}
                />
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const trimmed = newUnit.trim();
                    if (trimmed) {
                      if (!units.includes(trimmed)) {
                        setUnits([...units, trimmed]);
                      }
                      setForm((f) => ({ ...f, unit: trimmed }));
                      setNewUnit("");
                      setShowUnitInput(false);
                    }
                  }}
                >
                  Save Unit
                </Btn>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Btn
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setShowCategoryInput(false);
                }}
                className="flex-1 justify-center"
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                disabled={saving}
                onClick={async () => {
                  const trimmedName = String(form.name || "").trim();
                  if (!trimmedName) {
                    showToast("Product name is required.", "error");
                    return;
                  }

                  setSaving(true);
                  // Check for duplicate SKU only if a custom SKU was entered
                  const trimmedSku = String(form.sku || "").trim();
                  if (trimmedSku && productList.some((p) => String(p.sku || "").trim() === trimmedSku)) {
                    showToast('SKU already exists. Please use a unique SKU.', 'error');
                    setSaving(false);
                    return;
                  }
                  try {
                    await createProduct({
                      name: trimmedName,
                      sku: trimmedSku,
                      barcode: form.barcode || generateProductBarcode(),
                      category: form.category || "General",
                      supplier: form.supplier === "None / Direct" ? "" : form.supplier,
                      cost: Number(form.cost || 0),
                      price: Number(form.price || 0),
                      wholesalePrice: Number(form.wholesalePrice || 0),
                      minOrderQty: Number(form.minOrderQty || 1),
                      packSize: form.packSize || "",
                      batchNo: form.batchNo || "",
                      expiryDate: form.expiryDate || null,
                      size: form.size || "",
                      color: form.color || "",
                      warrantyMonths: Number(form.warrantyMonths || 0),
                      isPrescriptionOnly: Boolean(form.isPrescriptionOnly),
                      gst: Number(form.gst || 0),
                      stock: 0,
                      minStock: Number(form.minStock || 0),
                      unit: form.unit || (isWholesale ? "Box" : "Piece"),
                      status: "Active",
                    });
                    await loadProducts();
                    setShowModal(false);
                    setShowCategoryInput(false);
                    window.dispatchEvent(new CustomEvent("stockUpdated"));
                    window.dispatchEvent(new CustomEvent("productUpdated"));
                    setForm({
                      name: "",
                      sku: "",
                      barcode: "",
                      category: categories[0] || "General",
                      supplier: "",
                      cost: "0",
                      price: "0",
                      wholesalePrice: "0",
                      minOrderQty: "1",
                      packSize: "",
                      batchNo: "",
                      expiryDate: "",
                      size: "",
                      color: "",
                      warrantyMonths: "0",
                      isPrescriptionOnly: false,
                      gst: "",
                      stock: "0",
                      minStock: "10",
                      unit: isWholesale ? "Box" : "Piece",
                    });
                    showToast("Product created successfully", "success");
                  } catch (err) {
                    showToast(
                      err.response?.data?.message || err.message || "Failed to create product.",
                      "error",
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
                className="flex-1 justify-center"
              >
                {saving ? "Saving..." : "Save Product"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* BULK IMPORT EXCEL / CSV MODAL */}
      {showImportModal && (
        <Modal
          title="Bulk Import Products & Stock"
          onClose={() => {
            setShowImportModal(false);
            setImportFile(null);
            setParsedProducts([]);
            setImportErrors([]);
            setImportSummary({ total: 0, newCount: 0, updateCount: 0, errorCount: 0 });
          }}
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Step 1: Template Download Banner */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-blue-950 text-sm">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  <span>Download Formatted Templates</span>
                </div>
                <p className="text-xs text-blue-700 mt-0.5">
                  Download a pre-formatted Excel or CSV template with column headers and sample data.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Btn
                  variant="outline"
                  size="sm"
                  onClick={() => downloadProductExcelTemplate()}
                  icon={<Download className="w-3.5 h-3.5 text-emerald-600" />}
                  className="bg-white hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 text-xs shadow-sm"
                >
                  Excel Template (.xlsx)
                </Btn>
                <Btn
                  variant="outline"
                  size="sm"
                  onClick={() => downloadProductCsvTemplate()}
                  icon={<Download className="w-3.5 h-3.5 text-blue-600" />}
                  className="bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-xs shadow-sm"
                >
                  CSV Template (.csv)
                </Btn>
                {productList.length > 0 && (
                  <Btn
                    variant="outline"
                    size="sm"
                    onClick={() => downloadProductExcelTemplate(productList)}
                    icon={<Download className="w-3.5 h-3.5 text-purple-600" />}
                    className="bg-white hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 text-xs shadow-sm"
                  >
                    My Catalog ({productList.length} Items)
                  </Btn>
                )}
              </div>
            </div>

            {/* Accounting / Inventory Workflow Notice */}
            <div className="flex items-start gap-2.5 p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Catalog Master & Opening Stock:</span>
                <span className="text-amber-800 ml-1">
                  Use this import to set up your product master catalog and initial opening stock (inventory you already own). For new vendor shipments, supplier tax invoices, and payment tracking, record or import a bill under <span className="font-semibold text-amber-950">Transactions ➔ Purchases</span>.
                </span>
              </div>
            </div>

            {/* Step 2: Upload File Box */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Upload File (.xlsx, .xls, .csv)
              </label>
              <div className="relative border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/70 hover:bg-blue-50/30 rounded-2xl p-4 transition-all text-center">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-xs">
                    {importFile ? (
                      <span className="font-semibold text-blue-700 flex items-center justify-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                      </span>
                    ) : (
                      <>
                        <span className="font-semibold text-slate-700">Click to upload</span> or drag and drop
                        <span className="block text-[11px] text-slate-400 mt-0.5">Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Import & Stock Strategy Options */}
            {parsedProducts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                {/* Import Mode */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Import Action
                  </label>
                  <div className="space-y-1.5 text-xs">
                    <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-blue-300">
                      <input
                        type="radio"
                        name="importMode"
                        value="upsert"
                        checked={importMode === "upsert"}
                        onChange={() => setImportMode("upsert")}
                        className="text-blue-600"
                      />
                      <div>
                        <p className="font-semibold text-slate-900">Update & Add (Upsert)</p>
                        <p className="text-[10px] text-slate-500">Update matching products & add new ones</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-blue-300">
                      <input
                        type="radio"
                        name="importMode"
                        value="update_stock"
                        checked={importMode === "update_stock"}
                        onChange={() => setImportMode("update_stock")}
                        className="text-blue-600"
                      />
                      <div>
                        <p className="font-semibold text-slate-900">Update Stock Only</p>
                        <p className="text-[10px] text-slate-500">Only modify stock quantities of existing items</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-blue-300">
                      <input
                        type="radio"
                        name="importMode"
                        value="create_only"
                        checked={importMode === "create_only"}
                        onChange={() => setImportMode("create_only")}
                        className="text-blue-600"
                      />
                      <div>
                        <p className="font-semibold text-slate-900">Add New Only</p>
                        <p className="text-[10px] text-slate-500">Only add new products; skip existing items</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Stock Mode */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Stock Adjustment Strategy
                  </label>
                  <div className="space-y-1.5 text-xs">
                    <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-blue-300">
                      <input
                        type="radio"
                        name="stockMode"
                        value="replace"
                        checked={stockMode === "replace"}
                        onChange={() => setStockMode("replace")}
                        className="text-blue-600"
                      />
                      <div>
                        <p className="font-semibold text-slate-900">Set / Replace Stock Quantity</p>
                        <p className="text-[10px] text-slate-500">File stock count is the new inventory count</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-blue-300">
                      <input
                        type="radio"
                        name="stockMode"
                        value="add"
                        checked={stockMode === "add"}
                        onChange={() => setStockMode("add")}
                        className="text-blue-600"
                      />
                      <div>
                        <p className="font-semibold text-slate-900">Add to Current Stock (+)</p>
                        <p className="text-[10px] text-slate-500">Add file quantity on top of current stock</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Validation Warnings / Errors */}
            {importErrors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl max-h-32 overflow-y-auto">
                <p className="text-xs font-bold text-red-700 mb-1 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Warnings & Errors ({importErrors.length}):
                </p>
                <ul className="text-[11px] text-red-600 space-y-0.5 list-disc pl-4">
                  {importErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Step 4: Summary & Live Preview */}
            {parsedProducts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                      Total Rows: {importSummary.total}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      New Products: {importSummary.newCount}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 font-semibold flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />
                      Existing Updates: {importSummary.updateCount}
                    </span>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="max-h-48 overflow-y-auto overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 sticky top-0 font-semibold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="px-3 py-2">Action</th>
                          <th className="px-3 py-2">Product</th>
                          <th className="px-3 py-2">SKU</th>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2">Price</th>
                          <th className="px-3 py-2">Stock Impact</th>
                          <th className="px-3 py-2">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedProducts.map((p, idx) => {
                          const resultingStock =
                            p.isExisting && stockMode === "add"
                              ? p.currentStock + p.stock
                              : p.stock;

                          return (
                            <tr
                              key={idx}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                p.isExisting ? "bg-blue-50/20" : ""
                              }`}
                            >
                              <td className="px-3 py-2 whitespace-nowrap">
                                {p.isExisting ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1 w-max">
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    Update
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-max">
                                    <Plus className="w-2.5 h-2.5" />
                                    New
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 font-medium text-slate-900 max-w-[150px] truncate">
                                {p.name}
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-500 text-[11px]">
                                {p.sku || "Auto"}
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {p.category}
                              </td>
                              <td className="px-3 py-2 font-semibold text-slate-800">
                                ₹{p.price}
                              </td>
                              <td className="px-3 py-2 font-mono">
                                {p.isExisting ? (
                                  <span className="text-blue-700 font-medium">
                                    {p.currentStock}{" "}
                                    {stockMode === "add" ? `+ ${p.stock} = ` : "➔ "}
                                    <strong>{resultingStock}</strong>
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 font-bold">{p.stock}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-slate-500">
                                {p.unit}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <Btn
                variant="outline"
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setParsedProducts([]);
                  setImportErrors([]);
                  setImportSummary({ total: 0, newCount: 0, updateCount: 0, errorCount: 0 });
                }}
                className="flex-1 justify-center"
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                disabled={importing || parsing || parsedProducts.length === 0}
                onClick={handleExecuteImport}
                className="flex-1 justify-center shadow-md shadow-blue-500/20"
                icon={<Upload className="w-4 h-4" />}
              >
                {importing
                  ? "Importing Products..."
                  : `Import Products & Stock (${parsedProducts.length})`}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* BUSINESS TYPE & CATEGORY BANNER */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 flex-wrap ${
        isWholesale
          ? "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-200 dark:border-amber-800/40"
          : "bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border-blue-200 dark:border-blue-800/40"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
            isWholesale ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
          }`}>
            {isWholesale ? "🏢" : isPharmacy ? "💊" : isApparel ? "👗" : isElectronics ? "⚡" : "🛒"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                {isWholesale ? "Wholesale B2B Product Catalog" : "Retail Product Catalog"}
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isWholesale ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-blue-100 text-blue-800 border border-blue-200"
              }`}>
                {userBizType} Mode
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {userBizCat ? `Configured for ${userBizCat}` : "General Commercial Inventory"} • {productList.length} items loaded
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isWholesale && (
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 rounded-lg border border-amber-300/40">
              ✓ Wholesale Price & MOQ Enabled
            </span>
          )}
          {isPharmacy && (
            <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 rounded-lg border border-emerald-300/40">
              ✓ Batch & Expiry Compliance
            </span>
          )}
          {isApparel && (
            <span className="text-[11px] font-semibold text-purple-800 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 px-2.5 py-1 rounded-lg border border-purple-300/40">
              ✓ Size & Color Variants
            </span>
          )}
        </div>
      </div>

      {/* FILTER AND HEADER CONTROLS */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-48 flex items-center gap-2">
            <Input
              value={search}
              onChange={setSearch}
              placeholder="Search product name, SKU, barcode..."
              icon={<Search className="w-4 h-4" />}
              className="flex-1"
            />
            <Btn
              variant="outline"
              size="md"
              onClick={() => {
                setScannerTarget("search");
                setCameraScannerOpen(true);
              }}
              icon={<Barcode className="w-4 h-4 text-emerald-600" />}
              title="Open camera to scan barcode"
            >
              Scan Barcode
            </Btn>
          </div>

          {/* Relatable Category Filter Dropdown Menu */}
          <div className="w-60 min-w-[200px]">
            <div className="relative flex items-center">
              <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 pointer-events-none" />
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs appearance-none transition-all"
                title="Filter products by relatable category"
              >
                <option value="All">All Categories ({productList.length})</option>
                {categories.map((c) => {
                  const count = productList.filter((p) => p.category === c).length;
                  return (
                    <option key={c} value={c}>
                      {c} {count > 0 ? `(${count})` : ""}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-3 pointer-events-none" />
            </div>
          </div>

          {/* Export Dropdown */}
          <div className="relative">
            <Btn
              variant="outline"
              size="md"
              onClick={() => setShowExportMenu(!showExportMenu)}
              icon={<Download className="w-4 h-4" />}
            >
              Export
              <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
            </Btn>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-30">
                <button
                  onClick={handleExportExcel}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-2 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Export to Excel (.xlsx)
                </button>
                <button
                  onClick={handleExportCsv}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4 text-blue-600" />
                  Export to CSV (.csv)
                </button>
              </div>
            )}
          </div>

          {/* Import Button */}
          <Btn
            variant="outline"
            size="md"
            onClick={() => setShowImportModal(true)}
            icon={<Upload className="w-4 h-4" />}
          >
            Import Excel / CSV
          </Btn>

          <Btn
            variant="outline"
            size="md"
            onClick={() => setShowCategoryManager(true)}
            icon={<Settings className="w-4 h-4" />}
          >
            Manage Categories
          </Btn>
          <Btn
            variant="primary"
            size="md"
            onClick={() => {
              setForm((f) => ({ ...f, barcode: generateProductBarcode() }));
              setShowModal(true);
            }}
            icon={<Plus className="w-4 h-4" />}
          >
            Add Product
          </Btn>
        </div>

        {/* Active Category Filter Tag */}
        {catFilter !== "All" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Active Category:</span>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold shadow-xs">
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              <span>{catFilter}</span>
              <span className="text-[11px] opacity-75 font-mono">
                ({productList.filter((p) => p.category === catFilter).length} items)
              </span>
              <button
                type="button"
                onClick={() => setCatFilter("All")}
                className="ml-1 p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-300 transition-colors cursor-pointer"
                title="Clear category filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TABLE SECTION */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {[
                  "Product",
                  "SKU / Barcode",
                  "Category",
                  "Supplier",
                  "Cost",
                  isWholesale ? "Wholesale / Retail" : "Price",
                  "Stock",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((p) => {
                const lowStock = p.stock <= p.minStock;
                const pId = p._id || p.id;
                return (
                  <tr
                    key={pId}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-5 py-4 font-medium text-slate-900 max-w-[220px]">
                      <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                      
                      {/* Industry Variant Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        {p.batchNo && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-mono">
                            Batch: {p.batchNo}
                          </span>
                        )}
                        {p.expiryDate && (
                          <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded font-mono">
                            Exp: {new Date(p.expiryDate).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}
                          </span>
                        )}
                        {p.isPrescriptionOnly && (
                          <span className="text-[10px] bg-red-100 text-red-800 font-bold px-1.5 py-0.2 rounded">
                            Rx
                          </span>
                        )}
                        {p.size && (
                          <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded font-semibold">
                            Size: {p.size}
                          </span>
                        )}
                        {p.color && (
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
                            {p.color}
                          </span>
                        )}
                        {p.packSize && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                            Pack: {p.packSize}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-mono text-xs text-slate-700 font-semibold">{p.sku}</div>
                      {p.barcode ? (
                        <div className="flex items-center gap-1 text-[11px] font-mono text-blue-600 mt-0.5" title={`Barcode: ${p.barcode}`}>
                          <Barcode className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{p.barcode}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">No Barcode</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge label={p.category} variant="blue" />
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-xs truncate max-w-[140px]">
                      {p.supplier || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{fmt(p.cost)}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {isWholesale && p.wholesalePrice && Number(p.wholesalePrice) > 0 ? (
                        <div>
                          <div className="text-amber-700 font-bold">{fmt(p.wholesalePrice)}</div>
                          <div className="text-[10px] text-slate-400 font-normal">MRP: {fmt(p.price)}</div>
                        </div>
                      ) : (
                        fmt(p.price)
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {Number(p.stock || 0) <= 0 ? (
                        <div>
                          <span className="font-mono font-bold text-[11px] text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded inline-block">
                            0 in Stock
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5">Awaiting purchase</p>
                        </div>
                      ) : (
                        <div>
                          <span
                            className={`font-mono font-bold text-sm ${lowStock ? "text-amber-600" : "text-slate-900 dark:text-slate-100"}`}
                          >
                            {p.stock} <span className="text-[10px] font-normal text-slate-500">{p.unit || "Piece"}</span>
                          </span>
                          {lowStock && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-600 mt-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              Low Stock (Min: {p.minStock})
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Btn
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPrintBarcodeProduct(p);
                            setBarcodeCopies(1);
                          }}
                          icon={<Barcode className="w-3.5 h-3.5 text-slate-700" />}
                          title="Print Barcode Labels"
                          className="text-[11px] py-1 px-2 text-slate-700 bg-white border-slate-200 hover:bg-slate-50 shadow-2xs"
                        >
                          Barcode
                        </Btn>
                        <Btn
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            localStorage.setItem(
                              "reorderProduct",
                              JSON.stringify({ name: p.name, minStock: p.minStock })
                            );
                            if (onNav) onNav("purchase");
                            else window.location.href = "/app/purchase";
                          }}
                          icon={<ShoppingCart className="w-3.5 h-3.5 text-blue-600" />}
                          title="Record Supplier Purchase to Inward Stock"
                          className="text-[11px] py-1 px-2 text-blue-700 bg-blue-50/70 border-blue-200 hover:bg-blue-100"
                        >
                          Inward Stock
                        </Btn>
                        <Btn
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowEditModal(true);
                            setEditId(pId);
                            setEditForm({
                              name: p.name,
                              sku: p.sku,
                              barcode: p.barcode || "",
                              category: p.category,
                              supplier: p.supplier,
                              cost: String(p.cost ?? 0),
                              price: String(p.price ?? 0),
                              wholesalePrice: String(p.wholesalePrice ?? 0),
                              minOrderQty: String(p.minOrderQty ?? 1),
                              packSize: p.packSize || "",
                              batchNo: p.batchNo || "",
                              expiryDate: p.expiryDate ? String(p.expiryDate).split("T")[0] : "",
                              size: p.size || "",
                              color: p.color || "",
                              warrantyMonths: String(p.warrantyMonths ?? 0),
                              isPrescriptionOnly: Boolean(p.isPrescriptionOnly),
                              gst: String(p.gst ?? ""),
                              stock: String(p.stock ?? 0),
                              minStock: String(p.minStock ?? 0),
                              unit: p.unit || "Piece",
                            });
                          }}
                          icon={<Edit2 className="w-3.5 h-3.5" />}
                        />
                        <Btn
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(pId);
                          }}
                          icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Showing {filtered.length} of {productList.length} products
          </p>
          <div className="flex gap-1">
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                className={`w-8 h-8 text-xs rounded-lg ${p === 1 ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* BARCODE LABEL PRINT MODAL */}
      {printBarcodeProduct && (
        <Modal
          title={`Print Barcode Label: ${printBarcodeProduct.name}`}
          onClose={() => setPrintBarcodeProduct(null)}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 border rounded-xl">
              <div>
                <p className="text-xs font-semibold text-slate-800">Barcode Identifier</p>
                <p className="text-xs font-mono text-blue-600 font-bold">
                  {printBarcodeProduct.barcode || printBarcodeProduct.sku}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600">Quantity (Stickers):</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={barcodeCopies}
                  onChange={(e) => setBarcodeCopies(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 border rounded-lg px-2 py-1 text-xs text-center font-bold"
                />
              </div>
            </div>

            {/* Label Preview */}
            <div className="border border-dashed border-slate-300 rounded-2xl p-6 bg-slate-50 flex flex-col items-center justify-center">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-3">
                Label Sticker Preview (50mm × 30mm)
              </p>
              <div
                id="printable-barcode-label"
                className="bg-white border border-slate-300 shadow-sm rounded-lg p-3 w-56 flex flex-col items-center text-center"
              >
                <p className="text-xs font-bold text-slate-900 truncate w-full">{printBarcodeProduct.name}</p>
                <div className="w-full my-1.5 flex justify-center">
                  <BarcodeSVG value={printBarcodeProduct.barcode || printBarcodeProduct.sku} height={40} />
                </div>
                <div className="w-full flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 font-semibold">
                  <span className="text-slate-500 font-mono text-[10px]">{printBarcodeProduct.sku}</span>
                  <span className="text-blue-700 font-bold">MRP: ₹{printBarcodeProduct.price}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Btn variant="outline" onClick={() => setPrintBarcodeProduct(null)} className="flex-1 justify-center">
                Close
              </Btn>
              <Btn
                variant="primary"
                onClick={() => {
                  const printWin = window.open("", "_blank", "width=600,height=600");
                  if (!printWin) {
                    showToast("Please allow popups to print barcode stickers.", "error");
                    return;
                  }
                  const barcodeVal = printBarcodeProduct.barcode || printBarcodeProduct.sku;
                  const labelsHtml = Array.from({ length: barcodeCopies })
                    .map(
                      () => `
                      <div class="sticker">
                        <div class="prod-name">${printBarcodeProduct.name}</div>
                        <div class="barcode-container">
                          <!-- Barcode Lines -->
                          <svg viewBox="0 0 160 40" class="barcode-svg">
                            <rect x="0" y="0" width="2" height="40" fill="#000"/>
                            <rect x="4" y="0" width="1" height="40" fill="#000"/>
                            <rect x="8" y="0" width="3" height="40" fill="#000"/>
                            <rect x="14" y="0" width="1" height="40" fill="#000"/>
                            <rect x="18" y="0" width="2" height="40" fill="#000"/>
                            <rect x="23" y="0" width="3" height="40" fill="#000"/>
                            <rect x="29" y="0" width="1" height="40" fill="#000"/>
                            <rect x="33" y="0" width="2" height="40" fill="#000"/>
                            <rect x="38" y="0" width="3" height="40" fill="#000"/>
                            <rect x="44" y="0" width="2" height="40" fill="#000"/>
                            <rect x="49" y="0" width="1" height="40" fill="#000"/>
                            <rect x="53" y="0" width="3" height="40" fill="#000"/>
                            <rect x="59" y="0" width="2" height="40" fill="#000"/>
                            <rect x="64" y="0" width="1" height="40" fill="#000"/>
                            <rect x="68" y="0" width="3" height="40" fill="#000"/>
                            <rect x="74" y="0" width="2" height="40" fill="#000"/>
                            <rect x="79" y="0" width="1" height="40" fill="#000"/>
                            <rect x="83" y="0" width="3" height="40" fill="#000"/>
                            <rect x="89" y="0" width="2" height="40" fill="#000"/>
                            <rect x="94" y="0" width="1" height="40" fill="#000"/>
                            <rect x="98" y="0" width="2" height="40" fill="#000"/>
                            <rect x="103" y="0" width="3" height="40" fill="#000"/>
                            <rect x="109" y="0" width="1" height="40" fill="#000"/>
                            <rect x="113" y="0" width="2" height="40" fill="#000"/>
                            <rect x="118" y="0" width="3" height="40" fill="#000"/>
                            <rect x="124" y="0" width="2" height="40" fill="#000"/>
                            <rect x="129" y="0" width="1" height="40" fill="#000"/>
                            <rect x="133" y="0" width="3" height="40" fill="#000"/>
                            <rect x="139" y="0" width="2" height="40" fill="#000"/>
                            <rect x="144" y="0" width="1" height="40" fill="#000"/>
                            <rect x="148" y="0" width="2" height="40" fill="#000"/>
                            <rect x="153" y="0" width="3" height="40" fill="#000"/>
                            <rect x="158" y="0" width="2" height="40" fill="#000"/>
                          </svg>
                          <div class="code-num">${barcodeVal}</div>
                        </div>
                        <div class="price-row">
                          <span>${printBarcodeProduct.sku}</span>
                          <strong>₹${printBarcodeProduct.price}</strong>
                        </div>
                      </div>
                    `
                    )
                    .join("");

                  printWin.document.write(`
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <title>Barcode Labels - ${printBarcodeProduct.name}</title>
                        <style>
                          @page { margin: 4mm; }
                          * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
                          body { display: flex; flex-wrap: wrap; gap: 6mm; padding: 4mm; background: #fff; }
                          .sticker { width: 50mm; height: 30mm; border: 1px dashed #ccc; padding: 2mm 3mm; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; page-break-inside: avoid; }
                          .prod-name { font-size: 10px; font-weight: bold; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                          .barcode-container { display: flex; flex-direction: column; align-items: center; width: 100%; }
                          .barcode-svg { width: 42mm; height: 12mm; }
                          .code-num { font-size: 8px; font-family: monospace; letter-spacing: 1px; font-weight: bold; margin-top: 1px; }
                          .price-row { width: 100%; display: flex; justify-content: space-between; font-size: 9px; border-top: 1px solid #eee; padding-top: 1px; }
                          .price-row strong { font-size: 10px; color: #000; }
                        </style>
                      </head>
                      <body>
                        ${labelsHtml}
                        <script>
                          window.onload = function() {
                            window.print();
                            window.close();
                          };
                        </script>
                      </body>
                    </html>
                  `);
                  printWin.document.close();
                }}
                className="flex-1 justify-center shadow-md shadow-blue-500/20"
                icon={<Printer className="w-4 h-4" />}
              >
                Print {barcodeCopies} Sticker{barcodeCopies > 1 ? "s" : ""}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* CAMERA BARCODE SCANNER MODAL */}
      <CameraBarcodeScanner
        isOpen={cameraScannerOpen}
        onClose={() => setCameraScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title={
          scannerTarget === "search"
            ? "Scan Barcode to Find Product"
            : scannerTarget === "add"
            ? "Scan Barcode for New Product"
            : "Scan Barcode for Product"
        }
      />
    </div>
  );
}



