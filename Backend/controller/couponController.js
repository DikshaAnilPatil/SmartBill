import Coupon from "../models/Coupon.js";
import User from "../models/User.js";
import { getPlanConfig } from "../middleware/checkPlanLimits.js";
import { PLAN_LIMITS } from "../config/plans.js";

/* ─────────────────────────────────────────────────────────────
   Super Admin: List all coupons with filters & stats
   GET /api/admin/coupons
───────────────────────────────────────────────────────────── */
export const getCoupons = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { code: { $regex: search.trim(), $options: "i" } },
        { title: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Coupon.countDocuments(filter);
    const coupons = await Coupon.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean({ virtuals: true });

    // Auto-update status for expired dates
    const now = new Date();
    const updatedCoupons = coupons.map((c) => {
      if (c.status === "active" && c.expiryDate && new Date(c.expiryDate) < now) {
        c.status = "expired";
      }
      return c;
    });

    res.json({
      success: true,
      coupons: updatedCoupons,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ message: "Failed to fetch coupons", error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   Super Admin: Summary KPI metrics for dashboard
   GET /api/admin/coupons/stats
───────────────────────────────────────────────────────────── */
export const getCouponStats = async (req, res) => {
  try {
    const coupons = await Coupon.find().lean();
    const now = new Date();

    let totalCoupons = coupons.length;
    let activeCoupons = 0;
    let totalRedemptions = 0;
    let totalDiscountsGiven = 0;
    let totalRevenueGenerated = 0;

    for (const c of coupons) {
      const isExpired =
        c.status === "expired" ||
        (c.expiryDate && new Date(c.expiryDate) < now) ||
        (c.maxUsageCount != null && c.usedCount >= c.maxUsageCount);

      if (c.status === "active" && !isExpired) {
        activeCoupons++;
      }

      if (Array.isArray(c.redemptions)) {
        for (const r of c.redemptions) {
          totalRedemptions++;
          totalDiscountsGiven += Number(r.discountAmount || 0);
          totalRevenueGenerated += Number(r.finalAmount || 0);
        }
      }
    }

    res.json({
      success: true,
      stats: {
        totalCoupons,
        activeCoupons,
        totalRedemptions,
        totalDiscountsGiven: Math.round(totalDiscountsGiven),
        totalRevenueGenerated: Math.round(totalRevenueGenerated),
      },
    });
  } catch (error) {
    console.error("Error fetching coupon stats:", error);
    res.status(500).json({ message: "Failed to fetch coupon stats", error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   Super Admin: Create a new Coupon
   POST /api/admin/coupons
───────────────────────────────────────────────────────────── */
export const createCoupon = async (req, res) => {
  try {
    const {
      code,
      title,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
      applicablePlans,
      applicableCycles,
      maxUsageCount,
      maxUsagePerUser,
      startDate,
      expiryDate,
      status,
      isFeaturedBanner,
      bannerText,
      bannerCta,
    } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ message: "Coupon code is required." });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Offer title / campaign name is required." });
    }
    if (discountValue == null || isNaN(Number(discountValue)) || Number(discountValue) < 0) {
      return res.status(400).json({ message: "Valid discount value is required." });
    }

    const normalizedCode = code.trim().toUpperCase().replace(/\s+/g, "");

    const existing = await Coupon.findOne({ code: normalizedCode });
    if (existing) {
      return res.status(400).json({ message: `Coupon with code "${normalizedCode}" already exists.` });
    }

    // If marked as featured banner, unmark other featured banners
    if (isFeaturedBanner) {
      await Coupon.updateMany({ isFeaturedBanner: true }, { isFeaturedBanner: false });
    }

    const newCoupon = new Coupon({
      code: normalizedCode,
      title: title.trim(),
      description: description ? description.trim() : "",
      discountType: discountType || "percentage",
      discountValue: Number(discountValue),
      maxDiscountAmount: maxDiscountAmount != null && maxDiscountAmount !== "" ? Number(maxDiscountAmount) : null,
      minOrderAmount: minOrderAmount != null && minOrderAmount !== "" ? Number(minOrderAmount) : 0,
      applicablePlans: Array.isArray(applicablePlans) && applicablePlans.length > 0 ? applicablePlans : ["all"],
      applicableCycles: Array.isArray(applicableCycles) && applicableCycles.length > 0 ? applicableCycles : ["all"],
      maxUsageCount: maxUsageCount != null && maxUsageCount !== "" ? Number(maxUsageCount) : null,
      maxUsagePerUser: maxUsagePerUser != null && maxUsagePerUser !== "" ? Number(maxUsagePerUser) : 1,
      startDate: startDate ? new Date(startDate) : new Date(),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      status: status || "active",
      isFeaturedBanner: Boolean(isFeaturedBanner),
      bannerText: bannerText ? bannerText.trim() : "",
      bannerCta: bannerCta ? bannerCta.trim() : "Claim Offer",
      createdBy: req.user?._id,
    });

    await newCoupon.save();

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      coupon: newCoupon,
    });
  } catch (error) {
    console.error("Error creating coupon:", error);
    res.status(500).json({ message: "Failed to create coupon", error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   Super Admin: Update an existing Coupon
   PUT /api/admin/coupons/:id
───────────────────────────────────────────────────────────── */
export const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    const {
      code,
      title,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
      applicablePlans,
      applicableCycles,
      maxUsageCount,
      maxUsagePerUser,
      startDate,
      expiryDate,
      status,
      isFeaturedBanner,
      bannerText,
      bannerCta,
    } = req.body;

    if (code) {
      const normalizedCode = code.trim().toUpperCase().replace(/\s+/g, "");
      if (normalizedCode !== coupon.code) {
        const existing = await Coupon.findOne({ code: normalizedCode });
        if (existing) {
          return res.status(400).json({ message: `Coupon code "${normalizedCode}" is already taken.` });
        }
        coupon.code = normalizedCode;
      }
    }

    if (title !== undefined) coupon.title = title.trim();
    if (description !== undefined) coupon.description = description.trim();
    if (discountType !== undefined) coupon.discountType = discountType;
    if (discountValue !== undefined) coupon.discountValue = Number(discountValue);
    if (maxDiscountAmount !== undefined) {
      coupon.maxDiscountAmount = maxDiscountAmount != null && maxDiscountAmount !== "" ? Number(maxDiscountAmount) : null;
    }
    if (minOrderAmount !== undefined) {
      coupon.minOrderAmount = minOrderAmount != null && minOrderAmount !== "" ? Number(minOrderAmount) : 0;
    }
    if (applicablePlans !== undefined) {
      coupon.applicablePlans = Array.isArray(applicablePlans) && applicablePlans.length > 0 ? applicablePlans : ["all"];
    }
    if (applicableCycles !== undefined) {
      coupon.applicableCycles = Array.isArray(applicableCycles) && applicableCycles.length > 0 ? applicableCycles : ["all"];
    }
    if (maxUsageCount !== undefined) {
      coupon.maxUsageCount = maxUsageCount != null && maxUsageCount !== "" ? Number(maxUsageCount) : null;
    }
    if (maxUsagePerUser !== undefined) {
      coupon.maxUsagePerUser = maxUsagePerUser != null && maxUsagePerUser !== "" ? Number(maxUsagePerUser) : 1;
    }
    if (startDate !== undefined) coupon.startDate = startDate ? new Date(startDate) : new Date();
    if (expiryDate !== undefined) coupon.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (status !== undefined) coupon.status = status;

    if (isFeaturedBanner !== undefined) {
      coupon.isFeaturedBanner = Boolean(isFeaturedBanner);
      if (coupon.isFeaturedBanner) {
        await Coupon.updateMany({ _id: { $ne: coupon._id }, isFeaturedBanner: true }, { isFeaturedBanner: false });
      }
    }
    if (bannerText !== undefined) coupon.bannerText = bannerText.trim();
    if (bannerCta !== undefined) coupon.bannerCta = bannerCta.trim();

    await coupon.save();

    res.json({
      success: true,
      message: "Coupon updated successfully",
      coupon,
    });
  } catch (error) {
    console.error("Error updating coupon:", error);
    res.status(500).json({ message: "Failed to update coupon", error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   Super Admin: Delete Coupon
   DELETE /api/admin/coupons/:id
───────────────────────────────────────────────────────────── */
export const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    res.json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({ message: "Failed to delete coupon", error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   Super Admin: Toggle status (active / inactive)
   PATCH /api/admin/coupons/:id/toggle
───────────────────────────────────────────────────────────── */
export const toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    coupon.status = coupon.status === "active" ? "inactive" : "active";
    await coupon.save();

    res.json({
      success: true,
      message: `Coupon is now ${coupon.status}`,
      status: coupon.status,
    });
  } catch (error) {
    console.error("Error toggling coupon status:", error);
    res.status(500).json({ message: "Failed to toggle coupon status", error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   Super Admin: Get all redemption history logs
   GET /api/admin/coupons/redemptions
───────────────────────────────────────────────────────────── */
export const getCouponRedemptions = async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;

    const coupons = await Coupon.find({ "redemptions.0": { $exists: true } })
      .select("code title discountType discountValue redemptions")
      .lean();

    let allRedemptions = [];
    for (const c of coupons) {
      if (Array.isArray(c.redemptions)) {
        for (const r of c.redemptions) {
          allRedemptions.push({
            ...r,
            couponId: c._id,
            couponCode: c.code,
            couponTitle: c.title,
            discountType: c.discountType,
            discountValue: c.discountValue,
          });
        }
      }
    }

    // Sort by most recent
    allRedemptions.sort((a, b) => new Date(b.redeemedAt || 0) - new Date(a.redeemedAt || 0));

    // Optional text filter
    if (search) {
      const q = search.toLowerCase();
      allRedemptions = allRedemptions.filter(
        (r) =>
          (r.businessName && r.businessName.toLowerCase().includes(q)) ||
          (r.email && r.email.toLowerCase().includes(q)) ||
          (r.couponCode && r.couponCode.toLowerCase().includes(q)) ||
          (r.plan && r.plan.toLowerCase().includes(q))
      );
    }

    const total = allRedemptions.length;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const paginated = allRedemptions.slice(skip, skip + parseInt(limit, 10));

    res.json({
      success: true,
      redemptions: paginated,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (error) {
    console.error("Error fetching redemptions:", error);
    res.status(500).json({ message: "Failed to fetch redemptions", error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   Calculate discount helper function
───────────────────────────────────────────────────────────── */
export const calculateDiscount = (coupon, originalAmount) => {
  const amount = Number(originalAmount) || 0;
  let discount = 0;

  if (coupon.discountType === "percentage") {
    discount = (amount * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount != null && coupon.maxDiscountAmount > 0) {
      discount = Math.min(discount, coupon.maxDiscountAmount);
    }
  } else if (coupon.discountType === "flat") {
    discount = Math.min(coupon.discountValue, amount);
  } else if (coupon.discountType === "trial_days") {
    discount = 0; // Trial days don't discount cash, they grant days
  }

  discount = Math.round(discount * 100) / 100;
  const finalAmount = Math.max(0, Math.round((amount - discount) * 100) / 100);

  return {
    discountAmount: discount,
    finalAmount,
  };
};

/* ─────────────────────────────────────────────────────────────
   Client / Checkout: Validate a coupon code for a given plan
   POST /api/coupons/validate
───────────────────────────────────────────────────────────── */
export const validateCoupon = async (req, res) => {
  try {
    const { code, planName, originalAmount } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ message: "Please enter a coupon code." });
    }

    const normalizedCode = code.trim().toUpperCase();
    const coupon = await Coupon.findOne({ code: normalizedCode });

    if (!coupon) {
      return res.status(404).json({ message: "Invalid coupon code." });
    }

    const now = new Date();

    // 1. Check status
    if (coupon.status !== "active") {
      return res.status(400).json({ message: "This coupon is currently inactive or expired." });
    }

    // 2. Check dates
    if (coupon.startDate && new Date(coupon.startDate) > now) {
      return res.status(400).json({ message: "This offer has not started yet." });
    }
    if (coupon.expiryDate && new Date(coupon.expiryDate) < now) {
      return res.status(400).json({ message: "This coupon has expired." });
    }

    // 3. Check global usage cap
    if (coupon.maxUsageCount != null && coupon.usedCount >= coupon.maxUsageCount) {
      return res.status(400).json({ message: "This coupon has reached its maximum redemption limit." });
    }

    // 4. Check user per-account usage limit
    const userId = req.user?.ownerId || req.user?._id;
    if (userId && Array.isArray(coupon.redemptions)) {
      const userRedemptionCount = coupon.redemptions.filter(
        (r) => r.userId?.toString() === userId.toString() || r.ownerId?.toString() === userId.toString()
      ).length;

      if (userRedemptionCount >= (coupon.maxUsagePerUser || 1)) {
        return res.status(400).json({ message: "You have already used this coupon code." });
      }
    }

    // 5. Check plan compatibility
    const normalizedPlan = (planName || "").toLowerCase().replace(/\s*plan\s*/gi, "").trim();
    if (
      normalizedPlan &&
      !coupon.applicablePlans.includes("all") &&
      !coupon.applicablePlans.includes(normalizedPlan)
    ) {
      return res.status(400).json({
        message: `This coupon is not valid for the ${normalizedPlan.toUpperCase()} plan. Applicable plans: ${coupon.applicablePlans.join(", ")}.`,
      });
    }

    // 6. Check min order amount
    let basePrice = Number(originalAmount);
    if (isNaN(basePrice) || basePrice <= 0) {
      const planConfig = (await getPlanConfig(normalizedPlan)) || PLAN_LIMITS[normalizedPlan] || {};
      basePrice = planConfig.price || 0;
    }

    if (coupon.minOrderAmount > 0 && basePrice < coupon.minOrderAmount) {
      return res.status(400).json({
        message: `This coupon requires a minimum spend of ₹${coupon.minOrderAmount}.`,
      });
    }

    const { discountAmount, finalAmount } = calculateDiscount(coupon, basePrice);

    res.json({
      success: true,
      valid: true,
      message: `Coupon applied: ${coupon.title}`,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        title: coupon.title,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountAmount: coupon.maxDiscountAmount,
      },
      originalAmount: basePrice,
      discountAmount,
      finalAmount,
      trialDays: coupon.discountType === "trial_days" ? coupon.discountValue : 0,
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    res.status(500).json({ message: "Failed to validate coupon", error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   Public / Landing Page: Get active featured announcement banner
   GET /api/coupons/featured-banner
───────────────────────────────────────────────────────────── */
export const getFeaturedBanner = async (req, res) => {
  try {
    const now = new Date();
    const bannerCoupon = await Coupon.findOne({
      isFeaturedBanner: true,
      status: "active",
      $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }],
    }).lean();

    if (!bannerCoupon) {
      return res.json({ success: true, banner: null });
    }

    res.json({
      success: true,
      banner: {
        code: bannerCoupon.code,
        title: bannerCoupon.title,
        bannerText: bannerCoupon.bannerText || `${bannerCoupon.discountValue}% OFF with code ${bannerCoupon.code}!`,
        bannerCta: bannerCoupon.bannerCta || "Claim Offer",
        discountType: bannerCoupon.discountType,
        discountValue: bannerCoupon.discountValue,
        expiryDate: bannerCoupon.expiryDate,
      },
    });
  } catch (error) {
    console.error("Error fetching featured banner:", error);
    res.status(500).json({ message: "Failed to fetch featured banner" });
  }
};
