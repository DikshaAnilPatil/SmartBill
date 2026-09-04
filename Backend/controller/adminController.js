import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";
import Order from "../models/Order.js";
import SystemSettings from "../models/SystemSettings.js";
import { createNotification, notifySuperAdmins } from "../services/notificationService.js";
import { sendSystemEmail } from "../utils/emailService.js";

const isInternalAdmin = (user) => {
  if (!user) return false;
  const roleStr = String(user?.role || "").toLowerCase().replace(/[-_\s]/g, "");
  return (
    roleStr === "superadmin" ||
    roleStr.includes("admin") ||
    roleStr === "support" ||
    roleStr === "billing" ||
    (!user?.ownerId && roleStr !== "owner")
  );
};

/**
 * GET /api/admin/businesses
 * Fetch all registered business owner accounts from MongoDB for SuperAdmin view.
 * Excludes passwords and sensitive authentication data.
 */
export const getAllBusinesses = async (req, res) => {
  try {
    // Internal Admin access control
    if (!isInternalAdmin(req.user)) {
      return res.status(403).json({
        message: "Forbidden: Internal Admin access required.",
      });
    }

    // Run all 3 DB queries in parallel for maximum speed
    const ownerQuery = {
      $or: [
        { role: "owner" },
        { ownerId: null, role: { $ne: "superadmin" } },
      ],
    };

    const [owners, revenueByOwner, employeeCounts] = await Promise.all([
      User.find(ownerQuery)
        .select("-password -passwordResetToken -passwordResetExpires -twoFactorSecret")
        .sort({ createdAt: -1 })
        .lean(),
      Order.aggregate([
        { $group: { _id: "$ownerId", totalRevenue: { $sum: "$totalOrderValue" } } },
      ]),
      User.aggregate([
        { $match: { ownerId: { $ne: null } } },
        { $group: { _id: "$ownerId", count: { $sum: 1 } } },
      ]),
    ]);

    const revenueMap = new Map(
      revenueByOwner.map((item) => [String(item._id), Number(item.totalRevenue) || 0])
    );

    const employeeMap = new Map(
      employeeCounts.map((item) => [String(item._id), Number(item.count) || 0])
    );

    // Map each owner to business card format with employee count and revenue
    const businessList = owners.map((owner) => {
      const ownerIdStr = owner._id.toString();
      const employeeCount = employeeMap.get(ownerIdStr) || 0;
      const revenue = revenueMap.get(ownerIdStr) || 0;

      const rawPlan = owner.subscription?.plan || "starter";
      const formattedPlan =
        rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1);

      return {
        _id: owner._id,
        id: ownerIdStr,
        name: owner.businessName || `${owner.firstName} ${owner.lastName}'s Business`,
        owner: `${owner.firstName} ${owner.lastName}`.trim(),
        ownerEmail: owner.email,
        ownerPhone: owner.phone || "N/A",
        ownerCity: owner.city || "N/A",
        plan: formattedPlan,
        users: employeeCount + 1, // Owner + employees
        revenue: revenue,
        status: owner.status || "Active",
        suspensionReason: owner.suspensionReason || "",
        joined: owner.createdAt
          ? new Date(owner.createdAt).toISOString().split("T")[0]
          : "N/A",
      };
    });

    return res.status(200).json({
      success: true,
      count: businessList.length,
      data: businessList,
    });
  } catch (error) {
    console.error("GET ALL BUSINESSES ERROR:", error);
    return res.status(500).json({
      message: error.message || "Failed to retrieve business records.",
    });
  }
};

/**
 * PUT /api/admin/businesses/:id/status
 * Update an owner/business status (Active / Suspended) and suspension reason.
 */
