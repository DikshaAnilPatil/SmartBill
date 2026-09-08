import React, { useState, useEffect } from "react";
import { PackageSearch, Check, Loader2, Save } from "lucide-react";
import { Select, Input, Btn } from "@shared/components/common/ui";
import { getInventorySettings, updateInventorySettings } from "@shared/api/inventorySettingsAPI";

const CleanToggle = ({ title, description, checked, onChange }) => (
  <div className="flex items-start justify-between py-4 group cursor-pointer" onClick={onChange}>
    <div className="pr-8">
      <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
        {title}
      </p>
      {description && (
        <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
          {description}
        </p>
      )}
    </div>
    <div
      className={`w-10 h-5.5 rounded-full relative flex-shrink-0 transition-colors mt-0.5 ${
        checked ? "bg-blue-600" : "bg-slate-200"
      }`}
    >
      <span
        className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-sm transition-all duration-300 ${
          checked ? "right-0.5" : "left-0.5"
        }`}
      />
    </div>
  </div>
);

const Section = ({ title, description, children, isLast }) => (
  <div className={`flex flex-col md:flex-row gap-8 py-8 ${!isLast ? "border-b border-slate-100" : ""}`}>
    <div className="md:w-1/3 flex-shrink-0">
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{description}</p>
    </div>
    <div className="md:w-2/3 flex-1 bg-slate-50/50 rounded-2xl p-5 border border-slate-100/60">
      {children}
    </div>
  </div>
);

export default function ItemInventorySettingsTab() {
  const [settings, setSettings] = useState({
    stockValueFormula: "FIFO Method",
    defaultItemType: "Goods",
    lowStockAlert: "10",
    enableSerialTracking: false,
    enableBatchTracking: false,
    enableMultiUnit: true,
    preventNegativeStock: false,
  });

  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // 1. Initial load from localStorage for instant display
    try {
      const stored = localStorage.getItem("smartbill_inventorySettings");
      if (stored) {
        setSettings((prev) => ({ ...prev, ...JSON.parse(stored) }));
      }
    } catch (_) {}

    // 2. Fetch authoritative settings from backend
    getInventorySettings()
      .then((res) => {
        if (res?.settings) {
          setSettings((prev) => {
            const merged = { ...prev, ...res.settings };
            localStorage.setItem("smartbill_inventorySettings", JSON.stringify(merged));
            return merged;
          });
        }
      })
      .catch((err) => {
        console.warn("Inventory settings load notice:", err.message);
      });
  }, []);

  const handleChange = (field, value) => {
    setSettings((prev) => {
      const next = { ...prev, [field]: value };
      localStorage.setItem("smartbill_inventorySettings", JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("inventorySettingsUpdated", { detail: next }));
      return next;
    });
    setShowSuccess(false);
  };

  const handleToggle = (field) => {
    setSettings((prev) => {
      const next = { ...prev, [field]: !prev[field] };
      localStorage.setItem("smartbill_inventorySettings", JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("inventorySettingsUpdated", { detail: next }));
      return next;
    });
    setShowSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem("smartbill_inventorySettings", JSON.stringify(settings));
      window.dispatchEvent(new CustomEvent("inventorySettingsUpdated", { detail: settings }));
      window.dispatchEvent(new CustomEvent("stockUpdated"));

      await updateInventorySettings(settings);

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.warn("Backend settings sync warning:", err.message);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-16 animate-in fade-in duration-500">
      
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-md">
            <PackageSearch className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Item & Inventory</h2>
            <p className="text-sm text-slate-500 mt-0.5">Manage stock valuation, tracking features, and alerts</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {showSuccess && (
            <span className="text-sm font-medium text-emerald-600 flex items-center gap-1.5 animate-in fade-in slide-in-from-right-4">
              <Check className="w-4 h-4" /> Saved Successfully
            </span>
          )}
          <Btn
            variant="primary"
            onClick={handleSave}
            disabled={saving}
            className="min-w-[130px] justify-center bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20"
            icon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Btn>
        </div>
      </div>

      {/* Settings Sections - Split Layout */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm px-8 py-2">
        
        <Section 
          title="General Setup" 
          description="Configure how your inventory is valued and set default options for new items."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Select
              label="Stock Valuation Method"
              value={settings.stockValueFormula}
              onChange={(v) => handleChange("stockValueFormula", v)}
              options={["FIFO Method", "LIFO Method", "Weighted Average"]}
            />
            <Select
              label="Default Item Type"
              value={settings.defaultItemType}
              onChange={(v) => handleChange("defaultItemType", v)}
              options={["Goods / Products", "Services (Non-inventory)"]}
            />
          </div>
        </Section>

        <Section 
          title="Advanced Tracking" 
          description="Enable granular tracking rules like batch expiry dates, serial numbers, and barcode scanning."
        >
          <div className="divide-y divide-slate-100/80">
            <CleanToggle
              title="Enable Batch & Expiry Tracking"
              description="Track manufacturing batches and expiry dates (essential for FMCG or Pharmacy)."
              checked={settings.enableBatchTracking}
              onChange={() => handleToggle("enableBatchTracking")}
            />
            <CleanToggle
              title="Enable Serial Number Tracking"
              description="Assign unique serial numbers to individual units (essential for Electronics)."
              checked={settings.enableSerialTracking}
              onChange={() => handleToggle("enableSerialTracking")}
            />
          </div>
        </Section>

        <Section 
          title="Measurements & Alerts" 
          description="Configure custom measurement scales and set up automated low stock alerts."
          isLast={true}
        >
          <div className="divide-y divide-slate-100/80">
            <CleanToggle
              title="Multi-unit Measurement Scales"
              description="Allow mapping between different units (e.g., 1 Box = 10 Pieces)."
              checked={settings.enableMultiUnit}
              onChange={() => handleToggle("enableMultiUnit")}
            />
            <CleanToggle
              title="Prevent Negative Stock Sales"
              description="Block the creation of invoices if the required stock quantity is unavailable."
              checked={settings.preventNegativeStock}
              onChange={() => handleToggle("preventNegativeStock")}
            />
            
            {/* Low Stock Warning Threshold */}
            <div className="pt-5 mt-2">
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Global Low Stock Warning Threshold
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={settings.lowStockAlert}
                  onChange={(v) => handleChange("lowStockAlert", v)}
                />
                <span className="text-sm text-slate-500">Units remaining</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                You will be warned when any item's stock falls below this number.
              </p>
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
}



