import axiosClient from "./axiosClient";

/* ─────────────────────────────────────────────────────────────
   Super Admin APIs
───────────────────────────────────────────────────────────── */

/**
 * Fetch all coupons with optional status, search, and pagination.
 */
export const getAdminCoupons = (params = {}) =>
  axiosClient.get("/coupons/admin", { params }).then((res) => res.data);

/**
 * Fetch coupon KPI metrics.
 */
export const getAdminCouponStats = () =>
  axiosClient.get("/coupons/admin/stats").then((res) => res.data);

/**
 * Create a new coupon.
 */
export const createAdminCoupon = (payload) =>
  axiosClient.post("/coupons/admin", payload).then((res) => res.data);

/**
 * Update an existing coupon.
 */
export const updateAdminCoupon = (id, payload) =>
  axiosClient.put(`/coupons/admin/${id}`, payload).then((res) => res.data);

/**
 * Delete a coupon.
 */
export const deleteAdminCoupon = (id) =>
  axiosClient.delete(`/coupons/admin/${id}`).then((res) => res.data);

/**
 * Toggle active/inactive status of a coupon.
 */
export const toggleCouponStatus = (id) =>
  axiosClient.patch(`/coupons/admin/${id}/toggle`).then((res) => res.data);

/**
 * Fetch all coupon redemption audit logs.
 */
export const getCouponRedemptions = (params = {}) =>
  axiosClient.get("/coupons/admin/redemptions", { params }).then((res) => res.data);

/* ─────────────────────────────────────────────────────────────
   Public / Client APIs
───────────────────────────────────────────────────────────── */

/**
 * Validate a coupon code for a given plan and price.
 */
export const validateCouponCode = (code, planName, originalAmount) =>
  axiosClient
    .post("/coupons/validate", { code, planName, originalAmount })
    .then((res) => res.data);

/**
 * Fetch the active promotional announcement banner for landing page / upgrade screen.
 */
export const getFeaturedBanner = () =>
  axiosClient.get("/coupons/featured-banner").then((res) => res.data);
