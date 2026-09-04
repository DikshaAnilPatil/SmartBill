import { useState, useEffect } from "react";
import Revenue from "./pages/admin/Revenue";
import BusinessesNew from "./pages/admin/BusinessesNew";
import Sidebar from "@shared/layouts/Sidebar";
import Topbar from "@shared/layouts/Topbar";
import TrialBanner from "@shared/components/common/TrialBanner";
import SuperAdminDashboard from "./pages/dashboard/SuperAdminDashboard";
import SuperAdminSettingsScreen from "./pages/admin/SuperAdminSettingsScreen";
import SubscriptionManagementScreen from "./pages/admin/SubscriptionManagementScreen";
import AdminRolesScreen from "./pages/admin/AdminRolesScreen";
import NotificationsScreen from "./pages/users/NotificationsScreen";
import ProfileScreen from "./pages/settings/ProfileScreen";
import { useCustomization } from "@shared/hooks/useCustomization";
import { useLowStock } from "@shared/hooks/useLowStock";
import { useNotifications } from "@shared/hooks/useNotifications";
import { Toaster } from "sonner";
import { AlertTriangle, X, ShoppingCart, TrendingDown, ShieldAlert, Info } from "lucide-react";
import { hasPermission } from "@shared/utils/permissions";

function LowStockAlert({ lowStockItems, outOfStockItems, globalThreshold, onClose, onNav }) {
  const total = lowStockItems.length + outOfStockItems.length;

  if (total === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-80 shadow-2xl rounded-2xl overflow-hidden border border-amber-200 animate-in slide-in-from-bottom-4"
      style={{ animation: "slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-semibold text-sm">Low Stock Alert</span>
          <span className="bg-white/25 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {total}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Items list */}
      <div className="bg-white max-h-56 overflow-y-auto divide-y divide-slate-100">
        {outOfStockItems.map((p) => (
          <div key={p._id || p.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="w-3.5 h-3.5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{p.name}</p>
              <p className="text-[10px] text-red-500 font-medium">Out of Stock</p>
            </div>
            <span className="text-xs font-bold text-red-500 font-mono">0</span>
          </div>
        ))}
        {lowStockItems.map((p) => (
          <div key={p._id || p.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{p.name}</p>
              <p className="text-[10px] text-amber-600">
                Min: {p.minStock !== undefined && p.minStock !== null && p.minStock !== "" ? p.minStock : globalThreshold || 10}
              </p>
            </div>
            <span className="text-xs font-bold text-amber-600 font-mono">{p.stock} left</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-100">
        <button
          onClick={() => {
            onNav("inventory");
            onClose();
          }}
          className="w-full text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors text-center cursor-pointer"
        >
          View Inventory →
        </button>
      </div>
    </div>
  );
}

function AccessDenied({ pageKey, onNav }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-white rounded-xl border border-slate-200 shadow-sm max-w-lg mx-auto my-12">
      <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4 text-amber-600 border border-amber-200">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
        You do not have permission to access the{" "}
        <span className="font-semibold text-slate-800 capitalize">{pageKey}</span>{" "}
        module. Please contact your business owner to request access.
      </p>
      <button
        onClick={() => onNav("dashboard")}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
      >
        Return to Dashboard
      </button>
    </div>
  );
}

export default function AppShell({ role, user, onLogout, page, onNav }) {
  const [collapsed, setCollapsed] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const { unreadCount } = useNotifications();

  const { lowStockItems, outOfStockItems, alertCount, globalThreshold } = useLowStock(
    20_000,
    role !== "superadmin"
  );

  useEffect(() => {
    if (alertCount > 0) {
      setAlertDismissed(false);
    }
  }, [alertCount]);

  const totalAlerts = role === "superadmin" ? 0 : alertCount;
  const bellCount = unreadCount;

  const renderPage = () => {
    if (!hasPermission(user, page)) {
      return <AccessDenied pageKey={page} onNav={onNav} />;
    }

    switch (page) {
      case "super-dashboard":
        return <SuperAdminDashboard />;
      case "businesses":
        return <BusinessesNew />;
      case "revenue":
        return <Revenue />;
      case "admin-role":
        return <AdminRolesScreen />;
      case "subscriptions":
        return <SubscriptionManagementScreen />;
      case "settings":
        return <SuperAdminSettingsScreen />;
      case "notifications":
        return <NotificationsScreen onNav={onNav} user={user} role={role} />;
      case "profile":
        return <ProfileScreen user={user} />;
      default:
        return <SuperAdminDashboard />;
    }
  };

  return (
    <div
      className="flex h-screen bg-slate-100 dark:bg-slate-950 overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <Toaster position="top-right" richColors closeButton />
      <Sidebar
        page={page}
        onNav={onNav}
        role={role}
        user={user}
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TrialBanner user={user} onNav={onNav} />
        <Topbar
          page={page}
          onLogout={onLogout}
          onNav={onNav}
          role={role}
          user={user}
          notifCount={bellCount}
        />
        <main className="flex-1 overflow-y-auto p-6 flex flex-col">
          <div className="flex-1">
            {renderPage()}
          </div>
        </main>
      </div>

      {/* Low Stock Floating Alert (Disabled for Super Admin) */}
      {!alertDismissed && role !== "superadmin" && totalAlerts > 0 && (
        <LowStockAlert
          lowStockItems={lowStockItems}
          outOfStockItems={outOfStockItems}
          globalThreshold={globalThreshold}
          onClose={() => setAlertDismissed(true)}
          onNav={onNav}
        />
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </div>
  );
}