export const updateBusinessStatus = async (req, res) => {
  try {
    if (!isInternalAdmin(req.user)) {
      return res.status(403).json({
        message: "Forbidden: Admin access required.",
      });
    }

    const { id } = req.params;
    const { status, reason } = req.body;

    if (!["Active", "Suspended", "Inactive"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status value. Allowed: Active, Suspended, Inactive.",
      });
    }

    const owner = await User.findById(id);

    if (!owner) {
      return res.status(404).json({
        message: "Business owner account not found.",
      });
    }

    owner.status = status;
    if (status === "Suspended") {
      owner.suspensionReason = String(reason || "").trim();
    } else if (status === "Active") {
      owner.suspensionReason = "";
    }

    await owner.save();

    // Dispatch status change notifications
    try {
      const bName = owner.businessName || `${owner.firstName} ${owner.lastName}`;
      // Notify SuperAdmins
      await notifySuperAdmins({
        title: `Business ${status}: ${bName}`,
        message: `Business ${bName} (${owner.email}) status was changed to ${status}${reason ? `. Reason: ${reason}` : ""}.`,
        type: status === "Suspended" ? "warning" : "info",
        category: "businesses",
        link: "businesses",
        metadata: { businessId: owner._id.toString(), status },
      });

      // Notify the business owner directly
      await createNotification({
        ownerId: owner._id,
        userId: owner._id,
        title: status === "Suspended" ? "Account Suspended" : "Account Reactivated",
        message: status === "Suspended"
          ? `Your business account has been suspended${reason ? `: ${reason}` : ". Please contact support for assistance."}`
          : "Your business account has been reactivated. You now have full platform access.",
        type: status === "Suspended" ? "error" : "success",
        category: "system",
        link: "settings",
        metadata: { status, reason },
      });
    } catch (notifErr) {
      console.error("Business status notification error:", notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Business status updated to ${status}.`,
      data: {
        id: owner._id,
        status: owner.status,
        suspensionReason: owner.suspensionReason,
      },
    });
  } catch (error) {
    console.error("UPDATE BUSINESS STATUS ERROR:", error);
    return res.status(500).json({
      message: error.message || "Failed to update business status.",
    });
  }
};

/**
 * GET /api/admin/settings/system
 * Retrieve system settings for SuperAdmin.
 */
export const getSystemSettings = async (req, res) => {
  try {
    if (!isInternalAdmin(req.user)) {
      return res.status(403).json({
        message: "Forbidden: Admin access required.",
      });
    }

    let settings = await SystemSettings.findOne({ key: "global_system_settings" });
    if (!settings) {
      settings = await SystemSettings.create({ key: "global_system_settings" });
    }

    return res.status(200).json({
      success: true,
      systemSettings: settings,
    });
  } catch (error) {
    console.error("GET SYSTEM SETTINGS ERROR:", error);
    return res.status(500).json({
      message: error.message || "Failed to retrieve system settings.",
    });
  }
};

/**
 * PUT /api/admin/settings/system
 * Update system settings for SuperAdmin.
 */
export const updateSystemSettings = async (req, res) => {
  try {
    if (!isInternalAdmin(req.user)) {
      return res.status(403).json({
        message: "Forbidden: Admin access required.",
      });
    }

    const {
      maintenanceMode,
      autoBackup,
      debugMode,
      backupFrequency,
      maxLoginAttempts,
      emailTemplates,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpFrom,
    } = req.body;

    const payload = {};
    if (typeof maintenanceMode === "boolean") payload.maintenanceMode = maintenanceMode;
    if (typeof autoBackup === "boolean") payload.autoBackup = autoBackup;
    if (typeof debugMode === "boolean") payload.debugMode = debugMode;
    if (backupFrequency && ["hourly", "daily", "weekly", "monthly", "manual", "disabled"].includes(backupFrequency)) {
      payload.backupFrequency = backupFrequency;
    }
    if (maxLoginAttempts !== undefined) {
      const parsedAttempts = parseInt(maxLoginAttempts, 10);
      if (!isNaN(parsedAttempts) && parsedAttempts >= 1) {
        payload.maxLoginAttempts = parsedAttempts;
      }
    }
    if (smtpHost !== undefined) payload.smtpHost = String(smtpHost || "").trim();
    if (smtpPort !== undefined) payload.smtpPort = Number(smtpPort) || 587;
    if (smtpUser !== undefined) payload.smtpUser = String(smtpUser || "").trim();
    if (smtpPass !== undefined && smtpPass !== "") payload.smtpPass = String(smtpPass).trim();
    if (smtpFrom !== undefined) payload.smtpFrom = String(smtpFrom || "").trim();

    if (Array.isArray(emailTemplates)) {
      payload.emailTemplates = emailTemplates.map((t) => ({
        id: Number(t.id),
        name: String(t.name || "").trim(),
        subject: String(t.subject || "").trim(),
        body: String(t.body || "").trim(),
        status: t.status === "inactive" ? "inactive" : "active",
      }));
    }

    const settings = await SystemSettings.findOneAndUpdate(
      { key: "global_system_settings" },
      { $set: payload },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "System settings updated successfully.",
      systemSettings: settings,
    });
  } catch (error) {
    console.error("UPDATE SYSTEM SETTINGS ERROR:", error);
    return res.status(500).json({
      message: error.message || "Failed to update system settings.",
    });
  }
};

/**
 * GET /api/admin/revenue
 * Comprehensive multi-dimensional revenue analytics aggregated across all registered business owners.
 * Supports optional filters: ?timeframe=week|month|3m|6m|1y|all & ?businessId=all|<ownerId>
 */
export const getAdminRevenueAnalytics = async (req, res) => {
  try {
    if (!isInternalAdmin(req.user)) {
      return res.status(403).json({
        message: "Forbidden: Admin access required.",
      });
    }

    const { timeframe = "6M", businessId } = req.query;

    // 1. Fetch all business owners
    const ownerQuery = {
      $or: [
        { role: "owner" },
        { ownerId: null, role: { $ne: "superadmin" } },
      ],
    };
    if (businessId && businessId !== "all" && businessId !== "undefined") {
      ownerQuery._id = businessId;
    }

    const owners = await User.find(ownerQuery)
      .select("firstName lastName businessName businessType email phone city status subscription createdAt")
      .lean();

    const allOwnerIds = owners.map((o) => o._id);

    // 2. Platform Subscription Revenue & MRR calculations
    const PLAN_PRICES = { starter: 0, pro: 999, enterprise: 2499 };
    let platformMRR = 0;
    let activeSubscribersCount = 0;
    let trialingCount = 0;
    let starterCount = 0;
    let proCount = 0;
    let enterpriseCount = 0;

    owners.forEach((owner) => {
      const plan = (owner.subscription?.plan || "starter").toLowerCase();
      const status = owner.subscription?.status || "trialing";

      if (plan === "pro") proCount++;
      else if (plan === "enterprise") enterpriseCount++;
      else starterCount++;

      if (status === "active") {
        const price = PLAN_PRICES[plan] || 0;
        platformMRR += price;
        if (price > 0) activeSubscribersCount++;
      } else if (status === "trialing") {
        trialingCount++;
      }
    });

    const platformARR = platformMRR * 12;

    // Plan distribution dataset for charts
    const planDistribution = [
      { name: "Starter", count: starterCount, price: 0, revenue: 0, color: "#94A3B8" },
      { name: "Pro", count: proCount, price: 999, revenue: proCount * 999, color: "#2563EB" },
      { name: "Enterprise", count: enterpriseCount, price: 2499, revenue: enterpriseCount * 2499, color: "#7C3AED" },
    ];

    // 3. Ecosystem Orders & GMV Aggregation
    const orderMatch = { ownerId: { $in: allOwnerIds } };

    // Date filtering if applicable
    const now = new Date();
    let startDate = null;
    if (timeframe === "This Week" || timeframe === "7D" || timeframe === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe === "This Month" || timeframe === "30D" || timeframe === "month") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeframe === "3M") {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (timeframe === "6M") {
      startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    } else if (timeframe === "1Y") {
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    if (startDate) {
      orderMatch.$or = [
        { date: { $gte: startDate } },
        { createdAt: { $gte: startDate } },
      ];
    }

    const allOrders = await Order.find(orderMatch).sort({ date: -1, createdAt: -1 }).lean();

    let totalGMV = 0;
    let totalTaxCollected = 0;
    let totalOutstanding = 0;
    let paidOrdersCount = 0;
    let pendingOrdersCount = 0;

    // Aging categories: 0-30d, 31-60d, 61+d
    const agingMap = {
      current: { amount: 0, count: 0 },
      overdue: { amount: 0, count: 0 },
      critical: { amount: 0, count: 0 },
    };

    // Payment methods map
    const paymentMethodMap = {};

    // Category / Business Type revenue map
    const ownerBizTypeMap = new Map();
    owners.forEach((o) => ownerBizTypeMap.set(o._id.toString(), o.businessType || "Retail"));
    const categoryRevenueMap = {};

    // Top products aggregation map
    const productSalesMap = {};

    // Daily / Monthly historical aggregation
    const monthlyTrendMap = {};
    const weeklyTrendMap = {
      Mon: { day: "Mon", revenue: 0, orders: 0, tax: 0 },
      Tue: { day: "Tue", revenue: 0, orders: 0, tax: 0 },
      Wed: { day: "Wed", revenue: 0, orders: 0, tax: 0 },
      Thu: { day: "Thu", revenue: 0, orders: 0, tax: 0 },
      Fri: { day: "Fri", revenue: 0, orders: 0, tax: 0 },
      Sat: { day: "Sat", revenue: 0, orders: 0, tax: 0 },
      Sun: { day: "Sun", revenue: 0, orders: 0, tax: 0 },
    };

    // Top Businesses aggregation
    const businessStatsMap = new Map();
    owners.forEach((o) => {
      businessStatsMap.set(o._id.toString(), {
        id: o._id.toString(),
        name: o.businessName || `${o.firstName} ${o.lastName}`,
        owner: `${o.firstName} ${o.lastName}`.trim(),
        email: o.email,
        phone: o.phone || "N/A",
        city: o.city || "N/A",
        businessType: o.businessType || "Retail",
        plan: (o.subscription?.plan || "starter").toUpperCase(),
        totalSpent: 0,
        ordersCount: 0,
        taxCollected: 0,
        outstanding: 0,
      });
    });

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    allOrders.forEach((ord) => {
      const ordTotal = Number(ord.totalOrderValue || ord.total || 0);
      const ordTax = Number(ord.gst || ord.tax || 0);
      const ordBalance = Number(ord.balanceDue || 0);
      const ordStatus = ord.status || "Paid";
      const ordMode = ord.paymentMode || "Cash";
      const ordDate = new Date(ord.date || ord.createdAt || Date.now());

      totalGMV += ordTotal;
      totalTaxCollected += ordTax;

      if (ordStatus === "Paid") paidOrdersCount++;
      else pendingOrdersCount++;

      // Aging
      if (ordBalance > 0 || ordStatus !== "Paid") {
        const itemBal = ordBalance > 0 ? ordBalance : ordTotal;
        totalOutstanding += itemBal;
        const ageDays = Math.floor((now.getTime() - ordDate.getTime()) / (24 * 60 * 60 * 1000));
        if (ageDays <= 30) {
          agingMap.current.amount += itemBal;
          agingMap.current.count++;
        } else if (ageDays <= 60) {
          agingMap.overdue.amount += itemBal;
          agingMap.overdue.count++;
        } else {
          agingMap.critical.amount += itemBal;
          agingMap.critical.count++;
        }
      }

      // Payment method
      const modeKey = ordMode.toUpperCase();
      if (!paymentMethodMap[modeKey]) {
        paymentMethodMap[modeKey] = { name: ordMode, value: 0 };
      }
      paymentMethodMap[modeKey].value += ordTotal;

      // Category / Business Type
      const ownerIdStr = ord.ownerId?.toString();
      const bType = ownerBizTypeMap.get(ownerIdStr) || "Retail";
      if (!categoryRevenueMap[bType]) {
        categoryRevenueMap[bType] = { category: bType, revenue: 0, orders: 0 };
      }
      categoryRevenueMap[bType].revenue += ordTotal;
      categoryRevenueMap[bType].orders += 1;

      // Top Products from order items
      if (Array.isArray(ord.items)) {
        ord.items.forEach((item) => {
          const pName = item.name || item.sku || "Product";
          const pQty = Number(item.qty || 1);
          const pAmt = Number(item.amount || item.price * pQty || 0);
          if (!productSalesMap[pName]) {
            productSalesMap[pName] = { name: pName, quantity: 0, revenue: 0 };
          }
          productSalesMap[pName].quantity += pQty;
          productSalesMap[pName].revenue += pAmt;
        });
      }

      // Day of week
      const dName = dayNames[ordDate.getDay()];
      if (weeklyTrendMap[dName]) {
        weeklyTrendMap[dName].revenue += ordTotal;
        weeklyTrendMap[dName].orders += 1;
        weeklyTrendMap[dName].tax += ordTax;
      }

      // Month trend key
      const monthLabel = ordDate.toLocaleString("en-IN", { month: "short" });
      const monthYearKey = `${ordDate.getFullYear()}-${String(ordDate.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyTrendMap[monthYearKey]) {
        monthlyTrendMap[monthYearKey] = {
          month: monthLabel,
          key: monthYearKey,
          revenue: 0,
          orders: 0,
          tax: 0,
          businessesActive: new Set(),
        };
      }
      monthlyTrendMap[monthYearKey].revenue += ordTotal;
      monthlyTrendMap[monthYearKey].orders += 1;
      monthlyTrendMap[monthYearKey].tax += ordTax;
      if (ownerIdStr) monthlyTrendMap[monthYearKey].businessesActive.add(ownerIdStr);

      // Business Stats
      if (ownerIdStr && businessStatsMap.has(ownerIdStr)) {
        const bStat = businessStatsMap.get(ownerIdStr);
        bStat.totalSpent += ordTotal;
        bStat.ordersCount += 1;
        bStat.taxCollected += ordTax;
        bStat.outstanding += ordBalance;
      }
    });

    // Format Monthly trend array
    const sortedMonthKeys = Object.keys(monthlyTrendMap).sort();
    const monthlyTrend = sortedMonthKeys.map((k) => ({
      month: monthlyTrendMap[k].month,
      key: k,
      revenue: monthlyTrendMap[k].revenue,
      orders: monthlyTrendMap[k].orders,
      tax: monthlyTrendMap[k].tax,
      businesses: monthlyTrendMap[k].businessesActive.size,
    }));

    // If less than 6 months of data, generate trailing months sequence
    const trendData = monthlyTrend.length > 0 ? monthlyTrend : [
      { month: "Jan", revenue: 0, orders: 0, businesses: owners.length },
      { month: "Feb", revenue: 0, orders: 0, businesses: owners.length },
      { month: "Mar", revenue: 0, orders: 0, businesses: owners.length },
      { month: "Apr", revenue: 0, orders: 0, businesses: owners.length },
      { month: "May", revenue: 0, orders: 0, businesses: owners.length },
      { month: "Jun", revenue: totalGMV, orders: allOrders.length, businesses: owners.length },
    ];

    // Format Aging Invoices array
    const agingInvoicesData = [
      {
        range: "0–30 Days (Current)",
        amount: agingMap.current.amount,
        count: agingMap.current.count,
        color: "bg-blue-500",
        textColor: "text-blue-600",
      },
      {
        range: "31–60 Days (Overdue)",
        amount: agingMap.overdue.amount,
        count: agingMap.overdue.count,
        color: "bg-amber-500",
        textColor: "text-amber-600",
      },
      {
        range: "61+ Days (Critical)",
        amount: agingMap.critical.amount,
        count: agingMap.critical.count,
        color: "bg-rose-500",
        textColor: "text-rose-600",
      },
    ];

    // Format Payment Method breakdown
    const PM_COLORS = {
      UPI: "#2563EB",
      CASH: "#10B981",
      CARD: "#F59E0B",
      BANK: "#8B5CF6",
      TRANSFER: "#6366F1",
      WALLET: "#EC4899",
    };
    const paymentMethodData = Object.values(paymentMethodMap).map((pm) => ({
      name: pm.name,
      value: pm.value,
      color: PM_COLORS[pm.name.toUpperCase()] || "#64748B",
    }));

    if (paymentMethodData.length === 0) {
      paymentMethodData.push(
        { name: "UPI", value: 0, color: "#2563EB" },
        { name: "Cash", value: 0, color: "#10B981" },
        { name: "Card", value: 0, color: "#F59E0B" },
      );
    }

    // Category Revenue list
    const categoryRevenueData = Object.values(categoryRevenueMap).sort((a, b) => b.revenue - a.revenue);
    if (categoryRevenueData.length === 0) {
      categoryRevenueData.push(
        { category: "Retail", revenue: totalGMV, orders: allOrders.length },
        { category: "Services", revenue: 0, orders: 0 },
      );
    }

    // Top Products list
    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((p, idx) => ({ id: idx + 1, ...p }));

    // Top Businesses list
    const topBusinesses = Array.from(businessStatsMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    // Recent Daily Transactions Report
    const dailyRevenueMap = {};
    allOrders.slice(0, 50).forEach((ord) => {
      const dStr = new Date(ord.date || ord.createdAt).toISOString().split("T")[0];
      if (!dailyRevenueMap[dStr]) {
        dailyRevenueMap[dStr] = {
          date: dStr,
          sales: 0,
          taxCollected: 0,
          grossRevenue: 0,
          status: "Completed",
        };
      }
      dailyRevenueMap[dStr].sales += 1;
      dailyRevenueMap[dStr].taxCollected += Number(ord.gst || ord.tax || 0);
      dailyRevenueMap[dStr].grossRevenue += Number(ord.totalOrderValue || ord.total || 0);
    });

    const dailyRevenueReport = Object.values(dailyRevenueMap).sort((a, b) => b.date.localeCompare(a.date));

    // Business options for filter dropdown
    const businessFilterOptions = owners.map((o) => ({
      id: o._id.toString(),
      name: o.businessName || `${o.firstName} ${o.lastName}`,
      email: o.email,
      plan: (o.subscription?.plan || "starter").toUpperCase(),
      businessType: o.businessType || "Retail",
    }));

    return res.status(200).json({
      success: true,
      summary: {
        totalBusinesses: owners.length,
        totalOrders: allOrders.length,
        totalGMV,
        platformMRR,
        platformARR,
        activeSubscribersCount,
        trialingCount,
        totalTaxCollected,
        totalOutstanding,
        paidOrdersCount,
        pendingOrdersCount,
        avgOrderValue: allOrders.length > 0 ? Math.round(totalGMV / allOrders.length) : 0,
      },
      weeklyFinancialTrend: Object.values(weeklyTrendMap),
      monthlyFinancialTrend: trendData,
      agingInvoicesData,
      paymentMethodData,
      categoryRevenueData,
      planDistribution,
      topProducts,
      topBusinesses,
      dailyRevenueReport,
      businessFilterOptions,
    });
  } catch (error) {
    console.error("GET ADMIN REVENUE ANALYTICS ERROR:", error);
    return res.status(500).json({
      message: error.message || "Failed to retrieve revenue analytics.",
    });
  }
};

/**
 * GET /api/admin/dashboard-stats
 * Live dashboard metrics for SuperAdmin / Admin Portal.
 */
export const getSuperAdminDashboardStats = async (req, res) => {
  try {
    if (!isInternalAdmin(req.user)) {
      return res.status(403).json({
        message: "Forbidden: Admin access required.",
      });
    }

    const { range = "6M" } = req.query;

    const owners = await User.find({
      $or: [
        { role: "owner" },
        { ownerId: null, role: { $ne: "superadmin" } },
      ],
    }).select("subscription createdAt").lean();

    const totalUsers = await User.countDocuments();
    const totalBusinesses = owners.length;

    const PLAN_PRICES = { starter: 0, pro: 999, enterprise: 2499 };
    let mrr = 0;
    let activeSubs = 0;
    let starter = 0;
    let pro = 0;
    let enterprise = 0;

    owners.forEach((o) => {
      const plan = (o.subscription?.plan || "starter").toLowerCase();
      const status = o.subscription?.status || "trialing";
      if (plan === "pro") pro++;
      else if (plan === "enterprise") enterprise++;
      else starter++;

      if (status === "active") {
        const price = PLAN_PRICES[plan] || 0;
        mrr += price;
        if (price > 0) activeSubs++;
      }
    });

    const totalOrders = await Order.countDocuments();
    const gmvAgg = await Order.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ["$totalOrderValue", { $ifNull: ["$total", 0] }] } } } },
    ]);
    const totalGMV = gmvAgg[0]?.total || 0;

    // Monthly breakdown for AreaChart
    const monthsLimit = range === "1Y" ? 12 : range === "3M" ? 3 : 6;
    const now = new Date();
    const revenueByRange = [];

    for (let i = monthsLimit - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const mName = d.toLocaleString("en-IN", { month: "short" });

      const monthOrders = await Order.aggregate([
        {
          $match: {
            $or: [
              { date: { $gte: d, $lt: nextD } },
              { createdAt: { $gte: d, $lt: nextD } },
            ],
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ["$totalOrderValue", { $ifNull: ["$total", 0] }] } },
            count: { $sum: 1 },
          },
        },
      ]);

      const monthBiz = owners.filter((o) => new Date(o.createdAt) < nextD).length;
      const monthRev = monthOrders[0]?.total || 0;

      revenueByRange.push({
        month: mName,
        businesses: monthBiz,
        revenue: monthRev > 0 ? monthRev : (mrr > 0 ? mrr : 0),
        orders: monthOrders[0]?.count || 0,
      });
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalBusinesses,
        totalUsers,
        activeSubscriptions: activeSubs,
        mrr,
        totalGMV,
        totalOrders,
      },
      planDistribution: [
        { name: "Starter", value: starter, color: "#CBD5E1" },
        { name: "Pro", value: pro, color: "#2563EB" },
        { name: "Enterprise", value: enterprise, color: "#7C3AED" },
      ],
      revenueByRange,
    });
  } catch (error) {
    console.error("GET DASHBOARD STATS ERROR:", error);
    return res.status(500).json({
      message: error.message || "Failed to retrieve dashboard stats.",
    });
  }
};

