import { useEffect, useState, useRef } from "react";
import {
  Download,
  Edit2,
  Eye,
  Filter,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  Truck,
  Receipt,
  Printer,
  Check,
  CreditCard,
  Building2,
  DollarSign,
  Calendar,
  Layers,
  RotateCcw,
  Sparkles,
  FileText,
  User,
  ArrowUpRight,
  ShieldCheck,
  X,
} from "lucide-react";
import { fmt, fmtK } from "@shared/utils/format";
import {
  Btn,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Toast,
} from "@shared/components/common/ui";
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "@shared/api/supplierAPI";
import {
  fetchCashVouchers,
  createCashVoucher,
  updateCashVoucher,
  deleteCashVoucher,
} from "@shared/api/cashVoucherAPI";
import { getProfile } from "@shared/api/authAPI";
import { numberToWordsIndian } from "@shared/utils/numberToWords";

const validateSupplierPhone = (value) => {
  const digits = String(value ?? "").trim();
  if (!digits) return "";
  return /^\d{10}$/.test(digits)
    ? ""
    : "Contact number must be exactly 10 digits.";
};

const ACCOUNT_HEADS = [
  "Vendor Payment",
  "Vendor Advance",
  "Transportation / Freight",
  "Material Purchase",
  "Loading & Unloading",
  "Repair & Maintenance",
  "Office Expense",
  "Miscellaneous Expense",
];

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque", "Other"];

