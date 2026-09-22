import React, { useState, useEffect, useRef } from "react";
import {
  INVOICE_TEMPLATES,
  TEMPLATE_CATEGORIES,
  FONT_FAMILIES,
  COLOR_PRESETS,
  getTemplateConfig,
} from "./templateConfigs";
import InvoiceRenderer from "./InvoiceRenderer";
import { getInvoiceSettings, updateInvoiceSettings } from "../../api/invoiceSettingsAPI";
import { getProfile } from "../../api/authAPI";
import {
  Check,
  Loader2,
  Printer,
  Download,
  Eye,
  Settings,
  Sparkles,
  Layout,
  Palette,
  FileText,
  Building,
  CreditCard,
  QrCode,
  ShieldCheck,
  Search,
  RotateCcw,
  Maximize2,
  ChevronDown,
  ChevronUp,
  X,
  Sliders,
  Layers,
  Smartphone,
  Monitor,
  FileCheck,
} from "lucide-react";

export default function InvoiceTemplateStudio({ onSettingsSaved }) {
  // Master State
  const [activeTab, setActiveTab] = useState("gallery"); // "gallery" | "studio"
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewModalTemplate, setPreviewModalTemplate] = useState(null);
  const [previewScale, setPreviewScale] = useState(0.85);
  const [viewportMode, setViewportMode] = useState("desktop"); // "desktop" | "tablet" | "mobile"

  // Active Settings State
  const [settings, setSettings] = useState({
    template: "classic_gst",
    defaultTemplate: "classic_gst",
    primaryColor: "#2563eb",
    secondaryColor: "#64748b",
    accentColor: "#f59e0b",
    fontFamily: "Inter",
    fontSize: "medium",
    paperSize: "A4",
    headerLayout: "standard",
    tableStyle: "bordered",
    borderStyle: "solid",
    invoiceTitle: "Tax Invoice",
    invoicePrefix: "INV",
    startingNumber: 1001,
    autoNumbering: true,
    financialYearWise: true,
    dateFormat: "DD-MM-YYYY",

    // Column & Section Toggles
    showLogo: true,
    logoPosition: "left",
    logoSize: "medium",
    showCustomerName: true,
    showCustomerMobile: true,
    showBillingAddress: true,
    showShippingAddress: false,
    showCustomerGSTIN: true,
    showPlaceOfSupply: true,
    showStateCode: true,
    showReverseCharge: false,
    showHSN: true,
    showDescription: true,
    showSKU: false,
    showDiscount: true,
    showTax: true,
    showTaxBreakdown: true,
    showCess: false,
    showAmountInWords: true,
    showComputerGeneratedNotice: true,
    showPaymentStatus: true,
    showBalanceDue: true,
    showPaidAmount: true,
    showDueDate: true,

    // Bank & UPI
    showBankDetails: true,
    bankName: "State Bank of India",
    accountHolder: "SmartBill Enterprise Pvt. Ltd.",
    accountNumber: "38491029481",
    ifsc: "SBIN0001234",
    branch: "Nariman Point Branch",
    showUPIQR: true,
    upiId: "smartbill@upi",

    // Footer & Signature
    invoiceFooter: "Thank you for your business! We appreciate your partnership.",
    customerNotes: "Please make all cheques payable to SmartBill Enterprise Pvt. Ltd.",
    termsAndConditions:
      "1. Goods once sold will not be accepted back unless manufacturing defect.\n2. Interest @18% p.a. will be charged on overdue payments beyond due date.\n3. All disputes are subject to local jurisdiction.",
    showSignature: true,
    signatureUrl: "",
  });

  const [businessInfo, setBusinessInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState("colors");

  // Load Data on Mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, settingsRes] = await Promise.allSettled([
          getProfile(),
          getInvoiceSettings(),
        ]);

        if (profileRes.status === "fulfilled" && profileRes.value?.user) {
          setBusinessInfo(profileRes.value.user);
        }

        if (settingsRes.status === "fulfilled" && settingsRes.value?.settings) {
          const s = settingsRes.value.settings;
          setSettings((prev) => ({
            ...prev,
            ...s,
            template: s.template || s.defaultTemplate || prev.template,
          }));
        }
      } catch (err) {
        console.warn("Error fetching invoice studio data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Update Settings
  const handleChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleToggle = (field) => {
    setSettings((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  // Choose Template
  const handleSelectTemplate = (templateId) => {
    const tpl = getTemplateConfig(templateId);
    setSettings((prev) => ({
      ...prev,
      template: tpl.id,
      primaryColor: tpl.primaryColor || prev.primaryColor,
      secondaryColor: tpl.secondaryColor || prev.secondaryColor,
      accentColor: tpl.accentColor || prev.accentColor,
      fontFamily: tpl.fontFamily || prev.fontFamily,
      headerLayout: tpl.headerLayout || prev.headerLayout,
      tableStyle: tpl.tableStyle || prev.tableStyle,
      borderStyle: tpl.borderStyle || prev.borderStyle,
      paperSize: tpl.recommendedPaper || prev.paperSize,
    }));
    setActiveTab("studio");
  };

  // Set Default Template
  const handleSetDefaultTemplate = async (templateId, e) => {
    if (e) e.stopPropagation();
    const tpl = getTemplateConfig(templateId);
    const updated = {
      ...settings,
      defaultTemplate: tpl.id,
      template: tpl.id,
      primaryColor: tpl.primaryColor || settings.primaryColor,
      secondaryColor: tpl.secondaryColor || settings.secondaryColor,
      accentColor: tpl.accentColor || settings.accentColor,
      fontFamily: tpl.fontFamily || settings.fontFamily,
      headerLayout: tpl.headerLayout || settings.headerLayout,
      tableStyle: tpl.tableStyle || settings.tableStyle,
      borderStyle: tpl.borderStyle || settings.borderStyle,
      paperSize: tpl.recommendedPaper || settings.paperSize,
    };
    setSettings(updated);
    try {
      await updateInvoiceSettings(updated);
      try {
        localStorage.setItem("smartbill_invoice_settings", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("invoiceSettingsUpdated", { detail: updated }));
      } catch (_) {}
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onSettingsSaved) onSettingsSaved(updated);
    } catch (err) {
      alert("Failed to set default template");
    }
  };

  // Save Settings
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateInvoiceSettings(settings);
      try {
        localStorage.setItem("smartbill_invoice_settings", JSON.stringify(settings));
        window.dispatchEvent(new CustomEvent("invoiceSettingsUpdated", { detail: settings }));
      } catch (_) {}
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
      if (onSettingsSaved) onSettingsSaved(settings);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save invoice settings.");
    } finally {
      setSaving(false);
    }
  };

  // Reset to Template Defaults
  const handleResetDefaults = () => {
    const tpl = getTemplateConfig(settings.template);
    setSettings((prev) => ({
      ...prev,
      primaryColor: tpl.primaryColor,
      secondaryColor: tpl.secondaryColor,
      accentColor: tpl.accentColor,
      fontFamily: tpl.fontFamily,
      headerLayout: tpl.headerLayout,
      tableStyle: tpl.tableStyle,
      borderStyle: tpl.borderStyle,
      paperSize: tpl.recommendedPaper,
      fontSize: "medium",
    }));
  };

  // Signature Upload
  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Signature image size must be under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      handleChange("signatureUrl", reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Direct Browser Print
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    const isThermal = settings.paperSize?.toLowerCase().includes("thermal");
    const pageSize = isThermal
      ? settings.paperSize.includes("58")
        ? "58mm auto"
        : "80mm auto"
      : "A4 portrait";

    const invoiceContent = document.getElementById("invoice-live-preview-container")?.innerHTML || "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Invoice - ${settings.invoicePrefix || "INV"}-${settings.startingNumber || "1001"}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600;700&family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page {
              size: ${pageSize};
              margin: 8mm;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .invoice-render-wrapper {
              transform: none !important;
              width: 100% !important;
            }
            @media print {
              .print\\:shadow-none { box-shadow: none !important; }
              .print\\:border-none { border: none !important; }
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div style="width: 100%; margin: 0 auto;">
            ${invoiceContent}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter Templates
  const filteredTemplates = INVOICE_TEMPLATES.filter((tpl) => {
    const matchesCat =
      categoryFilter === "all" ||
      tpl.category.toLowerCase() === categoryFilter.toLowerCase() ||
      tpl.tags.some((t) => t.toLowerCase() === categoryFilter.toLowerCase());
    const matchesSearch =
      !searchQuery ||
      tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
        <p className="text-sm font-semibold text-slate-600">Loading Invoice Templates & Studio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header & Tab Switcher ─────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Invoice Templates & Customization Studio
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose from 10 Indian GST & retail templates, customize palettes, typography, and print options.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab("gallery")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "gallery"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Template Gallery ({INVOICE_TEMPLATES.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("studio")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "studio"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Live Studio & Customizer</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: TEMPLATE GALLERY
      ────────────────────────────────────────────────────────────── */}
      {activeTab === "gallery" && (
        <div className="space-y-6">
          {/* Category Filter Pills & Search */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setCategoryFilter(cat.key)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    categoryFilter === cat.key
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Template Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((tpl) => {
              const isDefault =
                settings.defaultTemplate === tpl.id ||
                settings.defaultTemplate === tpl.alias ||
                (!settings.defaultTemplate && tpl.id === "classic_gst");
              const isCurrent =
                settings.template === tpl.id || settings.template === tpl.alias;

              return (
                <div
                  key={tpl.id}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group ${
                    isDefault
                      ? "border-blue-500 ring-2 ring-blue-500/20"
                      : isCurrent
                      ? "border-emerald-500"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  {/* Card Visual Preview Header */}
                  <div
                    className="h-44 p-4 flex flex-col justify-between relative overflow-hidden cursor-pointer"
                    style={{
                      background:
                        tpl.id === "creative_gradient"
                          ? "linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #ec4899 100%)"
                          : tpl.id === "professional_dark"
                          ? "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)"
                          : tpl.id === "elegant"
                          ? "linear-gradient(135deg, #831843 0%, #701a75 100%)"
                          : tpl.id === "corporate"
                          ? "linear-gradient(135deg, #0f2744 0%, #1e3a8a 100%)"
                          : `linear-gradient(135deg, ${tpl.primaryColor} 0%, #0f172a 120%)`,
                    }}
                    onClick={() => setPreviewModalTemplate(tpl)}
                  >
                    {/* Top Badges */}
                    <div className="flex justify-between items-start z-10">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/20 text-white backdrop-blur-md">
                        {tpl.category}
                      </span>

                      {isDefault ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow-sm">
                          <Check className="w-3 h-3" /> Default Active
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${tpl.badgeColor}`}>
                          {tpl.badgeText}
                        </span>
                      )}
                    </div>

                    {/* Mini Mock Layout Presentation */}
                    <div className="bg-white/95 rounded-xl p-2.5 shadow-lg border border-white/40 text-[9px] text-slate-800 space-y-1 transform group-hover:scale-102 transition-transform">
                      <div className="flex justify-between items-center border-b pb-1">
                        <span className="font-bold text-[10px]" style={{ color: tpl.primaryColor }}>
                          {tpl.name}
                        </span>
                        <span className="font-mono font-bold text-slate-500">INV-2026-001</span>
                      </div>
                      <div className="flex justify-between text-[8px] text-slate-500">
                        <span>GSTIN: 27ABCDE1234F1Z5</span>
                        <span className="font-bold text-emerald-600">₹1,14,922.00</span>
                      </div>
                    </div>

                    {/* Quick Preview Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewModalTemplate(tpl);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-white text-slate-900 font-bold text-xs flex items-center gap-1.5 shadow-lg hover:bg-slate-100 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>Preview</span>
                      </button>
                    </div>
                  </div>

                  {/* Card Description & Meta */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                          {tpl.name}
                        </h3>
                        <span className="text-xs font-mono text-slate-400 font-semibold">
                          {tpl.recommendedPaper}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {tpl.description}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {tpl.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-medium"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Card Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectTemplate(tpl.id)}
                        className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Customize</span>
                      </button>

                      {!isDefault && (
                        <button
                          type="button"
                          onClick={(e) => handleSetDefaultTemplate(tpl.id, e)}
                          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all cursor-pointer"
                          title="Set as default invoice template"
                        >
                          Set Default
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: LIVE STUDIO & CUSTOMIZER (SPLIT VIEW)
      ────────────────────────────────────────────────────────────── */}
      {activeTab === "studio" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: CUSTOMIZATION ACCORDIONS (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Top Action Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
              <div>
                <span className="text-xs text-slate-400 font-medium">Selected Template:</span>
                <p className="font-extrabold text-sm text-slate-900 dark:text-white capitalize">
                  {getTemplateConfig(settings.template).name}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  title="Reset colors and typography to template defaults"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{saving ? "Saving..." : saveSuccess ? "Saved!" : "Save Settings"}</span>
                </button>
              </div>
            </div>

            {/* Accordion 1: Palette & Typography */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() =>
                  setActiveAccordion(activeAccordion === "colors" ? "" : "colors")
                }
                className="w-full p-4 flex items-center justify-between text-left font-bold text-sm text-slate-900 dark:text-white bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/70 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Palette className="w-4 h-4 text-blue-600" />
                  <span>Color Palette & Typography</span>
                </div>
                {activeAccordion === "colors" ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {activeAccordion === "colors" && (
                <div className="p-4 space-y-4 text-xs">
                  {/* Preset Palettes */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Quick Palette Presets
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {COLOR_PRESETS.map((p) => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => {
                            handleChange("primaryColor", p.primary);
                            handleChange("secondaryColor", p.secondary);
                            handleChange("accentColor", p.accent);
                          }}
                          className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                            settings.primaryColor === p.primary
                              ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40"
                              : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                          }`}
                        >
                          <div
                            className="w-6 h-6 rounded-full shadow-xs"
                            style={{ backgroundColor: p.primary }}
                          />
                          <span className="text-[9px] font-medium text-slate-600 dark:text-slate-400 truncate w-full text-center">
                            {p.name.split(" ")[0]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Hex Pickers */}
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Primary Color
                      </label>
                      <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 bg-slate-50 dark:bg-slate-800">
                        <input
                          type="color"
                          value={settings.primaryColor}
                          onChange={(e) => handleChange("primaryColor", e.target.value)}
                          className="w-6 h-6 rounded-lg cursor-pointer border-none bg-transparent"
                        />
                        <span className="font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                          {settings.primaryColor}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Secondary Color
                      </label>
                      <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 bg-slate-50 dark:bg-slate-800">
                        <input
                          type="color"
                          value={settings.secondaryColor}
                          onChange={(e) => handleChange("secondaryColor", e.target.value)}
                          className="w-6 h-6 rounded-lg cursor-pointer border-none bg-transparent"
                        />
                        <span className="font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                          {settings.secondaryColor}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Accent Color
                      </label>
                      <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 bg-slate-50 dark:bg-slate-800">
                        <input
                          type="color"
                          value={settings.accentColor}
                          onChange={(e) => handleChange("accentColor", e.target.value)}
                          className="w-6 h-6 rounded-lg cursor-pointer border-none bg-transparent"
                        />
                        <span className="font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                          {settings.accentColor}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Typography Font Family */}
                  <div className="pt-2">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Font Family
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {FONT_FAMILIES.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleChange("fontFamily", f.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            settings.fontFamily === f.id
                              ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                              : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                          }`}
                        >
                          <p className="font-bold text-xs" style={{ fontFamily: f.css }}>
                            {f.name.split(" ")[0]}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{f.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 2: Header & Layout Options */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() =>
                  setActiveAccordion(activeAccordion === "header" ? "" : "header")
                }
                className="w-full p-4 flex items-center justify-between text-left font-bold text-sm text-slate-900 dark:text-white bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/70 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Layout className="w-4 h-4 text-indigo-600" />
                  <span>Header Layout & Paper Format</span>
                </div>
                {activeAccordion === "header" ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {activeAccordion === "header" && (
                <div className="p-4 space-y-4 text-xs">
                  {/* Paper Format */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Paper Size Format
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {["A4", "A5", "Thermal 80mm", "Thermal 58mm"].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handleChange("paperSize", p)}
                          className={`p-2 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                            settings.paperSize === p
                              ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Header Layout */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Header Presentation
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {["standard", "banner", "centered"].map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => handleChange("headerLayout", l)}
                          className={`p-2 rounded-xl border text-center capitalize font-semibold text-xs transition-all cursor-pointer ${
                            settings.headerLayout === l
                              ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* General Fields */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Invoice Title
                      </label>
                      <input
                        type="text"
                        value={settings.invoiceTitle}
                        onChange={(e) => handleChange("invoiceTitle", e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Invoice Prefix
                      </label>
                      <input
                        type="text"
                        value={settings.invoicePrefix}
                        onChange={(e) => handleChange("invoicePrefix", e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs"
                      />
                    </div>
                  </div>

                  {/* Logo Options */}
                  <div className="pt-2 space-y-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Show Business Logo</span>
                      <input
                        type="checkbox"
                        checked={settings.showLogo}
                        onChange={() => handleToggle("showLogo")}
                        className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                      />
                    </div>

                    {settings.showLogo && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">Logo Size</label>
                          <select
                            value={settings.logoSize}
                            onChange={(e) => handleChange("logoSize", e.target.value)}
                            className="w-full p-1.5 border rounded-lg bg-slate-50 dark:bg-slate-800 text-xs"
                          >
                            <option value="small">Small</option>
                            <option value="medium">Medium</option>
                            <option value="large">Large</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">Logo Position</label>
                          <select
                            value={settings.logoPosition}
                            onChange={(e) => handleChange("logoPosition", e.target.value)}
                            className="w-full p-1.5 border rounded-lg bg-slate-50 dark:bg-slate-800 text-xs"
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 3: Column & Section Toggles */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() =>
                  setActiveAccordion(activeAccordion === "toggles" ? "" : "toggles")
                }
                className="w-full p-4 flex items-center justify-between text-left font-bold text-sm text-slate-900 dark:text-white bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/70 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Column Visibility & Section Toggles</span>
                </div>
                {activeAccordion === "toggles" ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {activeAccordion === "toggles" && (
                <div className="p-4 space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-700 dark:text-slate-300">Show HSN/SAC Column</span>
                    <input
                      type="checkbox"
                      checked={settings.showHSN}
                      onChange={() => handleToggle("showHSN")}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-700 dark:text-slate-300">Show Item Descriptions</span>
                    <input
                      type="checkbox"
                      checked={settings.showDescription}
                      onChange={() => handleToggle("showDescription")}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-700 dark:text-slate-300">Show Discount Column</span>
                    <input
                      type="checkbox"
                      checked={settings.showDiscount}
                      onChange={() => handleToggle("showDiscount")}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-700 dark:text-slate-300">Show GST Tax Breakdown (CGST/SGST/IGST)</span>
                    <input
                      type="checkbox"
                      checked={settings.showTax}
                      onChange={() => handleToggle("showTax")}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-700 dark:text-slate-300">Show Customer GSTIN</span>
                    <input
                      type="checkbox"
                      checked={settings.showCustomerGSTIN}
                      onChange={() => handleToggle("showCustomerGSTIN")}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-700 dark:text-slate-300">Show Amount in Words (Indian Format)</span>
                    <input
                      type="checkbox"
                      checked={settings.showAmountInWords}
                      onChange={() => handleToggle("showAmountInWords")}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-700 dark:text-slate-300">Show Payment Status Badge</span>
                    <input
                      type="checkbox"
                      checked={settings.showPaymentStatus}
                      onChange={() => handleToggle("showPaymentStatus")}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-700 dark:text-slate-300">Show Balance Due in Summary</span>
                    <input
                      type="checkbox"
                      checked={settings.showBalanceDue}
                      onChange={() => handleToggle("showBalanceDue")}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 4: Bank Details & UPI QR */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() =>
                  setActiveAccordion(activeAccordion === "bank" ? "" : "bank")
                }
                className="w-full p-4 flex items-center justify-between text-left font-bold text-sm text-slate-900 dark:text-white bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/70 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  <span>Payment, Bank & UPI QR Details</span>
                </div>
                {activeAccordion === "bank" ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {activeAccordion === "bank" && (
                <div className="p-4 space-y-4 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Show Firm Bank Details</span>
                    <input
                      type="checkbox"
                      checked={settings.showBankDetails}
                      onChange={() => handleToggle("showBankDetails")}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                  </div>

                  {settings.showBankDetails && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          value={settings.bankName}
                          onChange={(e) => handleChange("bankName", e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Account Holder
                        </label>
                        <input
                          type="text"
                          value={settings.accountHolder}
                          onChange={(e) => handleChange("accountHolder", e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Account Number
                        </label>
                        <input
                          type="text"
                          value={settings.accountNumber}
                          onChange={(e) => handleChange("accountNumber", e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          IFSC Code
                        </label>
                        <input
                          type="text"
                          value={settings.ifsc}
                          onChange={(e) => handleChange("ifsc", e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-lg text-xs font-mono uppercase"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Show Dynamic UPI QR Code</span>
                    <input
                      type="checkbox"
                      checked={settings.showUPIQR}
                      onChange={() => handleToggle("showUPIQR")}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                  </div>

                  {settings.showUPIQR && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border">
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        UPI ID (VPA)
                      </label>
                      <input
                        type="text"
                        value={settings.upiId}
                        onChange={(e) => handleChange("upiId", e.target.value)}
                        placeholder="business@okaxis"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-lg text-xs font-mono"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Accordion 5: Terms, Notes & Signature */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() =>
                  setActiveAccordion(activeAccordion === "terms" ? "" : "terms")
                }
                className="w-full p-4 flex items-center justify-between text-left font-bold text-sm text-slate-900 dark:text-white bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/70 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span>Terms, Footer & Authorized Signature</span>
                </div>
                {activeAccordion === "terms" ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {activeAccordion === "terms" && (
                <div className="p-4 space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Invoice Footer Greeting
                    </label>
                    <input
                      type="text"
                      value={settings.invoiceFooter}
                      onChange={(e) => handleChange("invoiceFooter", e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Terms & Conditions (Printed at Bottom Left)
                    </label>
                    <textarea
                      rows={3}
                      value={settings.termsAndConditions}
                      onChange={(e) => handleChange("termsAndConditions", e.target.value)}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs leading-relaxed"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Show Authorized Signature</span>
                      <input
                        type="checkbox"
                        checked={settings.showSignature}
                        onChange={() => handleToggle("showSignature")}
                        className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                      />
                    </div>

                    {settings.showSignature && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border space-y-2">
                        <label className="block text-[11px] text-slate-500">
                          Upload Signature Image (PNG / JPEG &lt; 2MB)
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleSignatureUpload}
                          className="text-xs text-slate-600"
                        />
                        {settings.signatureUrl && (
                          <div className="p-2 bg-white rounded-lg border inline-block">
                            <img
                              src={settings.signatureUrl}
                              alt="Signature Preview"
                              className="h-12 object-contain"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: STICKY INTERACTIVE LIVE PREVIEW (7 Cols) */}
          <div className="lg:col-span-7 sticky top-4 space-y-3">
            {/* Viewport & Action Controls */}
            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
              {/* Device Selector */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setViewportMode("desktop");
                    setPreviewScale(0.85);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewportMode === "desktop"
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop (100%)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewportMode("tablet");
                    setPreviewScale(0.68);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewportMode === "tablet"
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Fit (70%)</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Print clean A4 invoice without UI"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  <span>Print Invoice</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="Save or Download as PDF"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

            {/* Live Invoice Canvas */}
            <div
              className="bg-slate-100 dark:bg-slate-950/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto overflow-y-auto max-h-[calc(100vh-180px)] flex justify-center items-start shadow-inner"
            >
              <div id="invoice-live-preview-container" className="w-full flex justify-center">
                <InvoiceRenderer
                  settings={settings}
                  businessInfo={businessInfo}
                  scale={previewScale}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FULL-SCREEN PREVIEW MODAL
      ────────────────────────────────────────────────────────────── */}
      {previewModalTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95">
            {/* Modal Top Bar */}
            <div className="p-4 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Template Preview: {previewModalTemplate.name}
                </h3>
                <p className="text-xs text-slate-500">{previewModalTemplate.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleSelectTemplate(previewModalTemplate.id);
                    setPreviewModalTemplate(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Customize Template</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModalTemplate(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Canvas */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-950 flex justify-center items-start">
              <InvoiceRenderer
                settings={{
                  ...settings,
                  template: previewModalTemplate.id,
                  primaryColor: previewModalTemplate.primaryColor,
                  secondaryColor: previewModalTemplate.secondaryColor,
                  accentColor: previewModalTemplate.accentColor,
                  fontFamily: previewModalTemplate.fontFamily,
                  headerLayout: previewModalTemplate.headerLayout,
                  tableStyle: previewModalTemplate.tableStyle,
                  borderStyle: previewModalTemplate.borderStyle,
                  paperSize: previewModalTemplate.recommendedPaper,
                }}
                businessInfo={businessInfo}
                scale={0.8}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