/**
 * PUT /api/admin/businesses/:id/access
 * Grant/update business module permissions, generate new temporary password securely on backend,
 * hash password with bcrypt, save to MongoDB, and email credentials to the user.
 */
export const grantBusinessAccess = async (req, res) => {
  try {
    if (!isInternalAdmin(req.user)) {
      return res.status(403).json({
        message: "Forbidden: Admin access required.",
      });
    }

    const { id } = req.params;
    const { permissions } = req.body;

    if (!permissions || typeof permissions !== "object") {
      return res.status(400).json({
        message: "Invalid permissions format.",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        message: "Business owner account not found.",
      });
    }

    // 1. Save selected module permissions in MongoDB
    user.permissions = permissions;

    // 2. Generate a NEW cryptographically secure temporary password on backend
    const rawBytes = crypto.randomBytes(6).toString("hex");
    const tempPassword = `Sb#${rawBytes.slice(0, 4)}!${rawBytes.slice(4, 8)}`;

    // 3. Hash temporary password using bcrypt
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    user.password = hashedPassword;

    // Reset lockout/failed attempts if any
    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;

    await user.save();

    // 4. Build Granted Modules List for Email
    const MODULE_LABELS = {
      dashboard: "Executive Dashboard",
      customers: "Customers Directory",
      pos: "Point of Sale (POS) & Invoicing",
      products: "Products Catalog",
      inventory: "Stock & Inventory Control",
      suppliers: "Suppliers Directory",
      purchase: "Purchase Invoices",
      expenses: "Expense Tracking",
      reports: "Financial & Tax Reports",
      users: "Staff & User Management",
      settings: "System & Business Settings",
    };

    const grantedModules = Object.keys(permissions)
      .filter((k) => Boolean(permissions[k]))
      .map((k) => `✓ ${MODULE_LABELS[k] || k}`);

    const modulesText = grantedModules.length > 0
      ? grantedModules.join("\n")
      : "No modules granted";

    const userName = user.businessName || `${user.firstName} ${user.lastName}`.trim();
    const portalUrl = process.env.CLIENT_URL || "http://localhost:5173/login";

    const emailSubject = "SmartBill Access Granted";
    const emailBody = `Hello ${userName},\n\nYour SmartBill account access has been updated by the SuperAdmin.\n\nLogin Email:\n${user.email}\n\nTemporary Password:\n${tempPassword}\n\nModules you can access:\n${modulesText}\n\nLogin:\n${portalUrl}\n\nPlease log in using the temporary password above and change your password after logging in.\n\nRegards,\nSmartBill Team`;

    // 5. Dispatch Email via Nodemailer (using process.env.SMTP_*)
    let emailResult = null;
    try {
      emailResult = await sendSystemEmail({
        templateName: "SmartBill Access Granted",
        toEmail: user.email,
        variables: {
          business_name: userName,
          user_name: userName,
          email: user.email,
          temp_password: tempPassword,
          modules_granted: modulesText,
          login_url: portalUrl,
        },
        defaultSubject: emailSubject,
        defaultBody: emailBody,
      });
    } catch (emailErr) {
      console.error("Email dispatch failed:", emailErr.message);
      emailResult = { success: false, error: emailErr.message };
    }

    if (!emailResult || !emailResult.success) {
      return res.status(207).json({
        success: false,
        emailFailed: true,
        message: `Account permissions and password updated successfully, BUT notification email could not be delivered (${emailResult?.error || "SMTP error"}). Please verify SMTP settings in .env.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Access granted successfully. Temporary password has been sent to the user's registered email.",
    });
  } catch (error) {
    console.error("GRANT BUSINESS ACCESS ERROR:", error);
    return res.status(500).json({
      message: error.message || "Failed to grant business access.",
    });
  }
};

/**
 * GET /api/admin/staff
 * Fetch all internal admin staff users.
 */
export const getAdminStaff = async (req, res) => {
  try {
    if (!isInternalAdmin(req.user)) {
      return res.status(403).json({ message: "Forbidden: Admin access required." });
    }

    const staff = await User.find({
      $or: [
        { role: "superadmin" },
        { role: { $regex: "admin", $options: "i" } },
        { role: "support_admin" },
        { role: "billing_admin" }
      ]
    })
      .select("-password -twoFactorSecret")
      .sort({ createdAt: -1 })
      .lean();

    const formattedStaff = staff.map((u) => ({
      id: u._id.toString(),
      _id: u._id.toString(),
      name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
      email: u.email,
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`,
      roleId: u.role || "support_admin",
      department: u.department || "Operations",
      status: u.status || "Active",
      permissions: u.permissions || {},
      lastActive: "Recent",
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString().split("T")[0] : "N/A"
    }));

    return res.status(200).json({
      success: true,
      count: formattedStaff.length,
      data: formattedStaff
    });
  } catch (error) {
    console.error("GET ADMIN STAFF ERROR:", error);
    return res.status(500).json({ message: error.message || "Failed to fetch admin staff." });
  }
};

