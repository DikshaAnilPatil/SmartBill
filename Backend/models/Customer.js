import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    city: {
      type: String,
      trim: true,
      default: "",
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    gst: {
      type: String,
      trim: true,
      default: "",
    },

    state: {
      type: String,
      trim: true,
      default: "",
    },

    stateCode: {
      type: String,
      trim: true,
      default: "",
    },

    category: {
      type: String,
      trim: true,
      default: "Retailer",
    },

    creditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },

    shippingAddress: {
      type: String,
      trim: true,
      default: "",
    },

    openingBalance: {
      type: Number,
      default: 0,
    },

    totalOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    balance: {
      type: Number,
      default: 0,
    },

    invoices: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentHistory: [
      {
        amount: { type: Number, required: true },
        paymentMode: { type: String, default: "Cash" },
        date: { type: Date, default: Date.now },
        referenceNo: { type: String, default: "" },
        notes: { type: String, default: "" },
        invoiceNo: { type: String, default: "" },
      },
    ],

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for tenant-isolated querying & search
// Note: name is NOT unique so distinct customers can share common names
customerSchema.index({ ownerId: 1, createdAt: -1 });
customerSchema.index({ ownerId: 1, name: 1 });
customerSchema.index({ ownerId: 1, phone: 1 });
customerSchema.index({ ownerId: 1, status: 1 });

const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);

// Self-healing migration to drop the harmful legacy unique index on name if present
Customer.collection.indexes().then((indexes) => {
  const legacyUniqueIndex = indexes.find((idx) => idx.name === "ownerId_1_name_1" && idx.unique);
  if (legacyUniqueIndex) {
    Customer.collection.dropIndex("ownerId_1_name_1").catch((err) => {
      console.warn("Could not drop legacy customer unique index:", err.message);
    });
  }
}).catch(() => {});

export default Customer;