import SubscriptionPlan from "../models/SubscriptionPlan.js";

const LIMIT_FIELDS = ["maxUsers", "maxInvoicesPerMonth", "maxCustomers", "maxProducts"];

const parseLimit = (value, field) => {
  if (value === null || value === "unlimited") return null;
  if (value === undefined || value === "" || !Number.isInteger(Number(value)) || Number(value) < 0) {
    throw new Error(`${field} must be a non-negative integer or Unlimited.`);
  }
  return Number(value);
};

/*
|--------------------------------------------------------------------------
| Helper: Generate unique plan key
|--------------------------------------------------------------------------
*/

const generatePlanKey = async (name, excludeId = null) => {
  let baseKey = String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!baseKey) {
    baseKey = "plan";
  }

  let key = baseKey;
  let counter = 1;

  while (true) {
    const query = { key };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existingPlan = await SubscriptionPlan.findOne(query);

    if (!existingPlan) {
      return key;
    }

    key = `${baseKey}-${counter}`;
    counter++;
  }
};


const isInternalAdmin = (user) => {
  if (!user) return false;
  const roleStr = String(user?.role || "").toLowerCase().replace(/[-_\s]/g, "");
  return (
    roleStr === "superadmin" ||
    roleStr.includes("admin") ||
    roleStr === "support" ||
    roleStr === "billing" ||
    (!user?.ownerId && roleStr !== "owner")
  );
};

/*
|--------------------------------------------------------------------------
| GET /api/admin/subscription-plans
| Admin access
|--------------------------------------------------------------------------
*/

