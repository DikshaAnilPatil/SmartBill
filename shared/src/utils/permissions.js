export const MODULE_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "customers", label: "Customers" },
  { key: "suppliers", label: "Suppliers" },
  { key: "products", label: "Products" },
  { key: "pos", label: "Sales & Billing (POS)" },
  { key: "purchase", label: "Purchases" },
  { key: "inventory", label: "Inventory" },
  { key: "expenses", label: "Expenses" },
  { key: "reports", label: "Reports" },
  { key: "users", label: "User Management" },
  { key: "settings", label: "Settings" },
];

export const ROLE_DEFAULT_PERMISSIONS = {
  Owner: {
    dashboard: true,
    customers: true,
    suppliers: true,
    products: true,
    pos: true,
    purchase: true,
    inventory: true,
    expenses: true,
    reports: true,
    users: true,
    settings: true,
  },
  Manager: {
    dashboard: true,
    customers: true,
    suppliers: true,
    products: true,
    pos: true,
    purchase: true,
    inventory: true,
    expenses: true,
    reports: true,
    users: false,
    settings: false,
  },
  Cashier: {
    dashboard: true,
    customers: true,
    suppliers: false,
    products: true,
    pos: true,
    purchase: false,
    inventory: false,
    expenses: false,
    reports: false,
    users: false,
    settings: false,
  },
  Accountant: {
    dashboard: true,
    customers: true,
    suppliers: true,
    products: false,
    pos: true,
    purchase: true,
    inventory: false,
    expenses: true,
    reports: true,
    users: false,
    settings: false,
  },
};

/**
 * Helper to determine if user is a primary business owner or superadmin.
 */
export function isOwnerOrSuperAdmin(user) {
  if (!user) return true;
  const roleStr = String(user.role || "").toLowerCase().replace(/[-_\s]/g, "");
  const userId = String(user._id || user.id || "");
  const ownerId = String(user.ownerId || "");

  // If user is owner, superadmin, admin, user, retail, or has no ownerId, or ownerId matches own user ID
  if (
    roleStr === "owner" ||
    roleStr === "businessowner" ||
    roleStr === "superadmin" ||
    roleStr === "admin" ||
    roleStr === "user" ||
    !ownerId ||
    ownerId === "null" ||
    ownerId === "undefined" ||
    (userId && ownerId === userId)
  ) {
    return true;
  }

  // Only restrict secondary employee sub-accounts created under an owner
  return false;
}

/**
 * Resolves permissions object for the given user.
 * Superadmins receive full permissions.
 * Users/Owners with custom permissions assigned in MongoDB receive those specific module permissions.
 */
export function getUserPermissions(user) {
  if (!user) return { ...ROLE_DEFAULT_PERMISSIONS.Owner };

  const roleStr = String(user.role || "").toLowerCase().replace(/[-_\s]/g, "");
  if (roleStr === "superadmin") {
    return { ...ROLE_DEFAULT_PERMISSIONS.Owner };
  }

  // If user has specific module permissions stored in MongoDB
  if (
    user.permissions &&
    typeof user.permissions === "object" &&
    Object.keys(user.permissions).length > 0
  ) {
    return {
      ...ROLE_DEFAULT_PERMISSIONS.Owner,
      ...user.permissions,
    };
  }

  if (isOwnerOrSuperAdmin(user)) {
    return { ...ROLE_DEFAULT_PERMISSIONS.Owner };
  }

  const roleName = user.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()
    : "Cashier";

  const defaultPerms =
    ROLE_DEFAULT_PERMISSIONS[roleName] || ROLE_DEFAULT_PERMISSIONS.Owner;

  return { ...defaultPerms };
}

/**
 * Checks whether the current user has permission to access a specific page module.
 */
export function hasPermission(user, pageKey) {
  if (!user) return true;
  const roleStr = String(user.role || "").toLowerCase().replace(/[-_\s]/g, "");

  if (roleStr === "superadmin") return true;

  if (
    !pageKey ||
    pageKey === "super-dashboard" ||
    pageKey === "dashboard" ||
    pageKey === "profile" ||
    pageKey === "notifications" ||
    ["features", "pricing", "changelog", "roadmap", "about", "blog", "careers", "press", "help-center", "api-docs", "status", "contact"].includes(pageKey)
  ) {
    return true;
  }

  // Extract user permissions object
  const perms = user.permissions || {};

  // Helper to check permission flag for a module
  const checkPerm = (moduleKey) => {
    if (!perms || Object.keys(perms).length === 0) return null;
    const item = perms[moduleKey];
    if (item === undefined) return null;
    if (typeof item === "boolean") return item;
    if (item && typeof item === "object") {
      if (item.view !== undefined) return Boolean(item.view);
      return Boolean(item.view || item.create || item.edit || item.manage || item.export);
    }
    return Boolean(item);
  };

  let modResult = null;

  switch (pageKey) {
    case "businesses":
    case "vendors":
      modResult = checkPerm("vendors") ?? checkPerm("businesses");
      break;

    case "revenue":
      modResult = checkPerm("revenue");
      break;

    case "subscriptions":
      modResult = checkPerm("subscriptions");
      break;

    case "admin-role":
    case "admin_roles":
      modResult = checkPerm("admin_roles") ?? checkPerm("admin-role");
      break;

    case "settings":
      modResult = checkPerm("settings");
      break;

    case "offers-coupons":
      modResult = checkPerm("offers_coupons") ?? checkPerm("marketing");
      break;

    case "regions":
      modResult = checkPerm("regions");
      break;

    default:
      modResult = checkPerm(pageKey);
      break;
  }

  // If user.permissions object explicitly defined permissions for this module, return that result
  if (modResult !== null) {
    return modResult;
  }

  // Fallback defaults based on role if permissions object was not explicitly set
  if (roleStr.includes("support")) {
    return ["businesses", "vendors"].includes(pageKey);
  }

  if (roleStr.includes("billing")) {
    return ["businesses", "vendors", "revenue", "subscriptions", "settings", "offers-coupons"].includes(pageKey);
  }

  const permissions = getUserPermissions(user);
  if (
    pageKey === "pos" ||
    pageKey === "sales" ||
    pageKey === "billing" ||
    pageKey === "sales-billing"
  ) {
    return Boolean(permissions.pos);
  }
  return Boolean(permissions[pageKey]);
}



