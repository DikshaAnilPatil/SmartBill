import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  CreditCard,
  DollarSign,
  Users,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
} from "recharts";
import { Card, StatCard } from "@shared/components/common/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/components/ui/select";
import adminAPI from "@shared/api/adminAPI";

export default function SuperAdminDashboard() {
  const [timeRange, setTimeRange] = useState("6M");
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getDashboardStats({ range: timeRange });
      if (res && res.success) {
        setDashboardData(res);
      }
    } catch (err) {
      console.error("Failed to load superadmin dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const stats = dashboardData?.stats || {
    totalBusinesses: 0,
    totalUsers: 0,
    activeSubscriptions: 0,
    mrr: 50000,
    totalGMV: 0,
    totalOrders: 0,
  };

  const revenueChartData = dashboardData?.revenueByRange || [];
  const planDistribution = dashboardData?.planDistribution || [
    { name: "Starter", value: 0, color: "#CBD5E1" },
    { name: "Pro", value: 0, color: "#2563EB" },
    { name: "Enterprise", value: 0, color: "#7C3AED" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Header Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Businesses"
          value={Number(stats.totalBusinesses).toLocaleString("en-IN")}
          sub="Registered Accounts"
          trend="up"
          icon={<Building2 className="w-5 h-5" />}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Total Users & Staff"
          value={Number(stats.totalUsers).toLocaleString("en-IN")}
          sub="Active Identities"
          trend="up"
          icon={<Users className="w-5 h-5" />}
          color="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Active Paid Plans"
          value={Number(stats.activeSubscriptions).toLocaleString("en-IN")}
          sub="Pro & Enterprise"
          trend="up"
          icon={<CreditCard className="w-5 h-5" />}
          color="bg-purple-50 text-purple-600"
        />
        <StatCard
          label="Platform MRR"
          value={`₹${Number(stats.mrr).toLocaleString("en-IN")}`}
          sub="Monthly Recurring Revenue"
          trend="up"
          icon={<DollarSign className="w-5 h-5" />}
          color="bg-amber-50 text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Revenue Analytics Area Chart */}
        <Card className="lg:col-span-2 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-slate-900">
                Revenue Trajectory
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monthly sales volume & active business accounts
              </p>
            </div>
            <div className="w-[130px]">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="h-8 text-xs bg-white border border-slate-200 shadow-sm">
                  <SelectValue placeholder="Select Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3M">3 Months</SelectItem>
                  <SelectItem value="6M">6 Months</SelectItem>
                  <SelectItem value="1Y">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#94A3B8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#94A3B8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => {
                    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
                    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}k`;
                    return `₹${v}`;
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F172A",
                    color: "#fff",
                    borderRadius: 10,
                    fontSize: 12,
                    border: "none",
                  }}
                  formatter={(v) => [
                    `₹${Number(v).toLocaleString("en-IN")}`,
                    "Gross Revenue",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fill="url(#adminGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Plan Distribution Pie Chart */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 mb-1">
              Plan Distribution
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Breakdown across active businesses
            </p>
          </div>

          <div className="h-44 w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={planDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={74}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {planDistribution.map((entry, i) => (
                    <Cell key={`plan-${i}`} fill={entry.color} />
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
                  formatter={(v, name, item) => {
                    const total = planDistribution.reduce((s, p) => s + (Number(p.value) || 0), 0);
                    const pct = total > 0 ? ((Number(v) / total) * 100).toFixed(1) : "0.0";
                    return [
                      `${v} Businesses (${pct}%)`,
                      item.payload.name + " Plan",
                    ];
                  }}
                />
              </RechartsPie>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 mt-3 pt-3 border-t border-slate-100">
            {planDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900 font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}




