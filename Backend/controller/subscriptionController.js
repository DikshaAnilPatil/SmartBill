import crypto from "crypto";
import { razorpayInstance } from "../config/razorpay.js";
import { PLAN_LIMITS } from "../config/plans.js";
import { getOrUpdateSubscriptionState } from "../middleware/checkPlanLimits.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import { createNotification, notifySuperAdmins } from "../services/notificationService.js";
import { sendSubscriptionReminderEmail } from "../utils/emailService.js";

/* ─────────────────────────────────────────────────────────────
   Helper: days remaining in current period
───────────────────────────────────────────────────────────── */
function daysRemaining(periodEnd) {
  if (!periodEnd) return 0;
  const diff = new Date(periodEnd) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/* ─────────────────────────────────────────────────────────────
   1. Upgrade Preview (prorated discount calculation)
   GET /subscriptions/upgrade-preview?newPlan=pro
───────────────────────────────────────────────────────────── */
export const getUpgradePreview = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const user = await User.findById(ownerId);

    if (!user) return res.status(404).json({ message: "User not found" });

    const { newPlan } = req.query;
    const newPlanKey = (newPlan || "").toLowerCase().trim();
    const newPlanConfig = PLAN_LIMITS[newPlanKey];

    if (!newPlanConfig) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    const currentPlanKey = user.subscription?.plan || "starter";
    const currentPlanConfig = PLAN_LIMITS[currentPlanKey] || PLAN_LIMITS.starter;

    if (currentPlanKey === newPlanKey) {
      return res.status(400).json({ message: "You are already on this plan" });
    }

    // Plan ordering for upgrade vs downgrade detection
    const PLAN_ORDER = { starter: 1, pro: 2, enterprise: 3 };
    const isUpgrade = PLAN_ORDER[newPlanKey] > PLAN_ORDER[currentPlanKey];

    // Prorated calculation (only relevant when currently active/paid)
    const isActivePaid = user.subscription?.status === "active" &&
                         user.subscription?.currentPeriodEnd;

    let proratedCredit = 0;
    let daysLeft = 0;

    if (isActivePaid) {
      daysLeft = daysRemaining(user.subscription.currentPeriodEnd);
      // Daily rate of current plan (30-day cycle)
      const dailyRate = currentPlanConfig.price / 30;
      proratedCredit = Math.floor(dailyRate * daysLeft);
    }

    const originalPrice = newPlanConfig.price;
    const discountedPrice = isUpgrade
      ? Math.max(0, originalPrice - proratedCredit)
      : 0; // Downgrade is end-of-period, no immediate charge

    res.json({
      success: true,
      currentPlan: {
        key: currentPlanKey,
        name: currentPlanConfig.name,
        price: currentPlanConfig.price,
      },
      newPlan: {
        key: newPlanKey,
        name: newPlanConfig.name,
        price: newPlanConfig.price,
      },
      isUpgrade,
      isActivePaid,
      daysRemaining: daysLeft,
      proratedCredit,
      originalPrice,
      discountedPrice,
      // For downgrade: effective date is end of current period
      effectiveDate: isUpgrade
        ? new Date().toISOString()
        : user.subscription?.currentPeriodEnd || new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting upgrade preview:", error);
    res.status(500).json({ message: error.message || "Failed to get upgrade preview" });
  }
};

/* ─────────────────────────────────────────────────────────────
   2. Create Razorpay Order
   POST /subscriptions/create-order
   Body: { planName, isUpgrade?, proratedAmount? }
───────────────────────────────────────────────────────────── */
export const createSubscriptionOrder = async (req, res) => {
  try {
    const { planName, isUpgrade, proratedAmount } = req.body;
    const planKey = (planName || "").toLowerCase().replace(/\s*plan\s*/gi, "").trim();
    const planConfig = PLAN_LIMITS[planKey] || PLAN_LIMITS[planName?.toLowerCase()];

    if (!planConfig) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    // Use prorated amount if this is a mid-cycle upgrade
    const chargeAmount = (isUpgrade && proratedAmount != null)
      ? Math.max(100, Math.round(proratedAmount)) // minimum ₹1 (100 paise)
      : planConfig.price;

    const amountInPaise = chargeAmount * 100;
    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_TPCMQcPRZqe62i";

    try {
      const options = {
        amount: amountInPaise,
        currency: "INR",
        receipt: `sub_${Date.now()}`,
        notes: {
          planName: planConfig.name,
          userId: req.user ? req.user._id.toString() : "guest",
          isUpgrade: isUpgrade ? "true" : "false",
        },
      };

      const order = await razorpayInstance.orders.create(options);

      return res.json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId,
        planName: planConfig.name,
        isMock: false,
        isUpgrade: !!isUpgrade,
        proratedCredit: isUpgrade ? (planConfig.price - chargeAmount) : 0,
      });
    } catch (rzpErr) {
      console.error("Razorpay API error:", rzpErr.message);
      return res.status(500).json({ message: "Failed to create payment order with Razorpay." });
    }
  } catch (error) {
    console.error("Error creating subscription order:", error);
    res.status(500).json({ message: error.message || "Failed to create subscription order" });
  }
};

