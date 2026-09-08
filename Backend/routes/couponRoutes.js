import express from "express";
import {
  getCoupons,
  getCouponStats,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  getCouponRedemptions,
  validateCoupon,
  getFeaturedBanner,
} from "../controller/couponController.js";
import { protect, requireRole } from "../middleware/mid.js";

const router = express.Router();

const internalAdminRoles = ["superadmin", "super_admin", "admin", "support", "billing", "owner"];

/* ─────────────────────────────────────────────────────────────
   Public / Client Routes
───────────────────────────────────────────────────────────── */
// Get featured announcement banner
router.get("/featured-banner", getFeaturedBanner);

// Validate coupon code during checkout (optional auth)
router.post("/validate", validateCoupon);

/* ─────────────────────────────────────────────────────────────
   Protected Super Admin Routes (both /admin and direct path)
───────────────────────────────────────────────────────────── */
router.get("/admin/stats", protect, requireRole(internalAdminRoles), getCouponStats);
router.get("/admin/redemptions", protect, requireRole(internalAdminRoles), getCouponRedemptions);
router.get("/admin", protect, requireRole(internalAdminRoles), getCoupons);
router.post("/admin", protect, requireRole(internalAdminRoles), createCoupon);
router.put("/admin/:id", protect, requireRole(internalAdminRoles), updateCoupon);
router.delete("/admin/:id", protect, requireRole(internalAdminRoles), deleteCoupon);
router.patch("/admin/:id/toggle", protect, requireRole(internalAdminRoles), toggleCouponStatus);

router.get("/stats", protect, requireRole(internalAdminRoles), getCouponStats);
router.get("/redemptions", protect, requireRole(internalAdminRoles), getCouponRedemptions);
router.get("/", protect, requireRole(internalAdminRoles), getCoupons);
router.post("/", protect, requireRole(internalAdminRoles), createCoupon);
router.put("/:id", protect, requireRole(internalAdminRoles), updateCoupon);
router.delete("/:id", protect, requireRole(internalAdminRoles), deleteCoupon);
router.patch("/:id/toggle", protect, requireRole(internalAdminRoles), toggleCouponStatus);

export default router;
