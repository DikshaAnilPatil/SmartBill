import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    billingCycle: {
      type: String,
      enum: ["monthly", "yearly", "custom"],
      default: "monthly",
    },

    maxUsers: { type: Number, default: null, min: 0 },
    maxInvoicesPerMonth: { type: Number, default: null, min: 0 },
    maxCustomers: { type: Number, default: null, min: 0 },
    maxProducts: { type: Number, default: null, min: 0 },

    features: {
      basicReports: {
        type: Boolean,
        default: false,
      },

      advancedReports: {
        type: Boolean,
        default: false,
      },

      gstReports: {
        type: Boolean,
        default: false,
      },

      expenses: { type: Boolean, default: false },
      purchaseManagement: { type: Boolean, default: false },
      inventory: { type: Boolean, default: false },
      paymentTracking: { type: Boolean, default: false },
      paymentHistory: { type: Boolean, default: false },
      advancedPaymentHistory: { type: Boolean, default: false },
      invoiceCustomization: { type: Boolean, default: false },
      advancedInvoiceCustomization: { type: Boolean, default: false },
      unlimitedInvoiceCustomization: { type: Boolean, default: false },
      stockAlerts: { type: Boolean, default: false },
      advancedStockAlerts: { type: Boolean, default: false },
      enhancedStockMonitoring: { type: Boolean, default: false },
      dataExport: { type: Boolean, default: false },

    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "SubscriptionPlan",
  subscriptionPlanSchema
);