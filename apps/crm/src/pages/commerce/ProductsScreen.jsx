import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  Download,
  Edit2,
  Eye,
  Filter,
  Package,
  Plus,
  Search,
  Settings,
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
  updateProduct,
  deleteProduct,
} from "@shared/api/productAPI";
import {
  exportToCsv,
  parseCsv,
  downloadProductTemplate,
} from "@shared/utils/csvHelper";

export default function ProductsScreen() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [catFilter, setCatFilter] = useState("All");

  const [deleteId, setDeleteId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    sku: "",
    category: "Electronics",
    supplier: "",
    cost: "0",
    price: "0",
    gst: "",
    stock: "0",
    minStock: "10",
    unit: "Piece",
  });
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // CSV Import / Export State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [parsedProducts, setParsedProducts] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);

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
  
  // Load suppliers dynamically
  useEffect(() => {
    fetchSuppliers()
      .then((data) => {
        const list = Array.isArray(data.suppliers) ? data.suppliers : data;
        setSupplierList(list);
      })
      .catch((err) => console.error('Failed to load suppliers', err));
  }, []);

  // --- DYNAMIC & PERSISTENT CATEGORIES WITH REMOVE FEATURE ---
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem("smartbill_categories");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return ["Electronics", "Clothing", "Groceries", "Hardware"];
  });
  const [newCategory, setNewCategory] = useState("");
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [showEditCategoryInput, setShowEditCategoryInput] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [categoryToRemove, setCategoryToRemove] = useState(null);
  const [supplierList, setSupplierList] = useState([]);

  // Persist categories list to localStorage
  useEffect(() => {
    localStorage.setItem("smartbill_categories", JSON.stringify(categories));
  }, [categories]);

  // =========================
  // EXPORT PRODUCTS
  // =========================
  const handleExportProducts = () => {
    if (productList.length === 0) {
      showToast("No products available to export.", "error");
      return;
    }
    const columns = [
      { key: "name", label: "Product Name" },
      { key: "sku", label: "SKU / Barcode" },
      { key: "category", label: "Category" },
      { key: "supplier", label: "Supplier" },
      { key: "price", label: "Selling Price (₹)" },
      { key: "cost", label: "Purchase Cost (₹)" },
      { key: "stock", label: "Stock Quantity" },
      { key: "minStock", label: "Min Stock Alert" },
      { key: "unit", label: "Unit" },
      { key: "gst", label: "GST (%)" },
      { key: "status", label: "Status" },
    ];
    exportToCsv("SmartBill_Products.csv", columns, productList);
    showToast(`Exported ${productList.length} products successfully!`, "success");
  };

  // =========================
  // PARSE CSV FILE
  // =========================
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      const records = parseCsv(text);
      if (!records || records.length === 0) {
        setImportErrors(["CSV file is empty or could not be parsed."]);
        setParsedProducts([]);
        return;
      }

      const valid = [];
      const errors = [];

      records.forEach((r, idx) => {
        const name = r.productname || r.name || r.title || "";
        const rawPrice = r.sellingprice || r.price;
        const rawCost = r.purchasecost || r.cost;
        const rawStock = r.initialstockqty || r.stock || r.quantity;
        const price = Number(rawPrice || 0);
        const cost = Number(rawCost || 0);
        const stock = Number(rawStock || 0);
        const sku = r.skubarcode || r.sku || r.barcode || `SKU-${Date.now().toString().slice(-4)}-${idx + 1}`;
        const category = r.category || "Electronics";
        const minStock = Number(r.minstockalert || r.minstock || 10);
        const unit = r.unitpiecekgbox || r.unit || "Piece";
        const gst = Number(r.gstrate || r.gst || 0);

        if (!name.trim()) {
          errors.push(`Row ${idx + 2}: Product Name is required.`);
        } else if (isNaN(price) || price < 0) {
          errors.push(`Row ${idx + 2} ("${name}"): Invalid selling price.`);
        } else {
          valid.push({
            name: name.trim(),
            sku: sku.trim(),
            category,
            supplier: r.supplier || "",
            cost,
            price,
            stock,
            minStock,
            unit,
            gst,
            status: "Active",
          });
        }
      });

      setParsedProducts(valid);
      setImportErrors(errors);
    };
    reader.readAsText(file);
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
    let createdCount = 0;
    let failedCount = 0;

    for (const p of parsedProducts) {
      try {
        await createProduct(p);
        createdCount++;
      } catch (err) {
        failedCount++;
      }
    }

    await loadProducts();
    window.dispatchEvent(new CustomEvent("stockUpdated"));
    window.dispatchEvent(new CustomEvent("productUpdated"));
    setImporting(false);
    setShowImportModal(false);
    setImportFile(null);
    setParsedProducts([]);
    setImportErrors([]);

    if (failedCount > 0) {
      showToast(`Imported ${createdCount} products. ${failedCount} items had errors or duplicate SKUs.`, "warning");
    } else {
      showToast(`Successfully imported ${createdCount} products!`, "success");
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

  // Automatically include any category from loaded products into the categories list
  useEffect(() => {
    if (productList.length > 0) {
      setCategories((prev) => {
        const set = new Set([...prev]);
        productList.forEach((p) => {
          if (p.category && String(p.category).trim()) {
            set.add(String(p.category).trim());
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

    // Remove category from list
    const updated = categories.filter((c) => c !== catName);
    const finalCategories = updated.length > 0 ? updated : ["General"];
    setCategories(finalCategories);

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
    category: "Electronics",
    supplier: supplierList[0]?.name ?? "",
    cost: "0",
    price: "0",
    gst: "",
    stock: "0",
    minStock: "10",
    unit: "Piece",
  });

  const filtered = productList.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.includes(search);
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
                        if (newCategory.trim() && !categories.includes(newCategory.trim())) {
                          setCategories([...categories, newCategory.trim()]);
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
              <Input
                label="SKU / Barcode"
                value={editForm.sku}
                onChange={(v) => setEditForm((f) => ({ ...f, sku: v }))}
              />
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
                      setCategories([...categories, newCategory]);
                      setEditForm((f) => ({ ...f, category: newCategory }));
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

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Opening Stock"
                value={editForm.stock}
                onChange={(v) => setEditForm((f) => ({ ...f, stock: v }))}
              />
              <Input
                label="Min. Stock Level"
                value={editForm.minStock}
                onChange={(v) => setEditForm((f) => ({ ...f, minStock: v }))}
              />
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
                      category: editForm.category,
                      supplier: editForm.supplier,
                      cost: Number(editForm.cost || 0),
                      price: Number(editForm.price || 0),
                      gst: Number(editForm.gst || 0),
                      stock: Number(editForm.stock || 0),
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
              <Input
                label="SKU / Barcode"
                value={form.sku}
                onChange={(v) => setForm((f) => ({ ...f, sku: v }))}
              />
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
                      setCategories([...categories, newCategory]);
                      setForm((f) => ({ ...f, category: newCategory }));
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
              label="Supplier"
              value={form.supplier}
              onChange={(v) => setForm((f) => ({ ...f, supplier: v }))}
              options={supplierList.map((s) => s.name)}
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
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Opening Stock"
                type="number"
                value={form.stock}
                onChange={(v) => setForm((f) => ({ ...f, stock: v }))}
              />
              <Input
                label="Min. Stock Level"
                type="number"
                value={form.minStock}
                onChange={(v) => setForm((f) => ({ ...f, minStock: v }))}
              />
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
                  setSaving(true);
                  // Check for duplicate SKU
                  if (productList.some((p) => p.sku === form.sku)) {
                    showToast('SKU already exists. Please use a unique SKU.', 'error');
                    setSaving(false);
                    return;
                  }
                  try {
                    await createProduct({
                      name: form.name,
                      sku: form.sku,
                      category: form.category,
                      supplier: form.supplier,
                      cost: Number(form.cost || 0),
                      price: Number(form.price || 0),
                      gst: Number(form.gst || 0),
                      stock: Number(form.stock || 0),
                      minStock: Number(form.minStock || 0),
                      unit: form.unit,
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
                      category: "Electronics",
                      supplier: supplierList[0]?.name ?? "",
                      cost: "0",
                      price: "0",
                      gst: "",
                      stock: "0",
                      minStock: "10",
                      unit: "Piece",
                    });
                    showToast("Product created successfully", "success");
                  } catch (err) {
                    showToast(
                      err.message || "Failed to create product.",
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

      {/* BULK IMPORT CSV MODAL */}
      {showImportModal && (
        <Modal
          title="Bulk Import Products from CSV"
          onClose={() => {
            setShowImportModal(false);
            setImportFile(null);
            setParsedProducts([]);
            setImportErrors([]);
          }}
        >
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-900">Download CSV Template</p>
                <p className="text-xs text-blue-700">Use our pre-formatted template with all required columns.</p>
              </div>
              <Btn
                variant="outline"
                size="sm"
                onClick={downloadProductTemplate}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                Template
              </Btn>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Upload CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-xl p-2 cursor-pointer"
              />
            </div>

            {importErrors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl max-h-32 overflow-y-auto">
                <p className="text-xs font-bold text-red-700 mb-1">CSV Warnings / Errors ({importErrors.length}):</p>
                <ul className="text-[11px] text-red-600 space-y-0.5 list-disc pl-4">
                  {importErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsedProducts.length > 0 && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-xs font-bold text-emerald-800">
                  ✓ {parsedProducts.length} valid products ready for import.
                </p>
                <div className="max-h-32 overflow-y-auto mt-2 divide-y divide-emerald-100 text-xs text-slate-700">
                  {parsedProducts.slice(0, 5).map((p, i) => (
                    <div key={i} className="py-1 flex justify-between">
                      <span className="font-medium">{p.name}</span>
                      <span className="font-mono text-slate-500">₹{p.price} | Stock: {p.stock}</span>
                    </div>
                  ))}
                  {parsedProducts.length > 5 && (
                    <p className="text-[10px] text-slate-500 pt-1 text-center font-medium">
                      + {parsedProducts.length - 5} more items...
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Btn
                variant="outline"
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setParsedProducts([]);
                  setImportErrors([]);
                }}
                className="flex-1 justify-center"
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                disabled={importing || parsedProducts.length === 0}
                onClick={handleExecuteImport}
                className="flex-1 justify-center"
                icon={<Upload className="w-4 h-4" />}
              >
                {importing ? "Importing..." : `Import (${parsedProducts.length})`}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* FILTER AND HEADER CONTROLS */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <Input
              value={search}
              onChange={setSearch}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
          <Btn
            variant="outline"
            size="md"
            onClick={handleExportProducts}
            icon={<Download className="w-4 h-4" />}
          >
            Export CSV
          </Btn>
          <Btn
            variant="outline"
            size="md"
            onClick={() => setShowImportModal(true)}
            icon={<Upload className="w-4 h-4" />}
          >
            Import CSV
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
            onClick={() => setShowModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Add Product
          </Btn>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {["All", ...categories].map((c) => (
            <div key={c} className="flex items-center">
              {c === "All" ? (
                <button
                  onClick={() => setCatFilter("All")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    catFilter === "All"
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:border-blue-300"
                  }`}
                >
                  All
                </button>
              ) : (
                <div
                  className={`group flex items-center rounded-lg border text-xs font-medium transition-all overflow-hidden ${
                    catFilter === c
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:border-blue-400"
                  }`}
                >
                  <button
                    onClick={() => setCatFilter(c)}
                    className={`pl-3 pr-2 py-1.5 transition-colors ${
                      catFilter === c
                        ? "text-white"
                        : "hover:text-blue-700"
                    }`}
                  >
                    {c}
                    {productList.filter((p) => p.category === c).length > 0 && (
                      <span
                        className={`ml-1.5 text-[10px] font-mono ${
                          catFilter === c ? "opacity-75" : "text-slate-400"
                        }`}
                      >
                        ({productList.filter((p) => p.category === c).length})
                      </span>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategoryToRemove(c);
                    }}
                    title={`Remove "${c}" category`}
                    className={`pr-2 pl-0.5 py-1.5 transition-all opacity-0 group-hover:opacity-100 ${
                      catFilter === c
                        ? "text-blue-200 hover:text-white"
                        : "text-slate-400 hover:text-red-500"
                    }`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* TABLE SECTION */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {[
                  "Product",
                  "SKU",
                  "Category",
                  "Supplier",
                  "Cost",
                  "Price",
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
                return (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-5 py-4 font-medium text-slate-900 max-w-[200px] truncate">
                      {p.name}
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-slate-500">
                      {p.sku}
                    </td>
                    <td className="px-5 py-4">
                      <Badge label={p.category} variant="blue" />
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-xs truncate max-w-[140px]">
                      {p.supplier}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{fmt(p.cost)}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {fmt(p.price)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`font-mono font-semibold text-sm ${p.stock === 0 ? "text-blue-600" : lowStock ? "text-amber-600" : "text-slate-900"}`}
                      >
                        {p.stock}
                      </span>
                      {lowStock && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 mt-0.5">
                          <AlertTriangle className="w-3 h-3" />
                          Low Stock
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Btn
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowEditModal(true);
                            setEditId(p.id);
                            setEditForm({
                              name: p.name,
                              sku: p.sku,
                              category: p.category,
                              supplier: p.supplier,
                              cost: String(p.cost ?? 0),
                              price: String(p.price ?? 0),
                              gst: "",
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
                            setDeleteId(p.id);
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
    </div>
  );
}



