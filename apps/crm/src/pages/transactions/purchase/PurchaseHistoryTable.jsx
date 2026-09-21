import React from "react";
import {
  Search,
  CreditCard,
  CheckCircle2,
  Trash2,
  FileText,
  Upload,
  Eye,
  Paperclip,
  RotateCcw,
} from "lucide-react";

export default function PurchaseHistoryTable({
  filteredPurchases,
  searchHistory,
  setSearchHistory,
  filterMonth,
  setFilterMonth,
  handleOpenPaymentModal,
  handleOpenSupplierDetails,
  handleOpenReturnModal,
  handleDeletePurchase,
  fmt,
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Search bar & Filter */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            value={searchHistory}
            onChange={(e) => setSearchHistory(e.target.value)}
            placeholder="Search invoice or supplier..."
            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            Filter By Month:
          </label>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
          />
          {filterMonth && (
            <button
              onClick={() => setFilterMonth("")}
              className="text-xs text-blue-600 hover:underline whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {filteredPurchases.length === 0 ? (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
          No purchase records found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-semibold">
                <th className="px-4 py-3">Supplier Name</th>
                <th className="px-4 py-3">Invoice / PO No.</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-right">GST</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-center">Payment Status</th>
                <th className="px-4 py-3 text-center">Receipt Bill</th>
                <th className="px-4 py-3 text-right">Remaining Due</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPurchases.map((purchase) => {
                const suppName =
                  purchase.supplierName || purchase.supplier || "Supplier";
                const invNo =
                  purchase.supplierInvoiceNo ||
                  purchase.invoiceNo ||
                  purchase._id ||
                  "-";
                const poNo = purchase.purchaseOrderNo
                  ? ` (${purchase.purchaseOrderNo})`
                  : "";
                const dateStr = purchase.purchaseDate
                  ? new Date(purchase.purchaseDate).toISOString().slice(0, 10)
                  : purchase.date || "-";
                const itemCount = Array.isArray(purchase.items)
                  ? purchase.items.length
                  : purchase.items || 0;
                const remAmt =
                  purchase.remainingAmount !== undefined
                    ? purchase.remainingAmount
                    : 0;

                return (
                  <tr
                    key={purchase._id || purchase.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenSupplierDetails &&
                          handleOpenSupplierDetails(purchase)
                        }
                        className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline flex items-center gap-1.5 text-left cursor-pointer group"
                        title="Click to view full supplier payment details & breakdown"
                      >
                        <span>{suppName}</span>
                        <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          (View Details ➔)
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {invNo}
                      {poNo && <span className="text-slate-400 ml-1">{poNo}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono">
                      {dateStr}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {itemCount} item{itemCount !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300 text-right">
                      {fmt(purchase.subtotal || 0)}
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-400 text-right">
                      {fmt(purchase.gstTotal || purchase.gst || 0)}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white font-mono text-right">
                      {fmt(purchase.totalAmount || purchase.total || 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                          purchase.paymentStatus === "Paid"
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            : purchase.paymentStatus === "Partially Paid"
                            ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                            : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                        }`}
                      >
                        {purchase.paymentStatus || "Unpaid"}
                      </span>
                    </td>

                    {/* Receipt Status & Upload Option */}
                    <td className="px-4 py-3 text-center">
                      {purchase.receiptUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenSupplierDetails &&
                            handleOpenSupplierDetails(purchase)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-medium hover:bg-emerald-100 transition-colors cursor-pointer"
                          title="View attached supplier bill receipt"
                        >
                          <Paperclip className="w-3 h-3" />
                          <span>Receipt Attached</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenSupplierDetails &&
                            handleOpenSupplierDetails(purchase)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 dark:border-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                          title="Upload bill receipt image or document"
                        >
                          <Upload className="w-3 h-3" />
                          <span>+ Upload Receipt</span>
                        </button>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono text-xs font-semibold text-right">
                      {remAmt > 0 ? (
                        <span className="text-red-600 dark:text-red-400">
                          {fmt(remAmt)}
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Cleared
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenSupplierDetails &&
                            handleOpenSupplierDetails(purchase)
                          }
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                          title="View Supplier Payment Breakdown"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {purchase.paymentStatus !== "Paid" && remAmt > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentModal(purchase)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[11px] font-semibold shadow-sm hover:shadow transition-all cursor-pointer"
                            title="Record payment to supplier"
                          >
                            <CreditCard className="w-3 h-3" />
                            Pay
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handleOpenReturnModal && handleOpenReturnModal(purchase)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                          title="Create Purchase Return / Debit Note"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeletePurchase(purchase._id || purchase.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                          title="Delete purchase bill & reverse inventory stock"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
