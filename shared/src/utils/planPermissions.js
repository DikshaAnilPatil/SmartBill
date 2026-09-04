/**
 * Plan Feature Matrix and Access Control Utilities
 */

export const PLAN_CONFIGS = {
  starter: {
    key: "starter",
    name: "Starter",
    price: 999,
    features: {
      basicReports: true,
      advancedReports: false,
      gstReports: false,
      barcodeScanner: false,
      expenses: true,
      purchaseManagement: true,
      inventory: true,
      advancedInventory: false,
      dataExport: false,
      apiAccess: false,
    },
  },
  pro: {
    key: "pro",
    name: "Pro",
    price: 2499,
    features: {
      basicReports: true,
      advancedReports: true,
      gstReports: true,
      barcodeScanner: true,
      expenses: true,
      purchaseManagement: true,
      inventory: true,
      advancedInventory: true,
      dataExport: true,
      apiAccess: false,
    },
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    price: 6999,
    features: {
      basicReports: true,
      advancedReports: true,
      gstReports: true,
      barcodeScanner: true,
      expenses: true,
      purchaseManagement: true,
      inventory: true,
      advancedInventory: true,
      dataExport: true,
      apiAccess: true,
    },
  },
};

/**
 * Returns normalized plan key for user ('starter', 'pro', 'enterprise').
 * Superadmin always returns 'enterprise'.
 */
export function getUserPlanKey(user) {
  if (!user || user.role === "superadmin") return "enterprise";
  const plan = user.subscription?.plan || "starter";
  const normalized = String(plan).toLowerCase().replace(/\s*plan\s*/gi, "").trim();
  return PLAN_CONFIGS[normalized] ? normalized : "starter";
}

/**
 * Returns full plan configuration object for the user.
 */
export function getUserPlan(user) {
  const planKey = getUserPlanKey(user);
  return PLAN_CONFIGS[planKey] || PLAN_CONFIGS.starter;
}

/**
 * Checks if current user's plan unlocks a specific feature key.
 * Superadmin has access to all features.
 *
 * @param {object} user - Authenticated user object
 * @param {string} featureKey - e.g. 'advancedReports', 'gstReports', 'barcodeScanner', 'apiAccess'
 * @returns {boolean}
 */
export function hasPlanFeature(user, featureKey) {
  if (!user || user.role === "superadmin") return true;
  const plan = getUserPlan(user);
  return Boolean(plan.features?.[featureKey]);
}

/**
 * Returns human readable error or requirement for locked feature.
 */
export function getRequiredPlanForFeature(featureKey) {
  switch (featureKey) {
    case "advancedReports":
    case "gstReports":
    case "barcodeScanner":
      return "Pro";
    case "apiAccess":
      return "Enterprise";
    default:
      return "Pro";
  }
}



