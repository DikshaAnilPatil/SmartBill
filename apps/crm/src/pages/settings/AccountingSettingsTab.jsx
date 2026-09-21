import React, { useState, useEffect } from "react";
import { 
  Landmark, 
  Check, 
  Loader2, 
  Sparkles, 
  RefreshCcw,
  BookOpen,
  Calendar,
  DollarSign,
  PieChart,
  Calculator,
  ShoppingCart,
  CreditCard,
  Settings,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from "lucide-react";
import { Select, Btn, Input, Toast } from "@shared/components/common/ui";
import { getAccountingSettings, updateAccountingSettings } from "@shared/api/accountingSettingsAPI";

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

const Section = ({ icon: Icon, title, description, children, isLast }) => (
  <div className={`flex flex-col md:flex-row gap-8 py-8 ${!isLast ? "border-b border-slate-100" : ""}`}>
    <div className="md:w-1/3 flex-shrink-0">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-5 h-5 text-slate-400" />
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
      </div>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
    <div className="md:w-2/3 flex-1 bg-slate-50/50 rounded-2xl p-5 border border-slate-100/60 shadow-sm">
      {children}
    </div>
  </div>
);

export default function AccountingSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  const [settings, setSettings] = useState({
    accountingMethod: "Accrual",
    doubleEntry: true,
    accountsReceivable: true,
    accountsPayable: true,
    autoLedgerEntries: true,
    fiscalYearStart: "April",
    baseCurrency: "INR (₹)",
    numberFormat: "Indian",
    decimalPlaces: 2,
    enableTaxAccounting: true,
    trackCogs: true,
    inventoryValuation: "FIFO",
    defaultSalesAccount: "Sales Revenue",
    defaultPurchaseAccount: "Cost of Goods Sold",
    trackReturns: true,
    trackDiscounts: true,
    enableRoundOff: true,
    defaultCashAccount: "Cash in Hand",
    enableJournalSettings: true,
    documentNumbering: "Auto",
    strictNegativeCash: false,
    enableCostCenters: false,
  });

  const [originalSettings, setOriginalSettings] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getAccountingSettings();
      if (data) {
        setSettings((prev) => ({ ...prev, ...data }));
        setOriginalSettings(data);
      }
    } catch (error) {
      console.error("Failed to load accounting settings", error);
      showToast("Failed to load settings. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setShowSuccess(false);
  };

  const handleToggle = (field) => {
    setSettings((prev) => ({ ...prev, [field]: !prev[field] }));
    setShowSuccess(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await updateAccountingSettings(settings);
      setSettings((prev) => ({ ...prev, ...updated }));
      setOriginalSettings(updated);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      showToast("Settings saved successfully", "success");
    } catch (error) {
      console.error("Failed to save accounting settings", error);
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (originalSettings) {
      setSettings({ ...originalSettings });
      showToast("Changes discarded", "success");
    }
  };

  const hasUnsavedChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const formatPreviewNumber = () => {
    const amount = 1234567.89;
    const locales = settings.numberFormat === "Indian" ? "en-IN" : "en-US";
    return new Intl.NumberFormat(locales, { 
      minimumFractionDigits: settings.decimalPlaces, 
      maximumFractionDigits: settings.decimalPlaces 
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-16 animate-in fade-in duration-500">
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* Premium Header */}
      <div className="sticky top-0 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-white/80 backdrop-blur-xl p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-md">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Accounting & Books</h2>
            <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
              Manage your financial rules and ledgers
              {hasUnsavedChanges && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[10px] font-medium border border-amber-200">
                  <AlertCircle className="w-3 h-3" /> Unsaved changes
                </span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {showSuccess && (
            <span className="text-sm font-medium text-emerald-600 flex items-center gap-1.5 animate-in fade-in slide-in-from-right-4 mr-2">
              <Check className="w-4 h-4" /> Saved
            </span>
          )}
          {hasUnsavedChanges && (
            <Btn
              variant="outline"
              onClick={handleReset}
              disabled={saving}
              className="text-slate-600 bg-white"
              icon={<RefreshCcw className="w-4 h-4" />}
            >
              Reset
            </Btn>
          )}
          <Btn
            variant="primary"
            onClick={handleSave}
            disabled={saving || (!hasUnsavedChanges && !showSuccess)}
            className="min-w-[130px] justify-center bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:bg-slate-300 disabled:shadow-none"
            icon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Btn>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm px-8 py-2">
        
        {/* 1. Basic Accounting */}
        <Section 
          icon={BookOpen}
          title="Basic Accounting" 
          description="Fundamental accounting settings that govern how entries are recorded."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <Select
              label="Accounting Method"
              value={settings.accountingMethod}
              onChange={(v) => handleChange("accountingMethod", v)}
              options={["Accrual", "Cash"]}
            />
          </div>
          <div className="divide-y divide-slate-100/80">
            <CleanToggle
              title="Double Entry System"
              description="Record corresponding credit and debit entries for all financial transactions."
              checked={settings.doubleEntry}
              onChange={() => handleToggle("doubleEntry")}
            />
            <CleanToggle
              title="Accounts Receivable (A/R)"
              description="Track money owed to your business by customers."
              checked={settings.accountsReceivable}
              onChange={() => handleToggle("accountsReceivable")}
            />
            <CleanToggle
              title="Accounts Payable (A/P)"
              description="Track money your business owes to suppliers."
              checked={settings.accountsPayable}
              onChange={() => handleToggle("accountsPayable")}
            />
            <CleanToggle
              title="Automatic Ledger Entries"
              description="Automatically generate journal entries when invoices or bills are created."
              checked={settings.autoLedgerEntries}
              onChange={() => handleToggle("autoLedgerEntries")}
            />
          </div>
        </Section>

        {/* 2. Financial Year */}
        <Section 
          icon={Calendar}
          title="Financial Year" 
          description="Define the start of your accounting period for accurate reporting."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <Select
              label="Financial Year Starts From"
              value={settings.fiscalYearStart}
              onChange={(v) => handleChange("fiscalYearStart", v)}
              options={["January", "April", "July", "October"]}
            />
          </div>
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <p className="text-sm text-blue-800 flex items-center gap-2">
              <span className="font-semibold">Current FY:</span> 
              {settings.fiscalYearStart} {new Date().getFullYear()} - {
                ["January", "April", "July", "October"][
                  (["January", "April", "July", "October"].indexOf(settings.fiscalYearStart) + 3) % 4
                ] || "March"
              } {new Date().getFullYear() + 1}
            </p>
          </div>
        </Section>

        {/* 3. Currency & Number Format */}
        <Section 
          icon={DollarSign}
          title="Currency & Number Format" 
          description="Configure how monetary values appear across your dashboard and invoices."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <Select
              label="Base Currency"
              value={settings.baseCurrency}
              onChange={(v) => handleChange("baseCurrency", v)}
              options={["INR (₹)", "USD ($)", "EUR (€)", "GBP (£)"]}
            />
            <Select
              label="Number Format"
              value={settings.numberFormat}
              onChange={(v) => handleChange("numberFormat", v)}
              options={["Indian", "International"]}
            />
            <Select
              label="Decimal Places"
              value={settings.decimalPlaces?.toString()}
              onChange={(v) => handleChange("decimalPlaces", parseInt(v))}
              options={["0", "1", "2", "3", "4"]}
            />
          </div>
          <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Live Preview</p>
            <p className="text-xl font-mono text-slate-900">
              {settings.baseCurrency.split(' ')[1]?.replace(/[()]/g, '') || ''} {formatPreviewNumber()}
            </p>
          </div>
        </Section>

        {/* 4. Chart of Accounts */}
        <Section 
          icon={PieChart}
          title="Chart of Accounts" 
          description="Manage your business's ledger accounts categorized by assets, liabilities, equity, revenue, and expenses."
        >
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-center">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <PieChart className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">Standard Chart of Accounts</h4>
            <p className="text-xs text-slate-500 mb-4 px-4">
              Your books are currently using the default standard chart of accounts optimized for small businesses.
            </p>
            <Btn variant="outline" className="mx-auto text-blue-600 border-blue-200 hover:bg-blue-50">
              Manage Accounts (Coming Soon)
            </Btn>
          </div>
        </Section>

        {/* 5. Tax & Inventory Accounting */}
        <Section 
          icon={Calculator}
          title="Tax & Inventory Accounting" 
          description="Rules for inventory valuation and cost of goods sold calculations."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <Select
              label="Inventory Valuation Method"
              value={settings.inventoryValuation}
              onChange={(v) => handleChange("inventoryValuation", v)}
              options={["FIFO", "LIFO", "Weighted Average"]}
            />
          </div>
          <div className="divide-y divide-slate-100/80">
            <CleanToggle
              title="Tax Accounting"
              description="Track input and output taxes automatically in respective ledgers."
              checked={settings.enableTaxAccounting}
              onChange={() => handleToggle("enableTaxAccounting")}
            />
            <CleanToggle
              title="Track Cost of Goods Sold (COGS)"
              description="Automatically recognize the cost of inventory sold during transactions."
              checked={settings.trackCogs}
              onChange={() => handleToggle("trackCogs")}
            />
          </div>
        </Section>

        {/* 6. Sales & Purchase Accounting */}
        <Section 
          icon={ShoppingCart}
          title="Sales & Purchase Accounting" 
          description="Default accounts mapping for revenue, costs, and allowances."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <Input
              label="Default Sales Account"
              value={settings.defaultSalesAccount}
              onChange={(v) => handleChange("defaultSalesAccount", v)}
            />
            <Input
              label="Default Purchase Account"
              value={settings.defaultPurchaseAccount}
              onChange={(v) => handleChange("defaultPurchaseAccount", v)}
            />
          </div>
          <div className="divide-y divide-slate-100/80">
            <CleanToggle
              title="Track Sales/Purchase Returns"
              description="Post returns to separate contra accounts rather than reducing primary revenue/cost."
              checked={settings.trackReturns}
              onChange={() => handleToggle("trackReturns")}
            />
            <CleanToggle
              title="Track Discounts Separately"
              description="Post discounts given or received to dedicated expense/income accounts."
              checked={settings.trackDiscounts}
              onChange={() => handleToggle("trackDiscounts")}
            />
            <CleanToggle
              title="Enable Round-off Account"
              description="Automatically post invoice round-off differences to a specific ledger."
              checked={settings.enableRoundOff}
              onChange={() => handleToggle("enableRoundOff")}
            />
          </div>
        </Section>

        {/* 7. Payments & Journal */}
        <Section 
          icon={CreditCard}
          title="Payments & Journal" 
          description="Manage how payments are deposited and how journal entries are numbered."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <Input
              label="Default Cash/Bank Account"
              value={settings.defaultCashAccount}
              onChange={(v) => handleChange("defaultCashAccount", v)}
            />
            <Select
              label="Document Numbering"
              value={settings.documentNumbering}
              onChange={(v) => handleChange("documentNumbering", v)}
              options={["Auto", "Manual"]}
            />
          </div>
          <div className="divide-y divide-slate-100/80">
            <CleanToggle
              title="Enable Manual Journal Entries"
              description="Allow accountants to post manual journal adjustments."
              checked={settings.enableJournalSettings}
              onChange={() => handleToggle("enableJournalSettings")}
            />
          </div>
        </Section>

        {/* 8. Advanced Settings */}
        <div className="py-8 border-t border-slate-100">
          <button 
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="flex items-center justify-between w-full focus:outline-none group"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
              <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Advanced Settings</h3>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600 transition-colors">
              {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>
          
          {advancedOpen && (
            <div className="mt-6 animate-in slide-in-from-top-4 fade-in duration-300">
              <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100/60 shadow-sm">
                <div className="divide-y divide-slate-100/80">
                  <CleanToggle
                    title="Strict Negative Cash Rule"
                    description="Prevent any transaction that would cause your cash or bank balance to go below zero."
                    checked={settings.strictNegativeCash}
                    onChange={() => handleToggle("strictNegativeCash")}
                  />
                  <CleanToggle
                    title="Enable Cost Centers"
                    description="Track revenue and expenses across multiple departments or branches."
                    checked={settings.enableCostCenters}
                    onChange={() => handleToggle("enableCostCenters")}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}



