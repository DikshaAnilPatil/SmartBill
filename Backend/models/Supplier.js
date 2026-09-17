import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    contact: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      default: "",
    },

    city: {
      type: String,
      default: "",
    },

    state: {
      type: String,
      default: "",
    },

    address: {
      type: String,
      default: "",
    },

    gst: {
      type: String,
      default: "",
    },

    openingBalance: {
      type: Number,
      default: 0,
    },

    totalPurchases: {
      type: Number,
      default: 0,
    },

    totalPaid: {
      type: Number,
      default: 0,
    },

    balance: {
      type: Number,
      default: 0,
    },

    paymentHistory: [
      {
        amount: { type: Number, required: true },
        paymentMethod: { type: String, default: "Cash" },
        date: { type: Date, default: Date.now },
        referenceNo: { type: String, default: "" },
        notes: { type: String, default: "" },
        purchaseBillNo: { type: String, default: "" },
      },
    ],

    status: {
      type: String,
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

supplierSchema.index({ ownerId: 1, name: 1 });
supplierSchema.index({ ownerId: 1, createdAt: -1 });

export default mongoose.models.Supplier || mongoose.model("Supplier", supplierSchema);