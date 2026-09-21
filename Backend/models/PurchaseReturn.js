import mongoose from "mongoose";

const purchaseReturnItemSchema = new mongoose.Schema({
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
  itemAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  reason: {
    type: String,
    default: "Damaged / Defective",
    trim: true,
  },
  condition: {
    type: String,
    enum: ["Damaged", "Faulty", "Opened", "Sealed", "Expired", "Other"],
    default: "Damaged",
  },
});

const purchaseReturnSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    debitNoteNo: {
      type: String,
      required: true,
      trim: true,
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
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
    returnDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    items: [purchaseReturnItemSchema],
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    gstTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    totalReturnAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    settlementType: {
      type: String,
      enum: [
        "Adjust from Supplier Balance",
        "Cash Refund",
        "Bank Transfer",
        "Supplier Credit Note",
      ],
      default: "Adjust from Supplier Balance",
    },
    refundStatus: {
      type: String,
      enum: ["Settled", "Pending"],
      default: "Settled",
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.PurchaseReturn ||
  mongoose.model("PurchaseReturn", purchaseReturnSchema);
