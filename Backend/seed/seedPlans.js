import SubscriptionPlan from "../models/SubscriptionPlan.js";
import { PLAN_LIMITS } from "../config/plans.js";

/**
 * Seed default subscription plans on server startup (idempotent).
 */
export const seedSubscriptionPlans = async () => {
  try {
    for (const [key, config] of Object.entries(PLAN_LIMITS)) {
      await SubscriptionPlan.findOneAndUpdate(
        { key },
        {
          key,
          name: config.name,
          price: config.price,
          billingCycle: "monthly",
          maxUsers: config.maxUsers === Infinity ? null : config.maxUsers,
          maxInvoicesPerMonth:
            config.maxInvoicesPerMonth === Infinity
              ? null
              : config.maxInvoicesPerMonth,
          maxCustomers:
            config.maxCustomers === Infinity ? null : config.maxCustomers,
          maxProducts:
            config.maxProducts === Infinity ? null : config.maxProducts,
          features: config.features,
          status: "active",
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );
    }
    console.log("[SEED] Subscription plans verified/seeded successfully.");
  } catch (error) {
    console.warn("[SEED] Notice: Subscription plan seeding skipped or failed:", error.message);
  }
};

export default seedSubscriptionPlans;
