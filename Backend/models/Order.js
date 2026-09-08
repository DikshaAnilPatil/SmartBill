import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.Mixed, default: null },
    name: { type: String, default: "" },
    sku: { type: String, default: "" },
    price: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    qty: { type: Number, default: 1 },
    discount: { type: Number, default: 0 },
    gstRate: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    customerName: {
      type: String,
      default: "Walk-in Customer",
    },
    invoiceNo: {
      type: String,
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    gstRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    gst: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceDue: {
      type: Number,
      default: 0,
    },
    paymentMode: {
      type: String,
      default: "Cash",
    },
    splitPayments: {
      type: [
        {
          mode: { type: String, default: "Cash" },
          amount: { type: Number, default: 0 },
          referenceNo: { type: String, default: "" },
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ["Paid", "Partial", "Due"],
      default: "Due",
    },
    returnStatus: {
      type: String,
      enum: ["None", "Partial", "Returned"],
      default: "None",
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
    returnedItems: {
      type: [orderItemSchema],
      default: [],
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    cashDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    totalCogs: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

orderSchema.index({ invoiceNo: 1, ownerId: 1 }, { unique: true });
orderSchema.index({ ownerId: 1, createdAt: -1 });
orderSchema.index({ ownerId: 1, status: 1 });
orderSchema.index({ ownerId: 1, customerId: 1 });
orderSchema.index({ ownerId: 1, date: -1 });

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;
