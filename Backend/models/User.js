import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    firstName: {
      type: String,
      required: true,
    },

    lastName: {
      type: String,
      default: "",
    },

    businessName: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    phone: {
      type: String,
      default: "",
    },

    businessType: {
      type: String,
      default: "Retail",
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      default: "owner",
    },

    department: {
      type: String,
      default: "",
    },

    permissions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      enum: ["Active", "Inactive", "Suspended"],
      default: "Active",
    },

    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },

    failedLoginAttempts: {
      type: Number,
      default: 0,
    },

    lockoutUntil: {
      type: Date,
      default: null,
    },

    // Business Profile & Invoice Customization Fields
    tagline: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    country: { type: String, default: "India" },
    gstin: { type: String, default: "" },
    panNumber: { type: String, default: "" },
    msmeNumber: { type: String, default: "" },

    // Bank & Payment Details for Billing / Invoices
    bankName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifscCode: { type: String, default: "" },
    branchName: { type: String, default: "" },
    upiId: { type: String, default: "" },

    // Invoice Terms & Footer
    invoiceTerms: { type: String, default: "1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged on overdue payments." },
    invoiceFooter: { type: String, default: "Thank you for your business!" },

    // Business Branding
    logoUrl: { type: String, default: "" },
    signatureUrl: { type: String, default: "" },

    // Subscription & Plan Details
    subscription: {
      plan: {
        type: String,
        enum: ["starter", "pro", "enterprise"],
        default: "starter",
      },
      status: {
        type: String,
        enum: ["active", "trialing", "canceled", "expired"],
        default: "trialing",
      },
      trialEndsAt: {
        type: Date,
        default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
      currentPeriodStart: { type: Date, default: Date.now },
      currentPeriodEnd: { type: Date },
      razorpayOrderId: { type: String, default: "" },
      razorpayPaymentId: { type: String, default: "" },

      // Plan change tracking
      previousPlan: { type: String, default: "" },
      upgradedAt: { type: Date },
      // Pending downgrade: if set, switch to this plan at currentPeriodEnd
      pendingDowngradePlan: { type: String, default: "" },
      planHistory: [
        {
          plan: { type: String },
          activatedAt: { type: Date },
          price: { type: Number },
          reason: { type: String, default: "upgrade" }, // "initial" | "upgrade" | "downgrade"
        },
      ],
      paymentHistory: [
        {
          plan: { type: String },
          amount: { type: Number, default: 0 },
          paidAt: { type: Date, default: Date.now },
          razorpayOrderId: { type: String, default: "" },
          razorpayPaymentId: { type: String, default: "" },
        },
      ],
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("User", userSchema);
