import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  FileText,
  CreditCard,
  ArrowUpRight,
  ChevronDown,
  Download,
  Calendar,
  Percent,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Building2,
  Users,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
} from "recharts";
import adminAPI from "@shared/api/adminAPI";

const fmt = (val) => `₹${Number(val || 0).toLocaleString("en-IN")}`;
const fmtL = (val) => {
  const n = Number(val || 0);
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
};

export default function Revenue() {
  const [timeframe, setTimeframe] = useState("6M");
  const [selectedBusiness, setSelectedBusiness] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const fetchRevenueData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await adminAPI.getRevenueAnalytics({
        timeframe,
        businessId: selectedBusiness,
      });
      if (res && res.success) {
        setData(res);
      }
    } catch (err) {
      console.error("Failed to load revenue analytics:", err);
      setError(err?.response?.data?.message || err.message || "Failed to load revenue analytics.");
    } finally {
      setLoading(false);
    }
  }, [timeframe, selectedBusiness]);

  useEffect(() => {
    fetchRevenueData();
  }, [fetchRevenueData]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!data) return;
    const summary = data.summary || {};
    const rows = [
      ["SmartBill Platform Revenue Analytics Report"],
      ["Generated At", new Date().toLocaleString("en-IN")],
      ["Timeframe", timeframe],
      ["Business Scope", selectedBusiness === "all" ? "All Registered Businesses" : selectedBusiness],
      [],
      ["--- Platform Summary ---"],
      ["Total Businesses", summary.totalBusinesses || 0],
      ["Total Orders Processed", summary.totalOrders || 0],
      ["Total Ecosystem GMV (INR)", summary.totalGMV || 0],
      ["Platform Monthly Recurring Revenue (MRR)", summary.platformMRR || 0],
      ["Platform Annual Run Rate (ARR)", summary.platformARR || 0],
      ["Active Paid Subscribers", summary.activeSubscribersCount || 0],
      ["Total Tax Collected (INR)", summary.totalTaxCollected || 0],
      ["Total Unpaid / Outstanding Balance (INR)", summary.totalOutstanding || 0],
      [],
      ["--- Daily Revenue Reconciliation ---"],
      ["Date", "Orders Count", "Tax Collected (INR)", "Gross Revenue (INR)", "Status"],
      ...(data.dailyRevenueReport || []).map((d) => [
        d.date,
        d.sales,
        d.taxCollected,
        d.grossRevenue,
        d.status,
      ]),
      [],
      ["--- Top Businesses by Sales Volume ---"],
      ["Business Name", "Owner Name", "Email", "Plan", "Orders", "Total Sales (INR)"],
      ...(data.topBusinesses || []).map((b) => [
        b.name,
        b.owner,
        b.email,
        b.plan,
        b.ordersCount,
        b.totalSpent,
      ]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SmartBill_Revenue_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = data?.summary || {};
  const weeklyFinancialTrend = data?.weeklyFinancialTrend || [];
  const monthlyFinancialTrend = data?.monthlyFinancialTrend || [];
  const agingInvoicesData = data?.agingInvoicesData || [];
  const paymentMethodData = data?.paymentMethodData || [];
  const categoryRevenueData = data?.categoryRevenueData || [];
  const planDistribution = data?.planDistribution || [];
  const topProducts = data?.topProducts || [];
  const topBusinesses = data?.topBusinesses || [];
  const dailyRevenueReport = data?.dailyRevenueReport || [];
  const businessFilterOptions = data?.businessFilterOptions || [];

  const totalOutstanding = summary.totalOutstanding || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Page Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Platform Revenue Analysis</h1>
            <span className="bg-blue-50 text-blue-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-blue-100 flex items-center gap-1">
              <Zap className="w-3 h-3 text-blue-600" /> Live Data
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time financial aggregation across all registered business owner accounts and subscriptions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Business Selector */}
          <div className="relative">
            <select
              value={selectedBusiness}
              onChange={(e) => setSelectedBusiness(e.target.value)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 pr-8 font-medium cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">🌐 All Businesses ({businessFilterOptions.length})</option>
              {businessFilterOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  🏢 {b.name} ({b.plan})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Timeframe Selector */}
          <div className="relative">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 pr-8 font-medium cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
              <option value="3M">3M</option>
              <option value="6M">6M</option>
              <option value="1Y">1Y</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchRevenueData}
            disabled={loading}
            title="Refresh live data"
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs px-3.5 py-2 rounded-xl font-medium transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchRevenueData} className="underline font-semibold ml-2">Retry</button>
        </div>
      )}

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Platform MRR / Subscription Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              SaaS MRR
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-0.5">{fmt(summary.platformMRR)}</p>
          <p className="text-xs text-slate-500">Monthly Recurring Revenue</p>
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mt-3 pt-3 border-t border-slate-100">
            <span>ARR: <strong className="text-slate-900">{fmt(summary.platformARR)}</strong></span>
            <span className="text-purple-600 font-semibold">{summary.activeSubscribersCount || 0} Paid Plans</span>
          </div>
        </div>

        {/* Total Ecosystem GMV / Sales Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Ecosystem GMV
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-0.5">{fmt(summary.totalGMV)}</p>
          <p className="text-xs text-slate-500">Total Business Sales Processed</p>
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mt-3 pt-3 border-t border-slate-100">
            <span>Orders: <strong className="text-slate-900">{summary.totalOrders || 0}</strong></span>
            <span className="text-emerald-600 font-semibold">Avg ₹{summary.avgOrderValue || 0}/order</span>
          </div>
        </div>

        {/* Taxes & GST Collected */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              GST Collected
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-0.5">{fmt(summary.totalTaxCollected)}</p>
          <p className="text-xs text-slate-500">Total Tax & GST Inflow</p>
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mt-3 pt-3 border-t border-slate-100">
            <span>Businesses: <strong className="text-slate-900">{summary.totalBusinesses || 0}</strong></span>
            <span className="text-blue-600 font-semibold">{summary.paidOrdersCount || 0} Invoices Paid</span>
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              Unpaid Balance
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-0.5">{fmt(summary.totalOutstanding)}</p>
          <p className="text-xs text-slate-500">Total Outstanding Across Businesses</p>
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mt-3 pt-3 border-t border-slate-100">
            <span>Pending: <strong className="text-slate-900">{summary.pendingOrdersCount || 0} orders</strong></span>
            <span className="text-amber-600 font-semibold">{agingInvoicesData[0]?.count || 0} Recent</span>
          </div>
        </div>
      </div>

      {/* Main Charts Row: Multi-Month Trend & Plan Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Monthly Historical Revenue Trend */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Monthly Commerce & Revenue Trajectory</h3>
              <p className="text-xs text-slate-500">Gross monthly sales volume and transaction count across businesses.</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-blue-600" /> Sales GMV
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-500" /> Tax Flow
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyFinancialTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="taxGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => fmtL(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0F172A",
                    color: "#fff",
                    borderRadius: "10px",
                    fontSize: "12px",
                    border: "none",
                  }}
                  formatter={(value, name) => [
                    fmt(value),
                    name === "revenue" ? "Sales Volume" : name === "tax" ? "Tax Collected" : name,
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fill="url(#gmvGrad)"
                  name="revenue"
                />
                <Area
                  type="monotone"
                  dataKey="tax"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#taxGrad)"
                  name="tax"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 1 Col: Subscription Plan Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Subscription Plan Distribution</h3>
            <p className="text-xs text-slate-500 mb-4">Active businesses categorized by subscription tier.</p>
          </div>

          <div className="flex flex-col items-center justify-center my-auto">
            <div className="h-44 w-44">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={planDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={74}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {planDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      color: "#ffffff",
                      borderRadius: "10px",
                      fontSize: "12px",
                      border: "1px solid #334155",
                      boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
                    }}
                    itemStyle={{ color: "#38BDF8", fontSize: "12px", fontWeight: "600" }}
                    labelStyle={{ color: "#F8FAFC", fontSize: "12px", fontWeight: "700" }}
                    formatter={(value, name, item) => {
                      const total = planDistribution.reduce((s, p) => s + (Number(p.count) || 0), 0);
                      const pct = total > 0 ? ((Number(value) / total) * 100).toFixed(1) : "0.0";
                      return [
                        `${value} Businesses (${pct}%) • ${fmt(item.payload.revenue)}/mo`,
                        item.payload.name + " Plan",
                      ];
                    }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-2 w-full mt-3">
              {planDistribution.map((item) => (
                <div key={item.name} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <span className="flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-700">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-1">{item.count}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {item.price > 0 ? `₹${item.price}/mo` : "Free"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Aging Invoices & Collections Breakdown */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Aging Invoices & Receivables Analysis</h3>
              <p className="text-xs text-slate-500">Uncollected balances tracked across open statements platform-wide.</p>
            </div>
          </div>
          <span className="text-xs font-bold font-mono text-slate-900 bg-slate-100 px-3 py-1 rounded-xl">
            Total Outstanding: {fmt(totalOutstanding)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {agingInvoicesData.map((item, i) => {
            const pct = totalOutstanding > 0 ? Math.min(100, Math.round((item.amount / totalOutstanding) * 100)) : 0;
            return (
              <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-slate-700">{item.range}</span>
                    {i === 2 && item.amount > 0 && (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                    )}
                  </div>
                  <p className="text-lg font-bold text-slate-900 font-mono">{fmt(item.amount)}</p>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-1.5">
                    <div className={`${item.color} h-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                    <span>{item.count} Unpaid Statements</span>
                    <span className="font-mono">{pct}% of total</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Modes & Business Industry Splits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Modes */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm mb-1">Payment Method Distribution</h3>
            <p className="text-xs text-slate-500 mb-4">Inflow breakdown mapped out across all payment gateways and cash.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <div className="h-44 w-44 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={paymentMethodData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={74}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {paymentMethodData.map((entry, index) => (
                      <Cell key={`pm-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      color: "#ffffff",
                      borderRadius: "10px",
                      fontSize: "12px",
                      border: "1px solid #334155",
                      boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
                    }}
                    itemStyle={{ color: "#38BDF8", fontSize: "12px", fontWeight: "600" }}
                    labelStyle={{ color: "#F8FAFC", fontSize: "12px", fontWeight: "700" }}
                    formatter={(value, name, item) => {
                      const total = paymentMethodData.reduce((s, p) => s + (Number(p.value) || 0), 0);
                      const pct = total > 0 ? ((Number(value) / total) * 100).toFixed(1) : "0.0";
                      return [
                        `${fmt(value)} (${pct}%)`,
                        item?.payload?.name || name || "Payment Method",
                      ];
                    }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2.5 w-full sm:w-auto">
              {paymentMethodData.map((item) => (
                <div key={item.name} className="flex flex-col p-2.5 bg-slate-50 rounded-xl border border-slate-100 min-w-28">
                  <span className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <span className="text-sm font-bold text-slate-900 mt-1 font-mono">{fmt(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Business Industry / Category Split */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-1">Revenue by Business Industry</h3>
          <p className="text-xs text-slate-500 mb-4">Total revenue driven categorized by registered business vertical.</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={categoryRevenueData} margin={{ top: 10, right: 15, left: 35, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#94A3B8"
                  fontSize={10}
                  tickFormatter={(v) => fmtL(v)}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis dataKey="category" type="category" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => fmt(value)}
                  contentStyle={{
                    background: "#0F172A",
                    color: "#fff",
                    borderRadius: "8px",
                    fontSize: "12px",
                    border: "none",
                  }}
                />
                <Bar dataKey="revenue" fill="#8B5CF6" radius={[0, 6, 6, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Performers: Top Businesses & Top Products */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Businesses by Volume */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Top-Performing Businesses</h3>
              <p className="text-xs text-slate-500">Highest grossing business accounts on the platform.</p>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold border border-emerald-100">
              Top Merchants
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-xs">
                  <th className="text-left pb-2 font-semibold">Business</th>
                  <th className="text-center pb-2 font-semibold">Plan</th>
                  <th className="text-center pb-2 font-semibold">Orders</th>
                  <th className="text-right pb-2 font-semibold">Total GMV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topBusinesses.length > 0 ? (
                  topBusinesses.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5">
                        <p className="text-slate-900 font-semibold text-xs">{b.name}</p>
                        <p className="text-[10px] text-slate-400">{b.email}</p>
                      </td>
                      <td className="py-2.5 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.plan === "PRO"
                              ? "bg-blue-50 text-blue-700 border border-blue-100"
                              : b.plan === "ENTERPRISE"
                              ? "bg-purple-50 text-purple-700 border border-purple-100"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {b.plan}
                        </span>
                      </td>
                      <td className="py-2.5 text-center font-mono text-xs text-slate-700">{b.ordersCount}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-900">{fmt(b.totalSpent)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs text-slate-400">
                      No business transaction data found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Top-Selling Products</h3>
              <p className="text-xs text-slate-500">Highest grossing inventory products across all businesses.</p>
            </div>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-bold border border-blue-100">
              Best Sellers
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-xs">
                  <th className="text-left pb-2 font-semibold">Product Name</th>
                  <th className="text-center pb-2 font-semibold">Units Sold</th>
                  <th className="text-right pb-2 font-semibold">Gross Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topProducts.length > 0 ? (
                  topProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 text-slate-800 font-medium text-xs">{p.name}</td>
                      <td className="py-2.5 text-center font-mono text-xs text-slate-600">{p.quantity}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-900">{fmt(p.revenue)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-xs text-slate-400">
                      No products recorded in orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Daily Revenue Reconciliation Report */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Daily Revenue Reconciliation Log</h3>
            <p className="text-xs text-slate-500">Recent daily sales transactions, tax compliance logs, and settlements.</p>
          </div>
          <span className="text-[11px] font-medium text-slate-500">
            Showing latest {dailyRevenueReport.length} active billing days
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-xs">
                <th className="text-left pb-3 font-semibold">Date Log</th>
                <th className="text-center pb-3 font-semibold">Orders Processed</th>
                <th className="text-right pb-3 font-semibold">Total GST / Tax</th>
                <th className="text-right pb-3 font-semibold">Gross Inflow (GMV)</th>
                <th className="text-center pb-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {dailyRevenueReport.length > 0 ? (
                dailyRevenueReport.map((day, i) => (
                  <tr key={i} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 font-mono text-slate-700 font-medium text-xs">{day.date}</td>
                    <td className="py-3 text-center font-mono text-slate-800 text-xs">{day.sales} Orders</td>
                    <td className="py-3 text-right font-mono text-slate-500 text-xs">{fmt(day.taxCollected)}</td>
                    <td className="py-3 text-right font-mono font-bold text-slate-900 text-xs">{fmt(day.grossRevenue)}</td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {day.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                    No transactions recorded for the selected scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}



