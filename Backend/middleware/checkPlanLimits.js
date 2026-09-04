import Order from "../models/Order.js";
import User from "../models/User.js";
import Customer from "../models/Customer.js";
import Product from "../models/productModel.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import { PLAN_LIMITS } from "../config/plans.js";

export const getPlanConfig = async (planKey) => {
  const normalizedKey = String(planKey || "starter").toLowerCase().trim();
  const fallback = PLAN_LIMITS[normalizedKey] || {};
  const storedPlan = await SubscriptionPlan.findOne({ key: normalizedKey, status: "active" }).lean();
  if (!storedPlan) return PLAN_LIMITS[normalizedKey] || null;
  const { _id, createdAt, updatedAt, maxBusinesses, ...storedEntitlements } = storedPlan;
  const resolvedLimits = Object.fromEntries(
    ["maxUsers", "maxInvoicesPerMonth", "maxCustomers", "maxProducts"].map((field) => [
      field,
      storedPlan[field] == null ? Infinity : storedPlan[field],
    ])
  );
  return { ...fallback, ...storedEntitlements, ...resolvedLimits, features: { ...fallback.features, ...storedPlan.features } };
};

/**
 * Helper to evaluate and update trial/subscription status for a user.
 */
export const getOrUpdateSubscriptionState = async (user) => {
  if (!user || user.role === "superadmin") {
    return { isExpired: false, status: "active", daysLeft: Infinity };
  }

  // Auto-initialize missing subscription for legacy users
  if (!user.subscription || !user.subscription.trialEndsAt) {
    const createdAt = user.createdAt ? new Date(user.createdAt) : new Date();
    const trialEndsAt = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    user.subscription = {
      plan: "starter",
      status: Date.now() > trialEndsAt ? "expired" : "trialing",
      trialEndsAt,
      currentPeriodStart: createdAt,
    };
    await user.save();
  }

  // Active subscription check
  if (user.subscription.status === "active") {
    if (user.subscription.currentPeriodEnd && new Date() > new Date(user.subscription.currentPeriodEnd)) {
      user.subscription.status = "expired";
      await user.save();
      return { isExpired: true, status: "expired", daysLeft: 0 };
    }
    return { isExpired: false, status: "active", daysLeft: Infinity };
  }

  // Trialing check
  const trialEndsAt = new Date(user.subscription.trialEndsAt);
  const now = new Date();

  if (now > trialEndsAt) {
    if (user.subscription.status !== "expired") {
      user.subscription.status = "expired";
      await user.save();
    }
    return { isExpired: true, status: "expired", daysLeft: 0 };
  }

  const diffMs = trialEndsAt - now;
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  return { isExpired: false, status: "trialing", daysLeft };
};

// Enforce active trial or valid subscription before critical actions
export const requireActiveSubscription = async (req, res, next) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const user = await User.findById(ownerId);

    const subState = await getOrUpdateSubscriptionState(user);

    if (subState.isExpired) {
      return res.status(403).json({
        message: "Your 14-day free trial has expired. Please purchase a plan to continue using SmartBill.",
        trialExpired: true,
        upgradeRequired: true,
      });
    }

    req.subscriptionState = subState;
    next();
  } catch (error) {
    console.error("Error in requireActiveSubscription middleware:", error);
    next(error);
  }
};

// Check if user has exceeded monthly invoice limit
export const checkInvoiceLimit = async (req, res, next) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const user = await User.findById(ownerId);

    if (!user) return next();

    const subState = await getOrUpdateSubscriptionState(user);

    if (subState.isExpired) {
      return res.status(403).json({
        message: "Your 14-day free trial has expired. Please purchase a plan to continue.",
        trialExpired: true,
        upgradeRequired: true,
      });
    }

    const planKey = user.subscription?.plan || "starter";
    const planConfig = await getPlanConfig(planKey) || PLAN_LIMITS.starter;

    if (planConfig.maxInvoicesPerMonth !== Infinity) {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const invoiceCount = await Order.countDocuments({
        ownerId,
        createdAt: { $gte: startOfMonth },
      });

      if (invoiceCount >= planConfig.maxInvoicesPerMonth) {
        return res.status(403).json({
          message: `Monthly invoice limit reached (${planConfig.maxInvoicesPerMonth}). Please upgrade your plan to issue more invoices.`,
          limitReached: true,
          currentPlan: planKey,
        });
      }
    }
    next();
  } catch (error) {
    console.error("Error in checkInvoiceLimit middleware:", error);
    next(error);
  }
};

// Check if plan includes a specific feature key.
export const requireFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      const ownerId = req.user.ownerId || req.user._id;
      const user = await User.findById(ownerId);

      if (!user) return next();

      const subState = await getOrUpdateSubscriptionState(user);

      if (subState.isExpired) {
        return res.status(403).json({
          message: "Your 14-day free trial has expired. Please purchase a plan to unlock this feature.",
          trialExpired: true,
          upgradeRequired: true,
        });
      }

      const planKey = user.subscription?.plan || "starter";
      const planConfig = await getPlanConfig(planKey) || PLAN_LIMITS.starter;

      const featureEnabled = planConfig.features?.[featureKey];

      if (!featureEnabled) {
        return res.status(403).json({
          message: `Your ${planConfig.name} plan does not include ${featureKey}. Please upgrade to continue.`,
          featureLocked: true,
          requiredFeature: featureKey,
          currentPlan: planKey,
        });
      }
      next();
    } catch (error) {
      console.error("Error in requireFeature middleware:", error);
      next(error);
    }
  };
};

export const requireFeatureWhenEnabled = (featureKey, fields) => (req, res, next) => {
  const enabled = fields.some((field) => req.body?.[field] === true);
  return enabled ? requireFeature(featureKey)(req, res, next) : next();
};

const RESOURCE_MODELS = {
  customers: Customer,
  products: Product,
  users: User,
};

/** Enforce a plan's count limit immediately before a resource is created. */
export const checkResourceLimit = (resource) => async (req, res, next) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const user = await User.findById(ownerId);
    if (!user || user.role === "superadmin") return next();

    const subState = await getOrUpdateSubscriptionState(user);
    if (subState.isExpired) {
      return res.status(403).json({ message: "Your subscription has expired. Please choose a plan to continue.", trialExpired: true, upgradeRequired: true });
    }

    const planKey = user.subscription?.plan || "starter";
    const planConfig = await getPlanConfig(planKey) || PLAN_LIMITS.starter;
    const limitKey = `max${resource[0].toUpperCase()}${resource.slice(1)}`;
    const limit = planConfig[limitKey];
    const Model = RESOURCE_MODELS[resource];
    if (!Model || limit === Infinity || limit == null) return next();

    const query = resource === "users"
      ? { $or: [{ _id: ownerId }, { ownerId }] }
      : resource === "products"
        ? { $or: [{ ownerId }, { userId: ownerId }] }
        : { ownerId };
    const count = await Model.countDocuments(query);
    if (count >= limit) {
      return res.status(403).json({
        message: `${planConfig.name} allows ${limit} ${resource}. Please upgrade your plan to add more.`,
        limitReached: true,
        resource,
        limit,
        current: count,
        currentPlan: planKey,
      });
    }
    next();
  } catch (error) {
    console.error(`Error checking ${resource} plan limit:`, error);
    next(error);
  }
};
