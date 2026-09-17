import React, { useMemo, useState, useEffect } from "react";
import {
  Building,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Shield,
  KeyRound,
  ArrowUpDown,
  MoreHorizontal,
  Mail,
  Phone,
  MapPin,
  TrendingUp,
  Users as UsersIcon,
  Activity,
  CreditCard,
  Building2,
  MoreVertical,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@shared/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@shared/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@shared/components/ui/tabs";
import adminAPI from "@shared/api/adminAPI";
import { PERMISSION_CATEGORIES } from "../settings/components/UserPermissionsSettings";

const API_BASE = "http://localhost:5000/api";

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

function Badge({ label, variant }) {
  const styles = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    yellow: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    gray: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[variant] ?? styles.gray}`}
    >
      {label}
    </span>
  );
}

function statusToVariant(status) {
  switch (status) {
    case "Active":
      return "green";
    case "Pending":
      return "yellow";
    case "Suspended":
      return "red";
    default:
      return "gray";
  }
}

function planToVariant(plan) {
  switch (plan) {
    case "Enterprise":
      return "purple";
    case "Pro":
      return "blue";
    case "Starter":
      return "gray";
    default:
      return "gray";
  }
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-lg">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const CACHE_KEY = "smartbill_businesses_cache";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export default function BusinessesNew() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "joined", direction: "desc" });

  const [rows, setRows] = useState(() => {
    // Seed from cache immediately so refresh shows data instantly
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL_MS) return data;
      }
    } catch {}
    return [];
  });
  const hasCachedData = rows.length > 0;
  // `loading` = true only when we have NO data yet (full-page spinner)
  // `refreshing` = true when we have cached data but are fetching fresh copy in background
  const [loading, setLoading] = useState(!hasCachedData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendBusinessId, setSuspendBusinessId] = useState(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendReasonError, setSuspendReasonError] = useState("");

  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState({});
  const [grantingAccess, setGrantingAccess] = useState(false);
  const [accessMessage, setAccessMessage] = useState(null);

  const openAccessModal = (business) => {
    setSelectedBusiness(business);
    const existingPerms =
      business.permissions &&
      typeof business.permissions === "object" &&
      Object.keys(business.permissions).length > 0
        ? business.permissions
        : {
            dashboard: true,
            customers: true,
            suppliers: true,
            products: true,
            pos: true,
            purchase: true,
            inventory: true,
            expenses: true,
            reports: true,
            users: true,
            settings: true,
          };
    setSelectedPermissions({ ...existingPerms });
    setAccessMessage(null);
    setAccessModalOpen(true);
  };

  const toggleAccessPermission = (modKey) => {
    setSelectedPermissions((prev) => ({
      ...prev,
      [modKey]: !prev[modKey],
    }));
  };

  const handleGiveAccess = async () => {
    if (!selectedBusiness) return;
    setGrantingAccess(true);
    setAccessMessage(null);

    try {
      const bizId = selectedBusiness.id || selectedBusiness._id;
      const res = await adminAPI.grantBusinessAccess(
        bizId,
        selectedPermissions
      );

      const msg =
        res.message ||
        "Access granted successfully. Temporary password has been sent to the user's registered email.";
      const isSuccess = res.success !== false && !res.emailFailed;

      setAccessMessage({
        type: isSuccess ? "success" : "warning",
        text: msg,
      });

      // Update rows with new permissions
      setRows((prev) =>
        prev.map((b) =>
          b.id === bizId || b._id === bizId
            ? { ...b, permissions: { ...selectedPermissions } }
            : b
        )
      );

      if (isSuccess) {
        setTimeout(() => {
          setAccessModalOpen(false);
          setSelectedBusiness(null);
        }, 3000);
      }
    } catch (err) {
      console.error("Error granting business access:", err);
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        "Failed to grant access. Please try again.";
      setAccessMessage({ type: "error", text: errMsg });
    } finally {
      setGrantingAccess(false);
    }
  };

  const loadBusinesses = async (signal) => {
    const hasCached = rows.length > 0;
    try {
      if (hasCached) {
        setRefreshing(true);  // background refresh — keep showing existing rows
      } else {
        setLoading(true);     // no data at all — show full spinner
      }
      setError(null);

      const token = localStorage.getItem("smartbill_token");
      if (!token) {
        setError("Not logged in. Please log out and log back in.");
        return;
      }

      const response = await fetch(`${API_BASE}/admin/businesses`, {
        method: "GET",
        signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (signal?.aborted) return;

      const json = await response.json();

      if (!response.ok) {
        setError(`Server error ${response.status}: ${json.message || "Unknown error"}`);
        return;
      }

      const data = json.data || [];
      setRows(data);

      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
      } catch {}
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Error loading businesses:", err);
      setError(`Network error: ${err.message}. Check that backend is running on port 5000.`);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const handleRefresh = () => {
    // Clear cache and force fresh fetch
    try { sessionStorage.removeItem(CACHE_KEY); } catch {}
    const controller = new AbortController();
    loadBusinesses(controller.signal);
  };

  useEffect(() => {
    const controller = new AbortController();
    loadBusinesses(controller.signal);
    return () => controller.abort(); // Cleanup on unmount / StrictMode double-invoke
  }, []);

  const processedRows = useMemo(() => {
    // 1. Filter by Tab
    let filtered = rows;
    if (activeTab === "active") {
      filtered = rows.filter((r) => r.status === "Active");
    } else if (activeTab === "suspended") {
      filtered = rows.filter((r) => r.status === "Suspended");
    }

    // 2. Filter by Search
    const q = search.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((b) => {
        return (
          String(b.name ?? "").toLowerCase().includes(q) ||
          String(b.owner ?? "").toLowerCase().includes(q) ||
          String(b.ownerEmail ?? "").toLowerCase().includes(q) ||
          String(b.ownerPhone ?? "").toLowerCase().includes(q) ||
          String(b.plan ?? "").toLowerCase().includes(q) ||
          String(b.status ?? "").toLowerCase().includes(q) ||
          String(b.ownerCity ?? "").toLowerCase().includes(q)
        );
      });
    }

    // 3. Sort
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        if (sortConfig.key === "revenue" || sortConfig.key === "users") {
          valA = Number(valA || 0);
          valB = Number(valB || 0);
        } else if (sortConfig.key === "joined") {
          valA = new Date(valA).getTime();
          valB = new Date(valB).getTime();
        } else {
          valA = String(valA ?? "").toLowerCase();
          valB = String(valB ?? "").toLowerCase();
        }

        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [rows, search, activeTab, sortConfig]);

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const openSuspendModal = (businessId) => {
    setSuspendBusinessId(businessId);
    setSuspendReason("");
    setSuspendReasonError("");
    setSuspendModalOpen(true);
  };

  const confirmSuspend = async () => {
    const reason = suspendReason.trim();
    if (!reason) {
      setSuspendReasonError("Reason is required.");
      return;
    }
    if (reason.length > 500) {
      setSuspendReasonError("Reason is too long (max 500 characters).");
      return;
    }

    try {
      const token = localStorage.getItem("smartbill_token");
      const response = await fetch(`${API_BASE}/admin/businesses/${suspendBusinessId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "Suspended", reason }),
      });
      if (!response.ok) {
        const json = await response.json();
        setSuspendReasonError(json.message || "Failed to update business status.");
        return;
      }
      setRows((prev) =>
        prev.map((b) =>
          b.id === suspendBusinessId || b._id === suspendBusinessId
            ? { ...b, status: "Suspended", suspensionReason: reason }
            : b
        )
      );
      setSuspendModalOpen(false);
      setSuspendBusinessId(null);
    } catch (err) {
      setSuspendReasonError(err.message || "Failed to update business status.");
    }
  };

  const resumeBusiness = async (businessId) => {
    try {
      const token = localStorage.getItem("smartbill_token");
      const response = await fetch(`${API_BASE}/admin/businesses/${businessId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "Active", reason: "" }),
      });
      if (!response.ok) {
        const json = await response.json();
        alert(json.message || "Failed to reactivate business.");
        return;
      }
      setRows((prev) =>
        prev.map((b) =>
          b.id === businessId || b._id === businessId
            ? { ...b, status: "Active", suspensionReason: "" }
            : b
        )
      );
    } catch (err) {
      alert(err.message || "Failed to reactivate business.");
    }
  };

  return (
    <div className="p-6 space-y-5 bg-white">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Businesses</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
              Live Database
            </span>
            {refreshing && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Syncing...
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage all registered business owner profiles, subscriptions, and database status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 w-72 text-sm bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg shadow-sm hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh database records"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${(loading || refreshing) ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Syncing" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Error alert if any */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Building className="w-12 h-12 text-blue-600" />
          </div>
          <div className="flex items-center justify-between z-10">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Businesses
            </p>
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 z-10">
            <p className="text-3xl font-bold text-slate-900">{rows.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <CheckCircle className="w-12 h-12 text-emerald-600" />
          </div>
          <div className="flex items-center justify-between z-10">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active
            </p>
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 z-10">
            <p className="text-3xl font-bold text-slate-900">
              {rows.filter((r) => r.status === "Active").length}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <CreditCard className="w-12 h-12 text-amber-600" />
          </div>
          <div className="flex items-center justify-between z-10">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Revenue
            </p>
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 z-10">
            <p className="text-3xl font-bold text-slate-900">
              {fmt(rows.reduce((s, r) => s + Number(r.revenue || 0), 0))}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <UsersIcon className="w-12 h-12 text-purple-600" />
          </div>
          <div className="flex items-center justify-between z-10">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Users
            </p>
            <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
              <UsersIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 z-10">
            <p className="text-3xl font-bold text-slate-900">
              {rows.reduce((s, r) => s + Number(r.users || 0), 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="all">All ({rows.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({rows.filter(r => r.status === "Active").length})</TabsTrigger>
          <TabsTrigger value="suspended">Suspended ({rows.filter(r => r.status === "Suspended").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Suspend Modal */}
      {suspendModalOpen && (
        <Modal
          title="Suspend business owner"
          onClose={() => {
            setSuspendModalOpen(false);
            setSuspendBusinessId(null);
          }}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                Reason required
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Enter the reason for suspending this business owner account.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Suspension reason
              </label>
              <textarea
                value={suspendReason}
                onChange={(e) => {
                  setSuspendReason(e.target.value);
                  setSuspendReasonError("");
                }}
                rows={5}
                className={`w-full border rounded-lg bg-white text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all p-3 ${
                  suspendReasonError
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-slate-200"
                }`}
              />
              {suspendReasonError && (
                <p className="text-xs text-red-600">{suspendReasonError}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setSuspendModalOpen(false);
                  setSuspendBusinessId(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSuspend}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Suspend
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Manage Module Access Modal */}
      {accessModalOpen && selectedBusiness && (
        <Modal
          title={`Manage Module Access — ${selectedBusiness.name}`}
          onClose={() => {
            if (!grantingAccess) {
              setAccessModalOpen(false);
              setSelectedBusiness(null);
            }
          }}
        >
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-bold text-slate-900">
                Business Owner:{" "}
                <span className="font-semibold text-slate-700">
                  {selectedBusiness.owner}
                </span>
              </p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Email: {selectedBusiness.ownerEmail}
              </p>
            </div>

            {accessMessage && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                  accessMessage.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : accessMessage.type === "warning"
                    ? "bg-amber-50 border-amber-200 text-amber-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{accessMessage.text}</span>
              </div>
            )}

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Module Access
                </h4>
                <span className="text-[11px] font-semibold text-blue-600">
                  {
                    Object.values(selectedPermissions || {}).filter(Boolean)
                      .length
                  }{" "}
                  Granted
                </span>
              </div>

              {PERMISSION_CATEGORIES.map((cat) => (
                <div
                  key={cat.category}
                  className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50"
                >
                  <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200">
                    <span className="text-[11px] font-bold text-slate-800">
                      {cat.category}
                    </span>
                  </div>
                  <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white">
                    {cat.modules.map((mod) => (
                      <label
                        key={mod.key}
                        className="flex items-start gap-2 p-1.5 rounded-md hover:bg-slate-50 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(selectedPermissions[mod.key])}
                          onChange={() => toggleAccessPermission(mod.key)}
                          className="accent-blue-600 rounded w-4 h-4 mt-0.5 cursor-pointer flex-shrink-0"
                        />
                        <div>
                          <p className="text-xs font-semibold text-slate-800 leading-none mb-0.5">
                            {mod.label}
                          </p>
                          <p className="text-[10px] text-slate-500 line-clamp-1">
                            {mod.desc}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={grantingAccess}
                onClick={() => {
                  setAccessModalOpen(false);
                  setSelectedBusiness(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={grantingAccess}
                onClick={handleGiveAccess}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {grantingAccess ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Granting Access...</span>
                  </>
                ) : (
                  <span>Give Access</span>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                {[
                  { label: "Business & Owner", key: "name", sortable: true },
                  { label: "Location", key: "ownerCity", sortable: true },
                  { label: "Plan", key: "plan", sortable: true },
                  { label: "Joined", key: "joined", sortable: true },
                  { label: "Revenue", key: "revenue", sortable: true },
                  { label: "Users", key: "users", sortable: true },
                  { label: "Status", key: "status", sortable: true },
                  { label: "Actions", key: null, sortable: false },
                ].map((h) => (
                  <th
                    key={h.label}
                    onClick={() => h.sortable && requestSort(h.key)}
                    className={`py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap ${
                      h.sortable ? "cursor-pointer hover:text-blue-600 hover:bg-slate-100 transition-colors select-none group" : ""
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {h.label}
                      {h.sortable && (
                        <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === h.key ? "text-blue-600" : "text-slate-300 opacity-0 group-hover:opacity-100"} transition-all`} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      <span className="text-sm font-medium">Fetching registered business owners...</span>
                    </div>
                  </td>
                </tr>
              ) : processedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                        <Building2 className="w-6 h-6 text-slate-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 mb-1">No businesses found</h3>
                      <p className="text-xs text-slate-500">No matching business records in the database.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                processedRows.map((b) => (
                  <tr
                    key={b.id || b._id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-slate-200">
                          <AvatarFallback className="bg-blue-50 text-blue-700 font-semibold text-sm">
                            {b.name ? b.name.substring(0, 2).toUpperCase() : "B"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm leading-tight">{b.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                            <span className="flex items-center gap-1 truncate max-w-[120px]" title={b.ownerEmail}>
                              <Mail className="w-3 h-3" /> {b.ownerEmail}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {b.ownerPhone}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-sm">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {b.ownerCity || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={b.plan} variant={planToVariant(b.plan)} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-sm">{b.joined}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 text-sm">
                      {fmt(b.revenue)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{b.users}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <Badge label={b.status} variant={statusToVariant(b.status)} />
                        {b.status === "Suspended" && b.suspensionReason && (
                          <span
                            className="text-[10px] text-rose-600 truncate max-w-[120px]"
                            title={b.suspensionReason}
                          >
                            {b.suspensionReason}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 data-[state=open]:bg-slate-100 data-[state=open]:text-slate-900">
                          <MoreHorizontal className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openAccessModal(b)} className="cursor-pointer">
                            <Shield className="w-4 h-4 mr-2 text-blue-500" />
                            Manage Access
                          </DropdownMenuItem>
                          
                          {b.status === "Suspended" ? (
                            <DropdownMenuItem onClick={() => resumeBusiness(b.id || b._id)} className="cursor-pointer">
                              <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" />
                              Resume Account
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => openSuspendModal(b.id || b._id)} className="cursor-pointer text-red-600 focus:text-red-700">
                              <XCircle className="w-4 h-4 mr-2" />
                              Suspend Account
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200 bg-slate-50/50">
          <p className="text-xs text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-700">
              {processedRows.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-700">{rows.length}</span>{" "}
            businesses
          </p>
        </div>
      </div>
    </div>
  );
}