/* ─────────────────────────────────────────────────────────────
   3. Verify Payment & Activate / Schedule Plan
   POST /subscriptions/verify-payment
───────────────────────────────────────────────────────────── */
export const verifySubscriptionPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planName,
      email,
      isUpgrade,
      isDowngrade,
    } = req.body;

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    let isValid = false;

    if (razorpay_signature && keySecret) {
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(body.toString())
        .digest("hex");
      isValid = expectedSignature === razorpay_signature;
    } else {
      isValid = Boolean(razorpay_order_id && razorpay_payment_id);
    }

    if (!isValid) {
      return res.status(400).json({ message: "Invalid payment signature verification failed." });
    }

    const planKey = (planName || "pro").toLowerCase().replace(/\s*plan\s*/gi, "").trim();
    const planConfig = PLAN_LIMITS[planKey] || PLAN_LIMITS.starter;

    // Find target user
    let user = req.user ? await User.findById(req.user._id) : null;
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase() });
    }

    if (user) {
      const currentPlanKey = user.subscription?.plan || "starter";
      const now = new Date();
      const newPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      if (isDowngrade) {
        // ── Downgrade: schedule at end of current period, don't change plan yet ──
        user.subscription.pendingDowngradePlan = planKey;

        // Record in history
        if (!user.subscription.planHistory) user.subscription.planHistory = [];
        user.subscription.planHistory.push({
          plan: planKey,
          activatedAt: user.subscription.currentPeriodEnd || newPeriodEnd,
          price: planConfig.price,
          reason: "downgrade",
        });

        await user.save();

        return res.json({
          success: true,
          message: `Downgrade scheduled. Your ${currentPlanKey} plan continues until ${
            user.subscription.currentPeriodEnd
              ? new Date(user.subscription.currentPeriodEnd).toLocaleDateString("en-IN")
              : "end of billing period"
          }, then switches to ${planConfig.name}.`,
          subscription: user.subscription,
          isDowngrade: true,
        });
      } else {
        // ── Upgrade (or fresh purchase): activate immediately ──
        const prevPlan = currentPlanKey;

        if (!user.subscription.planHistory) user.subscription.planHistory = [];
        // Record previous plan closure
        if (prevPlan && user.subscription.status === "active") {
          user.subscription.planHistory.push({
            plan: prevPlan,
            activatedAt: user.subscription.currentPeriodStart || now,
            price: PLAN_LIMITS[prevPlan]?.price || 0,
            reason: isUpgrade ? "upgrade" : "initial",
          });
        }

        user.subscription = {
          ...user.subscription.toObject?.() || user.subscription,
          plan: planKey,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: newPeriodEnd,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          previousPlan: prevPlan,
          upgradedAt: now,
          pendingDowngradePlan: "",
          planHistory: user.subscription.planHistory || [],
        };

        await user.save();

        try {
          await createNotification({
            ownerId: user._id,
            userId: req.user ? req.user.actualUserId || user._id : user._id,
            title: isUpgrade ? "Plan Upgraded Successfully" : "Subscription Activated",
            message: `Your account is now active on the ${planConfig.name} plan.`,
            type: "success",
            category: "subscription",
            link: "settings",
            metadata: {
              plan: planKey,
              isUpgrade: !!isUpgrade,
            },
          });

          // Notify SuperAdmins about revenue / plan upgrade
          const bName = user.businessName || `${user.firstName} ${user.lastName}`;
          await notifySuperAdmins({
            title: `Subscription Payment: ${planConfig.name} Plan`,
            message: `${bName} (${user.email}) has ${isUpgrade ? "upgraded to" : "activated"} the ${planConfig.name} plan.`,
            type: "success",
            category: "subscription",
            link: "revenue",
            metadata: {
              businessId: user._id.toString(),
              businessName: bName,
              plan: planKey,
              razorpayOrderId: razorpay_order_id,
            },
          });
        } catch (notifErr) {
          console.error("Subscription notification error:", notifErr.message);
        }

        // Dispatch Subscription Email (checks SuperAdmin active/inactive setting in MongoDB)
        try {
          sendSubscriptionReminderEmail({
            toEmail: user.email,
            userName: `${user.firstName} ${user.lastName}`.trim(),
            expiryDate: user.subscription.currentPeriodEnd
              ? new Date(user.subscription.currentPeriodEnd).toLocaleDateString("en-IN")
              : "30 days",
            businessName: user.businessName || "Smart Bill",
          }).catch((err) => console.error("Subscription email trigger error:", err.message));
        } catch (subEmailErr) {
          console.error("Subscription email dispatch error:", subEmailErr.message);
        }

        res.json({
          success: true,
          message: `Payment successful! Your account has been ${isUpgrade ? "upgraded" : "activated"} to the ${planConfig.name} plan.`,
          subscription: user.subscription,
          isUpgrade: !!isUpgrade,
        });
      }
    } else {
      // Guest payment on landing page prior to registration
      try {
        await notifySuperAdmins({
          title: `Subscription Payment Received: ${planConfig.name} Plan`,
          message: `A payment of ₹${planConfig.price} was verified for the ${planConfig.name} plan (Order: ${razorpay_order_id}).`,
          type: "success",
          category: "subscription",
          link: "revenue",
          metadata: {
            plan: planKey,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
          },
        });
      } catch (notifErr) {
        console.error("Guest subscription notification error:", notifErr.message);
      }

      res.json({
        success: true,
        message: `Payment successful for ${planName || planKey} plan.`,
        subscription: { plan: planKey, status: "active" },
      });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ message: error.message || "Payment verification error" });
  }
};

