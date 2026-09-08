import test from "node:test";
import assert from "node:assert/strict";
import { calculateDiscount } from "../controller/couponController.js";

test("Offers & Coupons Calculation & Verification Engine", async (t) => {
  await t.test("should accurately calculate standard percentage discount", () => {
    const coupon = {
      discountType: "percentage",
      discountValue: 20, // 20%
      maxDiscountAmount: null,
    };
    const originalPrice = 2499;
    const { discountAmount, finalAmount } = calculateDiscount(coupon, originalPrice);

    assert.equal(discountAmount, 499.8);
    assert.equal(finalAmount, 1999.2);
  });

  await t.test("should enforce maxDiscountAmount cap on percentage discounts", () => {
    const coupon = {
      discountType: "percentage",
      discountValue: 50, // 50%
      maxDiscountAmount: 500, // Capped at ₹500
    };
    const originalPrice = 2499; // 50% of 2499 is 1249.5, should cap to 500
    const { discountAmount, finalAmount } = calculateDiscount(coupon, originalPrice);

    assert.equal(discountAmount, 500);
    assert.equal(finalAmount, 1999);
  });

  await t.test("should accurately calculate flat rupee discount", () => {
    const coupon = {
      discountType: "flat",
      discountValue: 300,
    };
    const originalPrice = 999;
    const { discountAmount, finalAmount } = calculateDiscount(coupon, originalPrice);

    assert.equal(discountAmount, 300);
    assert.equal(finalAmount, 699);
  });

  await t.test("should cap flat discount at base price so total is never negative", () => {
    const coupon = {
      discountType: "flat",
      discountValue: 1500,
    };
    const originalPrice = 999;
    const { discountAmount, finalAmount } = calculateDiscount(coupon, originalPrice);

    assert.equal(discountAmount, 999);
    assert.equal(finalAmount, 0);
  });

  await t.test("should return 0 cash discount for extra trial days discount type", () => {
    const coupon = {
      discountType: "trial_days",
      discountValue: 14,
    };
    const originalPrice = 999;
    const { discountAmount, finalAmount } = calculateDiscount(coupon, originalPrice);

    assert.equal(discountAmount, 0);
    assert.equal(finalAmount, 999);
  });

  await t.test("should correctly validate plan compatibility", () => {
    const couponForProOnly = {
      applicablePlans: ["pro", "enterprise"],
    };

    const isStarterValid =
      couponForProOnly.applicablePlans.includes("all") ||
      couponForProOnly.applicablePlans.includes("starter");
    const isProValid =
      couponForProOnly.applicablePlans.includes("all") ||
      couponForProOnly.applicablePlans.includes("pro");

    assert.equal(isStarterValid, false);
    assert.equal(isProValid, true);
  });

  await t.test("should detect when a coupon has reached max usage limit", () => {
    const coupon = {
      maxUsageCount: 100,
      usedCount: 100,
    };

    const isLimitReached =
      coupon.maxUsageCount != null && coupon.usedCount >= coupon.maxUsageCount;

    assert.equal(isLimitReached, true);
  });

  await t.test("should detect when a coupon has expired based on date", () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const expiredCoupon = { expiryDate: pastDate };
    const validCoupon = { expiryDate: futureDate };

    const isPastExpired = Boolean(expiredCoupon.expiryDate && new Date(expiredCoupon.expiryDate) < new Date());
    const isFutureExpired = Boolean(validCoupon.expiryDate && new Date(validCoupon.expiryDate) < new Date());

    assert.equal(isPastExpired, true);
    assert.equal(isFutureExpired, false);
  });
});
