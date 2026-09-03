import { useEffect, useState } from "react";
import {
  Download,
  Edit2,
  Eye,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
  FileText,
  IndianRupee,
  CheckCircle2,
  Clock,
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
  Select,
  Toast,
  Badge,
  statusBadge,
} from "@shared/components/common/ui";
import {
  fetchCustomers,
  fetchCustomerDetails,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@shared/api/customerAPI";
import { fetchOrder } from "@shared/api/orderAPI";
import { fetchPartySettings } from "@shared/api/partySettingsAPI";
import { exportToCsv } from "@shared/utils/csvHelper";

export default function CustomersScreen() {
  // =========================
  // STATE
  // =========================

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [viewCustomer, setViewCustomer] = useState(null);
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customerList, setCustomerList] = useState([]);
  const [businessType, setBusinessType] = useState("Retail");

  // Party Settings state
  const [partySettings, setPartySettings] = useState({
    enableGrouping: false,
    trackBalance: false,
    shippingAddress: true,
  });

  // Customer details panel (clicked from name)
  const [detailsCustomer, setDetailsCustomer] = useState(null);
  const [detailsData, setDetailsData] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Invoice view modal (clicked from invoice number)
  const [invoiceModal, setInvoiceModal] = useState(null);   // { order } or { loading: true }

  const initialFormState = {
    name: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    shippingAddress: "",
    category: "Retailer",
    creditLimit: "0",
    gst: "",
    openingBalance: "0",
  };

  const [form, setForm] = useState(initialFormState);
  const [editForm, setEditForm] = useState(initialFormState);

  // Determine if owner is Wholesale
  const isWholesale = String(businessType ?? "").toLowerCase() === "wholesale";

  // =========================
  // TOAST
  // =========================

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Load business type from stored user.
  useEffect(() => {
    const rawUser = localStorage.getItem("smartbill_user");
    if (rawUser) {
      try {
        const user = JSON.parse(rawUser);
        if (user?.businessType) {
          setBusinessType(String(user.businessType).trim());
        }
      } catch (err) {
        console.warn("Unable to parse stored user:", err);
      }
    }
  }, []);

  // Load party settings from backend & listen to update events
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetchPartySettings();
        if (res?.partySettings) {
          setPartySettings(res.partySettings);
        }
      } catch (err) {
        console.warn("Failed to load party settings:", err);
      }
    };
    loadSettings();

    const handleSettingsUpdated = (e) => {
      if (e.detail) {
        setPartySettings(e.detail);
      }
    };
    window.addEventListener("partySettingsUpdated", handleSettingsUpdated);
    return () => window.removeEventListener("partySettingsUpdated", handleSettingsUpdated);
  }, []);

  // =========================
  // LOAD CUSTOMERS
  // =========================

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        setLoading(true);
        const response = await fetchCustomers();

        const customers = Array.isArray(response)
          ? response
          : response?.customers || [];

        setCustomerList(customers);
      } catch (error) {
        console.error("LOAD CUSTOMERS ERROR:", error);
        showToast(
          error?.message || "Unable to load customers.",
          "error"
        );
        setCustomerList([]);
      } finally {
        setLoading(false);
      }
    };

    loadCustomers();
  }, []);

  // =========================
  // FILTER CUSTOMERS
  // =========================

  const filtered = customerList.filter((customer) => {
    const name = String(customer?.name || "").toLowerCase();
    const city = String(customer?.city || "").toLowerCase();
    const phone = String(customer?.phone || "").toLowerCase();
    const email = String(customer?.email || "").toLowerCase();
    const searchText = search.toLowerCase();

    return (
      name.includes(searchText) ||
      city.includes(searchText) ||
      phone.includes(searchText) ||
      email.includes(searchText)
    );
  });

  // =========================
  // SUMMARY CALCULATIONS
  // =========================

  const totalReceivable = customerList.reduce(
    (sum, customer) =>
      sum + Math.max(0, Number(customer?.balance || 0)),
    0
  );

  const totalPayable = customerList.reduce(
    (sum, customer) =>
      sum + Math.max(0, -Number(customer?.balance || 0)),
    0
  );

  // =========================
  // CREATE CUSTOMER
  // =========================

  const handleCreate = async () => {
    if (!form.name?.trim()) {
      showToast(isWholesale ? "Business name is required" : "Customer name is required", "error");
      return;
    }

    try {
      const response = await createCustomer({
        name: form.name,
        phone: form.phone,
        email: form.email,
        city: form.city,
        address: form.address,
        shippingAddress: partySettings.shippingAddress ? form.shippingAddress : "",
        category: partySettings.enableGrouping ? form.category : "Retailer",
        creditLimit: partySettings.trackBalance ? Number(form.creditLimit || 0) : 0,
        gst: isWholesale ? form.gst : "",
        openingBalance: isWholesale ? Number(form.openingBalance || 0) : 0,
      });

      const createdCustomer = response?.customer || response;

      setCustomerList((prev) => [createdCustomer, ...prev]);
      setShowModal(false);
      setForm(initialFormState);
      showToast("Customer added successfully", "success");
    } catch (error) {
      console.error("CREATE CUSTOMER ERROR:", error);
      showToast(error?.message || "Failed to add customer", "error");
    }
  };

  // =========================
  // UPDATE CUSTOMER
  // =========================

  const handleUpdate = async () => {
    if (!editForm.name?.trim()) {
      showToast(isWholesale ? "Business name is required" : "Customer name is required", "error");
      return;
    }

    try {
      const response = await updateCustomer(editId, {
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email,
        city: editForm.city,
        address: editForm.address,
        shippingAddress: partySettings.shippingAddress ? editForm.shippingAddress : "",
        category: partySettings.enableGrouping ? editForm.category : "Retailer",
        creditLimit: partySettings.trackBalance ? Number(editForm.creditLimit || 0) : 0,
        gst: isWholesale ? editForm.gst : "",
      });

      const updatedCustomer = response?.customer || response;

      setCustomerList((prev) =>
        prev.map((customer) =>
          String(customer._id || customer.id) === String(editId)
            ? updatedCustomer
            : customer
        )
      );

      setShowEditModal(false);
      setEditId(null);
      setEditForm(initialFormState);
      showToast("Customer updated successfully", "success");
    } catch (error) {
      console.error("UPDATE CUSTOMER ERROR:", error);
      showToast(error?.message || "Failed to update customer", "error");
    }
  };

  // =========================
  // DELETE CUSTOMER
  // =========================

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await deleteCustomer(deleteId);
      setCustomerList((prev) =>
        prev.filter(
          (customer) =>
            String(customer._id || customer.id) !== String(deleteId)
        )
      );
      setDeleteId(null);
      showToast("Customer deleted successfully", "success");
    } catch (error) {
      console.error("DELETE CUSTOMER ERROR:", error);
      setDeleteId(null);
      showToast(error?.message || "Failed to delete customer", "error");
    }
  };

  // =========================
  // OPEN EDIT MODAL
  // =========================

  const handleEdit = (customer) => {
    setEditId(customer._id || customer.id);
    setEditForm({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      city: customer.city || "",
      address: customer.address || "",
      shippingAddress: customer.shippingAddress || "",
      category: customer.category || "Retailer",
      creditLimit: String(customer.creditLimit ?? 0),
      gst: customer.gst || "",
      openingBalance: String(customer.balance ?? 0),
    });
    setShowEditModal(true);
  };

  const closeCreateModal = () => {
    setShowModal(false);
    setForm(initialFormState);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditId(null);
  };

  // =========================
  // OPEN CUSTOMER DETAILS
  // =========================

  const handleOpenDetails = async (customer) => {
    setDetailsCustomer(customer);
    setDetailsData(null);
    setDetailsLoading(true);
    try {
      const customerId = customer._id || customer.id;
      const data = await fetchCustomerDetails(customerId);
      setDetailsData(data);
    } catch (error) {
      console.error("FETCH CUSTOMER DETAILS ERROR:", error);
      showToast(error?.message || "Failed to load customer details", "error");
      setDetailsCustomer(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailsCustomer(null);
    setDetailsData(null);
    setInvoiceModal(null);
  };

  // =========================
  // OPEN INVOICE VIEW
  // =========================

  const handleOpenInvoice = async (orderId) => {
    setInvoiceModal({ loading: true });
    try {
      const data = await fetchOrder(orderId);
      const order = data?.order || data;
      setInvoiceModal({ order });
    } catch (error) {
      console.error("FETCH ORDER ERROR:", error);
      showToast(error?.message || "Failed to load invoice", "error");
      setInvoiceModal(null);
    }
  };

  // =========================
  // EXPORT CUSTOMERS
  // =========================
  const handleExportCustomers = () => {
    if (customerList.length === 0) {
      showToast("No customers available to export.", "error");
      return;
    }
    const columns = [
      { key: "name", label: "Customer Name" },
      { key: "phone", label: "Phone Number" },
      { key: "email", label: "Email" },
      { key: "city", label: "City" },
      { key: "address", label: "Billing Address" },
      { key: "shippingAddress", label: "Shipping Address" },
      { key: "category", label: "Category" },
      { key: "gst", label: "GST Number" },
      { key: "creditLimit", label: "Credit Limit (₹)" },
      { key: "balance", label: "Balance (₹)" },
      { key: "invoices", label: "Total Invoices" },
    ];
    exportToCsv("SmartBill_Customers.csv", columns, customerList);
    showToast(`Exported ${customerList.length} customers successfully!`, "success");
  };

  // =========================
  // UI RENDER
  // =========================

  return (
    <div className="space-y-5">

      {/* =========================
          CUSTOMER CLICKED – DETAILED MODAL
      ========================= */}
      {detailsCustomer && (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-0 bg-black/40 backdrop-blur-sm">
          <div
            className="relative bg-white h-full w-full max-w-2xl shadow-2xl flex flex-col"
            style={{ animation: "slideInRight 0.25s ease" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700">
              <div>
                <h2 className="text-lg font-bold text-white">{detailsCustomer.name}</h2>
                {detailsCustomer.phone && (
                  <p className="text-blue-200 text-sm mt-0.5">{detailsCustomer.phone}</p>
                )}
              </div>
              <button
                onClick={closeDetails}
                className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailsLoading ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                  <p className="text-sm text-slate-500">Loading customer details...</p>
                </div>
              ) : detailsData ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                          <IndianRupee className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Value</p>
                      </div>
                      <p className="text-xl font-bold text-slate-900">
                        {fmt(detailsData.summary?.totalOrderValue ?? 0)}
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 bg-emerald-200 rounded-lg flex items-center justify-center">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        </div>
                        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Total Paid</p>
                      </div>
                      <p className="text-xl font-bold text-emerald-700">
                        {fmt(detailsData.summary?.totalPaidValue ?? 0)}
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl p-4 border border-rose-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 bg-rose-200 rounded-lg flex items-center justify-center">
                          <Clock className="w-3.5 h-3.5 text-rose-700" />
                        </div>
                        <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide">Left to Pay</p>
                      </div>
                      <p className="text-xl font-bold text-rose-700">
                        {fmt(detailsData.summary?.amountLeftToBePaid ?? 0)}
                      </p>
                    </div>
                  </div>

                  {/* Invoices / Orders Table */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <h3 className="text-sm font-semibold text-slate-700">
                        Invoices
                        <span className="ml-1.5 text-xs font-normal text-slate-400">
                          ({detailsData.summary?.invoicesCount ?? 0})
                        </span>
                      </h3>
                    </div>

                    {(!detailsData.orders || detailsData.orders.length === 0) ? (
                      <div className="rounded-xl border border-slate-200 py-12 flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-3 text-slate-400">
                          <FileText className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-medium text-slate-600">No invoices yet</p>
                        <p className="text-xs text-slate-400 mt-1">Invoices for this customer will appear here</p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              {["Invoice #", "Date", "Total", "Paid", "Balance", "Status"].map((h) => (
                                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {detailsData.orders.map((order) => {
                              const orderId = order._id || order.id;
                              const balanceDue = Number(order.balanceDue ?? 0);
                              const amtPaid = Number(order.amountPaid ?? 0);
                              const total = Number(order.totalOrderValue ?? 0);
                              const invoiceNo = order.invoiceNumber || order.orderNumber || `#${String(orderId).slice(-6).toUpperCase()}`;
                              const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                              const status = order.paymentStatus || (balanceDue <= 0 ? "Paid" : balanceDue < total ? "Partial" : "Pending");

                              return (
                                <tr key={orderId} className="hover:bg-blue-50/50 transition-colors">
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => handleOpenInvoice(orderId)}
                                      className="font-mono text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline underline-offset-2 transition-colors"
                                    >
                                      {invoiceNo}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 text-slate-500 text-xs">{createdAt}</td>
                                  <td className="px-4 py-3 font-medium text-slate-900">{fmt(total)}</td>
                                  <td className="px-4 py-3 text-emerald-700 font-medium">{fmt(amtPaid)}</td>
                                  <td className="px-4 py-3 text-rose-600 font-semibold">{fmt(balanceDue)}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      status === "Paid" ? "bg-emerald-100 text-emerald-700" :
                                      status === "Partial" ? "bg-amber-100 text-amber-700" :
                                      "bg-rose-100 text-rose-700"
                                    }`}>
                                      {status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* ========================= INVOICE VIEW OVERLAY ========================= */}
            {invoiceModal && (
              <div className="absolute inset-0 z-10 bg-white flex flex-col" style={{ animation: "slideInRight 0.2s ease" }}>
                {/* Invoice header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <button
                    onClick={() => setInvoiceModal(null)}
                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to invoices
                  </button>
                  {!invoiceModal.loading && (
                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Print
                    </button>
                  )}
                </div>

                {/* Invoice body */}
                <div className="flex-1 overflow-y-auto p-6">
                  {invoiceModal.loading ? (
                    <div className="flex flex-col items-center justify-center py-24">
                      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                      <p className="text-sm text-slate-500">Loading invoice...</p>
                    </div>
                  ) : invoiceModal.order ? (() => {
                    const inv = invoiceModal.order;
                    const invDate = inv.date
                      ? new Date(inv.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                      : new Date().toLocaleDateString("en-IN");
                    const invStatus = inv.status || (inv.balanceDue <= 0 ? "Paid" : inv.balanceDue < inv.totalOrderValue ? "Partial" : "Due");

                    return (
                      <div className="max-w-lg mx-auto">
                        {/* Invoice header block */}
                        <div className="flex items-start justify-between mb-8">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                                <FileText className="w-3.5 h-3.5 text-white" />
                              </div>
                              <span className="font-bold text-slate-900">SmartBill</span>
                            </div>
                            <p className="text-xs text-slate-500">Invoice generated by SmartBill</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-blue-600 font-mono text-lg">{inv.invoiceNo || "—"}</p>
                            <p className="text-xs text-slate-500 mt-0.5">Date: {invDate}</p>
                            <span className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              invStatus === "Paid" ? "bg-emerald-100 text-emerald-700" :
                              invStatus === "Partial" ? "bg-amber-100 text-amber-700" :
                              "bg-rose-100 text-rose-700"
                            }`}>
                              {invStatus}
                            </span>
                          </div>
                        </div>

                        {/* Bill To */}
                        <div className="mb-5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <p className="text-xs text-slate-500 mb-0.5">Bill To</p>
                          <p className="font-semibold text-slate-900">{inv.customerName || detailsCustomer?.name || "—"}</p>
                          {inv.paymentMode && (
                            <p className="text-xs text-slate-400 mt-0.5">Payment: {inv.paymentMode}</p>
                          )}
                        </div>

                        {/* Items table */}
                        <table className="w-full text-sm mb-6">
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className="text-left pb-2 text-xs font-semibold text-slate-500">Item</th>
                              <th className="text-center pb-2 text-xs font-semibold text-slate-500">Qty</th>
                              <th className="text-right pb-2 text-xs font-semibold text-slate-500">Rate</th>
                              <th className="text-right pb-2 text-xs font-semibold text-slate-500">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(inv.items || []).map((item, idx) => (
                              <tr key={idx}>
                                <td className="py-2.5 text-slate-800">
                                  {item.name}
                                  {item.sku && <span className="block text-[10px] text-slate-400 font-mono">{item.sku}</span>}
                                </td>
                                <td className="py-2.5 text-center text-slate-600">{item.qty}</td>
                                <td className="py-2.5 text-right font-mono text-slate-700">{fmt(item.price)}</td>
                                <td className="py-2.5 text-right font-mono font-semibold text-slate-900">{fmt(item.amount ?? item.price * item.qty)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Totals */}
                        <div className="flex justify-end">
                          <div className="w-56 space-y-2 text-sm">
                            {inv.subtotal != null && (
                              <div className="flex justify-between text-slate-600">
                                <span>Subtotal</span>
                                <span className="font-mono">{fmt(inv.subtotal)}</span>
                              </div>
                            )}
                            {inv.gst != null && inv.gst > 0 && (
                              <div className="flex justify-between text-slate-600">
                                <span>GST ({inv.gstRate ?? 0}%)</span>
                                <span className="font-mono">+{fmt(inv.gst)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-200 pt-2 mt-2">
                              <span>Total</span>
                              <span className="font-mono text-blue-600">{fmt(inv.totalOrderValue)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Amount Paid</span>
                              <span className="font-mono text-emerald-600">{fmt(inv.amountPaid)}</span>
                            </div>
                            <div className="flex justify-between font-semibold">
                              <span>Balance Due</span>
                              <span className={`font-mono ${Number(inv.balanceDue) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                {fmt(inv.balanceDue)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-8 pt-4 border-t border-slate-100 text-center">
                          <p className="text-xs text-slate-400">Thank you for your business!</p>
                        </div>
                      </div>
                    );
                  })() : null}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================
          CUSTOMER DETAILS MODAL (eye icon)
      ========================= */}
      {viewCustomer && (
        <Modal title="Customer Details" onClose={() => setViewCustomer(null)}>
          <div className="space-y-5">
            <div>
              <p className="text-lg font-semibold text-slate-900">
                {viewCustomer.name}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Phone</p>
                <p className="text-sm text-slate-900">
                  {viewCustomer.phone || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">Email</p>
                <p className="text-sm text-slate-900">
                  {viewCustomer.email || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">City</p>
                <p className="text-sm text-slate-900">
                  {viewCustomer.city || "—"}
                </p>
              </div>

              {viewCustomer.address && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Billing Address</p>
                  <p className="text-sm text-slate-900">
                    {viewCustomer.address}
                  </p>
                </div>
              )}

              {partySettings.shippingAddress && viewCustomer.shippingAddress && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Shipping Address</p>
                  <p className="text-sm text-slate-900">
                    {viewCustomer.shippingAddress}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-slate-500 mb-1">Balance</p>
                <p className="text-sm font-semibold text-slate-900">
                  {fmt(Math.abs(Number(viewCustomer.balance || 0)))}
                  {Number(viewCustomer.balance) > 0
                    ? " (To Receive)"
                    : Number(viewCustomer.balance) < 0
                    ? " (To Pay)"
                    : " (Balanced)"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">Invoices</p>
                <p className="text-sm text-slate-900">
                  {viewCustomer.invoices ?? 0}
                </p>
              </div>

              {isWholesale && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">GST Number</p>
                  <p className="text-sm text-slate-900">
                    {viewCustomer.gst || "—"}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Btn variant="outline" onClick={() => setViewCustomer(null)}>
                Close
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================
          EDIT CUSTOMER MODAL
      ========================= */}
      {showEditModal && editId !== null && (
        <Modal title="Edit Customer" onClose={closeEditModal}>
          <div className="space-y-4">
            <Input
              label={isWholesale ? "Business Name" : "Customer Name"}
              value={editForm.name}
              onChange={(value) =>
                setEditForm((f) => ({ ...f, name: value }))
              }
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Phone"
                icon={<Phone className="w-4 h-4" />}
                value={editForm.phone}
                onChange={(value) =>
                  setEditForm((f) => ({ ...f, phone: value }))
                }
              />
              <Input
                label="Email"
                icon={<Mail className="w-4 h-4" />}
                value={editForm.email}
                onChange={(value) =>
                  setEditForm((f) => ({ ...f, email: value }))
                }
              />
            </div>

            <Input
              label="City"
              icon={<MapPin className="w-4 h-4" />}
              value={editForm.city}
              onChange={(value) =>
                setEditForm((f) => ({ ...f, city: value }))
              }
            />

            {isWholesale && (
              <Input
                label="GST Number"
                value={editForm.gst}
                onChange={(value) =>
                  setEditForm((f) => ({ ...f, gst: value }))
                }
              />
            )}

            <div className="flex gap-3 pt-2">
              <Btn
                variant="outline"
                onClick={closeEditModal}
                className="flex-1 justify-center"
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                onClick={handleUpdate}
                className="flex-1 justify-center"
              >
                Save Changes
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================
          ADD CUSTOMER MODAL
      ========================= */}
      {showModal && (
        <Modal title="Add New Customer" onClose={closeCreateModal}>
          <div className="space-y-4">
            <Input
              label={isWholesale ? "Business Name" : "Customer Name"}
              value={form.name}
              onChange={(value) =>
                setForm((f) => ({ ...f, name: value }))
              }
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Phone"
                icon={<Phone className="w-4 h-4" />}
                value={form.phone}
                onChange={(value) =>
                  setForm((f) => ({ ...f, phone: value }))
                }
              />
              <Input
                label="Email"
                icon={<Mail className="w-4 h-4" />}
                value={form.email}
                onChange={(value) =>
                  setForm((f) => ({ ...f, email: value }))
                }
              />
            </div>

            <Input
              label="City"
              icon={<MapPin className="w-4 h-4" />}
              value={form.city}
              onChange={(value) =>
                setForm((f) => ({ ...f, city: value }))
              }
            />

            {isWholesale && (
              <>
                <Input
                  label="GST Number"
                  value={form.gst}
                  onChange={(value) =>
                    setForm((f) => ({ ...f, gst: value }))
                  }
                />
              </>
            )}

            <div className="flex gap-3 pt-2">
              <Btn
                variant="outline"
                onClick={closeCreateModal}
                className="flex-1 justify-center"
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                onClick={handleCreate}
                className="flex-1 justify-center"
              >
                Save Customer
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================
          DELETE CONFIRMATION
      ========================= */}
      {deleteId && (
        <ConfirmDialog
          message="This will permanently delete this customer. This action cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {/* =========================
          SEARCH + BUTTONS
      ========================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-3">
          <Input
            value={search}
            onChange={setSearch}
            icon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="flex items-center gap-2">
          <Btn
            variant="outline"
            size="md"
            onClick={handleExportCustomers}
            icon={<Download className="w-4 h-4" />}
          >
            Export CSV
          </Btn>

          <Btn
            variant="primary"
            size="md"
            onClick={() => setShowModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Add Customer
          </Btn>
        </div>
      </div>

      {/* =========================
          SUMMARY CARDS
      ========================= */}
      <div className="grid grid-cols-3 gap-4">
        {[
          [customerList.length, "Total Customers"],
          [fmtK(totalReceivable), "Total Receivable"],
          [fmtK(totalPayable), "Total Payable"],
        ].map(([value, label]) => (
          <Card key={label} className="p-4 text-center">
            <p className="text-xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

      {/* =========================
          CUSTOMER TABLE
      ========================= */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {[
                  isWholesale ? "Business" : "Customer Name",
                  "Email",
                  "Phone",
                  "City",
                  "Balance",
                  "Actions",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center">
                    <p className="text-sm text-slate-500">
                      Loading customers...
                    </p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8">
                    <EmptyState
                      icon={<Users className="w-6 h-6" />}
                      title="No customers found"
                      sub="Try adjusting your search query"
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((customer) => {
                  const customerId = customer._id || customer.id;
                  const balance = Number(customer.balance || 0);

                  return (
                    <tr
                      key={customerId}
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      {/* NAME – clickable */}
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleOpenDetails(customer)}
                          className="text-left group/name"
                        >
                          <p className="font-medium text-blue-600 hover:text-blue-800 hover:underline underline-offset-2 transition-colors cursor-pointer">
                            {customer.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {customer.invoices ?? 0} invoices
                          </p>
                        </button>
                      </td>

                      {/* EMAIL */}
                      <td className="px-5 py-4 text-slate-600">
                        {customer.email || "—"}
                      </td>

                      {/* PHONE */}
                      <td className="px-5 py-4 text-slate-600 font-mono text-xs">
                        {customer.phone || "—"}
                      </td>

                      {/* CITY */}
                      <td className="px-5 py-4 text-slate-600">
                        {customer.city || "—"}
                      </td>

                      {/* BALANCE */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span
                            className={`font-semibold font-mono text-sm ${
                              balance > 0
                                ? "text-emerald-600"
                                : balance < 0
                                ? "text-red-500"
                                : "text-slate-500"
                            }`}
                          >
                            {balance > 0 ? "+" : ""}
                            {fmt(Math.abs(balance))}
                          </span>
                          <p className="text-[10px] text-slate-400">
                            {balance > 0
                              ? "To Receive"
                              : balance < 0
                              ? "To Pay"
                              : "Balanced"}
                          </p>
                        </div>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">

                          <Btn
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleEdit(customer);
                            }}
                            icon={<Edit2 className="w-3.5 h-3.5" />}
                          />
                          <Btn
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteId(customerId);
                            }}
                            icon={
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* TABLE FOOTER */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Showing {filtered.length} of {customerList.length} customers
          </p>
        </div>
      </Card>

      {/* =========================
          TOAST
      ========================= */}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}