/* ─────────────────────────────────────────────────────────────
   4. Get Current Subscription Status & Usage Metrics
   GET /subscriptions/status
───────────────────────────────────────────────────────────── */
export const getSubscriptionStatus = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const user = await User.findById(ownerId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Auto-apply pending downgrade if period has ended
    if (
      user.subscription?.pendingDowngradePlan &&
      user.subscription?.currentPeriodEnd &&
      new Date() > new Date(user.subscription.currentPeriodEnd)
    ) {
      const downgradePlan = user.subscription.pendingDowngradePlan;
      const now = new Date();
      user.subscription.plan = downgradePlan;
      user.subscription.status = "active";
      user.subscription.currentPeriodStart = now;
      user.subscription.currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      user.subscription.pendingDowngradePlan = "";
      user.subscription.upgradedAt = now;
      await user.save();
    }

    const subState = await getOrUpdateSubscriptionState(user);
    const planKey = user.subscription?.plan || "starter";
    const planConfig = PLAN_LIMITS[planKey] || PLAN_LIMITS.starter;

    // Current month invoice usage
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const invoiceCount = await Order.countDocuments({
      ownerId,
      createdAt: { $gte: startOfMonth },
    });

    res.json({
      success: true,
      subscription: user.subscription,
      trialState: subState,
      plan: planConfig,
      usage: {
        invoicesThisMonth: invoiceCount,
        maxInvoicesPerMonth: planConfig.maxInvoicesPerMonth,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
