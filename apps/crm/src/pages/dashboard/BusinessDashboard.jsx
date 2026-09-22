import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  AreaChart,
  Area,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  ChevronDown,
  DollarSign,
  FileText,
  Loader2,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Users,
  Wallet,
  RefreshCw,
  Clock,
  Sparkles,
  Layers,
} from "lucide-react";
import { fetchOrders } from "@shared/api/orderAPI";
import { getProducts } from "@shared/api/productAPI";
import { fetchCustomers } from "@shared/api/customerAPI";
import { fetchPurchases } from "@shared/api/purchaseAPI";
import { getExpenses } from "@shared/api/expenseApi";
import { fmt } from "@shared/utils/format";
import { Btn, Card, StatCard, statusBadge } from "@shared/components/common/ui";
import { useCustomization } from "@shared/hooks/useCustomization";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const TIMEFRAMES = [
  { key: "day", label: "Today", desc: "Today's performance", icon: Clock },
  { key: "week", label: "This Week", desc: "Current week (Mon-Sun)", icon: Calendar },
  { key: "month", label: "This Month", desc: "Current month to date", icon: Calendar },
  { key: "year", label: "This Year", desc: "Current calendar year", icon: Calendar },
  { key: "all", label: "Overall", desc: "All-time cumulative data", icon: Layers },
];

