import mongoose from "mongoose";

const transactionSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // 1. Pricing & Billing Rules
    salePrice: {
      type: String,
      default: "Retail Price",
      trim: true,
    },

    allowPriceEditing: {
      type: Boolean,
      default: false,
    },

    allowNegativeStock: {
      type: Boolean,
      default: false,
    },

    // 2. Discount Management
    allowDiscount: {
      type: Boolean,
      default: true,
    },

    discountType: {
      type: String,
      default: "Percentage",
      trim: true,
    },

    discountAppliedOn: {
      type: String,
      default: "Item-wise",
      trim: true,
    },

    maximumDiscount: {
      type: String,
      default: "20",
      trim: true,
    },

    // 3. Payment & Checkout
    defaultPaymentMode: {
      type: String,
      default: "Cash",
      trim: true,
    },

    enableRoundOff: {
      type: Boolean,
      default: false,
    },

    cashDiscountPercent: {
      type: String,
      default: "0",
      trim: true,
    },

    showPrintPreview: {
      type: Boolean,
      default: true,
    },

    printAfterSaving: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "TransactionSettings",
  transactionSettingsSchema
);