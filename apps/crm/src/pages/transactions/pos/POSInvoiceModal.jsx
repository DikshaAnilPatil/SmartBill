import React, { useState, useEffect } from "react";
import {
  Printer,
  Download,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  CheckCircle2,
  Palette,
  Sparkles,
} from "lucide-react";
import { fmt } from "@shared/utils/format";
import { Badge, Btn } from "@shared/components/common/ui";
import InvoiceRenderer from "@shared/components/invoice/InvoiceRenderer";
import { getTemplateConfig, INVOICE_TEMPLATES } from "@shared/components/invoice/templateConfigs";
import { numberToWordsIndian } from "@shared/utils/numberToWords";

export default function POSInvoiceModal({
  order,
  cart = [],
  customer = "",
  subtotal = 0,
  gst = 0,
  total = 0,
  paidValue = 0,
  paymentMode = "Cash",
  activeBiz = {},
  paymentSettings = {},
  invSettings: initialInvSettings = {},
  onClose,
  handlePrintInvoice,
  getProductDefaultPrice,
}) {
  const [scale, setScale] = useState(0.9);
  const [invSettings, setInvSettings] = useState(() => {
    try {
      const stored = localStorage.getItem("smartbill_invoice_settings");
      const parsed = stored ? JSON.parse(stored) : {};
      return { ...parsed, ...initialInvSettings };
    } catch {
      return initialInvSettings || {};
    }
  });

  useEffect(() => {
    if (initialInvSettings && Object.keys(initialInvSettings).length > 0) {
      setInvSettings((prev) => ({ ...prev, ...initialInvSettings }));
    }
  }, [initialInvSettings]);

  // Derived calculations
  const invoiceSubtotal = order?.subtotal ?? subtotal;
  const invoiceGst = order?.gst ?? gst;
  const invoiceTotal = order?.totalOrderValue ?? total;
  const invoicePaid = order?.amountPaid ?? (paidValue > 0 ? paidValue : total);
  const invoiceDue = order?.balanceDue ?? Math.max(0, invoiceTotal - invoicePaid);

  const orderStatus =
    order?.status ||
    (invoicePaid >= invoiceTotal
      ? "Paid"
      : invoicePaid > 0
      ? "Partial"
      : "Due");

  // Format line items
  const rawItems =
    order?.items && order.items.length > 0
      ? order.items
      : cart.map((i, idx) => ({
          srNo: idx + 1,
          name: i.product?.name || "Item",
          desc: i.product?.description || i.description || "",
          sku: i.product?.sku || "",
          hsn: i.product?.hsn || "",
          qty: Number(i.qty) || 1,
          unit: i.product?.unit || "pcs",
          price:
            i.price !== undefined
              ? Number(i.price)
              : getProductDefaultPrice
              ? getProductDefaultPrice(i.product)
              : Number(i.product?.price || 0),
          taxableValue:
            (i.price !== undefined
              ? Number(i.price)
              : getProductDefaultPrice
              ? getProductDefaultPrice(i.product)
              : Number(i.product?.price || 0)) * (Number(i.qty) || 1),
          gstRate: Number(i.product?.gstRate ?? 18),
          amount:
            (i.price !== undefined
              ? Number(i.price)
              : getProductDefaultPrice
              ? getProductDefaultPrice(i.product)
              : Number(i.product?.price || 0)) * (Number(i.qty) || 1),
        }));

  const invoiceItems = rawItems.map((item, idx) => {
    const rate = Number(item.price || item.rate || 0);
    const qty = Number(item.qty || 1);
    const taxable = Number(item.taxableValue || rate * qty);
    const gstRate = Number(item.gstRate ?? 18);
    const halfGstRate = gstRate / 2;
    const cgstAmt = (taxable * halfGstRate) / 100;
    const sgstAmt = (taxable * halfGstRate) / 100;
    const totalItemAmt = taxable + cgstAmt + sgstAmt;

    return {
      srNo: idx + 1,
      name: item.name || "Item",
      desc: item.desc || item.description || "",
      hsn: item.hsn || item.product?.hsn || "",
      sku: item.sku || item.product?.sku || "",
      qty: qty,
      unit: item.unit || "pcs",
      rate: rate,
      discountPct: Number(item.discountPct || 0),
      discountAmt: Number(item.discountAmt || 0),
      taxableValue: taxable,
      gstRate: gstRate,
      cgstRate: halfGstRate,
      cgstAmt: cgstAmt,
      sgstRate: halfGstRate,
      sgstAmt: sgstAmt,
      igstRate: 0,
      igstAmt: 0,
      cessAmt: 0,
      total: Number(item.amount || totalItemAmt),
    };
  });

  const invoiceData = {
    invoiceTitle: invSettings?.invoiceTitle || "TAX INVOICE",
    invoiceNo: order?.invoiceNo || `INV-${Date.now().toString().slice(-4)}`,
    invoiceDate: order?.createdAt
      ? new Date(order.createdAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
    dueDate: order?.dueDate
      ? new Date(order.dueDate).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "",
    poNumber: order?.poNumber || "",
    paymentTerms: order?.paymentTerms || "Immediate",
    paymentStatus: orderStatus,
    reverseCharge: "No",
    placeOfSupply: activeBiz?.state ? `${activeBiz.state} (${activeBiz.stateCode || "27"})` : "Maharashtra (27)",
    customer: {
      name: order?.customerName || customer || "Walk-in Customer",
      phone: order?.customerPhone || "",
      email: order?.customerEmail || "",
      address: order?.customerAddress || "",
      city: order?.customerCity || "",
      state: order?.customerState || activeBiz?.state || "",
      stateCode: order?.customerStateCode || "",
      pincode: order?.customerPincode || "",
      gstin: order?.customerGstin || "",
      shippingAddress: order?.shippingAddress || "",
    },
    items: invoiceItems,
    subtotal: invoiceSubtotal,
    itemDiscountTotal: Number(order?.discount || 0),
    cashDiscount: Number(order?.cashDiscount || 0),
    taxableAmount: invoiceSubtotal,
    cgstTotal: Number(order?.cgst ?? invoiceGst / 2),
    sgstTotal: Number(order?.sgst ?? invoiceGst / 2),
    igstTotal: Number(order?.igst || 0),
    cessTotal: Number(order?.cess || 0),
    shippingCharges: Number(order?.shippingCharges || 0),
    packagingCharges: Number(order?.packagingCharges || 0),
    roundOff: Number(order?.roundOff || 0),
    grandTotal: invoiceTotal,
    paidAmount: invoicePaid,
    balanceDue: invoiceDue,
    paymentMode: order?.paymentMode || paymentMode,
    splitPayments: order?.splitPayments || [],
  };

  const currentTpl = getTemplateConfig(invSettings?.template || "classic_gst");

  const handlePrint = () => {
    const printContent = document.getElementById("pos-invoice-print-container");
    if (!printContent) {
      if (handlePrintInvoice) handlePrintInvoice(order);
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    const isThermal = invSettings?.template === "thermal" || (invSettings?.paperSize || "").toLowerCase().includes("thermal");
    const paperSize = isThermal ? (invSettings?.paperSize?.includes("58") ? "58mm auto" : "80mm auto") : (invSettings?.paperSize || "A4");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${invoiceData.invoiceNo}</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600;700&family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@400;500;600;700;800;900&family=Playfair+Display:wght@600;700;900&family=Poppins:wght@400;500;600;700;800&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page {
              size: ${paperSize};
              margin: ${isThermal ? "2mm" : "8mm"};
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
              .no-print { display: none !important; }
              .print\\:shadow-none { box-shadow: none !important; }
              .print\\:border-none { border: none !important; }
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div style="width: 100%; margin: 0 auto;">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] bg-slate-50 dark:bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl">
      {/* ── TOP CONTROL BAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 z-10 shadow-2xs">
        <div className="flex items-center gap-3">
          <Btn
            variant="ghost"
            size="sm"
            onClick={onClose}
            icon={<ArrowLeft className="w-4 h-4" />}
            className="text-slate-700 dark:text-slate-200 font-bold"
          >
            Back to Billing
          </Btn>

          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500">Active Theme:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold border border-blue-200 dark:border-blue-900">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>{currentTpl.name}</span>
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700 mr-2">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-bold px-2 text-slate-600 dark:text-slate-300">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(1.4, s + 0.1))}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setScale(0.85)}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"
              title="Reset Zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <Btn
            variant="outline"
            size="sm"
            onClick={handlePrint}
            icon={<Download className="w-4 h-4" />}
            className="text-xs font-bold"
          >
            Download / PDF
          </Btn>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Invoice</span>
          </button>
        </div>
      </div>

      {/* ── INVOICE RENDER VIEWPORT ── */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center items-start">
        <div id="pos-invoice-print-container" className="transition-transform duration-150">
          <InvoiceRenderer
            settings={invSettings}
            businessInfo={activeBiz}
            invoiceData={invoiceData}
            scale={scale}
          />
        </div>
      </div>
    </div>
  );
}