export default function BusinessDashboard({ onNav }) {
  const { t, formatCurrency } = useCustomization();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Primary Dashboard Filter: "day" | "week" | "month" | "year" | "all"
  const [timeframe, setTimeframe] = useState("month");

  const loadDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [ordersRes, productsRes, customersRes, purchasesRes, expensesRes] =
        await Promise.allSettled([
          fetchOrders(),
          getProducts(),
          fetchCustomers(),
          fetchPurchases(),
          getExpenses(),
        ]);

      if (ordersRes.status === "fulfilled") {
        setOrders(ordersRes.value?.orders || []);
      }
      if (productsRes.status === "fulfilled") {
        setProducts(productsRes.value?.products || []);
      }
      if (customersRes.status === "fulfilled") {
        const raw = customersRes.value;
        setCustomers(Array.isArray(raw?.customers) ? raw.customers : Array.isArray(raw) ? raw : []);
      }
      if (purchasesRes.status === "fulfilled") {
        const raw = purchasesRes.value;
        setPurchases(Array.isArray(raw?.purchases) ? raw.purchases : Array.isArray(raw) ? raw : []);
      }
      if (expensesRes.status === "fulfilled") {
        setExpenses(expensesRes.value?.expenses || []);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();

    const handleRealtimeUpdate = () => {
      loadDashboardData();
    };

    window.addEventListener("stockUpdated", handleRealtimeUpdate);
    window.addEventListener("productUpdated", handleRealtimeUpdate);
    window.addEventListener("orderCreated", handleRealtimeUpdate);
    window.addEventListener("purchaseCreated", handleRealtimeUpdate);
    window.addEventListener("inventorySettingsUpdated", handleRealtimeUpdate);

    return () => {
      window.removeEventListener("stockUpdated", handleRealtimeUpdate);
      window.removeEventListener("productUpdated", handleRealtimeUpdate);
      window.removeEventListener("orderCreated", handleRealtimeUpdate);
      window.removeEventListener("purchaseCreated", handleRealtimeUpdate);
      window.removeEventListener("inventorySettingsUpdated", handleRealtimeUpdate);
    };
  }, [loadDashboardData]);

  // Dynamic global low stock threshold
  const globalLowStockThreshold = useMemo(() => {
    try {
      const stored = localStorage.getItem("smartbill_inventorySettings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.lowStockAlert !== undefined) return Number(parsed.lowStockAlert) || 10;
      }
    } catch (_) {}
    return 10;
  }, []);

  // Calculate Date Ranges for Current and Previous Period
  const dateRanges = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();

    let currentStart = new Date(0);
    let currentEnd = new Date(now);
    currentEnd.setHours(23, 59, 59, 999);

    let prevStart = null;
    let prevEnd = null;

    if (timeframe === "day") {
      currentStart = new Date(currentYear, currentMonth, currentDate, 0, 0, 0, 0);
      currentEnd = new Date(currentYear, currentMonth, currentDate, 23, 59, 59, 999);

      prevStart = new Date(currentYear, currentMonth, currentDate - 1, 0, 0, 0, 0);
      prevEnd = new Date(currentYear, currentMonth, currentDate - 1, 23, 59, 59, 999);
    } else if (timeframe === "week") {
      const currentDay = now.getDay();
      const distanceToMon = (currentDay + 6) % 7;
      currentStart = new Date(currentYear, currentMonth, currentDate - distanceToMon, 0, 0, 0, 0);
      currentEnd = new Date(currentStart);
      currentEnd.setDate(currentStart.getDate() + 6);
      currentEnd.setHours(23, 59, 59, 999);

      prevStart = new Date(currentStart);
      prevStart.setDate(currentStart.getDate() - 7);
      prevEnd = new Date(currentStart);
      prevEnd.setMilliseconds(-1);
    } else if (timeframe === "month") {
      currentStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
      currentEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

      prevStart = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
      prevEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    } else if (timeframe === "year") {
      currentStart = new Date(currentYear, 0, 1, 0, 0, 0, 0);
      currentEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);

      prevStart = new Date(currentYear - 1, 0, 1, 0, 0, 0, 0);
      prevEnd = new Date(currentYear - 1, 11, 31, 23, 59, 59, 999);
    }

    return { currentStart, currentEnd, prevStart, prevEnd };
  }, [timeframe]);

  // Filtered Orders, Purchases, and Expenses for the chosen timeframe
  const filteredData = useMemo(() => {
    const { currentStart, currentEnd, prevStart, prevEnd } = dateRanges;

    const inRange = (d, start, end) => {
      if (!d) return false;
      const t = new Date(d).getTime();
      return !isNaN(t) && t >= start.getTime() && t <= end.getTime();
    };

    const currentOrders = timeframe === "all"
      ? orders
      : orders.filter((o) => inRange(o.createdAt || o.date, currentStart, currentEnd));

    const prevOrders = (timeframe !== "all" && prevStart && prevEnd)
      ? orders.filter((o) => inRange(o.createdAt || o.date, prevStart, prevEnd))
      : [];

    const currentPurchases = timeframe === "all"
      ? purchases
      : purchases.filter((p) => inRange(p.purchaseDate || p.createdAt || p.date, currentStart, currentEnd));

    const currentExpenses = timeframe === "all"
      ? expenses
      : expenses.filter((e) => inRange(e.date || e.createdAt, currentStart, currentEnd));

    return {
      currentOrders,
      prevOrders,
      currentPurchases,
      currentExpenses,
    };
  }, [orders, purchases, expenses, dateRanges, timeframe]);

  // Derived Key Financial & Operational Metrics
  const metrics = useMemo(() => {
    const { currentOrders, prevOrders, currentPurchases, currentExpenses } = filteredData;

    // 1. Revenue
    const revenue = currentOrders.reduce((sum, o) => sum + (Number(o.totalOrderValue || o.total) || 0), 0);
    const prevRevenue = prevOrders.reduce((sum, o) => sum + (Number(o.totalOrderValue || o.total) || 0), 0);

    // Revenue growth %
    let revenueGrowth = 0;
    if (prevRevenue > 0) {
      revenueGrowth = Math.round(((revenue - prevRevenue) / prevRevenue) * 100);
    } else if (revenue > 0) {
      revenueGrowth = 100;
    }

    // 2. Cost of Goods Sold (COGS) & Profit
    let cogs = 0;
    currentOrders.forEach((o) => {
      if (Number(o.totalCogs) > 0) {
        cogs += Number(o.totalCogs);
      } else if (Array.isArray(o.items)) {
        o.items.forEach((it) => {
          cogs += (Number(it.cost) || 0) * (Number(it.qty) || 0);
        });
      }
    });

    const purchasesTotal = currentPurchases.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);
    const expensesTotal = currentExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const grossProfit = Math.max(0, revenue - cogs);
    const netProfit = grossProfit - expensesTotal;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    // 3. Orders & Average Order Value (AOV)
    const orderCount = currentOrders.length;
    const avgOrderValue = orderCount > 0 ? Math.round(revenue / orderCount) : 0;

    // 4. Low stock count
    const lowStockCount = products.filter((p) => {
      if (p.status === "Inactive") return false;
      const stock = Number(p.stock) || 0;
      const min =
        p.minStock !== undefined && p.minStock !== null && p.minStock !== ""
          ? Number(p.minStock)
          : globalLowStockThreshold;
      return stock <= min;
    }).length;

    return {
      revenue,
      revenueGrowth,
      prevRevenue,
      netProfit,
      netMargin,
      grossProfit,
      cogs,
      purchasesTotal,
      expensesTotal,
      totalOutflow: purchasesTotal + expensesTotal,
      orderCount,
      avgOrderValue,
      totalCustomers: customers.length,
      lowStockItems: lowStockCount,
    };
  }, [filteredData, products, customers, globalLowStockThreshold]);

  // Chart Data dynamically formatted for the chosen timeframe
  const salesPerformanceData = useMemo(() => {
    const { currentOrders } = filteredData;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (timeframe === "day") {
      // 2-Hour Interval Buckets (8 AM, 10 AM, 12 PM, 2 PM, 4 PM, 6 PM, 8 PM, 10 PM)
      const hours = [
        { label: "8 AM", start: 0, end: 9, amount: 0 },
        { label: "10 AM", start: 10, end: 11, amount: 0 },
        { label: "12 PM", start: 12, end: 13, amount: 0 },
        { label: "2 PM", start: 14, end: 15, amount: 0 },
        { label: "4 PM", start: 16, end: 17, amount: 0 },
        { label: "6 PM", start: 18, end: 19, amount: 0 },
        { label: "8 PM", start: 20, end: 21, amount: 0 },
        { label: "10 PM", start: 22, end: 23, amount: 0 },
      ];

      currentOrders.forEach((o) => {
        const d = new Date(o.createdAt || o.date);
        if (!isNaN(d.getTime())) {
          const h = d.getHours();
          const bucket = hours.find((b) => h >= b.start && h <= b.end);
          if (bucket) {
            bucket.amount += Number(o.totalOrderValue || o.total) || 0;
          }
        }
      });

      return {
        chartData: hours.map((h) => ({ label: h.label, amount: h.amount })),
        totalForPeriod: metrics.revenue,
        periodTitle: "Today's Sales Performance",
        periodSubtitle: "Hourly sales distribution for today",
      };
    }

    if (timeframe === "week") {
      const daysMap = {};
      DAYS.forEach((d) => (daysMap[d] = 0));

      currentOrders.forEach((o) => {
        const orderDate = new Date(o.createdAt || o.date);
        if (!isNaN(orderDate.getTime())) {
          const dayIdx = (orderDate.getDay() + 6) % 7;
          const dayName = DAYS[dayIdx];
          const val = Number(o.totalOrderValue || o.total) || 0;
          daysMap[dayName] = (daysMap[dayName] || 0) + val;
        }
      });

      return {
        chartData: DAYS.map((day) => ({ label: day, amount: daysMap[day] })),
        totalForPeriod: metrics.revenue,
        periodTitle: "Weekly Sales Performance",
        periodSubtitle: "Daily sales totals for this week",
      };
    }

    if (timeframe === "month") {
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const buckets = [
        { label: "Week 1 (1-7)", minDay: 1, maxDay: 7, amount: 0 },
        { label: "Week 2 (8-14)", minDay: 8, maxDay: 14, amount: 0 },
        { label: "Week 3 (15-21)", minDay: 15, maxDay: 21, amount: 0 },
        { label: "Week 4 (22-28)", minDay: 22, maxDay: 28, amount: 0 },
      ];
      if (daysInMonth > 28) {
        buckets.push({
          label: `Week 5 (29-${daysInMonth})`,
          minDay: 29,
          maxDay: daysInMonth,
          amount: 0,
        });
      }

      currentOrders.forEach((o) => {
        const orderDate = new Date(o.createdAt || o.date);
        if (!isNaN(orderDate.getTime())) {
          const day = orderDate.getDate();
          const val = Number(o.totalOrderValue || o.total) || 0;
          const targetBucket = buckets.find((b) => day >= b.minDay && day <= b.maxDay);
          if (targetBucket) {
            targetBucket.amount += val;
          }
        }
      });

      const monthName = MONTHS[currentMonth];
      return {
        chartData: buckets.map((b) => ({ label: b.label, amount: b.amount })),
        totalForPeriod: metrics.revenue,
        periodTitle: `Monthly Sales Performance (${monthName} ${currentYear})`,
        periodSubtitle: `Weekly breakdown for ${monthName} ${currentYear}`,
      };
    }

    if (timeframe === "year") {
      const monthsMap = {};
      MONTHS.forEach((m) => (monthsMap[m] = 0));

      currentOrders.forEach((o) => {
        const orderDate = new Date(o.createdAt || o.date);
        if (!isNaN(orderDate.getTime())) {
          const monthName = MONTHS[orderDate.getMonth()];
          const val = Number(o.totalOrderValue || o.total) || 0;
          monthsMap[monthName] = (monthsMap[monthName] || 0) + val;
        }
      });

      return {
        chartData: MONTHS.map((m) => ({ label: m, amount: monthsMap[m] })),
        totalForPeriod: metrics.revenue,
        periodTitle: `Yearly Sales Performance (${currentYear})`,
        periodSubtitle: `Month-by-month sales for ${currentYear}`,
      };
    }

    // "all" (Overall / Lifetime)
    const yearsMap = {};
    currentOrders.forEach((o) => {
      const orderDate = new Date(o.createdAt || o.date);
      if (!isNaN(orderDate.getTime())) {
        const y = String(orderDate.getFullYear());
        yearsMap[y] = (yearsMap[y] || 0) + (Number(o.totalOrderValue || o.total) || 0);
      }
    });

    const sortedYears = Object.keys(yearsMap).sort();
    const chartData = sortedYears.length > 0
      ? sortedYears.map((y) => ({ label: y, amount: yearsMap[y] }))
      : [{ label: String(currentYear), amount: metrics.revenue }];

    return {
      chartData,
      totalForPeriod: metrics.revenue,
      periodTitle: "Overall Lifetime Sales Performance",
      periodSubtitle: "Cumulative year-by-year sales revenue",
    };
  }, [filteredData, timeframe, metrics.revenue]);

  // Category Revenue Share in selected timeframe
  const salesByCategory = useMemo(() => {
    const { currentOrders } = filteredData;
    const catMap = {};
    let grandTotal = 0;

    currentOrders.forEach((o) => {
      (o.items || []).forEach((item) => {
        const cat = item.category || item.product?.category || "General";
        const val = Number(item.amount || (item.price * item.qty)) || 0;
        catMap[cat] = (catMap[cat] || 0) + val;
        grandTotal += val;
      });
    });

    if (grandTotal === 0) {
      products.forEach((p) => {
        const cat = p.category || "General";
        const val = (Number(p.price) || 0) * (Number(p.stock) || 1);
        catMap[cat] = (catMap[cat] || 0) + val;
        grandTotal += val;
      });
    }

    const colors = ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#6366F1"];
    const total = grandTotal || 1;

    const items = Object.entries(catMap).map(([name, amount], idx) => ({
      name,
      amount,
      value: Math.round((amount / total) * 100),
      color: colors[idx % colors.length],
    }));

    items.sort((a, b) => b.amount - a.amount);
    return items;
  }, [filteredData, products]);

  const recentInvoices = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
      .slice(0, 10);
  }, [orders]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-600" />
        <p className="text-sm font-medium">Loading live business performance data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Header & Global Timeframe Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {t("dashboard.title") || "Business Dashboard"}
            </h2>
            <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              {TIMEFRAMES.find((tf) => tf.key === timeframe)?.label} Data
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t("dashboard.subtitle") || "Real-time performance summary and business analytics"}
          </p>
        </div>

        {/* Filter Controls: Day, Week, Month, Year, Overall */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {TIMEFRAMES.map((tf) => {
              const active = timeframe === tf.key;
              const Icon = tf.icon;
              return (
                <button
                  key={tf.key}
                  type="button"
                  onClick={() => setTimeframe(tf.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-slate-200/80 dark:ring-slate-600 font-bold"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50"
                  }`}
                  title={tf.desc}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
                  <span>{tf.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl shadow-2xs hover:shadow transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
            <span className="hidden sm:inline">{refreshing ? "Syncing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Dynamic Metric Cards (Filter-Aware) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={
            timeframe === "day"
              ? "Today's Sales"
              : timeframe === "week"
              ? "This Week's Sales"
              : timeframe === "month"
              ? "This Month's Revenue"
              : timeframe === "year"
              ? "This Year's Revenue"
              : "Overall Lifetime Sales"
          }
          value={formatCurrency(metrics.revenue)}
          sub={
            timeframe === "all"
              ? `${metrics.orderCount} total orders`
              : metrics.prevRevenue > 0
              ? `${metrics.revenueGrowth >= 0 ? "+" : ""}${metrics.revenueGrowth}% vs prev ${timeframe}`
              : `${metrics.orderCount} orders in period`
          }
          trend={metrics.revenueGrowth >= 0 ? "up" : "down"}
          icon={<TrendingUp className="w-5 h-5" />}
          color="bg-blue-50 text-blue-600"
        />

        <StatCard
          label={timeframe === "all" ? "Overall Net Profit" : "Net Profit (Period)"}
          value={formatCurrency(metrics.netProfit)}
          sub={`${metrics.netMargin.toFixed(1)}% net margin`}
          trend={metrics.netProfit >= 0 ? "up" : "down"}
          icon={<DollarSign className="w-5 h-5" />}
          color={metrics.netProfit >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}
        />

        <StatCard
          label="Total Orders & Invoices"
          value={`${metrics.orderCount}`}
          sub={`Avg. Order: ${formatCurrency(metrics.avgOrderValue)}`}
          trend="up"
          icon={<Receipt className="w-5 h-5" />}
          color="bg-purple-50 text-purple-600"
        />

        <StatCard
          label="Purchases & Expenses"
          value={formatCurrency(metrics.totalOutflow)}
          sub={`Purchases: ${formatCurrency(metrics.purchasesTotal)}`}
          trend="down"
          icon={<ShoppingCart className="w-5 h-5" />}
          color="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Dynamic Sales Bar Chart */}
        <Card className="lg:col-span-2 p-5 h-[360px] flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                {salesPerformanceData.periodTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {salesPerformanceData.periodSubtitle}
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-900">
                Total: {formatCurrency(salesPerformanceData.totalForPeriod)}
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={salesPerformanceData.chartData}
              barSize={timeframe === "day" ? 22 : timeframe === "month" ? 34 : timeframe === "week" ? 30 : 20}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#94A3B8", fontSize: timeframe === "month" ? 10 : 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#94A3B8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0F172A",
                  borderColor: "#1E293B",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#ffffff",
                  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.4)",
                }}
                itemStyle={{ color: "#38BDF8", fontWeight: "600" }}
                formatter={(v) => [fmt(v), "Sales Revenue"]}
              />
              <Bar dataKey="amount" fill="#2563EB" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Category Share Breakdown */}
        <div className="space-y-4">
          <Card className="p-5 h-[360px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-base">
                Sales by Category
              </h3>
              <span className="text-[11px] font-medium text-slate-400 capitalize">
                {timeframe}
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto pr-2">
              {salesByCategory.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-10">No category sales in this period</p>
              ) : (
                salesByCategory.map((d) => (
                  <div key={d.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-gray-700 dark:text-gray-300 truncate max-w-[140px]">{d.name}</span>
                      <span className="font-bold text-gray-900 dark:text-white font-mono">
                        {fmt(d.amount)} ({d.value}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(4, d.value)}%`, backgroundColor: d.color }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Financial Breakdown Summary & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Invoices Table */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-base">
                Recent Sales Invoices
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Latest customer billing transactions</p>
            </div>
            <Btn variant="ghost" size="sm" onClick={() => onNav("pos")}>
              Go to POS Billing →
            </Btn>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-96 overflow-y-auto">
            {recentInvoices.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No recent invoices recorded yet. Start billing in POS screen!
              </div>
            ) : (
              recentInvoices.map((inv) => {
                const totalVal = Number(inv.totalOrderValue || inv.total) || 0;
                const paidVal = Number(inv.amountPaid) || 0;
                const status = inv.paymentStatus || (paidVal <= 0 ? "Due" : paidVal >= totalVal ? "Paid" : "Partial");
                const invDate = inv.createdAt || inv.date
                  ? new Date(inv.createdAt || inv.date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })
                  : "";

                return (
                  <div
                    key={inv._id || inv.id || inv.invoiceNo}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="w-9 h-9 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {inv.customerName || inv.customer || "Walk-in Customer"}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {inv.invoiceNo || inv.id || "INV-001"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white font-mono">
                        {fmt(totalVal)}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">{invDate}</p>
                    </div>
                    {statusBadge(status)}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Quick Actions Panel */}
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4 text-base">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "New POS Bill",
                icon: Receipt,
                color: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
                action: () => onNav("pos"),
              },
              {
                label: "Add Product",
                icon: Package,
                color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
                action: () => onNav("products"),
              },
              {
                label: "Add Customer",
                icon: Users,
                color: "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400",
                action: () => onNav("customers"),
              },
              {
                label: "Add Purchase",
                icon: ShoppingCart,
                color: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
                action: () => onNav("purchase"),
              },
              {
                label: "Add Expense",
                icon: Wallet,
                color: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
                action: () => onNav("expenses"),
              },
              {
                label: "View Reports",
                icon: BarChart3,
                color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                action: () => onNav("reports"),
              },
            ].map((q) => (
              <button
                key={q.label}
                onClick={q.action}
                className="flex flex-col items-center gap-2 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all group cursor-pointer bg-white dark:bg-slate-800/50"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${q.color} transition-transform group-hover:scale-105`}
                >
                  <q.icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 text-center leading-tight">
                  {q.label}
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