/**
 * POST /api/admin/staff
 * Create a new internal admin user account with email & password in MongoDB.
 */
export const createAdminStaff = async (req, res) => {
  try {
    if (!isInternalAdmin(req.user)) {
      return res.status(403).json({ message: "Forbidden: Admin access required." });
    }

    const { name, email, password, roleId, department, status, permissions } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ message: "An account with this email address already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || "";

    const newStaff = await User.create({
      firstName,
      lastName,
      email: normalizedEmail,
      password: hashedPassword,
      role: roleId || "support_admin",
      department: department || "Operations",
      status: status || "Active",
      permissions: permissions || {},
    });

    return res.status(201).json({
      success: true,
      message: "Internal admin user account created successfully.",
      user: {
        id: newStaff._id.toString(),
        _id: newStaff._id.toString(),
        name: `${newStaff.firstName} ${newStaff.lastName}`.trim(),
        email: newStaff.email,
        roleId: newStaff.role,
        department: newStaff.department,
        status: newStaff.status,
        permissions: newStaff.permissions,
        createdAt: new Date().toISOString().split("T")[0]
      }
    });
  } catch (error) {
    console.error("CREATE ADMIN STAFF ERROR:", error);
    return res.status(500).json({ message: error.message || "Failed to create admin staff." });
  }
};

