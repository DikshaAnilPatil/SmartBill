import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  ChevronDown,
  DollarSign,
  Download,
  FileSpreadsheet,
  Package,
  Plus,
  RefreshCw,
  ShoppingCart,
  Upload,
  XCircle,
} from "lucide-react";
import { fmt } from "@shared/utils/format";
import {
  Badge,
  Btn,
  Card,
  StatCard,
  Toast,
  statusBadge,
} from "@shared/components/common/ui";
import { getProducts } from "@shared/api/productAPI";
import { exportToCsv, exportToExcel } from "@shared/utils/csvHelper";

export default function InventoryScreen({ onNav }) {
  const [productList, setProductList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [globalThreshold, setGlobalThreshold] = useState(() => {
    try {
      const stored = localStorage.getItem("smartbill_inventorySettings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.lowStockAlert) return Number(parsed.lowStockAlert);
      }
    } catch (_) {}
    return 10;
  });

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Refresh local threshold
      try {
        const stored = localStorage.getItem("smartbill_inventorySettings");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.lowStockAlert !== undefined) {
            setGlobalThreshold(Number(parsed.lowStockAlert) || 10);
          }
        }
      } catch (_) {}

      const res = await getProducts();
      setProductList(res.products || []);
    } catch (err) {
      setError(err?.message || "Failed to fetch inventory products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();

    const handleUpdate = (e) => {
      if (e?.detail?.lowStockAlert !== undefined) {
        setGlobalThreshold(Number(e.detail.lowStockAlert) || 10);
      }
      loadProducts();
    };

    window.addEventListener("inventorySettingsUpdated", handleUpdate);
    window.addEventListener("stockUpdated", handleUpdate);
    window.addEventListener("productUpdated", handleUpdate);
    window.addEventListener("orderCreated", handleUpdate);
    window.addEventListener("purchaseCreated", handleUpdate);

    return () => {
      window.removeEventListener("inventorySettingsUpdated", handleUpdate);
      window.removeEventListener("stockUpdated", handleUpdate);
      window.removeEventListener("productUpdated", handleUpdate);
      window.removeEventListener("orderCreated", handleUpdate);
      window.removeEventListener("purchaseCreated", handleUpdate);
    };
  }, [loadProducts]);

  const totalProducts = productList.length;
  const totalStockValue = productList.reduce(
    (sum, p) => sum + Number(p.price || 0) * Number(p.stock || 0),
    0
  );

  const getEffectiveMinStock = (p) => {
    return p.minStock !== undefined && p.minStock !== null && p.minStock !== ""
      ? Number(p.minStock)
      : globalThreshold;
  };

  const lowStockItems = productList.filter(
    (p) => Number(p.stock || 0) <= getEffectiveMinStock(p) && Number(p.stock || 0) > 0
  );
  const outOfStockItems = productList.filter(
    (p) => Number(p.stock || 0) === 0
  );
  const allAlertItems = productList.filter(
    (p) => Number(p.stock || 0) <= getEffectiveMinStock(p)
  );

  const categoriesCount = new Set(productList.map((p) => p.category)).size;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Products"
          value={String(totalProducts)}
          sub={`Across ${categoriesCount || 1} categories`}
          trend="neutral"
          icon={<Package className="w-5 h-5" />}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Total Stock Value"
          value={fmt(totalStockValue)}
          sub="Live inventory value"
          trend="up"
          icon={<DollarSign className="w-5 h-5" />}
          color="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Low Stock Items"
          value={String(lowStockItems.length)}
          sub="Action required"
          trend="down"
          icon={<AlertTriangle className="w-5 h-5" />}
          color="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Out of Stock"
          value={String(outOfStockItems.length)}
          sub="Reorder pending"
          trend="down"
          icon={<XCircle className="w-5 h-5" />}
          color="bg-red-50 text-red-500"
        />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900 mb-1">Low Stock Alerts</h3>
            <p className="text-xs text-slate-500">
              Items that need immediate reordering
            </p>
          </div>
          <Btn
            variant="outline"
            size="sm"
            onClick={loadProducts}
            disabled={loading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />}
          >
            Refresh
          </Btn>
        </div>

        {allAlertItems.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
            All items are well stocked! No low stock alerts.
          </div>
        ) : (
          <div className="space-y-3">
            {allAlertItems.map((p) => (
              <div
                key={p._id || p.id}
                className={`flex items-center gap-4 p-4 rounded-xl border ${
                  p.stock === 0
                    ? "border-red-200 bg-red-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <AlertTriangle
                  className={`w-5 h-5 flex-shrink-0 ${
                    p.stock === 0 ? "text-red-500" : "text-amber-500"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{p.sku}</p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-bold ${
                      p.stock === 0 ? "text-red-500" : "text-amber-600"
                    }`}
                  >
                    {p.stock === 0 ? "Out of Stock" : `${p.stock} left`}
                  </p>
                  <p className="text-xs text-slate-500">Min: {p.minStock}</p>
                </div>
                <Btn
                  variant={p.stock === 0 ? "danger" : "outline"}
                  size="sm"
                  icon={<ShoppingCart className="w-3.5 h-3.5" />}
                  onClick={() => {
                    if (onNav) {
                      localStorage.setItem("reorderProduct", JSON.stringify({ name: p.name, minStock: p.minStock }));
                      onNav("purchase");
                    }
                  }}
                >
                  Reorder
                </Btn>
              </div>
            ))}
          </div>
        )}
      </Card>

      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-wrap gap-2">
          <div>
            <h3 className="font-semibold text-slate-900">Current Stock</h3>
            <p className="text-xs text-slate-500">Live quantity, valuation, and stock health</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Export Inventory Dropdown */}
            <div className="relative">
              <Btn
                variant="outline"
                size="sm"
                onClick={() => setShowExportMenu(!showExportMenu)}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                Export Stock
                <ChevronDown className="w-3 h-3 ml-1 opacity-70" />
              </Btn>
              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30">
                  <button
                    onClick={() => {
                      const columns = [
                        { key: "name", label: "Product Name" },
                        { key: "sku", label: "SKU / Barcode" },
                        { key: "category", label: "Category" },
                        { key: "stock", label: "Current Stock" },
                        { key: "unit", label: "Unit" },
                        { key: "minStock", label: "Min Stock Level" },
                        { key: "cost", label: "Purchase Cost (₹)" },
                        { key: "price", label: "Selling Price (₹)" },
                        {
                          key: "stockValue",
                          label: "Total Value (₹)",
                          accessor: (r) => (Number(r.price || 0) * Number(r.stock || 0)).toFixed(2),
                        },
                        { key: "status", label: "Status" },
                      ];
                      exportToExcel("SmartBill_Inventory_Stock.xlsx", "Current Stock", columns, productList);
                      showToast(`Exported stock for ${productList.length} items to Excel!`, "success");
                      setShowExportMenu(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => {
                      const columns = [
                        { key: "name", label: "Product Name" },
                        { key: "sku", label: "SKU / Barcode" },
                        { key: "category", label: "Category" },
                        { key: "stock", label: "Current Stock" },
                        { key: "unit", label: "Unit" },
                        { key: "minStock", label: "Min Stock Level" },
                        { key: "cost", label: "Purchase Cost (₹)" },
                        { key: "price", label: "Selling Price (₹)" },
                        {
                          key: "stockValue",
                          label: "Total Value (₹)",
                          accessor: (r) => (Number(r.price || 0) * Number(r.stock || 0)).toFixed(2),
                        },
                        { key: "status", label: "Status" },
                      ];
                      exportToCsv("SmartBill_Inventory_Stock.csv", columns, productList);
                      showToast(`Exported stock for ${productList.length} items to CSV!`, "success");
                      setShowExportMenu(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4 text-blue-600" />
                    CSV (.csv)
                  </button>
                </div>
              )}
            </div>

            {onNav && (
              <Btn
                variant="outline"
                size="sm"
                onClick={() => onNav("products")}
                icon={<Upload className="w-3.5 h-3.5" />}
              >
                Update Stock via Excel
              </Btn>
            )}

            {onNav && (
              <Btn
                variant="primary"
                size="sm"
                onClick={() => onNav("products")}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Product
              </Btn>
            )}
            <Btn
              variant="outline"
              size="sm"
              onClick={loadProducts}
              disabled={loading}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />}
            >
              Refresh
            </Btn>
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading inventory stock...</div>
        ) : productList.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm space-y-3">
            <p>No products found in your inventory.</p>
            {onNav && (
              <Btn
                variant="primary"
                size="sm"
                onClick={() => onNav("products")}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                + Add First Product
              </Btn>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {[
                  "Product",
                  "Category",
                  "In Stock",
                  "Min Level",
                  "Value",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className={`px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide ${
                      h === "Action" ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {productList.map((p) => (
                <tr key={p._id || p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{p.sku}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge label={p.category || "General"} variant="blue" />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold font-mono ${
                          p.stock === 0
                            ? "text-red-500"
                            : p.stock <= getEffectiveMinStock(p)
                            ? "text-amber-600"
                            : "text-slate-900"
                        }`}
                      >
                        {p.stock}
                      </span>
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (p.stock / Math.max(1, getEffectiveMinStock(p) * 3)) * 100)}%`,
                            backgroundColor:
                              p.stock === 0
                                ? "#EF4444"
                                : p.stock <= getEffectiveMinStock(p)
                                ? "#F59E0B"
                                : "#10B981",
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 font-mono">
                    {p.minStock !== undefined && p.minStock !== null && p.minStock !== "" ? p.minStock : `${globalThreshold} (global)`}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-slate-900">
                    {fmt((p.price || 0) * (p.stock || 0))}
                  </td>
                  <td className="px-5 py-3.5">
                    {statusBadge(p.stock === 0 ? "Inactive" : p.status || "Active")}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Btn
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (onNav) {
                          localStorage.setItem(
                            "reorderProduct",
                            JSON.stringify({ name: p.name, minStock: p.minStock })
                          );
                          onNav("purchase");
                        }
                      }}
                      icon={<ShoppingCart className="w-3.5 h-3.5 text-blue-600" />}
                      className="text-xs py-1 px-2.5 text-blue-700 bg-blue-50/70 border-blue-200 hover:bg-blue-100"
                    >
                      + Inward Stock
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}




