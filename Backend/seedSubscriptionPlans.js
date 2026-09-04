import dns from "node:dns";
import mongoose from "mongoose";
import dotenv from "dotenv";

import SubscriptionPlan from "./models/SubscriptionPlan.js";
import { PLAN_LIMITS } from "./config/plans.js";

dotenv.config();

// Same DNS workaround used by server.js
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (err) {
  console.warn("Could not set custom DNS servers:", err.message);
}

const seedSubscriptionPlans = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected.");

    for (const [key, config] of Object.entries(PLAN_LIMITS)) {
      await SubscriptionPlan.findOneAndUpdate(
        { key },
        {
          key,
          name: config.name,
          price: config.price,
          billingCycle: "monthly",
          maxUsers: config.maxUsers === Infinity ? null : config.maxUsers,
          maxInvoicesPerMonth: config.maxInvoicesPerMonth === Infinity ? null : config.maxInvoicesPerMonth,
          maxCustomers: config.maxCustomers === Infinity ? null : config.maxCustomers,
          maxProducts: config.maxProducts === Infinity ? null : config.maxProducts,
          features: config.features,
          status: "active",
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      console.log(`✓ ${config.name} plan seeded.`);
    }

    console.log("Subscription plans seeded successfully.");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Subscription plan seed error:", error);
    process.exit(1);
  }
};

seedSubscriptionPlans();