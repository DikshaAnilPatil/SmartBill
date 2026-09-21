import React from "react";
import { numberToWordsIndian } from "../../utils/numberToWords";
import { getTemplateConfig, FONT_FAMILIES } from "./templateConfigs";
import { Check, AlertCircle, Clock, QrCode, ShieldCheck } from "lucide-react";

/**
 * Format currency in Indian Numbering Format
 */
export function formatCurrencyINR(amount) {
  const num = Number(amount) || 0;
  return "₹" + num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Unified, Pixel-Perfect Invoice Renderer supporting 10 Indian GST and retail templates
 */
export default function InvoiceRenderer({
  settings = {},
  businessInfo = {},
  invoiceData = null,
  scale = 1,
  isPrintMode = false,
  customStyles = {},
}) {
  const tplId = settings.template || "classic_gst";
  const tplConfig = getTemplateConfig(tplId);

  // Resolved Styling Props
  const primaryColor = settings.primaryColor || tplConfig.primaryColor || "#2563eb";
  const secondaryColor = settings.secondaryColor || tplConfig.secondaryColor || "#64748b";
  const accentColor = settings.accentColor || tplConfig.accentColor || "#f59e0b";
  const fontFamilyName = settings.fontFamily || tplConfig.fontFamily || "Inter";
  const fontObj = FONT_FAMILIES.find((f) => f.id === fontFamilyName);
  const resolvedFontFamily = fontObj ? fontObj.css : "'Inter', sans-serif";
  const fontSize = settings.fontSize || "medium";
  const headerLayout = settings.headerLayout || tplConfig.headerLayout || "standard";
  const tableStyle = settings.tableStyle || tplConfig.tableStyle || "bordered";
  const borderStyle = settings.borderStyle || tplConfig.borderStyle || "solid";
  const paperSize = settings.paperSize || tplConfig.recommendedPaper || "A4";
  const isThermal = paperSize.toLowerCase().includes("thermal");
  const thermalWidth = paperSize.includes("58") ? "300px" : "380px";

  // Visibility Toggles
  const showLogo = settings.showLogo !== false;
  const logoPosition = settings.logoPosition || "left";
  const logoSize = settings.logoSize || "medium";
  const showCustomerName = settings.showCustomerName !== false;
  const showBillingAddress = settings.showBillingAddress !== false;
  const showShippingAddress = Boolean(settings.showShippingAddress);
  const showCustomerGSTIN = settings.showCustomerGSTIN !== false;
  const showHSN = settings.showHSN !== false;
  const showSKU = Boolean(settings.showSKU);
  const showDescription = settings.showDescription !== false;
  const showDiscount = settings.showDiscount !== false;
  const showTax = settings.showTax !== false;
  const showCess = Boolean(settings.showCess);
  const showBankDetails = Boolean(settings.showBankDetails);
  const showUPIQR = Boolean(settings.showUPIQR);
  const showSignature = Boolean(settings.showSignature);
  const showTerms = settings.termsAndConditions ? true : true;
  const showAmountInWords = settings.showAmountInWords !== false;
  const showComputerNotice = settings.showComputerGeneratedNotice !== false;
  const showPaymentStatus = settings.showPaymentStatus !== false;
  const showBalanceDue = settings.showBalanceDue !== false;
  const showDueDate = settings.showDueDate !== false;

  // Resolve Business Details
  const biz = {
    name: businessInfo.businessName || businessInfo.name || "SmartBill Enterprise Pvt. Ltd.",
    owner: businessInfo.ownerName || businessInfo.owner || "Authorized Manager",
    address: businessInfo.address || "Plot No. 42, Technology Park, Phase 1",
    city: businessInfo.city || "Mumbai",
    state: businessInfo.state || "Maharashtra",
    pincode: businessInfo.pincode || "400001",
    stateCode: businessInfo.stateCode || "27",
    gstin: businessInfo.gstin || businessInfo.gst || "27ABCDE1234F1Z5",
    pan: businessInfo.pan || "ABCDE1234F",
    phone: businessInfo.phone || businessInfo.mobile || "+91 98765 43210",
    email: businessInfo.email || "support@smartbill.io",
    website: businessInfo.website || "www.smartbill.io",
    logoUrl: businessInfo.logoUrl || businessInfo.logo || "",
  };

  // Mock / Real Invoice Data
  const defaultMockItems = [
    {
      srNo: 1,
      name: "Dell UltraSharp 27\" 4K Monitor",
      desc: "IPS panel with USB-C Hub, 99% sRGB coverage",
      hsn: "8471",
      sku: "DELL-U2723QE",
      qty: 2,
      unit: "pcs",
      rate: 35000,
      discountPct: 5,
      discountAmt: 3500,
      taxableValue: 66500,
      gstRate: 18,
      cgstRate: 9,
      cgstAmt: 5985,
      sgstRate: 9,
      sgstAmt: 5985,
      igstRate: 0,
      igstAmt: 0,
      cessAmt: 0,
      total: 78470,
    },
    {
      srNo: 2,
      name: "Logitech MX Master 3S Wireless Mouse",
      desc: "Quiet clicks, 8K DPI sensor, Bluetooth & Bolt",
      hsn: "8471",
      sku: "LOGI-MX3S",
      qty: 3,
      unit: "pcs",
      rate: 7500,
      discountPct: 0,
      discountAmt: 0,
      taxableValue: 22500,
      gstRate: 18,
      cgstRate: 9,
      cgstAmt: 2025,
      sgstRate: 9,
      sgstAmt: 2025,
      igstRate: 0,
      igstAmt: 0,
      cessAmt: 0,
      total: 26550,
    },
    {
      srNo: 3,
      name: "Ergonomic Mechanical Keyboard (Pro RGB)",
      desc: "Hot-swappable switches, wireless dual-mode",
      hsn: "8471",
      sku: "KEY-RGB96",
      qty: 1,
      unit: "pcs",
      rate: 8900,
      discountPct: 10,
      discountAmt: 890,
      taxableValue: 8010,
      gstRate: 18,
      cgstRate: 9,
      cgstAmt: 720.9,
      sgstRate: 9,
      sgstAmt: 720.9,
      igstRate: 0,
      igstAmt: 0,
      cessAmt: 0,
      total: 9451.8,
    },
  ];

  const inv = invoiceData || {
    invoiceTitle: settings.invoiceTitle || "TAX INVOICE",
    invoiceNo: `${settings.invoicePrefix || "INV"}-2026-0042`,
    invoiceDate: new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    poNumber: "PO-88910-B",
    paymentTerms: "Net 15 Days",
    paymentStatus: "Partial", // Paid, Partial, Due
    reverseCharge: "No",
    placeOfSupply: "Maharashtra (27)",
    customer: {
      name: "Acme Global Solutions Pvt. Ltd.",
      contactPerson: "Rajesh Sharma",
      address: "Tower 4, Suite 802, Cyber Heights, Hinjawadi Phase 2",
      city: "Pune",
      state: "Maharashtra",
      stateCode: "27",
      pincode: "411057",
      gstin: "27AAACA9876Q1ZT",
      phone: "+91 99887 76655",
      email: "accounts@acmeglobal.in",
      shippingAddress: "Warehouse 12, Logistics Park, Talegaon, Pune 410507",
    },
    items: defaultMockItems,
    subtotal: 97010,
    itemDiscountTotal: 4390,
    cashDiscount: 0,
    taxableAmount: 97010,
    cgstTotal: 8730.9,
    sgstTotal: 8730.9,
    igstTotal: 0,
    cessTotal: 0,
    shippingCharges: 450,
    packagingCharges: 0,
    roundOff: 0.2,
    grandTotal: 114922,
    paidAmount: 50000,
    balanceDue: 64922,
  };

  // Tax breakdown calculations
  const isInterState =
    inv.customer?.state && biz.state
      ? inv.customer.state.toLowerCase() !== biz.state.toLowerCase()
      : false;

  const grandTotalWords = numberToWordsIndian(inv.grandTotal);

  // Dynamic UPI URL
  const resolvedUpiId = settings.upiId || businessInfo.upiId || "smartbill@upi";
  const resolvedUpiPayee = biz.name;
  const dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    `upi://pay?pa=${resolvedUpiId}&pn=${encodeURIComponent(resolvedUpiPayee)}&am=${inv.grandTotal}&cu=INR`
  )}&margin=2`;

  // Dynamic Logo Size
  const logoHeightClass =
    logoSize === "small" ? "max-h-12" : logoSize === "large" ? "max-h-24" : "max-h-16";

  // Template-specific style classes
  const isDarkTpl = tplId === "professional_dark";
  const isGradientTpl = tplId === "creative_gradient";
  const isElegantTpl = tplId === "elegant";

  return (
    <div
      className={`invoice-render-wrapper select-text ${isPrintMode ? "print-root" : ""}`}
      style={{
        fontFamily: resolvedFontFamily,
        fontSize: fontSize === "small" ? "12px" : fontSize === "large" ? "15px" : "13px",
        ...customStyles,
      }}
    >
      {/* ─────────────────────────────────────────────────────────────
          INVOICE CONTAINER (A4 or THERMAL FORMAT)
      ────────────────────────────────────────────────────────────── */}
      <div
        className={`bg-white text-slate-900 border border-slate-200 transition-all duration-200 shadow-xl print:shadow-none print:border-none mx-auto relative ${
          isThermal ? "p-4" : "p-8 md:p-10"
        }`}
        style={{
          width: isThermal ? thermalWidth : "820px",
          minHeight: isThermal ? "auto" : "1160px",
          transform: isPrintMode ? "none" : `scale(${scale})`,
          transformOrigin: "top center",
          borderRadius: isThermal ? "8px" : isPrintMode ? "0px" : "16px",
        }}
      >
        {/* ── 1. HEADER SECTION ─────────────────────────────────── */}
        {headerLayout === "banner" || isGradientTpl || isDarkTpl ? (
          <div
            className={`rounded-xl p-6 mb-6 text-white flex flex-wrap justify-between items-center gap-4 ${
              isGradientTpl
                ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600"
                : isDarkTpl
                ? "bg-slate-900 border border-slate-800"
                : ""
            }`}
            style={{
              backgroundColor: isGradientTpl ? undefined : primaryColor,
            }}
          >
            <div className="flex items-center gap-4">
              {showLogo && biz.logoUrl && (
                <div className="bg-white p-2 rounded-xl shadow-sm">
                  <img src={biz.logoUrl} alt="Logo" className={`${logoHeightClass} object-contain`} />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-black tracking-tight">{biz.name}</h1>
                <p className="text-xs opacity-90 mt-0.5">{biz.address}, {biz.city}, {biz.state} - {biz.pincode}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11px] opacity-95">
                  <span><strong>GSTIN:</strong> {biz.gstin}</span>
                  <span><strong>PAN:</strong> {biz.pan}</span>
                  <span><strong>Phone:</strong> {biz.phone}</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-white/20 backdrop-blur-md mb-2">
                {inv.invoiceTitle || settings.invoiceTitle || "TAX INVOICE"}
              </span>
              <p className="text-xl font-mono font-extrabold">{inv.invoiceNo}</p>
              <p className="text-xs opacity-90 mt-1">Date: {inv.invoiceDate}</p>
              {showDueDate && inv.dueDate && (
                <p className="text-xs text-amber-200 mt-0.5 font-medium">Due: {inv.dueDate}</p>
              )}
            </div>
          </div>
        ) : headerLayout === "centered" ? (
          <div className="text-center pb-6 mb-6 border-b border-slate-200">
            {showLogo && biz.logoUrl && (
              <div className="flex justify-center mb-3">
                <img src={biz.logoUrl} alt="Logo" className={`${logoHeightClass} object-contain`} />
              </div>
            )}
            <h1
              className="text-2xl font-black tracking-tight"
              style={{ color: primaryColor }}
            >
              {biz.name}
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {biz.address}, {biz.city}, {biz.state} - {biz.pincode}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              <strong>GSTIN:</strong> {biz.gstin} &bull; <strong>Phone:</strong> {biz.phone} &bull; <strong>Email:</strong> {biz.email}
            </p>
            <div className="mt-4 inline-flex items-center gap-3 px-4 py-1.5 rounded-full border" style={{ borderColor: primaryColor, color: primaryColor }}>
              <span className="font-bold text-xs uppercase tracking-widest">{inv.invoiceTitle || "TAX INVOICE"}</span>
              <span className="font-mono font-bold text-xs">#{inv.invoiceNo}</span>
            </div>
          </div>
        ) : (
          /* Standard / Split Layout */
          <div className="flex flex-wrap justify-between items-start pb-6 mb-6 border-b-2" style={{ borderColor: borderStyle === "clean" ? "#f1f5f9" : primaryColor }}>
            <div className={`flex items-start gap-4 ${logoPosition === "center" ? "mx-auto text-center" : ""}`}>
              {showLogo && biz.logoUrl && (
                <img src={biz.logoUrl} alt="Logo" className={`${logoHeightClass} object-contain rounded-lg`} />
              )}
              <div>
                <h1
                  className="text-2xl font-extrabold tracking-tight"
                  style={{ color: primaryColor }}
                >
                  {biz.name}
                </h1>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-sm">
                  {biz.address}<br />
                  {biz.city}, {biz.state} - {biz.pincode}
                </p>
                <div className="mt-2 text-xs text-slate-700 space-y-0.5">
                  <p><span className="font-semibold text-slate-500">GSTIN:</span> <span className="font-mono font-bold">{biz.gstin}</span></p>
                  <p><span className="font-semibold text-slate-500">PAN:</span> <span className="font-mono">{biz.pan}</span> &bull; <span className="font-semibold text-slate-500">Phone:</span> {biz.phone}</p>
                </div>
              </div>
            </div>

            <div className="text-right mt-2 sm:mt-0">
              <h2
                className="text-2xl font-black uppercase tracking-wider"
                style={{ color: primaryColor }}
              >
                {inv.invoiceTitle || settings.invoiceTitle || "TAX INVOICE"}
              </h2>
              <div className="mt-2 space-y-1 font-mono text-xs text-slate-700">
                <p>
                  <span className="text-slate-400 font-sans font-medium">Invoice No: </span>
                  <span className="font-bold text-slate-900 text-sm">{inv.invoiceNo}</span>
                </p>
                <p>
                  <span className="text-slate-400 font-sans font-medium">Date: </span>
                  <span className="font-semibold text-slate-800">{inv.invoiceDate}</span>
                </p>
                {showDueDate && inv.dueDate && (
                  <p>
                    <span className="text-slate-400 font-sans font-medium">Due Date: </span>
                    <span className="font-semibold text-red-600">{inv.dueDate}</span>
                  </p>
                )}
                {inv.poNumber && (
                  <p>
                    <span className="text-slate-400 font-sans font-medium">PO Ref: </span>
                    <span className="font-semibold text-slate-800">{inv.poNumber}</span>
                  </p>
                )}
              </div>

              {/* Payment Status Pill */}
              {showPaymentStatus && (
                <div className="mt-3 flex justify-end">
                  {inv.paymentStatus === "Paid" ? (
                    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <Check className="w-3.5 h-3.5" /> PAYMENT CLEARED
                    </span>
                  ) : inv.paymentStatus === "Partial" ? (
                    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      <Clock className="w-3.5 h-3.5" /> PARTIALLY PAID
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                      <AlertCircle className="w-3.5 h-3.5" /> PAYMENT DUE
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 2. PARTIES SECTION (BILLED TO & SHIPPED TO) ───────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 mb-6 border-b border-slate-200 text-xs">
          {/* Billed To */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
            <p
              className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1"
              style={{ color: primaryColor }}
            >
              <span>Billed To (Customer Details)</span>
            </p>
            {showCustomerName && (
              <p className="font-bold text-slate-900 text-sm">
                {inv.customer?.name || "Cash Customer"}
              </p>
            )}
            {inv.customer?.contactPerson && (
              <p className="text-slate-600 font-medium text-[11px]">
                Attn: {inv.customer.contactPerson}
              </p>
            )}
            {showBillingAddress && (
              <p className="text-slate-600 mt-1 leading-relaxed">
                {inv.customer?.address}<br />
                {inv.customer?.city}, {inv.customer?.state} - {inv.customer?.pincode}
              </p>
            )}
            <div className="mt-2 pt-2 border-t border-slate-200/60 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-700">
              {showCustomerGSTIN && inv.customer?.gstin && (
                <span><strong>GSTIN:</strong> <span className="font-mono font-bold text-slate-900">{inv.customer.gstin}</span></span>
              )}
              {inv.customer?.phone && <span><strong>Phone:</strong> {inv.customer.phone}</span>}
              {inv.customer?.stateCode && <span><strong>State Code:</strong> {inv.customer.stateCode}</span>}
            </div>
          </div>

          {/* Shipped To / Supply Meta */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 flex flex-col justify-between">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
                style={{ color: primaryColor }}
              >
                {showShippingAddress && inv.customer?.shippingAddress
                  ? "Shipped To (Delivery Address)"
                  : "Dispatch & Tax Meta"}
              </p>
              {showShippingAddress && inv.customer?.shippingAddress ? (
                <p className="text-slate-600 leading-relaxed">
                  {inv.customer.shippingAddress}
                </p>
              ) : (
                <div className="space-y-1 text-slate-700">
                  <p><span className="text-slate-500 font-medium">Place of Supply:</span> <span className="font-bold text-slate-900">{inv.placeOfSupply || "Maharashtra (27)"}</span></p>
                  <p><span className="text-slate-500 font-medium">Reverse Charge:</span> <span className="font-semibold text-slate-800">{inv.reverseCharge || "No"}</span></p>
                  <p><span className="text-slate-500 font-medium">Payment Terms:</span> <span className="font-semibold text-slate-800">{inv.paymentTerms || "Immediate"}</span></p>
                  <p><span className="text-slate-500 font-medium">Inter-State Supply:</span> <span className="font-semibold text-slate-800">{isInterState ? "Yes (IGST Applicable)" : "No (CGST + SGST)"}</span></p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 3. ITEMS TABLE ────────────────────────────────────── */}
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr
                className={`${
                  tableStyle === "modern_filled"
                    ? "text-white"
                    : tableStyle === "striped"
                    ? "bg-slate-100 text-slate-800"
                    : "bg-slate-50 border-y-2 border-slate-300 text-slate-700"
                } font-bold text-[11px] uppercase tracking-wider`}
                style={{
                  backgroundColor: tableStyle === "modern_filled" ? primaryColor : undefined,
                }}
              >
                <th className="py-2.5 px-2 text-center w-8">#</th>
                <th className="py-2.5 px-3">Item / Service Details</th>
                {showHSN && <th className="py-2.5 px-2 text-center">HSN/SAC</th>}
                <th className="py-2.5 px-2 text-center">Qty</th>
                <th className="py-2.5 px-2 text-right">Rate</th>
                {showDiscount && <th className="py-2.5 px-2 text-right">Disc</th>}
                <th className="py-2.5 px-2 text-right">Taxable</th>
                {showTax && (
                  <>
                    {!isInterState ? (
                      <>
                        <th className="py-2.5 px-2 text-right">CGST</th>
                        <th className="py-2.5 px-2 text-right">SGST</th>
                      </>
                    ) : (
                      <th className="py-2.5 px-2 text-right">IGST</th>
                    )}
                  </>
                )}
                <th className="py-2.5 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {inv.items.map((item, idx) => (
                <tr
                  key={idx}
                  className={`${
                    tableStyle === "striped" && idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"
                  } hover:bg-blue-50/30 transition-colors`}
                >
                  <td className="py-3 px-2 text-center font-mono text-slate-400">{idx + 1}</td>
                  <td className="py-3 px-3">
                    <p className="font-bold text-slate-900 text-[13px]">{item.name}</p>
                    {showDescription && item.desc && (
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.desc}</p>
                    )}
                    {showSKU && item.sku && (
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {item.sku}</p>
                    )}
                  </td>
                  {showHSN && (
                    <td className="py-3 px-2 text-center font-mono text-slate-600">{item.hsn || "-"}</td>
                  )}
                  <td className="py-3 px-2 text-center font-mono font-semibold text-slate-800">
                    {item.qty} <span className="text-[10px] text-slate-500 font-sans">{item.unit || "pcs"}</span>
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-slate-700">
                    {formatCurrencyINR(item.rate)}
                  </td>
                  {showDiscount && (
                    <td className="py-3 px-2 text-right font-mono text-amber-600">
                      {item.discountAmt > 0 ? `${formatCurrencyINR(item.discountAmt)}` : "-"}
                    </td>
                  )}
                  <td className="py-3 px-2 text-right font-mono font-semibold text-slate-800">
                    {formatCurrencyINR(item.taxableValue)}
                  </td>
                  {showTax && (
                    <>
                      {!isInterState ? (
                        <>
                          <td className="py-3 px-2 text-right font-mono text-slate-600">
                            {formatCurrencyINR(item.cgstAmt)}
                            <div className="text-[9px] text-slate-400">{item.cgstRate}%</div>
                          </td>
                          <td className="py-3 px-2 text-right font-mono text-slate-600">
                            {formatCurrencyINR(item.sgstAmt)}
                            <div className="text-[9px] text-slate-400">{item.sgstRate}%</div>
                          </td>
                        </>
                      ) : (
                        <td className="py-3 px-2 text-right font-mono text-slate-600">
                          {formatCurrencyINR(item.igstAmt || item.cgstAmt * 2)}
                          <div className="text-[9px] text-slate-400">{item.gstRate}%</div>
                        </td>
                      )}
                    </>
                  )}
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    {formatCurrencyINR(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 4. TOTALS & FINANCIAL SUMMARY ─────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 mb-6 border-b border-slate-200">
          {/* Left Column: Bank Info, UPI QR & Amount in Words */}
          <div className="space-y-4">
            {showAmountInWords && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  Amount in Words
                </p>
                <p className="font-semibold text-slate-800 italic leading-snug">
                  {grandTotalWords}
                </p>
              </div>
            )}

            {/* Bank Details & UPI QR */}
            <div className="flex flex-wrap gap-4">
              {showBankDetails && (
                <div className="flex-1 min-w-[200px] bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Bank Account Details
                  </p>
                  <div className="space-y-0.5 text-slate-700">
                    <p><span className="text-slate-500">Bank:</span> <strong className="text-slate-900">{settings.bankName || "State Bank of India"}</strong></p>
                    <p><span className="text-slate-500">A/C Name:</span> {settings.accountHolder || biz.name}</p>
                    <p><span className="text-slate-500">A/C No:</span> <span className="font-mono font-bold">{settings.accountNumber || "38491029481"}</span></p>
                    <p><span className="text-slate-500">IFSC Code:</span> <span className="font-mono font-bold">{settings.ifsc || "SBIN0001234"}</span></p>
                  </div>
                </div>
              )}

              {showUPIQR && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-center flex flex-col items-center justify-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                    <QrCode className="w-3 h-3 text-emerald-600" />
                    <span>Scan to Pay via UPI</span>
                  </p>
                  <img src={dynamicQrUrl} alt="UPI QR" className="w-20 h-20 rounded bg-white p-1 border shadow-xs" />
                  <p className="font-mono text-[10px] text-slate-600 mt-1 font-semibold">{resolvedUpiId}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Breakdown & Grand Total */}
          <div className="space-y-2 text-xs">
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Amount:</span>
                <span className="font-mono font-semibold">{formatCurrencyINR(inv.taxableAmount)}</span>
              </div>

              {inv.itemDiscountTotal > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Total Discount Savings:</span>
                  <span className="font-mono">-{formatCurrencyINR(inv.itemDiscountTotal)}</span>
                </div>
              )}

              {/* Tax Breakup */}
              {!isInterState ? (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>CGST (Central Tax):</span>
                    <span className="font-mono font-semibold">+{formatCurrencyINR(inv.cgstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>SGST (State Tax):</span>
                    <span className="font-mono font-semibold">+{formatCurrencyINR(inv.sgstTotal)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-600">
                  <span>IGST (Integrated Tax):</span>
                  <span className="font-mono font-semibold">+{formatCurrencyINR(inv.igstTotal || inv.cgstTotal * 2)}</span>
                </div>
              )}

              {inv.shippingCharges > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Shipping & Delivery:</span>
                  <span className="font-mono">+{formatCurrencyINR(inv.shippingCharges)}</span>
                </div>
              )}

              {inv.roundOff !== 0 && (
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Round Off:</span>
                  <span className="font-mono">+{formatCurrencyINR(inv.roundOff)}</span>
                </div>
              )}

              {/* Grand Total Box */}
              <div
                className="pt-3 border-t-2 flex justify-between items-center text-sm font-black rounded-lg p-2.5 mt-2"
                style={{
                  backgroundColor: `${primaryColor}12`,
                  borderColor: primaryColor,
                  color: primaryColor,
                }}
              >
                <span className="uppercase tracking-wide text-xs md:text-sm">Grand Total (INR):</span>
                <span className="font-mono text-base md:text-lg">{formatCurrencyINR(inv.grandTotal)}</span>
              </div>

              {/* Payment Summary */}
              {showBalanceDue && (
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                  <div className="text-slate-600">
                    Paid: <strong className="text-emerald-600 font-mono">{formatCurrencyINR(inv.paidAmount)}</strong>
                  </div>
                  <div className="text-slate-600 font-bold">
                    Balance Due:{" "}
                    <span
                      className={`font-mono text-sm ${
                        inv.balanceDue > 0 ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {formatCurrencyINR(inv.balanceDue)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 5. FOOTER, TERMS & AUTHORIZED SIGNATURE ───────────── */}
        <div className="flex flex-wrap justify-between items-end gap-6 text-xs pt-2">
          {/* Terms & Notes */}
          <div className="flex-1 min-w-[260px] space-y-3">
            {showTerms && settings.termsAndConditions && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Terms & Conditions
                </p>
                <p className="text-slate-600 whitespace-pre-line text-[11px] leading-relaxed">
                  {settings.termsAndConditions}
                </p>
              </div>
            )}
            {settings.customerNotes && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Customer Notes
                </p>
                <p className="text-slate-600 text-[11px] italic">{settings.customerNotes}</p>
              </div>
            )}
          </div>

          {/* Signature Block */}
          <div className="w-56 text-center">
            {showSignature && settings.signatureUrl ? (
              <div className="flex justify-center mb-1">
                <img
                  src={settings.signatureUrl}
                  alt="Signature"
                  className="h-14 object-contain"
                />
              </div>
            ) : (
              <div className="h-14 flex items-end justify-center mb-1">
                <div className="w-40 border-b border-slate-400 border-dashed pb-1"></div>
              </div>
            )}
            <p className="font-bold text-slate-900 text-xs">{biz.name}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
              Authorized Signatory
            </p>
          </div>
        </div>

        {/* Bottom Banner Greeting & Computer Generated Notice */}
        <div className="mt-8 pt-4 border-t border-slate-200 text-center text-slate-400 text-[11px] space-y-1">
          {settings.invoiceFooter && (
            <p className="font-semibold text-slate-700">{settings.invoiceFooter}</p>
          )}
          {showComputerNotice && (
            <p className="text-[10px]">
              This is a computer generated invoice and does not require a physical stamp unless specified.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
