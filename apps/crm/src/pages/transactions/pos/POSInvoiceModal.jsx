import React from "react";
import { Printer, Download, ArrowLeft } from "lucide-react";
import { fmt } from "@shared/utils/format";
import { Badge, Btn, Card } from "@shared/components/common/ui";

export default function POSInvoiceModal({
  order,
  cart,
  customer,
  subtotal,
  gst,
  total,
  paidValue,
  paymentMode,
  activeBiz = {},
  paymentSettings = {},
  onClose,
  handlePrintInvoice,
  getProductDefaultPrice,
}) {
  const invoiceItems =
    order?.items && order.items.length > 0
      ? order.items
      : cart.map((i) => ({
          name: i.product?.name || "Item",
          qty: i.qty,
          price:
            i.price !== undefined
              ? Number(i.price)
              : getProductDefaultPrice
              ? getProductDefaultPrice(i.product)
              : Number(i.product?.price || 0),
          amount:
            (i.price !== undefined
              ? Number(i.price)
              : getProductDefaultPrice
              ? getProductDefaultPrice(i.product)
              : Number(i.product?.price || 0)) * i.qty,
        }));

  const invoiceSubtotal = order?.subtotal ?? subtotal;
  const invoiceGst = order?.gst ?? gst;
  const invoiceTotal = order?.totalOrderValue ?? total;
  const invoicePaid = order?.amountPaid ?? (paidValue > 0 ? paidValue : total);
  const invoiceDue = order?.balanceDue ?? Math.max(0, invoiceTotal - invoicePaid);

  const bName =
    paymentSettings?.bankSettings?.accountHolderName ||
    activeBiz.businessName ||
    "Smart Bill Business";
  const bTagline = activeBiz.tagline || "";
  const bAddress = [
    activeBiz.address,
    activeBiz.city,
    activeBiz.state,
    activeBiz.pincode,
  ]
    .filter(Boolean)
    .join(", ");
  const bGstin = activeBiz.gstin ? `GSTIN: ${activeBiz.gstin}` : "";
  const bPhone = activeBiz.phone ? `Ph: ${activeBiz.phone}` : "";
  const bBankName =
    paymentSettings?.bankSettings?.bankName || activeBiz.bankName || "";
  const bAccNo =
    paymentSettings?.bankSettings?.accountNumber || activeBiz.accountNumber || "";
  const bIfsc =
    paymentSettings?.bankSettings?.ifscCode || activeBiz.ifscCode || "";
  const bUpiId = paymentSettings?.upiSettings?.upiId || activeBiz.upiId || "";
  const bTerms = activeBiz.invoiceTerms || "";
  const bFooter =
    activeBiz.invoiceFooter ||
    activeBiz.invoiceFooterNote ||
    "Thank you for your business! Visit Again 🙏";

  const orderStatus =
    order?.status ||
    (invoicePaid >= invoiceTotal
      ? "Paid"
      : invoicePaid > 0
      ? "Partial"
      : "Due");

  return (
    <div className="max-w-2xl mx-auto">
      <Btn
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="mb-4"
        icon={<ArrowLeft className="w-4 h-4" />}
      >
        Back to Billing
      </Btn>
      <Card className="p-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              {activeBiz.logoUrl ? (
                <img
                  src={activeBiz.logoUrl}
                  alt="Logo"
                  className="w-10 h-10 object-contain rounded-lg border border-slate-200 dark:border-slate-700"
                />
              ) : null}
              <div>
                <h1 className="text-xl font-black text-slate-900 dark:text-white">
                  {bName}
                </h1>
                {bTagline && (
                  <p className="text-xs text-slate-500">{bTagline}</p>
                )}
              </div>
            </div>
            {bAddress && <p className="text-xs text-slate-500 mt-1">{bAddress}</p>}
            <div className="flex gap-4 text-xs text-slate-500 mt-0.5">
              {bGstin && <span>{bGstin}</span>}
              {bPhone && <span>{bPhone}</span>}
            </div>
          </div>

          <div className="text-right">
            <h2 className="text-lg font-black text-blue-600 dark:text-blue-400 uppercase tracking-wide">
              Tax Invoice
            </h2>
            <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5">
              #{order?.invoiceNo || "INV-001"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {order?.createdAt
                ? new Date(order.createdAt).toLocaleDateString("en-IN")
                : new Date().toLocaleDateString("en-IN")}
            </p>
            <div className="mt-2">
              <Badge
                label={orderStatus}
                variant={
                  orderStatus === "Paid"
                    ? "green"
                    : orderStatus === "Partial"
                    ? "yellow"
                    : "red"
                }
              />
            </div>
          </div>
        </div>

        <div className="mb-6 bg-slate-50/80 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
            Billed To
          </p>
          <p className="font-bold text-slate-900 dark:text-white text-sm">
            {order?.customerName || customer || "Walk-in Customer"}
          </p>
        </div>

        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
              <th className="text-left pb-2.5">Item</th>
              <th className="text-center pb-2.5">Qty</th>
              <th className="text-right pb-2.5">Rate</th>
              <th className="text-right pb-2.5">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {invoiceItems.map((i, idx) => (
              <tr key={idx}>
                <td className="py-3 text-xs font-bold text-slate-800 dark:text-slate-200">
                  {i.name}
                </td>
                <td className="py-3 text-xs text-center font-mono font-medium text-slate-600 dark:text-slate-300">
                  {i.qty}
                </td>
                <td className="py-3 text-xs text-right font-mono text-slate-600 dark:text-slate-400">
                  {fmt(i.price)}
                </td>
                <td className="py-3 text-xs text-right font-mono font-bold text-slate-900 dark:text-white">
                  {fmt(i.amount || i.price * i.qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end pt-2">
          <div className="w-64 space-y-2 text-xs bg-slate-50/60 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Subtotal</span>
              <span className="font-mono font-medium">{fmt(invoiceSubtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>GST Tax</span>
              <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                +{fmt(invoiceGst)}
              </span>
            </div>
            <div className="flex justify-between font-extrabold text-slate-900 dark:text-white text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
              <span>Total Amount</span>
              <span className="font-mono text-blue-600 dark:text-blue-400 font-extrabold text-base">
                {fmt(invoiceTotal)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-300 pt-1">
              <span>Amount Paid</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {fmt(invoicePaid)}
              </span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-100 dark:border-slate-700/60">
              <span>Balance Due</span>
              <span
                className={`font-mono font-bold ${
                  invoiceDue > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {fmt(invoiceDue)}
              </span>
            </div>
          </div>
        </div>

        {(bBankName || bUpiId) && (
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs bg-slate-50/60 dark:bg-slate-800/40 p-3.5 rounded-xl">
            <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
              Bank & Payment Details
            </p>
            {bBankName && (
              <p className="text-slate-500 dark:text-slate-400">
                Bank: {bBankName} {bAccNo ? `| A/C: ${bAccNo}` : ""}{" "}
                {bIfsc ? `| IFSC: ${bIfsc}` : ""}
              </p>
            )}
            {bUpiId && (
              <p className="text-blue-600 dark:text-blue-400 font-mono font-semibold mt-0.5">
                UPI ID: {bUpiId}
              </p>
            )}
          </div>
        )}

        {bTerms && (
          <div className="mt-4 text-xs bg-slate-50/60 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
              Terms & Conditions
            </p>
            <p className="text-slate-500 dark:text-slate-400 whitespace-pre-line text-[11px] leading-relaxed">
              {bTerms}
            </p>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
          <div className="p-3 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-100/60 dark:border-blue-900/40 inline-block max-w-md w-full">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {bFooter}
            </p>
          </div>
          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-2">
            Powered by SmartBill Pro
          </p>
        </div>

        {/* Payment Method & Split Details */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs bg-slate-50/60 dark:bg-slate-800/40 p-3.5 rounded-xl">
          <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
            Payment Method:{" "}
            <span className="text-blue-600 dark:text-blue-400 font-semibold">
              {order?.paymentMode || paymentMode}
            </span>
          </p>
          {Array.isArray(order?.splitPayments) && order.splitPayments.length > 0 && (
            <div className="mt-2 space-y-1 pl-2 border-l-2 border-blue-500">
              {order.splitPayments.map((sp, idx) => (
                <div
                  key={idx}
                  className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300"
                >
                  <span>
                    {sp.mode} {sp.referenceNo ? `(Ref: ${sp.referenceNo})` : ""}:
                  </span>
                  <span className="font-mono font-bold">{fmt(sp.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 no-print">
          <Btn
            variant="primary"
            onClick={() => handlePrintInvoice && handlePrintInvoice(order)}
            icon={<Printer className="w-4 h-4" />}
          >
            Print Invoice
          </Btn>
          <Btn
            variant="outline"
            onClick={() => handlePrintInvoice && handlePrintInvoice(order)}
            icon={<Download className="w-4 h-4" />}
          >
            Download PDF
          </Btn>
          <Btn variant="ghost" onClick={onClose}>
            New Invoice
          </Btn>
        </div>
      </Card>
    </div>
  );
}