export const getSubscriptionPlans = async (req, res) => {
  try {
    if (!isInternalAdmin(req.user)) {
      return res.status(403).json({
        message: "Forbidden: Admin access required.",
      });
    }

    const plans = await SubscriptionPlan.find()
      .sort({ price: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: plans.length,
      data: plans,
    });
  } catch (error) {
    console.error(
      "GET SUBSCRIPTION PLANS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Failed to fetch subscription plans.",
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET /api/subscription-plans
| PUBLIC
|
| Used by Sign In / Registration / Pricing pages
|--------------------------------------------------------------------------
*/

export const getPublicSubscriptionPlans = async (
  req,
  res
) => {
  try {
    const plans = await SubscriptionPlan.find({
      status: "active",
    })
      .select(
        "key name price billingCycle maxUsers maxInvoicesPerMonth maxCustomers maxProducts features status"
      )
      .sort({ price: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: plans.length,
      data: plans,
    });
  } catch (error) {
    console.error(
      "GET PUBLIC SUBSCRIPTION PLANS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Failed to fetch subscription plans.",
    });
  }
};


/*
|--------------------------------------------------------------------------
| POST /api/admin/subscription-plans
| SuperAdmin only
|--------------------------------------------------------------------------
*/

export const createSubscriptionPlan = async (
  req,
  res
) => {
  try {
    if (!isInternalAdmin(req.user)) {
      return res.status(403).json({
        message: "Forbidden: SuperAdmin access required.",
      });
    }

    const {
      name,
      price,
      billingCycle,
      maxUsers,
      maxInvoicesPerMonth,
      maxCustomers,
      maxProducts,
      features,
      status,
    } = req.body;

    if (!name || String(name).trim() === "") {
      return res.status(400).json({
        message: "Plan name is required.",
      });
    }

    if (
      price === undefined ||
      price === null ||
      Number.isNaN(Number(price)) ||
      Number(price) < 0
    ) {
      return res.status(400).json({
        message: "Valid plan price is required.",
      });
    }

    const normalizedName = String(name).trim();

    let parsedLimits;
    try {
      parsedLimits = Object.fromEntries(
        LIMIT_FIELDS.map((field) => [field, parseLimit(req.body[field], field)])
      );
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const key = await generatePlanKey(normalizedName);

    const plan = await SubscriptionPlan.create({
      key,
      name: normalizedName,
      price: Number(price),

      billingCycle:
        billingCycle || "monthly",

      ...parsedLimits,

      features: {
        basicReports:
          Boolean(features?.basicReports),

        advancedReports:
          Boolean(features?.advancedReports),

        gstReports: Boolean(features?.gstReports),

        barcodeScanner:
          Boolean(features?.barcodeScanner),

        expenses: Boolean(features?.expenses),
        purchaseManagement: Boolean(features?.purchaseManagement),
        inventory: Boolean(features?.inventory),
        advancedInventory: Boolean(features?.advancedInventory),
        dataExport: Boolean(features?.dataExport),

        apiAccess:
          Boolean(features?.apiAccess),

      },

      status: status || "active",
    });

    return res.status(201).json({
      success: true,
      message:
        "Subscription plan created successfully.",
      data: plan,
    });
  } catch (error) {
    console.error(
      "CREATE SUBSCRIPTION PLAN ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Failed to create subscription plan.",
    });
  }
};


/*
|--------------------------------------------------------------------------
| PUT /api/admin/subscription-plans/:id
| SuperAdmin only
|--------------------------------------------------------------------------
*/

export const updateSubscriptionPlan = async (
  req,
  res
) => {
  try {
    if (!isInternalAdmin(req.user)) {
      return res.status(403).json({
        message: "Forbidden: SuperAdmin access required.",
      });
    }

    const { id } = req.params;

    const plan =
      await SubscriptionPlan.findById(id);

    if (!plan) {
      return res.status(404).json({
        message:
          "Subscription plan not found.",
      });
    }

    const {
      name,
      price,
      billingCycle,
      maxUsers,
      maxInvoicesPerMonth,
      maxCustomers,
      maxProducts,
      features,
      status,
    } = req.body;

    /*
     * Do not change the key.
     *
     * Existing users may already have:
     *
     * subscription.plan = plan.key
     *
     * Changing the key could break existing subscriptions.
     */

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({
          message:
            "Plan name cannot be empty.",
        });
      }

      plan.name = String(name).trim();
    }

    if (price !== undefined) {
      if (
        Number.isNaN(Number(price)) ||
        Number(price) < 0
      ) {
        return res.status(400).json({
          message:
            "Plan price must be a valid positive number.",
        });
      }

      plan.price = Number(price);
    }

    if (billingCycle !== undefined) {
      if (
        !["monthly", "yearly", "custom"].includes(
          billingCycle
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid billing cycle.",
        });
      }

      plan.billingCycle = billingCycle;
    }

    for (const [field, value] of Object.entries({ maxUsers, maxInvoicesPerMonth, maxCustomers, maxProducts })) {
      if (value !== undefined) {
        try {
          plan[field] = parseLimit(value, field);
        } catch (error) {
          return res.status(400).json({ message: error.message });
        }
      }
    }

    if (features !== undefined) {
      plan.features = {
        basicReports:
          Boolean(features.basicReports),

        advancedReports:
          Boolean(features.advancedReports),

        gstReports: Boolean(features.gstReports),

        barcodeScanner:
          Boolean(features.barcodeScanner),

        expenses: Boolean(features.expenses),
        purchaseManagement: Boolean(features.purchaseManagement),
        inventory: Boolean(features.inventory),
        advancedInventory: Boolean(features.advancedInventory),
        dataExport: Boolean(features.dataExport),

        apiAccess:
          Boolean(features.apiAccess),

      };
    }

    if (status !== undefined) {
      if (
        !["active", "inactive"].includes(status)
      ) {
        return res.status(400).json({
          message:
            "Invalid subscription plan status.",
        });
      }

      plan.status = status;
    }

    await plan.save();

    return res.status(200).json({
      success: true,
      message:
        "Subscription plan updated successfully.",
      data: plan,
    });
  } catch (error) {
    console.error(
      "UPDATE SUBSCRIPTION PLAN ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Failed to update subscription plan.",
    });
  }
};


/*
|--------------------------------------------------------------------------
| DELETE /api/admin/subscription-plans/:id
| SuperAdmin only
|--------------------------------------------------------------------------
*/

export const deleteSubscriptionPlan = async (
  req,
  res
) => {
  try {
    if (!isInternalAdmin(req.user)) {
      return res.status(403).json({
        message:
          "Forbidden: SuperAdmin access required.",
      });
    }

    const { id } = req.params;

    const plan =
      await SubscriptionPlan.findById(id);

    if (!plan) {
      return res.status(404).json({
        message:
          "Subscription plan not found.",
      });
    }

    /*
     * Do not delete plans currently used by users.
     */

    const User =
      (await import("../models/User.js")).default;

    const usersUsingPlan =
      await User.countDocuments({
        "subscription.plan": plan.key,
      });

    if (usersUsingPlan > 0) {
      return res.status(400).json({
        message:
          `Cannot delete this plan because ${usersUsingPlan} user(s) are currently subscribed to it.`,
      });
    }

    await SubscriptionPlan.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message:
        "Subscription plan deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE SUBSCRIPTION PLAN ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Failed to delete subscription plan.",
    });
  }
};