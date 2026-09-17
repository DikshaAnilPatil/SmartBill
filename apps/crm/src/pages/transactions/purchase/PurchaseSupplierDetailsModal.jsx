import React, { useState, useRef } from "react";
import {
  X,
  Building2,
  Calendar,
  CreditCard,
  CheckCircle2,
  FileText,
  Upload,
  Download,
  Eye,
  Trash2,
  AlertCircle,
  Loader2,
  Plus,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";
import { Modal, Btn, Badge } from "@shared/components/common/ui";
import { uploadPurchaseReceipt } from "@shared/api/purchaseAPI";

export default function PurchaseSupplierDetailsModal({
  purchase,
  onClose,
  onOpenPaymentModal,
  onPurchaseUpdated,
  fmt,
}) {
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const fileInputRef = useRef(null);

  if (!purchase) return null;

  const total = Number(purchase.totalAmount || purchase.total) || 0;
  const paid = Number(purchase.amountPaid) || 0;
  const remaining =
    purchase.remainingAmount !== undefined
      ? Number(purchase.remainingAmount)
      : Math.max(0, total - paid);

  const paymentStatus = purchase.paymentStatus || (remaining === 0 ? "Paid" : paid > 0 ? "Partially Paid" : "Unpaid");

  const items = Array.isArray(purchase.items) ? purchase.items : [];
  const paymentHistory = Array.isArray(purchase.paymentHistory)
    ? purchase.paymentHistory
    : [];

  const handleReceiptFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setFeedbackMsg({ type: "error", text: "File size must be under 5MB." });
      return;
    }

    setUploadingReceipt(true);
    setFeedbackMsg(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const res = await uploadPurchaseReceipt(purchase._id || purchase.id, {
            receiptUrl: reader.result,
            receiptName: file.name,
          });
          setFeedbackMsg({ type: "success", text: "Receipt attached successfully!" });
          if (onPurchaseUpdated && res?.purchase) {
            onPurchaseUpdated(res.purchase);
          }
        } catch (err) {
          setFeedbackMsg({
            type: "error",
            text: err?.message || "Failed to upload receipt.",
          });
        } finally {
          setUploadingReceipt(false);
        }
      };
      reader.onerror = () => {
        setUploadingReceipt(false);
        setFeedbackMsg({ type: "error", text: "Could not read receipt file." });
      };
    } catch (err) {
      setUploadingReceipt(false);
      setFeedbackMsg({ type: "error", text: err?.message || "Upload error." });
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {purchase.supplierName || purchase.supplier || "Supplier Details"}
            </h3>
            <p className="text-xs text-slate-500 font-normal">
              Purchase Invoice & Payment Details
            </p>
          </div>
        </div>
      }
      onClose={onClose}
      className="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Feedback message */}
        {feedbackMsg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              feedbackMsg.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
            }`}
          >
            {feedbackMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* 1. Header Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
              Total Bill Value
            </p>
            <p className="text-lg font-black text-slate-900 dark:text-white font-mono">
              {fmt(total)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              GST Tax: {fmt(purchase.gstTotal || purchase.gst || 0)}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-0.5">
              Amount Paid
            </p>
            <p className="text-lg font-black text-emerald-700 dark:text-emerald-300 font-mono">
              {fmt(paid)}
            </p>
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400 mt-0.5">
              Method: {purchase.paymentMethod || "Cash"}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
              Remaining Balance Due
            </p>
            <p
              className={`text-lg font-black font-mono ${
                remaining > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {remaining > 0 ? fmt(remaining) : "₹0.00 (Cleared)"}
            </p>
            <div className="mt-0.5">
              <Badge
                label={paymentStatus}
                variant={
                  paymentStatus === "Paid"
                    ? "green"
                    : paymentStatus === "Partially Paid"
                    ? "yellow"
                    : "red"
                }
              />
            </div>
          </div>
        </div>

        {/* 2. Purchase Invoice & Supplier Info */}
        <div className="bg-slate-50/60 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 text-xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Invoice / Bill #
            </p>
            <p className="font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">
              {purchase.supplierInvoiceNo || purchase.invoiceNo || "-"}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Purchase Order (PO) #
            </p>
            <p className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">
              {purchase.purchaseOrderNo || "-"}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              E-Way Bill #
            </p>
            <p className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">
              {purchase.eWayBillNo || "-"}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Inward Date
            </p>
            <p className="text-slate-700 dark:text-slate-300 font-mono mt-0.5">
              {purchase.purchaseDate
                ? new Date(purchase.purchaseDate).toLocaleDateString("en-IN")
                : "-"}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Tax Regime
            </p>
            <p className="text-slate-700 dark:text-slate-300 font-medium mt-0.5">
              {purchase.taxType || "GST Regular"}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              ITC Status
            </p>
            <p className="mt-0.5">
              {purchase.itcEligible !== false ? (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Eligible (GSTR-2B)
                </span>
              ) : (
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  Ineligible
                </span>
              )}
            </p>
          </div>
        </div>

        {/* 3. Items Purchased Table */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Goods Received Line Items ({items.length})
          </h4>
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-500 dark:text-slate-400 text-[11px]">
                  <th className="px-3.5 py-2.5">Item Name</th>
                  <th className="px-3.5 py-2.5">HSN</th>
                  <th className="px-3.5 py-2.5">Batch #</th>
                  <th className="px-3.5 py-2.5">Expiry</th>
                  <th className="px-3.5 py-2.5 text-center">Qty</th>
                  <th className="px-3.5 py-2.5 text-right">Rate</th>
                  <th className="px-3.5 py-2.5 text-right">GST</th>
                  <th className="px-3.5 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-4 text-center text-slate-400">
                      No items recorded
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-3.5 py-2.5 font-medium text-slate-900 dark:text-white">
                        {item.productName || item.product || "Product"}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-500">
                        {item.hsnCode || "-"}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-500">
                        {item.batchNo || "-"}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-500">
                        {item.expiryDate
                          ? new Date(item.expiryDate).toLocaleDateString("en-IN")
                          : "-"}
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-mono text-slate-600 dark:text-slate-300">
                        {item.quantity || item.qty} {item.unit || "pcs"}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                        {fmt(item.purchaseRate || item.rate || 0)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                        {item.gstRate || 0}%
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {fmt(item.itemAmount || (item.purchaseRate || 0) * (item.quantity || 1))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Payment History Log */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Payment Transactions ({paymentHistory.length})
            </h4>
            {remaining > 0 && onOpenPaymentModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPaymentModal(purchase);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Record Payment
              </button>
            )}
          </div>

          <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {paymentHistory.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                {paid > 0
                  ? `Initial payment of ${fmt(paid)} via ${purchase.paymentMethod || "Cash"}`
                  : "No payment transactions recorded yet."}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {paymentHistory.map((ph, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {ph.paymentMethod || "Payment"}
                        {ph.referenceNo && (
                          <span className="text-[11px] font-mono text-slate-400 ml-1.5">
                            (Ref: {ph.referenceNo})
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {ph.date ? new Date(ph.date).toLocaleString("en-IN") : "-"}
                        {ph.notes ? ` • ${ph.notes}` : ""}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      +{fmt(ph.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 5. Attached Supplier Receipt / Bill */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Supplier Bill / Receipt Document
          </h4>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
            {purchase.receiptUrl ? (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {purchase.receiptUrl.startsWith("data:image") ||
                    purchase.receiptUrl.startsWith("http") ? (
                      <img
                        src={purchase.receiptUrl}
                        alt="Receipt"
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setPreviewReceipt(true)}
                      />
                    ) : (
                      <FileText className="w-6 h-6 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-xs text-slate-900 dark:text-white">
                      {purchase.receiptName || "Supplier Bill Receipt"}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Receipt attached • Click to preview
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewReceipt(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingReceipt}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors cursor-pointer"
                  >
                    {uploadingReceipt ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    Replace
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  No receipt or invoice image uploaded yet
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
                  Upload an image (PNG, JPG, WEBP) or scanned bill copy for record keeping
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingReceipt}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {uploadingReceipt ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Upload Receipt / Bill</span>
                    </>
                  )}
                </button>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleReceiptFileChange}
              accept="image/*,application/pdf"
              className="hidden"
            />
          </div>
        </div>

        {/* 6. Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <Btn variant="outline" size="sm" onClick={onClose}>
            Close
          </Btn>

          {remaining > 0 && onOpenPaymentModal && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPaymentModal(purchase);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              Record Supplier Payment ({fmt(remaining)})
            </button>
          )}
        </div>
      </div>

      {/* ── FULL SCREEN RECEIPT PREVIEW MODAL ── */}
      {previewReceipt && (
        <div
          onClick={() => setPreviewReceipt(false)}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Receipt Preview: {purchase.receiptName || purchase.supplierInvoiceNo || "Bill"}
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={purchase.receiptUrl}
                  download={purchase.receiptName || "supplier-receipt"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewReceipt(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-950">
              <img
                src={purchase.receiptUrl}
                alt="Full Receipt"
                className="max-h-[70vh] max-w-full object-contain rounded-lg shadow"
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
