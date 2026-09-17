import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.Mixed, default: null },
    name: { type: String, default: "" },
    sku: { type: String, default: "" },
    hsnCode: { type: String, default: "" },
    unit: { type: String, default: "Piece" },
    batchNo: { type: String, default: "" },
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
    customerPhone: {
      type: String,
      default: "",
    },
    customerGst: {
      type: String,
      default: "",
    },
    placeOfSupply: {
      type: String,
      default: "",
    },
    taxType: {
      type: String,
      enum: ["Intra-State", "Inter-State"],
      default: "Intra-State",
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
    cgst: {
      type: Number,
      default: 0,
      min: 0,
    },
    sgst: {
      type: Number,
      default: 0,
      min: 0,
    },
    igst: {
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
    paymentHistory: [
      {
        amount: { type: Number, required: true },
        paymentMode: { type: String, default: "Cash" },
        date: { type: Date, default: Date.now },
        referenceNo: { type: String, default: "" },
        notes: { type: String, default: "" },
      },
    ],
    status: {
      type: String,
      enum: ["Paid", "Partial", "Due", "Cancelled"],
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
    salesReturns: [
      {
        returnNo: { type: String, default: "" },
        returnDate: { type: Date, default: Date.now },
        reason: { type: String, default: "" },
        refundAmount: { type: Number, default: 0 },
        paymentMode: { type: String, default: "Cash" },
        items: [orderItemSchema],
      },
    ],
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
    notes: {
      type: String,
      default: "",
    },
    terms: {
      type: String,
      default: "",
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
