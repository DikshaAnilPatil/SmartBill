import mongoose from "mongoose";

const cashVoucherSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    voucherNo: {
      type: String,
      required: true,
    },
    voucherDate: {
      type: Date,
      default: Date.now,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    vendorPhone: {
      type: String,
      default: "",
    },
    vendorAddress: {
      type: String,
      default: "",
    },
    vendorGst: {
      type: String,
      default: "",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    amountDue: {
      type: Number,
      min: 0,
    },
    amountPaid: {
      type: Number,
      min: 0,
    },
    remainingBalance: {
      type: Number,
      min: 0,
    },
    paymentMode: {
      type: String,
      enum: ["Cash", "UPI", "Bank Transfer", "Cheque", "Other"],
      default: "Cash",
    },
    accountHead: {
      type: String,
      enum: [
        "Vendor Payment",
        "Vendor Advance",
        "Transportation / Freight",
        "Material Purchase",
        "Loading & Unloading",
        "Repair & Maintenance",
        "Office Expense",
        "Miscellaneous Expense",
      ],
      default: "Vendor Payment",
    },
    referenceNo: {
      type: String,
      default: "",
      trim: true,
    },
    paidBy: {
      type: String,
      default: "Cashier / Manager",
    },
    receivedBy: {
      type: String,
      default: "",
    },
    narration: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["Paid", "Pending", "Cancelled"],
      default: "Paid",
    },
    adjustSupplierBalance: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound index to ensure uniqueness of voucherNo per business/user
cashVoucherSchema.index({ userId: 1, voucherNo: 1 }, { unique: true });

export default mongoose.model("CashVoucher", cashVoucherSchema);