/**
 * PUT /api/admin/staff/:id
 * Update an existing internal admin user account (role, permissions, department, status, password).
 */
export const updateAdminStaff = async (req, res) => {
  try {
    if (!isInternalAdmin(req.user)) {
      return res.status(403).json({ message: "Forbidden: Admin access required." });
    }

    const { id } = req.params;
    const { name, department, roleId, status, permissions, password } = req.body;

    const staffUser = await User.findById(id);
    if (!staffUser) {
      return res.status(404).json({ message: "Staff user account not found." });
    }

    if (name) {
      const nameParts = name.trim().split(" ");
      staffUser.firstName = nameParts[0];
      staffUser.lastName = nameParts.slice(1).join(" ") || "";
    }
    if (department !== undefined) staffUser.department = department;
    if (roleId) staffUser.role = roleId;
    if (status) staffUser.status = status;
    if (permissions && typeof permissions === "object") staffUser.permissions = permissions;
    if (password && password.trim().length > 0) {
      staffUser.password = await bcrypt.hash(password.trim(), 10);
    }

    await staffUser.save();

    return res.status(200).json({
      success: true,
      message: "Internal admin account updated successfully.",
      user: {
        id: staffUser._id.toString(),
        _id: staffUser._id.toString(),
        name: `${staffUser.firstName} ${staffUser.lastName}`.trim(),
        email: staffUser.email,
        roleId: staffUser.role,
        department: staffUser.department,
        status: staffUser.status,
        permissions: staffUser.permissions
      }
    });
  } catch (error) {
    console.error("UPDATE ADMIN STAFF ERROR:", error);
    return res.status(500).json({ message: error.message || "Failed to update admin staff." });
  }
};