export default function SuppliersScreen() {
  // Navigation Tabs: "suppliers" | "vouchers"
  const [activeTab, setActiveTab] = useState("suppliers");

  // Suppliers Directory State
  const [search, setSearch] = useState("");
  const [supplierList, setSupplierList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [viewSupplier, setViewSupplier] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    contact: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    gst: "",
    balance: 0,
    status: "Active",
  });
  const [formPhoneError, setFormPhoneError] = useState("");
  const [editPhoneError, setEditPhoneError] = useState("");
  const [form, setForm] = useState({
    name: "",
    contact: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    gst: "",
    balanceDue: "0",
  });

  // Cash Vouchers State
  const [vouchers, setVouchers] = useState([]);
  const [voucherStats, setVoucherStats] = useState({
    totalAmount: 0,
    totalVouchers: 0,
    todayAmount: 0,
    todayCount: 0,
  });
  const [voucherSearch, setVoucherSearch] = useState("");
  const [voucherModeFilter, setVoucherModeFilter] = useState("all");
  const [voucherHeadFilter, setVoucherHeadFilter] = useState("all");
  const [voucherLoading, setVoucherLoading] = useState(false);

  // Voucher Modals
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState(null);
  const [viewVoucherSlip, setViewVoucherSlip] = useState(null);
  const [deleteVoucherId, setDeleteVoucherId] = useState(null);
  const [submittingVoucher, setSubmittingVoucher] = useState(false);

  const [voucherForm, setVoucherForm] = useState({
    supplierId: "",
    supplierName: "",
    vendorPhone: "",
    vendorAddress: "",
    vendorGst: "",
    amount: "",
    paymentMode: "Cash",
    accountHead: "Vendor Payment",
    referenceNo: "",
    paidBy: "",
    receivedBy: "",
    narration: "",
    voucherDate: new Date().toISOString().slice(0, 10),
    adjustSupplierBalance: true,
  });

  // Business Profile for Print Slips
  const [businessInfo, setBusinessInfo] = useState({});
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadSuppliers();
    loadCashVouchers();
    getProfile()
      .then((res) => {
        if (res?.user) setBusinessInfo(res.user);
      })
      .catch(() => {});
  }, []);

  const loadSuppliers = async () => {
    try {
      const data = await fetchSuppliers();
      setSupplierList(data.suppliers || []);
    } catch (err) {
      console.error("Error loading suppliers:", err);
    }
  };

  const loadCashVouchers = async () => {
    setVoucherLoading(true);
    try {
      const data = await fetchCashVouchers();
      setVouchers(data.vouchers || []);
      if (data.stats) setVoucherStats(data.stats);
    } catch (err) {
      console.error("Error loading cash vouchers:", err);
    } finally {
      setVoucherLoading(false);
    }
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Open Voucher Modal for a specific Supplier
  const handleOpenVoucherForSupplier = (supplier) => {
    setEditingVoucherId(null);
    setVoucherForm({
      supplierId: supplier._id || "",
      supplierName: supplier.name || "",
      vendorPhone: supplier.phone || "",
      vendorAddress: supplier.address || "",
      vendorGst: supplier.gst || "",
      amount: "",
      paymentMode: "Cash",
      accountHead: "Vendor Payment",
      referenceNo: "",
      paidBy: businessInfo.name || "Cashier / Manager",
      receivedBy: supplier.contact || "",
      narration: `Payment to ${supplier.name}`,
      voucherDate: new Date().toISOString().slice(0, 10),
      adjustSupplierBalance: true,
    });
    setShowVoucherModal(true);
  };

  // Open Blank Voucher Modal
  const handleOpenNewVoucher = () => {
    setEditingVoucherId(null);
    setVoucherForm({
      supplierId: "",
      supplierName: "",
      vendorPhone: "",
      vendorAddress: "",
      vendorGst: "",
      amount: "",
      paymentMode: "Cash",
      accountHead: "Vendor Payment",
      referenceNo: "",
      paidBy: businessInfo.name || "Cashier / Manager",
      receivedBy: "",
      narration: "",
      voucherDate: new Date().toISOString().slice(0, 10),
      adjustSupplierBalance: true,
    });
    setShowVoucherModal(true);
  };

  // When vendor selection changes in voucher modal
  const handleVoucherVendorSelect = (suppId) => {
    if (!suppId) {
      setVoucherForm((prev) => ({
        ...prev,
        supplierId: "",
        supplierName: "",
        vendorPhone: "",
        vendorAddress: "",
        vendorGst: "",
      }));
      return;
    }

    const selected = supplierList.find((s) => s._id === suppId);
    if (selected) {
      setVoucherForm((prev) => ({
        ...prev,
        supplierId: selected._id,
        supplierName: selected.name,
        vendorPhone: selected.phone || "",
        vendorAddress: selected.address || "",
        vendorGst: selected.gst || "",
        receivedBy: selected.contact || "",
      }));
    }
  };

  // Save / Submit Cash Voucher
  const handleSaveCashVoucher = async () => {
    if (!voucherForm.supplierName.trim()) {
      showToast("Please enter or select a Vendor / Payee Name.", "error");
      return;
    }
    const numAmt = Number(voucherForm.amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      showToast("Please enter a valid amount greater than 0.", "error");
      return;
    }

    setSubmittingVoucher(true);
    try {
      if (editingVoucherId) {
        await updateCashVoucher(editingVoucherId, voucherForm);
        showToast("Cash Voucher updated successfully!");
      } else {
        const res = await createCashVoucher(voucherForm);
        showToast(res.message || "Cash Voucher created successfully!");
        if (res.voucher) {
          setViewVoucherSlip(res.voucher);
        }
      }
      setShowVoucherModal(false);
      await Promise.all([loadCashVouchers(), loadSuppliers()]);
    } catch (err) {
      console.error("VOUCHER SAVE ERROR:", err);
      showToast(err.response?.data?.message || "Failed to save cash voucher.", "error");
    } finally {
      setSubmittingVoucher(false);
    }
  };

  // Print Cash Voucher Slip
  const handlePrintVoucher = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    const voucherHtml = document.getElementById("printable-cash-voucher-slip")?.innerHTML || "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Cash Voucher - ${viewVoucherSlip?.voucherNo || "Slip"}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fira+Code:wght@600;700&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page {
              size: A5 landscape;
              margin: 8mm;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              font-family: 'Inter', sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div style="max-width: 780px; margin: 0 auto;">
            ${voucherHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filtered Suppliers
  const filteredSuppliers = supplierList.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contact && s.contact.toLowerCase().includes(search.toLowerCase())) ||
      (s.phone && s.phone.includes(search)) ||
      (s.city && s.city.toLowerCase().includes(search.toLowerCase()))
  );

  // Filtered Vouchers
  const filteredVouchers = vouchers.filter((v) => {
    const matchesSearch =
      !voucherSearch ||
      v.voucherNo.toLowerCase().includes(voucherSearch.toLowerCase()) ||
      v.supplierName.toLowerCase().includes(voucherSearch.toLowerCase()) ||
      (v.referenceNo && v.referenceNo.toLowerCase().includes(voucherSearch.toLowerCase())) ||
      (v.narration && v.narration.toLowerCase().includes(voucherSearch.toLowerCase()));

    const matchesMode =
      voucherModeFilter === "all" || v.paymentMode.toLowerCase() === voucherModeFilter.toLowerCase();

    const matchesHead =
      voucherHeadFilter === "all" || v.accountHead.toLowerCase() === voucherHeadFilter.toLowerCase();

    return matchesSearch && matchesMode && matchesHead;
  });

  return (
    <div className="space-y-6">
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* ── Top Header with Tab Switcher ─────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            {activeTab === "suppliers" ? (
              <Truck className="w-5 h-5" />
            ) : (
              <Receipt className="w-5 h-5" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {activeTab === "suppliers" ? "Vendors & Suppliers" : "Vendor Cash Vouchers (रोकड व्हाउचर)"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeTab === "suppliers"
                ? "Manage registered suppliers, balance payables, and issue instant payment vouchers."
                : "Create, disburse, and print official Cash Payment Vouchers for vendors & expenses."}
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab("suppliers")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "suppliers"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Vendors Directory ({supplierList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("vouchers")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "vouchers"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Cash Vouchers ({vouchers.length})</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: VENDORS / SUPPLIERS DIRECTORY
      ────────────────────────────────────────────────────────────── */}
      {activeTab === "suppliers" && (
        <div className="space-y-5">
          {/* Actions & Search */}
          <div className="flex items-center justify-between gap-3 flex-wrap bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex-1 min-w-[260px] max-w-md">
              <Input
                value={search}
                onChange={setSearch}
                placeholder="Search vendors by name, contact, phone, city..."
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenNewVoucher}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                <span>Issue Cash Voucher</span>
              </button>

              <Btn
                variant="primary"
                size="md"
                onClick={() => setShowModal(true)}
                icon={<Plus className="w-4 h-4" />}
              >
                Add Supplier
              </Btn>
            </div>
          </div>

          {/* Suppliers Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
                    {[
                      "Supplier / Firm",
                      "Contact Person",
                      "Phone & Email",
                      "City & Address",
                      "GST Number",
                      "Balance Due",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className={`text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wide ${
                          h === "Actions" ? "text-right" : ""
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No matching suppliers found.
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <tr
                        key={s._id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group align-middle"
                      >
                        {/* Firm Name */}
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-900 dark:text-white text-sm">
                            {s.name}
                          </p>
                          <span className="text-[11px] text-slate-400">
                            ID: {s._id?.slice(-6).toUpperCase()}
                          </span>
                        </td>

                        {/* Contact Person */}
                        <td className="px-5 py-4 text-slate-700 dark:text-slate-300 font-medium">
                          {s.contact || "—"}
                        </td>

                        {/* Phone & Email */}
                        <td className="px-5 py-4">
                          <p className="text-slate-800 dark:text-slate-200 font-mono text-xs font-semibold">
                            {s.phone}
                          </p>
                          {s.email && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{s.email}</p>
                          )}
                        </td>

                        {/* City & Address */}
                        <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-400 max-w-[220px]">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{s.city || "—"}</p>
                          <p className="text-[11px] text-slate-400 truncate">{s.address}</p>
                        </td>

                        {/* GST Number */}
                        <td className="px-5 py-4 font-mono text-xs text-slate-600 dark:text-slate-300 font-semibold">
                          {s.gst || "—"}
                        </td>

                        {/* Balance Due */}
                        <td className="px-5 py-4">
                          <span
                            className={`font-mono font-bold text-sm ${
                              Number(s.balance) > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600"
                            }`}
                          >
                            {fmt(s.balance || 0)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {/* 1-Click Issue Cash Voucher Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenVoucherForSupplier(s)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title={`Issue Cash Voucher to ${s.name}`}
                            >
                              <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Voucher</span>
                            </button>

                            {/* View */}
                            <button
                              type="button"
                              onClick={() => setViewSupplier(s)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => {
                                setShowEditModal(true);
                                setEditId(s._id);
                                setEditForm({
                                  name: s.name,
                                  contact: s.contact,
                                  phone: s.phone,
                                  email: s.email,
                                  city: s.city,
                                  address: s.address || "",
                                  gst: s.gst || "",
                                  balance: s.balance,
                                  status: s.status,
                                });
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                              title="Edit supplier"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => setDeleteId(s._id)}
                              className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 dark:border-red-900/50 dark:hover:bg-red-950/50 cursor-pointer"
                              title="Delete supplier"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: CASH VOUCHERS (रोकड व्हाउचर)
      ────────────────────────────────────────────────────────────── */}
      {activeTab === "vouchers" && (
        <div className="space-y-6">
          {/* Top KPI Metrics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Vouchers Card */}
            <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800/80 flex-shrink-0">
                <Receipt className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Total Cash Vouchers
                </p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
                  {voucherStats.totalVouchers} Issued
                </p>
              </div>
            </div>

            {/* Total Disbursed Card */}
            <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/80 flex-shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Total Disbursed Amount
                </p>
                <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 truncate">
                  {fmt(voucherStats.totalAmount)}
                </p>
              </div>
            </div>

            {/* Today's Disbursements Card */}
            <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200 dark:border-purple-800/80 flex-shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Today's Disbursements
                </p>
                <p className="text-xl font-extrabold text-purple-600 dark:text-purple-400 font-mono mt-0.5 truncate">
                  {fmt(voucherStats.todayAmount)}
                </p>
              </div>
            </div>

            {/* Active Payees Card */}
            <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800/80 flex-shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Registered Vendors
                </p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
                  {supplierList.length} Vendors
                </p>
              </div>
            </div>
          </div>

          {/* Search, Filter Bar & Create Button */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={voucherSearch}
                onChange={(e) => setVoucherSearch(e.target.value)}
                placeholder="Search by Voucher #, Vendor Name, Ref #, Notes..."
                className="w-full pl-10 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-blue-500 shadow-xs"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={voucherModeFilter}
                onChange={(e) => setVoucherModeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value="all">All Payment Modes</option>
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <select
                value={voucherHeadFilter}
                onChange={(e) => setVoucherHeadFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value="all">All Account Heads</option>
                {ACCOUNT_HEADS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleOpenNewVoucher}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Cash Voucher</span>
              </button>
            </div>
          </div>

          {/* Vouchers Data Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
                    <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Voucher # & Date
                    </th>
                    <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Vendor / Payee Details
                    </th>
                    <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Debit Account Head
                    </th>
                    <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Mode & Ref
                    </th>
                    <th className="text-right px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Amount Paid
                    </th>
                    <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Narration / Remarks
                    </th>
                    <th className="text-right px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-400">
                        <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-600">No Cash Vouchers Found</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Click "+ New Cash Voucher" to issue your first payment voucher.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredVouchers.map((v) => (
                      <tr
                        key={v._id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group align-middle"
                      >
                        {/* Voucher # & Date */}
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => setViewVoucherSlip(v)}
                            className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline text-xs cursor-pointer block"
                          >
                            {v.voucherNo}
                          </button>
                          <span className="text-[11px] text-slate-400 mt-0.5 block font-mono">
                            {new Date(v.voucherDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </td>

                        {/* Vendor / Payee */}
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-900 dark:text-white text-xs">
                            {v.supplierName}
                          </p>
                          {v.vendorPhone && (
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {v.vendorPhone}
                            </p>
                          )}
                        </td>

                        {/* Account Head */}
                        <td className="px-5 py-4">
                          <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                            {v.accountHead}
                          </span>
                        </td>

                        {/* Payment Mode */}
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1 font-semibold text-xs text-slate-800 dark:text-slate-200">
                            <CreditCard className="w-3 h-3 text-emerald-600" />
                            {v.paymentMode}
                          </span>
                          {v.referenceNo && (
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              Ref: #{v.referenceNo}
                            </p>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="px-5 py-4 text-right">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            {fmt(v.amount)}
                          </span>
                        </td>

                        {/* Narration */}
                        <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-400 max-w-[200px]">
                          <p className="truncate italic">
                            {v.narration || "No remarks"}
                          </p>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {/* View & Print Voucher Slip */}
                            <button
                              type="button"
                              onClick={() => setViewVoucherSlip(v)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:text-slate-200 cursor-pointer"
                              title="View & Print Voucher Slip"
                            >
                              <Printer className="w-3.5 h-3.5 text-blue-600" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => setDeleteVoucherId(v._id)}
                              className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 dark:border-red-900/50 cursor-pointer"
                              title="Delete Voucher"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CREATE / EDIT CASH VOUCHER
      ────────────────────────────────────────────────────────────── */}
      {showVoucherModal && (
        <Modal
          title={editingVoucherId ? "Edit Cash Voucher" : "Issue New Cash Voucher (रोकड व्हाउचर)"}
          onClose={() => setShowVoucherModal(false)}
        >
          <div className="space-y-4 text-xs">
            {/* Registered Vendor Picker */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Select Registered Vendor / Supplier
              </label>
              <select
                value={voucherForm.supplierId}
                onChange={(e) => handleVoucherVendorSelect(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-blue-500"
              >
                <option value="">-- Choose Vendor or Type Custom Below --</option>
                {supplierList.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} (Bal: {fmt(s.balance || 0)})
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Payee Name & Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Vendor / Payee Name *
                </label>
                <input
                  type="text"
                  value={voucherForm.supplierName}
                  onChange={(e) =>
                    setVoucherForm((f) => ({ ...f, supplierName: e.target.value }))
                  }
                  placeholder="e.g. Acme Transport / Rajesh"
                  className="w-full p-2.5 border rounded-xl bg-white dark:bg-slate-900 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Number
                </label>
                <input
                  type="text"
                  value={voucherForm.vendorPhone}
                  onChange={(e) =>
                    setVoucherForm((f) => ({ ...f, vendorPhone: e.target.value }))
                  }
                  placeholder="10 digit phone"
                  className="w-full p-2.5 border rounded-xl bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
            </div>

            {/* Amount & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Disbursed Amount (₹) *
                </label>
                <input
                  type="number"
                  value={voucherForm.amount}
                  onChange={(e) =>
                    setVoucherForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  placeholder="0.00"
                  className="w-full p-2.5 border rounded-xl bg-white dark:bg-slate-900 text-xs font-mono font-bold text-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Voucher Date
                </label>
                <input
                  type="date"
                  value={voucherForm.voucherDate}
                  onChange={(e) =>
                    setVoucherForm((f) => ({ ...f, voucherDate: e.target.value }))
                  }
                  className="w-full p-2.5 border rounded-xl bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
            </div>

            {/* Amount in words preview */}
            {voucherForm.amount && Number(voucherForm.amount) > 0 && (
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                <span className="font-bold text-[10px] uppercase tracking-wider block">
                  Amount in Words:
                </span>
                <span className="italic font-semibold text-xs">
                  {numberToWordsIndian(Number(voucherForm.amount))}
                </span>
              </div>
            )}

            {/* Account Head & Payment Mode */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Debit Account Head
                </label>
                <select
                  value={voucherForm.accountHead}
                  onChange={(e) =>
                    setVoucherForm((f) => ({ ...f, accountHead: e.target.value }))
                  }
                  className="w-full p-2.5 border rounded-xl bg-white dark:bg-slate-900 text-xs"
                >
                  {ACCOUNT_HEADS.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Mode
                </label>
                <select
                  value={voucherForm.paymentMode}
                  onChange={(e) =>
                    setVoucherForm((f) => ({ ...f, paymentMode: e.target.value }))
                  }
                  className="w-full p-2.5 border rounded-xl bg-white dark:bg-slate-900 text-xs"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reference No & Received By */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Bill / PO / Invoice Ref #
                </label>
                <input
                  type="text"
                  value={voucherForm.referenceNo}
                  onChange={(e) =>
                    setVoucherForm((f) => ({ ...f, referenceNo: e.target.value }))
                  }
                  placeholder="e.g. BILL-9921 / PO-004"
                  className="w-full p-2.5 border rounded-xl bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Receiver's Name
                </label>
                <input
                  type="text"
                  value={voucherForm.receivedBy}
                  onChange={(e) =>
                    setVoucherForm((f) => ({ ...f, receivedBy: e.target.value }))
                  }
                  placeholder="e.g. Driver / Sales Rep"
                  className="w-full p-2.5 border rounded-xl bg-white dark:bg-slate-900 text-xs"
                />
              </div>
            </div>

            {/* Narration / Purpose */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Narration / Purpose of Payment
              </label>
              <textarea
                rows={2}
                value={voucherForm.narration}
                onChange={(e) =>
                  setVoucherForm((f) => ({ ...f, narration: e.target.value }))
                }
                placeholder="e.g. Advance cash payment for raw materials delivery..."
                className="w-full p-2.5 border rounded-xl bg-white dark:bg-slate-900 text-xs"
              />
            </div>

            {/* Balance Adjustment Toggle */}
            {voucherForm.supplierId && (
              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    Auto-Adjust Vendor Balance
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Automatically subtract this voucher amount from the vendor's pending payable balance.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={voucherForm.adjustSupplierBalance}
                  onChange={(e) =>
                    setVoucherForm((f) => ({
                      ...f,
                      adjustSupplierBalance: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                />
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex gap-3 pt-2">
              <Btn
                variant="outline"
                onClick={() => setShowVoucherModal(false)}
                className="flex-1 justify-center"
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                onClick={handleSaveCashVoucher}
                disabled={submittingVoucher}
                className="flex-1 justify-center"
              >
                {submittingVoucher ? "Saving..." : "Issue Cash Voucher"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: PRINTABLE CASH VOUCHER SLIP
      ────────────────────────────────────────────────────────────── */}
      {viewVoucherSlip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95">
            {/* Modal Top Toolbar */}
            <div className="p-4 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Cash Voucher: {viewVoucherSlip.voucherNo}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintVoucher}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Voucher</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewVoucherSlip(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Paper Canvas */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-950 flex justify-center items-start">
              <div
                id="printable-cash-voucher-slip"
                className="w-full bg-white text-slate-900 p-8 rounded-xl border-2 border-slate-800 shadow-lg text-xs"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {/* Voucher Header */}
                <div className="flex justify-between items-start pb-4 mb-4 border-b-2 border-slate-800">
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                      {businessInfo.businessName || businessInfo.name || "SMARTBILL ENTERPRISE"}
                    </h1>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                      {businessInfo.address || "Main Commercial Center"}, {businessInfo.city || "Mumbai"} - {businessInfo.pincode || "400001"}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      <strong>Phone:</strong> {businessInfo.phone || "+91 98765 43210"} &bull; <strong>GSTIN:</strong> {businessInfo.gstin || "27ABCDE1234F1Z5"}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded">
                      CASH PAYMENT VOUCHER
                    </span>
                    <p className="font-mono font-bold text-sm text-slate-900 mt-2">
                      No: {viewVoucherSlip.voucherNo}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5 font-medium">
                      Date: {new Date(viewVoucherSlip.voucherDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                {/* Paid To & Account Info */}
                <div className="grid grid-cols-2 gap-4 pb-4 mb-4 border-b border-slate-200">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      Paid To (Vendor / Payee):
                    </p>
                    <p className="font-extrabold text-sm text-slate-900">
                      {viewVoucherSlip.supplierName}
                    </p>
                    {viewVoucherSlip.vendorPhone && (
                      <p className="text-[11px] text-slate-600">
                        Phone: <span className="font-mono">{viewVoucherSlip.vendorPhone}</span>
                      </p>
                    )}
                  </div>

                  <div className="text-right space-y-1">
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      Debit Account Head:
                    </p>
                    <p className="font-bold text-xs text-slate-900">
                      {viewVoucherSlip.accountHead}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Payment Mode: <strong>{viewVoucherSlip.paymentMode}</strong>
                      {viewVoucherSlip.referenceNo && ` (Ref: #${viewVoucherSlip.referenceNo})`}
                    </p>
                  </div>
                </div>

                {/* Amount Table */}
                <div className="mb-4">
                  <table className="w-full text-left border-collapse border border-slate-800 text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                        <th className="p-2.5 border-r border-slate-800">Particulars / Narration</th>
                        <th className="p-2.5 text-right w-36">Amount (INR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-3 border-r border-slate-800 align-top leading-relaxed">
                          <p className="font-semibold text-slate-900">
                            Being payment made towards {viewVoucherSlip.accountHead.toLowerCase()}
                          </p>
                          {viewVoucherSlip.narration && (
                            <p className="text-slate-600 mt-1 italic">
                              "{viewVoucherSlip.narration}"
                            </p>
                          )}
                          {viewVoucherSlip.referenceNo && (
                            <p className="text-[11px] text-slate-500 font-mono mt-1">
                              Bill / Ref Reference: {viewVoucherSlip.referenceNo}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-sm text-slate-900 align-top">
                          {fmt(viewVoucherSlip.amount)}
                        </td>
                      </tr>
                      <tr className="border-t-2 border-slate-800 bg-slate-50 font-bold">
                        <td className="p-2.5 border-r border-slate-800 text-right uppercase tracking-wider text-slate-700">
                          Total Amount Paid:
                        </td>
                        <td className="p-2.5 text-right font-mono text-base font-black text-slate-900">
                          {fmt(viewVoucherSlip.amount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Amount in words */}
                <div className="p-3 rounded bg-slate-50 border border-slate-300 mb-8">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                    Amount in Words:
                  </span>
                  <span className="font-bold text-xs italic text-slate-900">
                    {numberToWordsIndian(viewVoucherSlip.amount)}
                  </span>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-4 gap-4 text-center pt-6 border-t border-slate-300 text-[11px]">
                  <div>
                    <div className="h-10 border-b border-dashed border-slate-400 mb-1"></div>
                    <p className="font-bold text-slate-800">Prepared By</p>
                    <p className="text-[10px] text-slate-400 font-mono">{viewVoucherSlip.paidBy || "Cashier"}</p>
                  </div>
                  <div>
                    <div className="h-10 border-b border-dashed border-slate-400 mb-1"></div>
                    <p className="font-bold text-slate-800">Checked By</p>
                    <p className="text-[10px] text-slate-400">Accountant</p>
                  </div>
                  <div>
                    <div className="h-10 border-b border-dashed border-slate-400 mb-1"></div>
                    <p className="font-bold text-slate-800">Authorized Signatory</p>
                    <p className="text-[10px] text-slate-400">Manager</p>
                  </div>
                  <div>
                    <div className="h-10 border-b border-dashed border-slate-400 mb-1"></div>
                    <p className="font-bold text-slate-800">Receiver's Sign</p>
                    <p className="text-[10px] text-slate-400 font-mono">{viewVoucherSlip.receivedBy || "Payee"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Suppliers */}
      {deleteId !== null && (
        <ConfirmDialog
          message="This will permanently delete the supplier from your directory."
          onConfirm={async () => {
            try {
              await deleteSupplier(deleteId);
              await loadSuppliers();
              setDeleteId(null);
              showToast("Supplier deleted successfully!");
            } catch (err) {
              console.error(err);
              showToast("Failed to delete supplier.", "error");
            }
          }}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {/* Delete Confirmation Modal for Vouchers */}
      {deleteVoucherId !== null && (
        <ConfirmDialog
          message="This will permanently delete this Cash Voucher and revert any supplier balance adjustment."
          onConfirm={async () => {
            try {
              await deleteCashVoucher(deleteVoucherId);
              await Promise.all([loadCashVouchers(), loadSuppliers()]);
              setDeleteVoucherId(null);
              showToast("Cash Voucher deleted successfully!");
            } catch (err) {
              console.error(err);
              showToast("Failed to delete voucher.", "error");
            }
          }}
          onCancel={() => setDeleteVoucherId(null)}
        />
      )}

      {/* View Supplier Details Modal */}
      {viewSupplier && (
        <Modal title="Supplier Profile Details" onClose={() => setViewSupplier(null)}>
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Firm / Vendor Name
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {viewSupplier.name}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Contact Person</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{viewSupplier.contact || "—"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Phone Number</p>
                <p className="mt-1 text-sm font-mono font-bold text-slate-800">{viewSupplier.phone || "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Email</p>
                <p className="mt-1 text-sm text-slate-700">{viewSupplier.email || "—"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">GST Number</p>
                <p className="mt-1 text-sm font-mono font-bold text-slate-800">{viewSupplier.gst || "—"}</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3.5">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Outstanding Balance Due</p>
              <p className="mt-1 text-lg font-mono font-extrabold text-red-600">
                {fmt(viewSupplier.balance || 0)}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Supplier Modal */}
      {showEditModal && editId !== null && (
        <Modal
          title="Edit Supplier"
          onClose={() => {
            setShowEditModal(false);
            setEditId(null);
          }}
        >
          <div className="space-y-4 text-xs">
            <Input
              label="Firm Name"
              value={editForm.name}
              onChange={(v) => setEditForm((f) => ({ ...f, name: v }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Contact Person"
                value={editForm.contact}
                onChange={(v) => setEditForm((f) => ({ ...f, contact: v }))}
              />
              <div>
                <Input
                  label="Phone"
                  icon={<Phone className="w-4 h-4" />}
                  value={editForm.phone}
                  onChange={(v) => {
                    const digitsOnly = String(v ?? "").replace(/\D/g, "").slice(0, 10);
                    setEditForm((f) => ({ ...f, phone: digitsOnly }));
                    setEditPhoneError(validateSupplierPhone(digitsOnly));
                  }}
                  error={editPhoneError}
                />
              </div>
            </div>
            <Input
              label="Email"
              icon={<Mail className="w-4 h-4" />}
              value={editForm.email}
              onChange={(v) => setEditForm((f) => ({ ...f, email: v }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="City"
                value={editForm.city}
                onChange={(v) => setEditForm((f) => ({ ...f, city: v }))}
              />
              <Input
                label="GST Number"
                value={editForm.gst}
                onChange={(v) => setEditForm((f) => ({ ...f, gst: v }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                Address
              </label>
              <textarea
                rows={3}
                value={editForm.address}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, address: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Btn
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  setEditId(null);
                }}
                className="flex-1 justify-center"
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                onClick={async () => {
                  const nextPhoneError = validateSupplierPhone(editForm.phone);
                  setEditPhoneError(nextPhoneError);
                  if (nextPhoneError) return;

                  try {
                    await updateSupplier(editId, editForm);
                    await loadSuppliers();
                    setShowEditModal(false);
                    setEditId(null);
                    showToast("Supplier updated successfully!");
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="flex-1 justify-center"
              >
                Save Changes
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Supplier Modal */}
      {showModal && (
        <Modal title="Add New Supplier" onClose={() => setShowModal(false)}>
          <div className="space-y-4 text-xs">
            <Input
              label="Firm Name *"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Contact Person"
                value={form.contact}
                onChange={(v) => setForm((f) => ({ ...f, contact: v }))}
              />
              <div>
                <Input
                  label="Phone *"
                  icon={<Phone className="w-4 h-4" />}
                  value={form.phone}
                  onChange={(v) => {
                    const digitsOnly = String(v ?? "").replace(/\D/g, "").slice(0, 10);
                    setForm((f) => ({ ...f, phone: digitsOnly }));
                    setFormPhoneError(validateSupplierPhone(digitsOnly));
                  }}
                  error={formPhoneError}
                />
              </div>
            </div>
            <Input
              label="Email"
              icon={<Mail className="w-4 h-4" />}
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="City"
                value={form.city}
                onChange={(v) => setForm((f) => ({ ...f, city: v }))}
              />
              <Input
                label="GST Number"
                value={form.gst}
                onChange={(v) => setForm((f) => ({ ...f, gst: v }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                Address
              </label>
              <textarea
                rows={3}
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Btn
                variant="outline"
                onClick={() => setShowModal(false)}
                className="flex-1 justify-center"
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                onClick={async () => {
                  const nextPhoneError = validateSupplierPhone(form.phone);
                  setFormPhoneError(nextPhoneError);
                  if (nextPhoneError) return;

                  try {
                    await createSupplier(form);
                    await loadSuppliers();
                    setShowModal(false);
                    setForm({
                      name: "",
                      contact: "",
                      phone: "",
                      email: "",
                      city: "",
                      address: "",
                      gst: "",
                      balanceDue: "0",
                    });
                    setFormPhoneError("");
                    showToast("Supplier added successfully!");
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="flex-1 justify-center"
              >
                Save Supplier
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
