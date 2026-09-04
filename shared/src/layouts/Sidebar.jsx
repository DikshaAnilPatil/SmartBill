import { BarChart2, ChevronRight, Menu, UserCircle } from "lucide-react";
import { NAV_GROUPS, SUPER_ADMIN_ITEMS } from "./navConfig";
import { getUserDisplayName } from "@shared/utils/userUtils";
import { useCustomization } from "@shared/hooks/useCustomization";
import { hasPermission } from "@shared/utils/permissions";

export default function Sidebar({ page, onNav, role, collapsed, onToggle, user }) {
  const { t } = useCustomization();
  const isSuperAdmin = role === "superadmin";
  const displayName = getUserDisplayName(user);
  const displayEmail = user?.email || "admin@business.in";

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
              {role === "superadmin" ? "Prathamesh" : (user?.businessName || "Smart Bill")}
            </p>
            <p className="text-[10px] text-slate-500 capitalize">
              {role.replace("-", " ")}
            </p>
          </div>
        )}
        <button
          onClick={onToggle}
          className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
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
        {isSuperAdmin ? (
          <div className="space-y-0.5 px-3">
            {SUPER_ADMIN_ITEMS.map(({ key, label, icon: Icon }) => {
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative ${
                    active
                      ? "text-white shadow-md"
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
                    const translation = t(`nav.${key}`);
                    const translatedLabel = translation !== `nav.${key}` ? translation : label;
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
        {!collapsed && !isSuperAdmin && (
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



