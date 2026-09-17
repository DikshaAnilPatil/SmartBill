import React, { useMemo } from "react";
import FilterBar from "./components/FilterBar";
import { ArrowUpRight, ArrowDownRight, Loader2, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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

export default function ProfitLossReport() {
  const { from, to, setFrom, setTo, appliedRange, apply } = useReportFilters();
  const { filteredOrders, filteredExpenses, filteredPurchases, loading } = useReportData(
    appliedRange.from,
    appliedRange.to
  );

  const derived = useMemo(() => {
    // 1. Gross Revenue & Sales Returns
    const totalSalesGross = filteredOrders.reduce(
      (s, o) => s + (Number(o.totalOrderValue || o.total) || 0),
      0
    );
    const totalReturns = filteredOrders.reduce(
      (s, o) => s + (Number(o.refundAmount) || 0),
      0
    );
    const netRevenue = Math.max(0, totalSalesGross - totalReturns);

    // 2. Cost of Goods Sold (COGS)
    let cogs = 0;
    filteredOrders.forEach((o) => {
      if (Number(o.totalCogs) > 0) {
        cogs += Number(o.totalCogs);
      } else if (Array.isArray(o.items)) {
        o.items.forEach((it) => {
          cogs += (Number(it.cost) || 0) * (Number(it.qty) || 0);
        });
      }
    });

    // 3. Operating Expenses
    const operatingExpenses = filteredExpenses.reduce(
      (s, e) => s + (Number(e.amount) || 0),
      0
    );

    // 4. Procurement Purchases (Cash outflow / inventory purchases)
    const totalPurchases = filteredPurchases.reduce(
      (s, p) => s + (Number(p.totalAmount) || 0),
      0
    );

    // 5. Authoritative Profit Calculations
    // Gross Profit = Net Revenue - COGS
    // Net Profit = Gross Profit - Operating Expenses
    const grossProfit = netRevenue - cogs;
    const netProfit = grossProfit - operatingExpenses;
    const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
    const netMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

    return {
      totalSalesGross,
      totalReturns,
      netRevenue,
      cogs,
      operatingExpenses,
      totalPurchases,
      grossProfit,
      netProfit,
      grossMargin,
      netMargin,
    };
  }, [filteredOrders, filteredExpenses, filteredPurchases]);

  // Monthly Income & Expense data
  const plData = useMemo(() => {
    const monthsMap = {};
    MONTH_NAMES.forEach((m) => {
      monthsMap[m] = { month: m, revenue: 0, cogs: 0, expenses: 0, netProfit: 0 };
    });

    filteredOrders.forEach((o) => {
      const dateObj = new Date(o.date || o.createdAt);
      if (!isNaN(dateObj.getTime())) {
        const m = MONTH_NAMES[dateObj.getMonth()];
        const rev = (Number(o.totalOrderValue || o.total) || 0) - (Number(o.refundAmount) || 0);
        let itemCogs = Number(o.totalCogs) || 0;
        if (!itemCogs && Array.isArray(o.items)) {
          o.items.forEach((it) => {
            itemCogs += (Number(it.cost) || 0) * (Number(it.qty) || 0);
          });
        }
        monthsMap[m].revenue += rev;
        monthsMap[m].cogs += itemCogs;
      }
    });

    filteredExpenses.forEach((e) => {
      const dateObj = new Date(e.date || e.createdAt);
      if (!isNaN(dateObj.getTime())) {
        const m = MONTH_NAMES[dateObj.getMonth()];
        monthsMap[m].expenses += Number(e.amount) || 0;
      }
    });

    return MONTH_NAMES.map((m) => {
      const entry = monthsMap[m];
      entry.netProfit = entry.revenue - entry.cogs - entry.expenses;
      return entry;
    });
  }, [filteredOrders, filteredExpenses]);

  // Category breakdown for expenses
  const expenseCats = useMemo(() => {
    const catMap = {};
    filteredExpenses.forEach((e) => {
      const cat = e.category || "Other";
      catMap[cat] = (catMap[cat] || 0) + (Number(e.amount) || 0);
    });

    const items = Object.entries(catMap).map(([name, v]) => ({ name, v }));
    items.sort((a, b) => b.v - a.v);

    return items;
  }, [filteredExpenses]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-600" />
        <p className="text-sm font-medium">Loading Profit & Loss statement...</p>
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            value: fmt(derived.netRevenue),
            label: "Net Sales Revenue",
            sub: derived.totalReturns > 0 ? `After ${fmt(derived.totalReturns)} returns` : `${filteredOrders.length} orders`,
            trend: "up",
          },
          {
            value: fmt(derived.cogs),
            label: "Cost of Goods Sold (COGS)",
            sub: "Procurement cost of sold items",
            trend: "down",
          },
          {
            value: fmt(derived.grossProfit),
            label: "Gross Profit",
            sub: `${derived.grossMargin.toFixed(1)}% gross margin`,
            trend: derived.grossProfit >= 0 ? "up" : "down",
          },
          {
            value: fmt(derived.netProfit),
            label: "Net Profit",
            sub: `${derived.netMargin.toFixed(1)}% net margin`,
            trend: derived.netProfit >= 0 ? "up" : "down",
          },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xl font-bold text-slate-900 font-mono">{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5 mb-2">{s.label}</p>
            <span
              className={`text-xs font-medium flex items-center gap-1 ${
                s.trend === "up" ? "text-emerald-600" : "text-rose-600"
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

      {/* Income Statement Table */}
      <Card className="p-5 border border-slate-200">
        <h3 className="font-semibold text-slate-900 mb-4 text-base">Comprehensive Income Statement (P&L)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs font-semibold">
                <th className="py-2.5">Line Item</th>
                <th className="py-2.5 text-right">Amount (₹)</th>
                <th className="py-2.5 text-right">% of Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              <tr>
                <td className="py-2.5 font-semibold text-slate-900">Gross Sales Revenue</td>
                <td className="py-2.5 text-right font-mono font-semibold">{fmt(derived.totalSalesGross)}</td>
                <td className="py-2.5 text-right font-mono">100.0%</td>
              </tr>
              {derived.totalReturns > 0 && (
                <tr className="text-rose-600">
                  <td className="py-2.5 pl-4">Less: Sales Returns / Credit Notes</td>
                  <td className="py-2.5 text-right font-mono">-{fmt(derived.totalReturns)}</td>
                  <td className="py-2.5 text-right font-mono">{((derived.totalReturns / (derived.totalSalesGross || 1)) * 100).toFixed(1)}%</td>
                </tr>
              )}
              <tr className="bg-slate-50/70 font-semibold text-slate-900">
                <td className="py-2.5">Net Sales Revenue</td>
                <td className="py-2.5 text-right font-mono">{fmt(derived.netRevenue)}</td>
                <td className="py-2.5 text-right font-mono">100.0%</td>
              </tr>
              <tr className="text-slate-600">
                <td className="py-2.5 pl-4">Less: Cost of Goods Sold (COGS)</td>
                <td className="py-2.5 text-right font-mono text-rose-600">-{fmt(derived.cogs)}</td>
                <td className="py-2.5 text-right font-mono">{((derived.cogs / (derived.netRevenue || 1)) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="bg-blue-50/50 font-bold text-blue-950">
                <td className="py-2.5">Gross Profit</td>
                <td className="py-2.5 text-right font-mono text-blue-700">{fmt(derived.grossProfit)}</td>
                <td className="py-2.5 text-right font-mono text-blue-700">{derived.grossMargin.toFixed(1)}%</td>
              </tr>
              <tr className="text-slate-600">
                <td className="py-2.5 pl-4">Less: Operating Expenses (OPEX)</td>
                <td className="py-2.5 text-right font-mono text-rose-600">-{fmt(derived.operatingExpenses)}</td>
                <td className="py-2.5 text-right font-mono">{((derived.operatingExpenses / (derived.netRevenue || 1)) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="bg-emerald-50/70 font-bold text-emerald-950 text-base border-t-2 border-emerald-300">
                <td className="py-3">Net Profit Before Tax</td>
                <td className={`py-3 text-right font-mono ${derived.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {fmt(derived.netProfit)}
                </td>
                <td className={`py-3 text-right font-mono ${derived.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {derived.netMargin.toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Revenue vs Cost Area Chart */}
      <ReportCard className="p-5">
        <h3 className="font-semibold text-slate-900 mb-5">
          Monthly Revenue vs Net Profit Trend
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={plData}>
            <defs>
              <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              formatter={(v) => [fmt(v)]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Net Revenue"
              stroke="#2563EB"
              fillOpacity={1}
              fill="url(#colorRev)"
            />
            <Area
              type="monotone"
              dataKey="netProfit"
              name="Net Profit"
              stroke="#10B981"
              fillOpacity={1}
              fill="url(#colorNet)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ReportCard>

      {/* Expense Breakdown */}
      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Operating Expense Distribution</h3>
        <div className="space-y-3">
          {expenseCats.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              No operating expenses recorded for this period.
            </p>
          ) : (
            expenseCats.map((cat) => {
              const pct = derived.operatingExpenses > 0 ? (cat.v / derived.operatingExpenses) * 100 : 0;
              return (
                <div key={cat.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-700">
                    <span>{cat.name}</span>
                    <span className="font-mono text-slate-900">
                      {fmt(cat.v)} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
