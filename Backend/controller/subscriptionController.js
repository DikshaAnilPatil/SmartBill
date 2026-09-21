import crypto from "crypto";
import jwt from "jsonwebtoken";
import { razorpayInstance } from "../config/razorpay.js";
import { PLAN_LIMITS } from "../config/plans.js";
import { getOrUpdateSubscriptionState, getPlanConfig } from "../middleware/checkPlanLimits.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import { calculateDiscount } from "./couponController.js";
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
    const newPlanConfig = await getPlanConfig(newPlanKey);

    if (!newPlanConfig) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    const currentPlanKey = user.subscription?.plan || "starter";
    const currentPlanConfig = await getPlanConfig(currentPlanKey);

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
    const { planName, isUpgrade, proratedAmount, couponCode } = req.body;
    const planKey = (planName || "").toLowerCase().replace(/\s*plan\s*/gi, "").trim();
    const planConfig = await getPlanConfig(planKey);

    if (!planConfig) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    // Base price
    let baseAmount = (isUpgrade && proratedAmount != null)
      ? Math.max(100, Math.round(proratedAmount))
      : planConfig.price;

    let appliedCoupon = null;
    let discountAmount = 0;
    let finalAmount = baseAmount;

    if (couponCode && typeof couponCode === "string" && couponCode.trim()) {
      const normalizedCode = couponCode.trim().toUpperCase();
      const coupon = await Coupon.findOne({ code: normalizedCode, status: "active" });

      if (coupon) {
        const now = new Date();
        const isValidDate = (!coupon.startDate || new Date(coupon.startDate) <= now) &&
                            (!coupon.expiryDate || new Date(coupon.expiryDate) >= now);
        const hasUsageLeft = coupon.maxUsageCount == null || coupon.usedCount < coupon.maxUsageCount;
        const matchesPlan = coupon.applicablePlans.includes("all") || coupon.applicablePlans.includes(planKey);

        if (isValidDate && hasUsageLeft && matchesPlan) {
          const discountRes = calculateDiscount(coupon, baseAmount);
          discountAmount = discountRes.discountAmount;
          finalAmount = Math.max(1, discountRes.finalAmount);
          appliedCoupon = {
            code: coupon.code,
            title: coupon.title,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discountAmount,
          };
        }
      }
    }

    const amountInPaise = Math.round(finalAmount * 100);
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
          couponCode: appliedCoupon ? appliedCoupon.code : "",
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
        originalAmount: baseAmount,
        discountAmount,
        finalAmount,
        appliedCoupon,
        proratedCredit: isUpgrade ? (planConfig.price - baseAmount) : 0,
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
      couponCode,
    } = req.body;

    // Strict validation: All 3 payment verification fields are mandatory
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        message: "Payment verification failed: razorpay_order_id, razorpay_payment_id, and razorpay_signature are all mandatory.",
      });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      console.error("Payment verification failed: RAZORPAY_KEY_SECRET is not configured.");
      return res.status(500).json({ message: "Payment verification service is misconfigured on the server." });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(body)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const receivedBuffer = Buffer.from(razorpay_signature, "utf8");

    const isValid =
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

    if (!isValid) {
      return res.status(400).json({ message: "Invalid payment signature verification failed." });
    }

    const planKey = (planName || "pro").toLowerCase().replace(/\s*plan\s*/gi, "").trim();
    const planConfig = await getPlanConfig(planKey);

    if (!planConfig) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    // Find target user (tenant owner)
    const targetUserId = req.user ? (req.user.ownerId || req.user._id) : null;
    let user = targetUserId ? await User.findById(targetUserId) : null;
    if (!user && email) {
      user = await User.findOne({ email: String(email).toLowerCase().trim() });
    }

    if (user) {
      // Replay check: ensure payment hasn't already been processed
      const isDuplicatePayment =
        user.subscription?.razorpayPaymentId === razorpay_payment_id ||
        user.subscription?.paymentHistory?.some((p) => p.razorpayPaymentId === razorpay_payment_id);

      if (isDuplicatePayment) {
        return res.status(409).json({
          message: "Payment has already been verified and applied.",
          subscription: user.subscription,
        });
      }

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
          ...(user.subscription?.toObject?.() || user.subscription || {}),
          plan: planKey,
          status: "active",
          trialEndsAt: newPeriodEnd,
          currentPeriodStart: now,
          currentPeriodEnd: newPeriodEnd,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          previousPlan: prevPlan,
          upgradedAt: now,
          pendingDowngradePlan: "",
          planHistory: user.subscription.planHistory || [],
          paymentHistory: [
            ...(user.subscription.paymentHistory || []),
            {
              plan: planKey,
              amount: planConfig.price,
              paidAt: now,
              razorpayOrderId: razorpay_order_id,
              razorpayPaymentId: razorpay_payment_id,
            },
          ],
        };

        await user.save();

        if (couponCode && typeof couponCode === "string" && couponCode.trim()) {
          try {
            const coupon = await Coupon.findOne({ code: couponCode.trim().toUpperCase() });
            if (coupon) {
              const { discountAmount, finalAmount } = calculateDiscount(coupon, planConfig.price);
              coupon.usedCount = (coupon.usedCount || 0) + 1;
              if (!coupon.redemptions) coupon.redemptions = [];
              coupon.redemptions.push({
                userId: user._id,
                ownerId: user._id,
                businessName: user.businessName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
                email: user.email,
                plan: planKey,
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                originalPrice: planConfig.price,
                discountAmount,
                finalPrice: finalAmount,
                redeemedAt: new Date(),
              });
              await coupon.save();
            }
          } catch (couponErr) {
            console.error("Coupon redemption recording error:", couponErr.message);
          }
        }

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

        const freshToken = jwt.sign(
          {
            id: user._id,
            ownerId: user.ownerId || user._id,
            role: user.role,
            businessType: user.businessType,
            permissions: user.permissions || {},
          },
          process.env.JWT_SECRET || "smartbill_secret_key_123",
          { expiresIn: "7d" }
        );

        res.json({
          success: true,
          message: `Payment successful! Your account has been ${isUpgrade ? "upgraded" : "activated"} to the ${planConfig.name} plan.`,
          token: freshToken,
          user: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            businessName: user.businessName,
            businessType: user.businessType,
            email: user.email,
            phone: user.phone,
            role: user.role,
            ownerId: user.ownerId || user._id,
            subscription: user.subscription,
          },
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
      new Date() > new Date(user.subscription?.currentPeriodEnd)
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

    // Auto-heal: if user has payment in paymentHistory in the last 30 days and status was wrongly marked expired/trialing
    const lastPayment = user.subscription?.paymentHistory?.slice(-1)[0];
    if (lastPayment && lastPayment.paidAt) {
      const paymentDate = new Date(lastPayment.paidAt);
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - paymentDate.getTime() < thirtyDays && user.subscription.status !== "active") {
        user.subscription.status = "active";
        user.subscription.plan = lastPayment.plan || user.subscription.plan || "pro";
        user.subscription.currentPeriodEnd = new Date(paymentDate.getTime() + thirtyDays);
        user.subscription.trialEndsAt = user.subscription.currentPeriodEnd;
        await user.save();
      }
    }

    const subState = await getOrUpdateSubscriptionState(user);
    const planKey = user.subscription?.plan || "starter";
    const planConfig = await getPlanConfig(planKey);

    // Current month invoice usage
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const invoiceCount = await Order.countDocuments({
      ownerId,
      createdAt: { $gte: startOfMonth },
    });
    const [userCount, customerCount, productCount] = await Promise.all([
      User.countDocuments({ $or: [{ _id: ownerId }, { ownerId }] }),
      Customer.countDocuments({ ownerId }),
      Product.countDocuments({ $or: [{ ownerId }, { userId: ownerId }] }),
    ]);

    res.json({
      success: true,
      subscription: user.subscription,
      trialState: subState,
      plan: planConfig,
      usage: {
        invoicesThisMonth: invoiceCount,
        maxInvoicesPerMonth: planConfig.maxInvoicesPerMonth,
        users: userCount,
        maxUsers: planConfig.maxUsers,
        customers: customerCount,
        maxCustomers: planConfig.maxCustomers,
        products: productCount,
        maxProducts: planConfig.maxProducts,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
