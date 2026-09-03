import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  CreditCard,
  DollarSign,
  Users,
} from "lucide-react";
import { StatCard } from "@shared/components/common/ui";
import adminAPI from "@shared/api/adminAPI";

export default function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getDashboardStats();
      if (res && res.success) {
        setDashboardData(res);
      }
    } catch (err) {
      console.error("Failed to load superadmin dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const stats = dashboardData?.stats || {
    totalBusinesses: 0,
    totalUsers: 0,
    activeSubscriptions: 0,
    mrr: 0,
    totalGMV: 0,
    totalOrders: 0,
  };

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
    </div>
  );
}