/**
 * DELETE /api/admin/staff/:id
 * Delete an internal admin staff account.
 */
export const deleteAdminStaff = async (req, res) => {
  try {
    if (!isInternalAdmin(req.user)) {
      return res.status(403).json({ message: "Forbidden: Admin access required." });
    }

    const { id } = req.params;
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: "Staff user account not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Staff user account deleted successfully."
    });
  } catch (error) {
    console.error("DELETE ADMIN STAFF ERROR:", error);
    return res.status(500).json({ message: error.message || "Failed to delete admin staff." });
  }
};

/**
 * PUT /api/admin/roles/:roleId
 * Update permissions for a role (e.g. support_admin, billing_admin) across ALL users in MongoDB having that role.
 */
export const updateRolePermissionsInBulk = async (req, res) => {
  try {
    if (!isInternalAdmin(req.user)) {
      return res.status(403).json({ message: "Forbidden: Admin access required." });
    }

    const { roleId } = req.params;
    const { permissions } = req.body;

    if (!permissions || typeof permissions !== "object") {
      return res.status(400).json({ message: "Valid permissions object is required." });
    }

    // Update ALL users in MongoDB assigned to this role
    const updateResult = await User.updateMany(
      {
        $or: [
          { role: roleId },
          { role: { $regex: roleId, $options: "i" } }
        ]
      },
      { $set: { permissions: permissions } }
    );

    return res.status(200).json({
      success: true,
      message: `Role permissions updated and synced across ${updateResult.modifiedCount || updateResult.nModified || 0} user account(s).`,
      modifiedCount: updateResult.modifiedCount || updateResult.nModified || 0
    });
  } catch (error) {
    console.error("UPDATE ROLE PERMISSIONS ERROR:", error);
    return res.status(500).json({ message: error.message || "Failed to update role permissions." });
  }
};

