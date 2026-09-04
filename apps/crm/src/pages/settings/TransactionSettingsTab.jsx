import React, { useState, useEffect } from "react";
import {
  Receipt,
  Tag,
  CreditCard,
  RotateCcw,
  Check,
  Loader2,
  Save,
  Zap,
} from "lucide-react";
import { Select, Input, Btn } from "@shared/components/common/ui";
import {
  fetchTransactionSettings,
  saveTransactionSettings,
} from "@shared/api/transactionSettingsAPI";
import { DEFAULT_TRANSACTION_SETTINGS } from "@shared/hooks/useTransactionSettings";

const CleanToggle = ({ title, description, checked, onChange }) => (
  <div
    className="flex items-start justify-between py-3.5 group cursor-pointer"
    onClick={onChange}
  >
    <div className="pr-6">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {title}
      </p>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
          {description}
        </p>
      )}
    </div>
    <div
      className={`w-10 h-5.5 rounded-full relative flex-shrink-0 transition-colors mt-0.5 ${
        checked ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"
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

const Section = ({ icon: Icon, title, description, children, isLast }) => (
  <div
    className={`flex flex-col lg:flex-row gap-6 py-7 ${
      !isLast ? "border-b border-slate-100 dark:border-slate-800" : ""
    }`}
  >
    <div className="lg:w-1/3 flex-shrink-0">
      <div className="flex items-center gap-2.5 mb-1.5">
        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pl-10">
        {description}
      </p>
    </div>
    <div className="lg:w-2/3 flex-1 bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 space-y-4">
      {children}
    </div>
  </div>
);

export default function TransactionSettingsTab() {
  const [settings, setSettings] = useState(DEFAULT_TRANSACTION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load transaction settings on mount
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetchTransactionSettings();
        if (res?.transactionSettings && isMounted) {
          setSettings((prev) => ({
            ...prev,
            ...res.transactionSettings,
          }));
        }
      } catch (err) {
        console.warn("Could not load transaction settings:", err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
    setShowSuccess(false);
  };

  const handleToggle = (field) => {
    setSettings((prev) => ({ ...prev, [field]: !prev[field] }));
    setHasUnsavedChanges(true);
    setShowSuccess(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await saveTransactionSettings(settings);
      const savedData = res?.transactionSettings || settings;

      setSettings(savedData);
      setHasUnsavedChanges(false);
      setShowSuccess(true);

      // Broadcast update event across open screens
      window.dispatchEvent(
        new CustomEvent("transactionSettingsUpdated", { detail: savedData })
      );

      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      alert(err.message || "Failed to save transaction settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
        <p className="text-sm text-slate-500 font-medium">
          Loading transaction settings...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-16 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 dark:bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-md">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Transaction Settings
              </h2>
              {hasUnsavedChanges && (
                <span className="px-2 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 rounded-full">
                  Unsaved changes
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Configure billing rules, pricing tiers, discounts, checkout options, and receipt preferences
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {showSuccess && (
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-4 h-4" /> Saved Successfully
            </span>
          )}
          <Btn
            variant="primary"
            onClick={handleSave}
            disabled={saving}
            className="min-w-[130px] justify-center bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20"
            icon={
              saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )
            }
          >
            {saving ? "Saving..." : "Save Settings"}
          </Btn>
        </div>
      </div>

      {/* Settings Sections Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm px-6 sm:px-8 py-2">
        {/* SECTION 1: PRICING & BILLING */}
        <Section
          icon={Tag}
          title="Pricing & Billing Rules"
          description="Define default selling price tier and item editing privileges during sales."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Default Selling Price"
              value={settings.salePrice}
              onChange={(v) => handleChange("salePrice", v)}
              options={["Retail Price", "Wholesale Price"]}
            />
            <div className="flex flex-col justify-center pt-2 sm:pt-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selected price rate will automatically load when adding products in POS.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-2">
            <CleanToggle
              title="Allow Price Editing in POS"
              description="Allow cashier or billing staff to adjust the selling price of items directly in the cart."
              checked={settings.allowPriceEditing}
              onChange={() => handleToggle("allowPriceEditing")}
            />
            <CleanToggle
              title="Allow Billing on Zero / Negative Stock"
              description="Enable creating invoices even if product inventory is low or currently shows 0 stock."
              checked={settings.allowNegativeStock}
              onChange={() => handleToggle("allowNegativeStock")}
            />
          </div>
        </Section>

        {/* SECTION 2: DISCOUNT MANAGEMENT */}
        <Section
          icon={Zap}
          title="Discount Management"
          description="Control discount limits, calculation modes, and application scope."
        >
          <CleanToggle
            title="Enable Discounts"
            description="Allow applying item or invoice discounts during billing checkout."
            checked={settings.allowDiscount}
            onChange={() => handleToggle("allowDiscount")}
          />

          {settings.allowDiscount && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Discount Application Scope"
                  value={settings.discountAppliedOn}
                  onChange={(v) => handleChange("discountAppliedOn", v)}
                  options={["Item-wise", "Entire Invoice"]}
                />
                <Select
                  label="Default Discount Format"
                  value={settings.discountType}
                  onChange={(v) => handleChange("discountType", v)}
                  options={["Percentage", "Flat Amount"]}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Maximum Allowed Discount Cap (%)
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.maximumDiscount}
                    onChange={(v) => handleChange("maximumDiscount", v)}
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    % Max limit per transaction
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Prevents users from giving discounts higher than this percentage.
                </p>
              </div>
            </div>
          )}
        </Section>

        {/* SECTION 3: PAYMENT & CHECKOUT */}
        <Section
          icon={CreditCard}
          title="Payment & Checkout"
          description="Set default payment methods, round-off calculation, and receipt printing behavior."
          isLast={true}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Default Payment Method"
              value={settings.defaultPaymentMode || "Cash"}
              onChange={(v) => handleChange("defaultPaymentMode", v)}
              options={["Cash", "UPI / QR", "Card", "Bank Transfer", "Credit / Due"]}
            />
            <div className="flex items-center pt-5">
              <CleanToggle
                title="Auto Round-off Bill Total"
                description="Round fractional totals to nearest ₹1."
                checked={settings.enableRoundOff}
                onChange={() => handleToggle("enableRoundOff")}
              />
            </div>
          </div>

          {/* Cash Discount Incentive */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="py-3.5">
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
                Cash Discount (%)
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                Automatically apply a percentage discount when payment mode is Cash. Set to 0 to disable.
              </p>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.cashDiscountPercent}
                  onChange={(v) => handleChange("cashDiscountPercent", v)}
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  % off on Cash payments
                </span>
              </div>
            </div>
          </div>

          {/* Receipt Printing Behavior */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            <CleanToggle
              title="Show Receipt Preview After Checkout"
              description="Displays the receipt modal for quick review and print confirmation."
              checked={settings.showPrintPreview}
              onChange={() => handleToggle("showPrintPreview")}
            />
            <CleanToggle
              title="Auto-Print Immediately on Checkout"
              description="Instantly sends receipt directly to the printer without waiting for user action."
              checked={settings.printAfterSaving}
              onChange={() => handleToggle("printAfterSaving")}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}



