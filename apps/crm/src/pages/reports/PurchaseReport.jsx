import React, { useMemo } from "react";
import FilterBar from "./components/FilterBar";
import { ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart as RechartsPie,
  Pie,
  Cell,
} from "recharts";
import ReportCard from "./components/ReportCard";
import { Card } from "@shared/components/common/ui";
import { useReportData } from "./useReportData";
import { useReportFilters } from "./useReportFilters";
import { fmt } from "@shared/utils/format";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function PurchaseReport() {
  const { from, to, setFrom, setTo, appliedRange, apply } = useReportFilters();
  const { suppliers, products, filteredPurchases, loading } = useReportData(
    appliedRange.from,
    appliedRange.to
  );

  const derived = useMemo(() => {
    const totalPurchases = filteredPurchases.reduce(
      (sum, p) => sum + (Number(p.totalAmount) || 0),
      0
    );
    const supplierPayments = filteredPurchases.reduce(
      (sum, p) => sum + (Number(p.amountPaid) || 0),
      0
    );
    const pendingPayments = filteredPurchases.reduce(
      (sum, p) => sum + (Number(p.remainingAmount) || 0),
      0
    );
    const purchaseOrders = filteredPurchases.length;

    return {
      totalPurchases,
      purchaseOrders,
      supplierPayments,
      pendingPayments,
    };
  }, [filteredPurchases]);

  // Monthly Purchase Trend based on actual purchase records
  const purchaseTrend = useMemo(() => {
    const monthsMap = {};
    MONTH_NAMES.forEach((m) => {
      monthsMap[m] = { month: m, purchases: 0, orders: 0 };
    });

    filteredPurchases.forEach((p) => {
      const dateObj = new Date(p.purchaseDate || p.createdAt || p.date);
      if (!isNaN(dateObj.getTime())) {
        const m = MONTH_NAMES[dateObj.getMonth()];
        monthsMap[m].purchases += Number(p.totalAmount) || 0;
        monthsMap[m].orders += 1;
      }
    });

    return MONTH_NAMES.map((m) => monthsMap[m]);
  }, [filteredPurchases]);

  // Category breakdown based on inventory products
  const purchaseCategories = useMemo(() => {
    const catMap = {};
    products.forEach((p) => {
      const cat = p.category || "General";
      const val = (p.stock || 0) * (p.cost || p.price || 0);
      catMap[cat] = (catMap[cat] || 0) + val;
    });

    const items = Object.entries(catMap).map(([name, v]) => ({ name, v }));
    items.sort((a, b) => b.v - a.v);

    if (items.length > 0) return items;

    return [{ name: "General Goods", v: 0 }];
  }, [products]);

  const categoryPie = useMemo(() => {
    const total = purchaseCategories.reduce((s, c) => s + c.v, 0) || 1;
    const colors = ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];
    return purchaseCategories.map((c, i) => ({
      name: c.name,
      value: (c.v / total) * 100,
      color: colors[i % colors.length],
    }));
  }, [purchaseCategories]);

  // Top suppliers from actual purchases combined with registered suppliers
  const topSuppliers = useMemo(() => {
    const supMap = {};

    filteredPurchases.forEach((p) => {
      const name = p.supplierName || "Unknown Supplier";
      if (!supMap[name]) {
        supMap[name] = { name, amount: 0, paid: 0, pending: 0 };
      }
      supMap[name].amount += Number(p.totalAmount) || 0;
      supMap[name].paid += Number(p.amountPaid) || 0;
      supMap[name].pending += Number(p.remainingAmount) || 0;
    });

    // Merge registered suppliers if they have balances but no purchases in date range
    suppliers.forEach((s) => {
      if (s.name && !supMap[s.name]) {
        supMap[s.name] = {
          name: s.name,
          amount: Number(s.totalPurchases) || 0,
          paid: Number(s.amountPaid) || 0,
          pending: Number(s.balanceDue || s.balance) || 0,
        };
      }
    });

    return Object.values(supMap);
  }, [filteredPurchases, suppliers]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-600" />
        <p className="text-sm font-medium">Loading purchase information...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FilterBar
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApply={apply}
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            value: fmt(derived.totalPurchases),
            label: "Total Purchases",
            sub: `${filteredPurchases.length} purchase records`,
            trend: "up",
          },
          {
            value: `${derived.purchaseOrders}`,
            label: "Purchase Orders",
            sub: "Total in period",
            trend: "up",
          },
          {
            value: fmt(derived.supplierPayments),
            label: "Supplier Payments",
            sub: "Amount cleared",
            trend: "up",
          },
          {
            value: fmt(derived.pendingPayments),
            label: "Pending Balance Due",
            sub: derived.pendingPayments > 0 ? "Outstanding" : "All cleared",
            trend: derived.pendingPayments > 0 ? "down" : "up",
          },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xl font-bold text-slate-900 font-mono">{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5 mb-2">{s.label}</p>
            <span
              className={`text-xs font-medium flex items-center gap-1 ${
                s.trend === "up" ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {s.trend === "up" ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              {s.sub}
            </span>
          </Card>
        ))}
      </div>

      {/* Monthly Purchase Trend & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ReportCard className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-slate-900">
              Monthly Purchase Trend
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={purchaseTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
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
                tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  fontSize: 12,
                }}
                formatter={(v) => [fmt(v), "Purchases"]}
              />
              <Line
                type="monotone"
                dataKey="purchases"
                stroke="#2563EB"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ReportCard>

        <ReportCard className="p-5">
          <h3 className="font-semibold text-slate-900 mb-5">
            Inventory Purchase Category Breakdown
          </h3>
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="w-full md:w-56 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={categoryPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {categoryPie.map((c) => (
                      <Cell key={c.name} fill={c.color} />
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
                    formatter={(v, name, item) => [
                      `${Number(v || 0).toFixed(1)}% Share`,
                      item?.payload?.name || name || "Category",
                    ]}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 w-full md:w-auto max-h-48 overflow-y-auto pr-2">
              {categoryPie.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center gap-2 text-xs text-gray-600"
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="font-medium truncate max-w-[120px]">
                    {c.name}
                  </span>
                  <span className="font-mono text-gray-400">
                    ({c.value.toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ReportCard>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Supplier Summary</h3>
        <div className="overflow-auto max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase tracking-wider">
                <th className="pb-3">Supplier</th>
                <th className="pb-3 text-right">Total Purchases</th>
                <th className="pb-3 text-right">Amount Paid</th>
                <th className="pb-3 text-right">Pending Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-400">
                    No purchase data available.
                  </td>
                </tr>
              ) : (
                topSuppliers.map((s) => (
                  <tr key={s.name} className="hover:bg-gray-50/50">
                    <td className="py-3 font-semibold text-gray-800">{s.name}</td>
                    <td className="py-3 text-right font-mono text-gray-900">
                      {fmt(s.amount)}
                    </td>
                    <td className="py-3 text-right font-mono text-emerald-600">
                      {fmt(s.paid)}
                    </td>
                    <td className="py-3 text-right font-mono text-rose-600 font-semibold">
                      {fmt(s.pending)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}





