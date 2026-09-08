import { useState, useEffect, useMemo } from "react";
import {
  Tag,
  Plus,
  Search,
  Copy,
  Check,
  Edit3,
  Trash2,
  Calendar,
  Users,
  Sparkles,
  AlertCircle,
  Loader2,
  RefreshCw,
  Megaphone,
  CreditCard,
  TrendingDown,
  CheckCircle2,
  X,
  Filter,
} from "lucide-react";
import {
  getAdminCoupons,
  getAdminCouponStats,
  createAdminCoupon,
  updateAdminCoupon,
  deleteAdminCoupon,
  toggleCouponStatus,
  getCouponRedemptions,
} from "@shared/api/couponAPI";

export default function OffersCouponsScreen() {
  const [activeTab, setActiveTab] = useState("coupons"); // 'coupons' | 'banners' | 'redemptions'
  const [coupons, setCoupons] = useState([]);
  const [stats, setStats] = useState({
    totalCoupons: 0,
    activeCoupons: 0,
    totalRedemptions: 0,
    totalDiscountsGiven: 0,
    totalRevenueGenerated: 0,
  });
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [copiedCode, setCopiedCode] = useState(null);
  const [toast, setToast] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [deleteCouponId, setDeleteCouponId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const initialFormState = {
    code: "",
    title: "",
    description: "",
    discountType: "percentage",
    discountValue: "",
    maxDiscountAmount: "",
    minOrderAmount: "",
    applicablePlans: ["all"],
    maxUsageCount: "",
    maxUsagePerUser: "1",
    startDate: new Date().toISOString().split("T")[0],
    expiryDate: "",
    status: "active",
    isFeaturedBanner: false,
    bannerText: "",
    bannerCta: "Claim Offer",
  };
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await getAdminCouponStats();
      if (res?.success && res?.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error("Error fetching coupon stats:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const res = await getAdminCoupons({ status: statusFilter, search: searchQuery });
      if (res?.success && Array.isArray(res?.coupons)) {
        setCoupons(res.coupons);
      }
    } catch (err) {
      console.error("Error fetching coupons:", err);
      showToast(err.message || err.response?.data?.message || "Failed to load coupons", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchRedemptions = async () => {
    try {
      setRedemptionsLoading(true);
      const res = await getCouponRedemptions();
      if (res?.success && Array.isArray(res?.redemptions)) {
        setRedemptions(res.redemptions);
      }
    } catch (err) {
      console.error("Error fetching redemptions:", err);
    } finally {
      setRedemptionsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchCoupons();
  }, [statusFilter]);

  useEffect(() => {
    if (activeTab === "redemptions") {
      fetchRedemptions();
    }
  }, [activeTab]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCoupons();
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast(`Coupon code "${code}" copied to clipboard!`, "success");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const generateRandomCode = () => {
    const prefixes = ["SMART", "SAVE", "GROW", "BOOST", "BIZ", "OFFER"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(10 + Math.random() * 90);
    const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    const generated = `${prefix}${num}${suffix}`;
    setFormData((prev) => ({ ...prev, code: generated }));
    setFormErrors((prev) => ({ ...prev, code: null }));
  };

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormData(initialFormState);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code || "",
      title: coupon.title || "",
      description: coupon.description || "",
      discountType: coupon.discountType || "percentage",
      discountValue: coupon.discountValue != null ? String(coupon.discountValue) : "",
      maxDiscountAmount: coupon.maxDiscountAmount != null ? String(coupon.maxDiscountAmount) : "",
      minOrderAmount: coupon.minOrderAmount != null ? String(coupon.minOrderAmount) : "",
      applicablePlans: Array.isArray(coupon.applicablePlans) && coupon.applicablePlans.length > 0 ? coupon.applicablePlans : ["all"],
      maxUsageCount: coupon.maxUsageCount != null ? String(coupon.maxUsageCount) : "",
      maxUsagePerUser: coupon.maxUsagePerUser != null ? String(coupon.maxUsagePerUser) : "1",
      startDate: coupon.startDate ? new Date(coupon.startDate).toISOString().split("T")[0] : "",
      expiryDate: coupon.expiryDate ? new Date(coupon.expiryDate).toISOString().split("T")[0] : "",
      status: coupon.status || "active",
      isFeaturedBanner: Boolean(coupon.isFeaturedBanner),
      bannerText: coupon.bannerText || "",
      bannerCta: coupon.bannerCta || "Claim Offer",
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.code || !formData.code.trim()) {
      errors.code = "Coupon code is required";
    }
    if (!formData.title || !formData.title.trim()) {
      errors.title = "Campaign title is required";
    }
    if (
      formData.discountValue === "" ||
      isNaN(Number(formData.discountValue)) ||
      Number(formData.discountValue) <= 0
    ) {
      errors.discountValue = "Enter a valid positive discount amount";
    }
    if (formData.discountType === "percentage" && Number(formData.discountValue) > 100) {
      errors.discountValue = "Percentage discount cannot exceed 100%";
    }
    if (formData.isFeaturedBanner && !formData.bannerText.trim()) {
      errors.bannerText = "Banner announcement text is required when featured";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveCoupon = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validateForm()) {
      showToast("Please fix the highlighted form errors", "error");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        code: formData.code.trim().toUpperCase().replace(/\s+/g, ""),
        title: formData.title.trim(),
        description: formData.description ? formData.description.trim() : "",
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        maxDiscountAmount:
          formData.maxDiscountAmount !== "" && !isNaN(Number(formData.maxDiscountAmount))
            ? Number(formData.maxDiscountAmount)
            : null,
        minOrderAmount:
          formData.minOrderAmount !== "" && !isNaN(Number(formData.minOrderAmount))
            ? Number(formData.minOrderAmount)
            : 0,
        applicablePlans:
          Array.isArray(formData.applicablePlans) && formData.applicablePlans.length > 0
            ? formData.applicablePlans
            : ["all"],
        maxUsageCount:
          formData.maxUsageCount !== "" && !isNaN(Number(formData.maxUsageCount))
            ? Number(formData.maxUsageCount)
            : null,
        maxUsagePerUser:
          formData.maxUsagePerUser !== "" && !isNaN(Number(formData.maxUsagePerUser))
            ? Number(formData.maxUsagePerUser)
            : 1,
        startDate: formData.startDate ? new Date(formData.startDate) : new Date(),
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : null,
        status: formData.status || "active",
        isFeaturedBanner: Boolean(formData.isFeaturedBanner),
        bannerText: formData.bannerText ? formData.bannerText.trim() : "",
        bannerCta: formData.bannerCta ? formData.bannerCta.trim() : "Claim Offer",
      };

      if (editingCoupon) {
        await updateAdminCoupon(editingCoupon._id, payload);
        showToast("Coupon updated successfully!");
      } else {
        await createAdminCoupon(payload);
        showToast("Coupon created successfully!");
      }

      setIsModalOpen(false);
      fetchCoupons();
      fetchStats();
    } catch (err) {
      console.error("Error saving coupon:", err);
      showToast(err.message || err.response?.data?.message || "Failed to save coupon", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (coupon) => {
    try {
      await toggleCouponStatus(coupon._id);
      showToast(`Coupon status updated!`);
      fetchCoupons();
      fetchStats();
    } catch (err) {
      console.error("Error toggling status:", err);
      showToast(err.message || "Failed to toggle coupon status", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteCouponId) return;
    try {
      await deleteAdminCoupon(deleteCouponId);
      showToast("Coupon deleted successfully!");
      setDeleteCouponId(null);
      fetchCoupons();
      fetchStats();
    } catch (err) {
      console.error("Error deleting coupon:", err);
      showToast(err.message || "Failed to delete coupon", "error");
    }
  };

  const togglePlanSelection = (planKey) => {
    setFormData((prev) => {
      let plans = [...prev.applicablePlans];
      if (planKey === "all") {
        return { ...prev, applicablePlans: ["all"] };
      }
      plans = plans.filter((p) => p !== "all");
      if (plans.includes(planKey)) {
        plans = plans.filter((p) => p !== planKey);
      } else {
        plans.push(planKey);
      }
      if (plans.length === 0) plans = ["all"];
      return { ...prev, applicablePlans: plans };
    });
  };

  const featuredBannerCoupon = useMemo(() => {
    return coupons.find((c) => c.isFeaturedBanner && c.status === "active");
  }, [coupons]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium border animate-in slide-in-from-top-3 ${
            toast.type === "error"
              ? "bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
              : "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
          }`}
        >
          {toast.type === "error" ? (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Offers & Coupons
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Manage SaaS subscription discount codes, promotional campaigns, and announcement banners
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              fetchStats();
              fetchCoupons();
              if (activeTab === "redemptions") fetchRedemptions();
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading || statsLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={openCreateModal}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-500/25 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Coupon
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active Coupons
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.activeCoupons}
            </span>
            <span className="text-xs text-slate-400 font-medium">of {stats.totalCoupons} total</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Redemptions
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.totalRedemptions}
            </span>
            <span className="text-xs text-blue-600 font-medium">usages</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Discounts Granted
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              ₹{Number(stats.totalDiscountsGiven || 0).toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-purple-500 font-medium">saved by vendors</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Revenue Influenced
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              ₹{Number(stats.totalRevenueGenerated || 0).toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-amber-600 font-medium">net converted</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("coupons")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
            activeTab === "coupons"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Tag className="w-4 h-4" />
          Coupons & Promo Codes
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === "coupons" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600"
            }`}
          >
            {coupons.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("banners")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
            activeTab === "banners"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Announcement Banners
          {featuredBannerCoupon && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("redemptions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
            activeTab === "redemptions"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Redemption History
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === "redemptions" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600"
            }`}
          >
            {stats.totalRedemptions}
          </span>
        </button>
      </div>

      {/* TAB 1: Coupons List */}
      {activeTab === "coupons" && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search coupon code or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </form>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1 flex-shrink-0">
                <Filter className="w-3.5 h-3.5" /> Status:
              </span>
              {["all", "active", "inactive", "expired"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer flex-shrink-0 ${
                    statusFilter === st
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Coupons Cards / Table */}
          {loading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
              <p className="text-sm text-slate-500">Loading coupons...</p>
            </div>
          ) : coupons.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center mb-4">
                <Tag className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                No coupons found
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                Create your first promotional discount code to incentivize new merchants and drive upgrades.
              </p>
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create Coupon
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {coupons.map((coupon) => {
                const isExpired =
                  coupon.status === "expired" ||
                  (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) ||
                  (coupon.maxUsageCount != null && coupon.usedCount >= coupon.maxUsageCount);

                const usagePercentage =
                  coupon.maxUsageCount != null
                    ? Math.min(100, Math.round((coupon.usedCount / coupon.maxUsageCount) * 100))
                    : null;

                return (
                  <div
                    key={coupon._id}
                    className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                      coupon.status === "active" && !isExpired
                        ? "border-slate-200/80 dark:border-slate-800"
                        : "border-slate-200 dark:border-slate-800 opacity-75"
                    }`}
                  >
                    <div>
                      {/* Top Bar: Code + Status Badge */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            onClick={() => copyToClipboard(coupon.code)}
                            className="group flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer transition"
                            title="Click to copy code"
                          >
                            <span className="font-mono font-bold text-sm tracking-wide text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                              {coupon.code}
                            </span>
                            {copiedCode === coupon.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition" />
                            )}
                          </div>
                          {coupon.isFeaturedBanner && (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              <Megaphone className="w-2.5 h-2.5" /> Banner
                            </span>
                          )}
                        </div>

                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                            coupon.status === "active" && !isExpired
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                              : coupon.status === "inactive"
                              ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                              : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400"
                          }`}
                        >
                          {isExpired ? "Expired" : coupon.status}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                        {coupon.title}
                      </h3>
                      {coupon.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                          {coupon.description}
                        </p>
                      )}

                      {/* Discount Amount Highlight */}
                      <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-3 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                            Discount Value
                          </span>
                          <span className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">
                            {coupon.discountType === "percentage"
                              ? `${coupon.discountValue}% OFF`
                              : coupon.discountType === "flat"
                              ? `₹${coupon.discountValue} FLAT OFF`
                              : `+${coupon.discountValue} Trial Days`}
                          </span>
                        </div>
                        {coupon.maxDiscountAmount && coupon.discountType === "percentage" && (
                          <div className="text-[11px] text-slate-500 mt-1">
                            Capped at max ₹{coupon.maxDiscountAmount} discount
                          </div>
                        )}
                        {coupon.minOrderAmount > 0 && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Min spend: ₹{coupon.minOrderAmount}
                          </div>
                        )}
                      </div>

                      {/* Scope & Restrictions */}
                      <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 mb-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-400">Plans:</span>
                          {coupon.applicablePlans.includes("all") ? (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-300">
                              All Plans
                            </span>
                          ) : (
                            coupon.applicablePlans.map((p) => (
                              <span
                                key={p}
                                className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium capitalize"
                              >
                                {p}
                              </span>
                            ))
                          )}
                        </div>

                        {/* Expiry Date */}
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {coupon.expiryDate
                              ? `Valid until ${new Date(coupon.expiryDate).toLocaleDateString("en-IN")}`
                              : "No expiration date (Ongoing)"}
                          </span>
                        </div>
                      </div>

                      {/* Usage Progress */}
                      {coupon.maxUsageCount != null && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span>Redemptions</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {coupon.usedCount} / {coupon.maxUsageCount}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                usagePercentage >= 90
                                  ? "bg-red-500"
                                  : usagePercentage >= 60
                                  ? "bg-amber-500"
                                  : "bg-indigo-600"
                              }`}
                              style={{ width: `${usagePercentage}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions Footer */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleToggleStatus(coupon)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                          coupon.status === "active"
                            ? "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                        }`}
                      >
                        {coupon.status === "active" ? "Pause" : "Activate"}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(coupon)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          title="Edit coupon"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteCouponId(coupon._id)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition cursor-pointer"
                          title="Delete coupon"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Announcement Banners */}
      {activeTab === "banners" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-indigo-600" />
                  Live Announcement Banner Preview
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  This banner appears at the very top of the Public Landing Page and In-App Upgrade screen.
                </p>
              </div>

              {featuredBannerCoupon && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 rounded-full text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> Currently Live
                </span>
              )}
            </div>

            {/* Live Interactive Preview */}
            {featuredBannerCoupon ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-4 py-3 rounded-xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                  <div className="flex items-center gap-2">
                    <span className="bg-white/20 text-white text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                      Offer
                    </span>
                    <span className="text-sm font-semibold">
                      {featuredBannerCoupon.bannerText ||
                        `${featuredBannerCoupon.title}: Use code ${featuredBannerCoupon.code} for ${featuredBannerCoupon.discountValue}% OFF!`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono bg-white/25 px-2.5 py-1 rounded-lg text-xs font-bold tracking-wider">
                      {featuredBannerCoupon.code}
                    </span>
                    <button className="px-3 py-1 bg-white text-indigo-700 rounded-lg text-xs font-bold shadow-sm hover:bg-white/90 transition cursor-pointer">
                      {featuredBannerCoupon.bannerCta || "Claim Offer"} →
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <div>
                    Linked Coupon: <strong className="text-slate-900 dark:text-white font-mono">{featuredBannerCoupon.code}</strong> ({featuredBannerCoupon.title})
                  </div>
                  <button
                    onClick={() => openEditModal(featuredBannerCoupon)}
                    className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                  >
                    Edit Banner Settings
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/40 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
                <Megaphone className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                  No Active Announcement Banner
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                  To display a banner on the landing page, create or edit a coupon and turn on the <strong>"Feature as Announcement Banner"</strong> option.
                </p>
                <button
                  onClick={openCreateModal}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Create Banner Coupon
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Redemption History */}
      {activeTab === "redemptions" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Redemption History & Audit Log
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track all businesses and transactions where discount codes were applied.
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
              {redemptions.length} records
            </span>
          </div>

          {redemptionsLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Loading redemptions...</p>
            </div>
          ) : redemptions.length === 0 ? (
            <div className="py-12 text-center">
              <Sparkles className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No redemptions recorded yet
              </p>
              <p className="text-xs text-slate-500">
                When merchants upgrade or purchase plans using coupon codes, transactions will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Business / Merchant</th>
                    <th className="py-3 px-4">Coupon Code</th>
                    <th className="py-3 px-4">Plan</th>
                    <th className="py-3 px-4 text-right">Original Price</th>
                    <th className="py-3 px-4 text-right">Discount</th>
                    <th className="py-3 px-4 text-right">Final Paid</th>
                    <th className="py-3 px-4">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {redemptions.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {r.businessName || "Merchant"}
                        </div>
                        <div className="text-[11px] text-slate-400">{r.email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-md">
                          {r.couponCode}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 capitalize font-semibold text-slate-800 dark:text-slate-200">
                        {r.plan}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-500 line-through">
                        ₹{r.originalAmount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                        -₹{r.discountAmount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 dark:text-white">
                        ₹{r.finalAmount}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                        {r.redeemedAt
                          ? new Date(r.redeemedAt).toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingCoupon ? "Edit Coupon / Offer" : "Create New Coupon / Offer"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form id="couponForm" onSubmit={handleSaveCoupon} className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Code & Generate Button */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Coupon Code *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. SUMMER30"
                    value={formData.code}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        code: e.target.value.toUpperCase().replace(/\s+/g, ""),
                      });
                      if (formErrors.code) setFormErrors({ ...formErrors, code: null });
                    }}
                    className="flex-1 px-3.5 py-2 uppercase font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={generateRandomCode}
                    className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Generate
                  </button>
                </div>
                {formErrors.code && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.code}</p>
                )}
              </div>

              {/* Title / Campaign Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Campaign / Offer Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Summer Business Growth 30% OFF"
                  value={formData.title}
                  onChange={(e) => {
                    setFormData({ ...formData, title: e.target.value });
                    if (formErrors.title) setFormErrors({ ...formErrors, title: null });
                  }}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {formErrors.title && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.title}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows="2"
                  placeholder="Optional details regarding terms or customer eligibility..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Discount Type *
                  </label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                    <option value="trial_days">Extra Free Trial Days</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Discount Value *{" "}
                    {formData.discountType === "percentage"
                      ? "(%)"
                      : formData.discountType === "flat"
                      ? "(₹)"
                      : "(Days)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder={formData.discountType === "percentage" ? "e.g. 20" : "e.g. 500"}
                    value={formData.discountValue}
                    onChange={(e) => {
                      setFormData({ ...formData, discountValue: e.target.value });
                      if (formErrors.discountValue) setFormErrors({ ...formErrors, discountValue: null });
                    }}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {formErrors.discountValue && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.discountValue}</p>
                  )}
                </div>
              </div>

              {/* Max Discount Cap & Min Spend */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {formData.discountType === "percentage" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Max Discount Cap (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 1000 (optional)"
                      value={formData.maxDiscountAmount}
                      onChange={(e) =>
                        setFormData({ ...formData, maxDiscountAmount: e.target.value })
                      }
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Min Order Spend (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 999 (optional)"
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Applicable Plans */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Applicable Subscription Plans
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "all", label: "All Plans" },
                    { key: "starter", label: "Starter Plan" },
                    { key: "pro", label: "Pro Plan" },
                    { key: "enterprise", label: "Enterprise Plan" },
                  ].map((p) => {
                    const isSelected = formData.applicablePlans.includes(p.key);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => togglePlanSelection(p.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Usage Limits & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Max Total Redemptions
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 100 (blank = unlimited)"
                    value={formData.maxUsageCount}
                    onChange={(e) => setFormData({ ...formData, maxUsageCount: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Max Uses Per Account
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxUsagePerUser}
                    onChange={(e) => setFormData({ ...formData, maxUsagePerUser: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Feature as Announcement Banner */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isFeaturedBanner}
                    onChange={(e) =>
                      setFormData({ ...formData, isFeaturedBanner: e.target.checked })
                    }
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Feature as Top Announcement Banner (Landing Page & CRM)
                  </span>
                </label>

                {formData.isFeaturedBanner && (
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Banner Headline Text *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Flash Sale: Get 30% off Pro with code SUMMER30!"
                        value={formData.bannerText}
                        onChange={(e) => {
                          setFormData({ ...formData, bannerText: e.target.value });
                          if (formErrors.bannerText) setFormErrors({ ...formErrors, bannerText: null });
                        }}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                      />
                      {formErrors.bannerText && (
                        <p className="text-[11px] text-red-500 mt-0.5">{formErrors.bannerText}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Button CTA Text
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Claim Offer"
                        value={formData.bannerCta}
                        onChange={(e) => setFormData({ ...formData, bannerCta: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive / Paused</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </form>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="couponForm"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-500/25 cursor-pointer disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingCoupon ? "Save Changes" : "Create Coupon"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteCouponId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Delete this coupon?
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              This action cannot be undone. Merchants will no longer be able to use this promo code.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteCouponId(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-red-600/20 cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
