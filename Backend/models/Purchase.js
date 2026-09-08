import mongoose from "mongoose";

const purchaseItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  },
  productName: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0.01,
  },
  unit: {
    type: String,
    default: "pcs",
    trim: true,
  },
  purchaseRate: {
    type: Number,
    required: true,
    min: 0,
  },
  gstRate: {
    type: Number,
    default: 0,
    min: 0,
  },
  gstAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
  },
  itemAmount: {
    type: Number,
    required: true,
    min: 0,
  },
});

const purchaseSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      index: true,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    supplierInvoiceNo: {
      type: String,
      default: "",
      trim: true,
    },
    purchaseOrderNo: {
      type: String,
      default: "",
      trim: true,
    },
    purchaseDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dueDate: {
      type: Date,
    },
    items: [purchaseItemSchema],
    subtotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    gstTotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    discountTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["Unpaid", "Partially Paid", "Paid"],
      default: "Unpaid",
    },
    paymentMethod: {
      type: String,
      default: "Cash",
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      default: "",
    },
    receiptUrl: {
      type: String,
      default: "",
    },
    receiptName: {
      type: String,
      default: "",
    },
    paymentHistory: [
      {
        amount: { type: Number, required: true },
        paymentMethod: { type: String, default: "Cash" },
        date: { type: Date, default: Date.now },
        referenceNo: { type: String, default: "" },
        notes: { type: String, default: "" },
      },
    ],
  },
  {
    timestamps: true,
  }
);

purchaseSchema.index({ ownerId: 1, createdAt: -1 });
purchaseSchema.index({ ownerId: 1, purchaseDate: -1 });
purchaseSchema.index({ ownerId: 1, supplierId: 1 });
purchaseSchema.index({ ownerId: 1, paymentStatus: 1 });

export default mongoose.models.Purchase || mongoose.model("Purchase", purchaseSchema);
