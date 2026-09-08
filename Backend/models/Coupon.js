import mongoose from "mongoose";

const redemptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    businessName: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      default: "",
    },
    plan: {
      type: String,
      required: true,
    },
    originalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    orderId: {
      type: String,
      default: "",
    },
    paymentId: {
      type: String,
      default: "",
    },
    redeemedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Offer title / campaign name is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "flat", "trial_days"],
      default: "percentage",
      required: true,
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
    },
    maxDiscountAmount: {
      type: Number,
      default: null, // Cap for percentage discounts, e.g., max ₹1000 off
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    applicablePlans: {
      type: [String],
      default: ["all"], // ["all", "starter", "pro", "enterprise"]
    },
    applicableCycles: {
      type: [String],
      default: ["all"], // ["all", "monthly", "annual"]
    },
    maxUsageCount: {
      type: Number,
      default: null, // null or Infinity for unlimited total uses
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxUsagePerUser: {
      type: Number,
      default: 1,
      min: 1,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "expired"],
      default: "active",
      index: true,
    },
    isFeaturedBanner: {
      type: Boolean,
      default: false,
    },
    bannerText: {
      type: String,
      default: "",
      trim: true,
    },
    bannerCta: {
      type: String,
      default: "Claim Offer",
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    redemptions: [redemptionSchema],
  },
  {
    timestamps: true,
  }
);

// Virtual check for expiry
couponSchema.virtual("isExpired").get(function () {
  if (this.status === "expired" || this.status === "inactive") return true;
  if (this.expiryDate && new Date() > new Date(this.expiryDate)) return true;
  if (this.maxUsageCount != null && this.usedCount >= this.maxUsageCount) return true;
  return false;
});

// Configure to include virtuals when converting to JSON
couponSchema.set("toJSON", { virtuals: true });
couponSchema.set("toObject", { virtuals: true });

const Coupon = mongoose.model("Coupon", couponSchema);

export default Coupon;
