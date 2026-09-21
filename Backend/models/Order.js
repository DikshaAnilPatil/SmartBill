import mongoose from "mongoose";

/**
 * ============================================================================
 * ORDER DATA MODEL (POS Transactions, Immutable Invoices & Tax Audits)
 * ============================================================================
 * 
 * PURPOSE:
 * Stores finalized point-of-sale transactions, B2B/B2C invoices, applied line-item 
 * discounts, statutory GST breakdowns (CGST/SGST/IGST), split payments, and sales returns.
 * 
 * ROLE IN ARCHITECTURE:
 * - Immutable financial record: snapshots prices and taxes at time-of-sale.
 * - Indexed by `invoiceNo` and `ownerId` with strict uniqueness to prevent duplicate bills.
 * - Tracks partial payments, balances due, customer credit, and sales return history.
 */

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
    // =========================================================================
    // 1. TENANT & CUSTOMER IDENTITY
    // =========================================================================
    /** Tenant reference for multi-tenant isolation */
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /** Customer document reference (null for anonymous walk-in sales) */
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

    // =========================================================================
    // 2. GST STATUTORY & GEOGRAPHIC ATTRIBUTES
    // =========================================================================
    /** State / Union Territory of delivery for GST tax classification */
    placeOfSupply: {
      type: String,
      default: "",
    },
    /** 'Intra-State' (CGST + SGST) vs 'Inter-State' (IGST) */
    taxType: {
      type: String,
      enum: ["Intra-State", "Inter-State"],
      default: "Intra-State",
    },

    // =========================================================================
    // 3. INVOICE IDENTIFIERS & LINE ITEMS
    // =========================================================================
    /** Sequential human-readable invoice code (e.g. 'INV-00124') */
    invoiceNo: {
      type: String,
      required: true,
      index: true,
    },
    /** Array of purchased items with immutable price/tax snapshots */
    items: {
      type: [orderItemSchema],
      default: [],
    },

    // =========================================================================
    // 4. FINANCIAL TOTALS & TAX BREAKDOWN
    // =========================================================================
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
    /** Central Goods and Services Tax (Intra-state sales) */
    cgst: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** State Goods and Services Tax (Intra-state sales) */
    sgst: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Integrated Goods and Services Tax (Inter-state sales) */
    igst: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Final payable invoice amount */
    totalOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =========================================================================
    // 5. PAYMENT SETTLEMENT & SPLIT TRANSACTIONS
    // =========================================================================
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
    /** Multiple tenders (e.g. Cash ₹500 + UPI ₹250) */
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
    /** Installment / credit repayment history */
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

    // =========================================================================
    // 6. SALES RETURNS & REFUND AUDIT
    // =========================================================================
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

    // =========================================================================
    // 7. DISCOUNTS, METADATA & COST OF GOODS SOLD
    // =========================================================================
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
    /** Total Cost of Goods Sold for profit & margin analysis */
    totalCogs: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for optimal tenant queries, invoice lookups, and financial reporting
orderSchema.index({ invoiceNo: 1, ownerId: 1 }, { unique: true });
orderSchema.index({ ownerId: 1, createdAt: -1 });
orderSchema.index({ ownerId: 1, status: 1 });
orderSchema.index({ ownerId: 1, customerId: 1 });
orderSchema.index({ ownerId: 1, date: -1 });

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;

