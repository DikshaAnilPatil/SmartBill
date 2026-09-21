import "dotenv/config";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import AccountingSettings from "../models/AccountingSettings.js";

/**
 * Migration script to initialize 14-day trial for existing users and sync accounting settings.
 * Grants existing users a 14-day trial starting from today so their work is uninterrupted.
 */
export const migrateExistingUserTrials = async () => {
  try {
    // Disable strictNegativeCash legacy default so initial purchases/expenses are not blocked
    await AccountingSettings.updateMany(
      { strictNegativeCash: true },
      { $set: { strictNegativeCash: false } }
    );

    const usersWithoutSubscription = await User.find({
      $or: [
        { subscription: { $exists: false } },
        { "subscription.trialEndsAt": { $exists: false } },
        { "subscription.status": { $exists: false } },
      ],
    });

    if (usersWithoutSubscription.length === 0) {
      console.log("[MIGRATION] All users already have subscription/trial states initialized.");
      return;
    }

    console.log(`[MIGRATION] Found ${usersWithoutSubscription.length} existing user(s) to initialize trial status.`);

    const now = new Date();
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    for (const user of usersWithoutSubscription) {
      const subscription = user.role === "superadmin"
        ? {
            plan: "enterprise",
            status: "active",
            trialEndsAt: fourteenDaysFromNow,
            currentPeriodStart: now,
          }
        : {
            plan: "starter",
            status: "trialing",
            trialEndsAt: fourteenDaysFromNow,
            currentPeriodStart: now,
          };

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            subscription,
            ...(user.firstName ? {} : { firstName: user.email ? user.email.split("@")[0] : "User" }),
          },
        }
      );
    }

    console.log(`[MIGRATION] Successfully initialized 14-day trial for ${usersWithoutSubscription.length} user(s).`);
  } catch (error) {
    console.error("[MIGRATION ERROR]:", error.message);
  }
};

export default migrateExistingUserTrials;
