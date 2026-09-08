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
      expenses: true,
      purchaseManagement: true,
      inventory: true,
      paymentTracking: true,
      paymentHistory: false,
      advancedPaymentHistory: false,
      invoiceCustomization: true,
      advancedInvoiceCustomization: false,
      unlimitedInvoiceCustomization: false,
      stockAlerts: true,
      advancedStockAlerts: false,
      enhancedStockMonitoring: false,
      dataExport: false,
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
      expenses: true,
      purchaseManagement: true,
      inventory: true,
      paymentTracking: true,
      paymentHistory: true,
      advancedPaymentHistory: false,
      invoiceCustomization: true,
      advancedInvoiceCustomization: true,
      unlimitedInvoiceCustomization: false,
      stockAlerts: true,
      advancedStockAlerts: true,
      enhancedStockMonitoring: false,
      dataExport: true,
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
      expenses: true,
      purchaseManagement: true,
      inventory: true,
      paymentTracking: true,
      paymentHistory: true,
      advancedPaymentHistory: true,
      invoiceCustomization: true,
      advancedInvoiceCustomization: true,
      unlimitedInvoiceCustomization: true,
      stockAlerts: true,
      advancedStockAlerts: true,
      enhancedStockMonitoring: true,
      dataExport: true,
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
 * @param {string} featureKey - e.g. 'advancedReports', 'paymentTracking', 'stockAlerts'
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
    case "advancedStockAlerts":
    case "paymentHistory":
    case "advancedInvoiceCustomization":
      return "Pro";
    case "advancedPaymentHistory":
    case "unlimitedInvoiceCustomization":
    case "enhancedStockMonitoring":
      return "Enterprise";
    default:
      return "Pro";
  }
}



