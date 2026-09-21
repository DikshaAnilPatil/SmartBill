import { useState, useEffect } from "react";
import { BarChart2, ChevronRight, Menu, UserCircle, Tag, Copy, Check, ArrowRight, Sparkles } from "lucide-react";
import { NAV_GROUPS, SUPER_ADMIN_ITEMS } from "./navConfig";
import { getUserDisplayName } from "@shared/utils/userUtils";
import { useCustomization } from "@shared/hooks/useCustomization";
import { hasPermission } from "@shared/utils/permissions";
import { getFeaturedBanner } from "@shared/api/couponAPI";

export default function Sidebar({ page, onNav, role, collapsed, onToggle, user: propUser, isPlatformAdmin: propsIsPlatformAdmin }) {
  const { t } = useCustomization();
  const [offerBanner, setOfferBanner] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = localStorage.getItem("smartbill_user");
      return raw ? { ...JSON.parse(raw), ...(propUser || {}) } : propUser || {};
    } catch {
      return propUser || {};
    }
  });

  useEffect(() => {
    let isMounted = true;
    getFeaturedBanner()
      .then((res) => {
        if (isMounted && res?.success && res?.banner) {
          setOfferBanner(res.banner);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyOffer = (e, code) => {
    e.stopPropagation();
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  useEffect(() => {
    if (propUser) setCurrentUser((prev) => ({ ...prev, ...propUser }));
  }, [propUser]);

  useEffect(() => {
    const handleSync = () => {
      try {
        const raw = localStorage.getItem("smartbill_user");
        if (raw) setCurrentUser(JSON.parse(raw));
      } catch (_) {}
    };
    window.addEventListener("userUpdated", handleSync);
    window.addEventListener("businessInfoUpdated", handleSync);
    return () => {
      window.removeEventListener("userUpdated", handleSync);
      window.removeEventListener("businessInfoUpdated", handleSync);
    };
  }, []);

  const user = currentUser;
  const normRole = String(role || user?.role || "").toLowerCase().replace(/[-_\s]/g, "");
  const isPlatformAdmin =
    propsIsPlatformAdmin !== undefined
      ? Boolean(propsIsPlatformAdmin)
      : normRole === "superadmin" ||
        normRole.includes("admin") ||
        normRole === "support" ||
        normRole === "billingadmin" ||
        (!user?.ownerId &&
          normRole !== "owner" &&
          normRole !== "cashier" &&
          normRole !== "manager" &&
          normRole !== "accountant" &&
          normRole !== "sales" &&
          normRole !== "billing" &&
          normRole !== "user");

  const displayName = getUserDisplayName(user);
  const displayEmail = user?.email || "admin@smartbill.io";

  const visibleAdminItems = SUPER_ADMIN_ITEMS.filter((item) => hasPermission(user, item.key));

  const visibleNavGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasPermission(user, item.key)),
  })).filter((group) => group.items.length > 0);

  return (
    <aside
      className="flex flex-col bg-slate-900 transition-all duration-300 z-20 flex-shrink-0"
      style={{ width: collapsed ? 64 : 240 }}
    >
      {/* Logo */}
      <div
        className={`flex items-center border-b border-slate-800 h-16 px-4 gap-3 flex-shrink-0`}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
          style={{ backgroundColor: "var(--primary, #2563eb)" }}
        >
          <BarChart2 className="w-4 h-4 text-white" />
        </div>

        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {displayName}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide ${
                String(user?.businessType).toLowerCase() === "wholesale"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
              }`}>
                {String(user?.businessType).toLowerCase() === "wholesale" ? "🏢 Wholesale" : "🛒 Retail"}
              </span>
              {user?.businessCategory && (
                <span className="text-[10px] text-slate-400 truncate max-w-[100px]" title={user.businessCategory}>
                  • {user.businessCategory}
                </span>
              )}
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 cursor-pointer"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <Menu className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {isPlatformAdmin ? (
          <div className="space-y-0.5 px-3">
            {visibleAdminItems.map(({ key, label, icon: Icon }) => {
              const active = page === key;
              const translation = t(`nav.${key}`);
              const translatedLabel = translation !== `nav.${key}` ? translation : label;
              return (
                <button
                  key={key}
                  onClick={() => onNav(key)}
                  style={
                    active
                      ? { backgroundColor: "var(--primary, #2563eb)", color: "#ffffff" }
                      : {}
                  }
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative cursor-pointer ${
                    active
                      ? "text-white shadow-md font-bold"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span>{translatedLabel}</span>}
                  {collapsed && (
                    <span className="absolute left-14 bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-xl">
                      {translatedLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-5">
            {visibleNavGroups.map((group) => (
              <div key={group.label}>
                {!collapsed && (
                  <p className="px-6 mb-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    {t(`nav.group_${group.label.toLowerCase()}`) !== `nav.group_${group.label.toLowerCase()}`
                      ? t(`nav.group_${group.label.toLowerCase()}`)
                      : group.label}
                  </p>
                )}
                <div className="space-y-0.5 px-3">
                  {group.items.map(({ key, label, icon: Icon }) => {
                    const active = page === key;
                    const isWholesale = String(user?.businessType || "").toLowerCase() === "wholesale";
                    const translation = t(`nav.${key}`);
                    let translatedLabel = translation !== `nav.${key}` ? translation : label;
                    if (isWholesale && key === "customers") {
                      translatedLabel = "Parties & Clients";
                    }
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => onNav(key)}
                        style={
                          active
                            ? { backgroundColor: "var(--primary, #2563eb)", color: "#ffffff" }
                            : {}
                        }
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative cursor-pointer ${
                          active
                            ? "text-white shadow-md font-bold"
                            : "text-slate-400 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {!collapsed && <span>{translatedLabel}</span>}
                        {collapsed && (
                          <span className="absolute left-14 bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-xl">
                            {translatedLabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      {/* Sleek Offer Box below Settings */}
      {!collapsed && offerBanner && !isPlatformAdmin && (
        <div className="mx-3 mb-2 p-2.5 bg-gradient-to-b from-slate-800/90 to-slate-800/40 rounded-xl border border-slate-700/70 text-slate-300 relative shadow-sm">
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
              <Tag className="w-3 h-3 text-blue-400" />
              Special Offer
            </span>
            {offerBanner.code && (
              <button
                onClick={(e) => handleCopyOffer(e, offerBanner.code)}
                title="Click to copy coupon code"
                className="inline-flex items-center gap-1 bg-slate-900/90 hover:bg-slate-900 text-slate-200 border border-slate-700 text-[10px] font-mono px-1.5 py-0.5 rounded transition cursor-pointer"
              >
                <span>{offerBanner.code}</span>
                {copiedCode ? (
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                ) : (
                  <Copy className="w-2.5 h-2.5 text-slate-400" />
                )}
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-200 font-medium leading-snug line-clamp-2 mb-2">
            {offerBanner.bannerText || `${offerBanner.title || "Limited Deal"}: Use code ${offerBanner.code} for discount.`}
          </p>
          <button
            onClick={() => onNav("profile")}
            className="w-full flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] py-1 px-2 rounded-lg transition shadow-xs cursor-pointer"
          >
            <span>{offerBanner.bannerCta || "Claim Offer"}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
      </nav>

      {/* User */}
      <div className="border-t border-slate-800 p-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
            <UserCircle className="w-4 h-4 text-slate-300" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {displayName}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                {displayEmail}
              </p>
            </div>
          )}
        </div>
        {!collapsed && !isPlatformAdmin && (
          <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
              {user?.subscription?.plan ? String(user.subscription.plan).toUpperCase() : "STARTER"} PLAN
            </span>
            <button
              onClick={() => onNav("profile")}
              className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
            >
              Manage
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
