import { useState, useMemo } from "react";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Trash2,
  CheckCheck,
  RefreshCw,
  Search,
  ArrowRight,
  Check,
} from "lucide-react";
import { useNotifications } from "@shared/hooks/useNotifications";
import { Btn, Card, Badge, EmptyState, ConfirmDialog } from "@shared/components/common/ui";

function formatRelativeTime(dateString) {
  try {
    if (!dateString) return "Recently";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Recently";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return "Just now";
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 45) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 7) return `${diffDay}d ago`;

    return date.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return "Recently";
  }
}

const SUPER_ADMIN_CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "businesses", label: "Businesses & Registrations" },
  { value: "subscription", label: "Subscriptions & Revenue" },
  { value: "security", label: "Security & Access" },
  { value: "system", label: "System & Platform" },
];

const OWNER_CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "stock", label: "Stock & Inventory" },
  { value: "sale", label: "Sales & Invoices" },
  { value: "purchase", label: "Purchases" },
  { value: "expense", label: "Expenses" },
  { value: "subscription", label: "Subscriptions" },
  { value: "customer", label: "Customers" },
  { value: "system", label: "System" },
];

export default function NotificationsScreen({ onNav, user, role }) {
  const isSuperAdmin = role === "superadmin" || user?.role === "superadmin";
  const categoryOptions = isSuperAdmin ? SUPER_ADMIN_CATEGORIES : OWNER_CATEGORIES;

  const {
    notifications = [],
    unreadCount = 0,
    loading = false,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    refresh,
  } = useNotifications();

  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'unread'
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (refresh) await refresh();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const safeNotifications = Array.isArray(notifications) ? notifications : [];

  const filteredNotifications = useMemo(() => {
    return safeNotifications.filter((notif) => {
      if (!notif) return false;
      // If superadmin, completely filter out any stock notifications that might exist in memory
      if (isSuperAdmin && notif.category === "stock") return false;

      if (activeTab === "unread" && notif.read) return false;
      if (selectedCategory !== "all" && notif.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = String(notif.title || "").toLowerCase().includes(q);
        const msgMatch = String(notif.message || "").toLowerCase().includes(q);
        if (!titleMatch && !msgMatch) return false;
      }
      return true;
    });
  }, [safeNotifications, activeTab, selectedCategory, searchQuery, isSuperAdmin]);

  const getTypeIcon = (type) => {
    switch (type) {
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case "info":
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getTypeIconBg = (type) => {
    switch (type) {
      case "warning":
        return "bg-amber-50 border border-amber-200";
      case "error":
        return "bg-red-50 border border-red-200";
      case "success":
        return "bg-emerald-50 border border-emerald-200";
      case "info":
      default:
        return "bg-blue-50 border border-blue-200";
    }
  };

  const getCategoryBadgeVariant = (category) => {
    switch (category) {
      case "businesses":
        return "blue";
      case "security":
        return "red";
      case "stock":
        return "yellow";
      case "sale":
        return "green";
      case "purchase":
        return "purple";
      case "expense":
        return "red";
      case "subscription":
        return "indigo";
      case "customer":
        return "blue";
      default:
        return "gray";
    }
  };

  const getLinkDestinationLabel = (link) => {
    switch (link) {
      case "super-dashboard":
        return "View Overview";
      case "businesses":
        return "View Businesses";
      case "revenue":
        return "View Revenue";
      case "inventory":
        return "View Inventory";
      case "pos":
        return "View Sales";
      case "purchase":
        return "View Purchases";
      case "expenses":
        return "View Expenses";
      case "customers":
        return "View Customers";
      case "suppliers":
        return "View Suppliers";
      case "settings":
        return "View Settings";
      case "profile":
        return "View Profile";
      default:
        return "View Details";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Notifications</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
              : "All notifications are read"}
          </p>
        </div>

        {/* Top actions */}
        <div className="flex items-center gap-2">
          <Btn
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Btn>

          {unreadCount > 0 && (
            <Btn
              variant="outline"
              size="sm"
              onClick={() => markAllAsRead && markAllAsRead()}
              className="text-xs"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Mark all as read
            </Btn>
          )}

          {safeNotifications.length > 0 && (
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Clear all
            </Btn>
          )}
        </div>
      </div>

      {/* ── Controls: Tabs + Filter + Search ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* All / Unread Tabs */}
        <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg border border-gray-200 dark:border-slate-700 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === "all"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            All ({safeNotifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("unread")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === "unread"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[10px] font-semibold">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Category Filter + Search */}
        <div className="flex items-center gap-2 flex-1 sm:justify-end">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="border border-gray-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-xs text-gray-700 dark:text-slate-200 px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
          >
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* ── Main Notifications Card ── */}
      <Card className="overflow-hidden">
        {loading && safeNotifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
            Loading notifications...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={<Bell className="w-8 h-8 text-slate-400" />}
              title="No notifications"
              sub={
                searchQuery || selectedCategory !== "all" || activeTab === "unread"
                  ? "No notifications match your filter criteria."
                  : isSuperAdmin
                  ? "You're all caught up! New business registrations, subscription updates, and platform alerts will appear here."
                  : "You're all caught up! New sales, inventory alerts, and updates will appear here."
              }
              action={
                (searchQuery || selectedCategory !== "all" || activeTab === "unread") ? (
                  <Btn
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("all");
                      setActiveTab("all");
                    }}
                    className="text-xs"
                  >
                    Reset filters
                  </Btn>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {filteredNotifications.map((n, idx) => {
              if (!n) return null;
              const notifId = n._id || n.id || `temp-notif-${idx}`;
              const notifType = n.type || "info";
              const isUnread = !n.read;
              const categoryStr = typeof n.category === "string" ? n.category : "";
              const categoryLabel = categoryStr
                ? categoryStr.charAt(0).toUpperCase() + categoryStr.slice(1)
                : "";

              return (
                <div
                  key={notifId}
                  className={`group p-4 flex items-start gap-3.5 transition-colors ${
                    isUnread
                      ? "bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/60"
                      : "bg-slate-50/40 dark:bg-slate-950/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 opacity-85 hover:opacity-100"
                  }`}
                >
                  {/* Type Icon */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${getTypeIconBg(
                      notifType
                    )}`}
                  >
                    {getTypeIcon(notifType)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {/* Unread indicator */}
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                      )}

                      <h4
                        className={`text-sm font-semibold ${
                          isUnread
                            ? "text-slate-900 dark:text-white"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {n.title || "Notification"}
                      </h4>

                      {categoryStr && (
                        <Badge
                          label={categoryLabel}
                          variant={getCategoryBadgeVariant(categoryStr)}
                        />
                      )}

                      <span className="text-xs text-slate-400 font-normal ml-auto flex-shrink-0">
                        {formatRelativeTime(n.createdAt || n.time)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {n.message || ""}
                    </p>

                    {/* Navigation Link */}
                    {n.link && onNav && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (isUnread && markAsRead) markAsRead(notifId);
                            onNav(n.link);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors cursor-pointer"
                        >
                          <span>{getLinkDestinationLabel(n.link)}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Row Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {isUnread && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (markAsRead) markAsRead(notifId);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-md transition-colors cursor-pointer"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (deleteNotification) deleteNotification(notifId);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Clear All Confirmation Dialog ── */}
      {showClearConfirm && (
        <ConfirmDialog
          message="Are you sure you want to clear all notifications? This action cannot be undone."
          onConfirm={async () => {
            setShowClearConfirm(false);
            if (clearAllNotifications) {
              await clearAllNotifications();
            }
          }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}
