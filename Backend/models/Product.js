import mongoose from "mongoose";

/**
 * ============================================================================
 * PRODUCT DATA MODEL (Multi-Tenant Inventory Catalog & Stock Tracking)
 * ============================================================================
 * 
 * PURPOSE:
 * Central inventory schema storing catalog items, pricing tiers (retail vs wholesale),
 * tax/GST rates, HSN codes, batch/expiry tracking, physical attributes, and stock audit history.
 * 
 * ROLE IN ARCHITECTURE:
 * - Isolated per tenant (`ownerId` / `userId`).
 * - Indexed by SKU and Barcode for sub-millisecond POS lookups.
 * - Supports batch tracking and pharmaceutical prescription-only flags.
 * - Maintains chronological stock mutation audit history (`stockHistory`).
 */

const productSchema = new mongoose.Schema(
  {
    // =========================================================================
    // 1. CORE IDENTIFIERS & CATEGORIZATION
    // =========================================================================
    /** Human-readable product name */
    name: {
      type: String,
      required: true,
      trim: true,
    },

    /** Stock Keeping Unit — unique per tenant */
    sku: {
      type: String,
      required: true,
      trim: true,
    },

    /** EAN-13, Code 128, or UPC barcode scanned via camera or USB scanner */
    barcode: {
      type: String,
      trim: true,
      default: "",
    },

    /** Industry-specific category (e.g. 'Medicines', 'Dairy', 'Footwear') */
    category: {
      type: String,
      required: true,
      trim: true,
      default: "General",
    },

    /** Primary supplier/vendor name or reference */
    supplier: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================================================================
    // 2. PRICING TIERS & TAXATION
    // =========================================================================
    /** Purchase/Cost price (COGS baseline) */
    cost: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    /** Standard retail selling price (MRP/Retail) */
    price: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    /** Bulk wholesale selling price */
    wholesalePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    /** Minimum allowable price threshold for cashier discount limits */
    minPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    /** GST Tax percentage (0%, 5%, 12%, 18%, 28%) */
    gst: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // =========================================================================
    // 3. INVENTORY LEVELS & REORDER THRESHOLDS
    // =========================================================================
    /** Current real-time available stock quantity */
    stock: {
      type: Number,
      default: 0,
    },

    /** Low-stock alert threshold for automated SSE notification triggers */
    minStock: {
      type: Number,
      default: 0,
      min: 0,
    },

    /** Measurement unit (e.g. 'Piece', 'Kg', 'Litre', 'Box', 'Strip') */
    unit: {
      type: String,
      trim: true,
      default: "Piece",
    },

    /** Harmonized System Nomenclature (HSN) for GST tax compliance */
    hsnCode: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================================================================
    // 4. BATCH & HEALTHCARE / SPECIALTY ATTRIBUTES
    // =========================================================================
    /** Manufacturing batch identifier */
    batchNo: {
      type: String,
      trim: true,
      default: "",
    },

    /** Expiration date for perishables & pharmaceuticals */
    expiryDate: {
      type: Date,
      default: null,
    },

    /** Physical size (Apparel / Footwear) */
    size: {
      type: String,
      trim: true,
      default: "",
    },

    /** Physical color variant */
    color: {
      type: String,
      trim: true,
      default: "",
    },

    /** Packaging size notation (e.g. '10x10 Tablets', '500g Jar') */
    packSize: {
      type: String,
      trim: true,
      default: "",
    },

    /** Minimum order quantity for wholesale orders */
    minOrderQty: {
      type: Number,
      default: 1,
      min: 1,
    },

    /** Product warranty coverage in months */
    warrantyMonths: {
      type: Number,
      default: 0,
      min: 0,
    },

    /** Compliance flag for Schedule H / Rx prescription medications */
    isPrescriptionOnly: {
      type: Boolean,
      default: false,
    },

    /** Lifecycle status */
    status: {
      type: String,
      enum: ["Active", "Inactive", "Discontinued"],
      default: "Active",
    },

    // =========================================================================
    // 5. STOCK AUDIT HISTORY (Chronological Inward/Outward Log)
    // =========================================================================
    stockHistory: [
      {
        date: { type: Date, default: Date.now },
        type: { 
          type: String, 
          enum: ["Sale", "Purchase", "Sales Return", "Purchase Return", "Stock Adjustment", "Initial"], 
          default: "Stock Adjustment" 
        },
        quantity: { type: Number, required: true },
        previousStock: { type: Number, default: 0 },
        newStock: { type: Number, default: 0 },
        reason: { type: String, default: "" },
        referenceNo: { type: String, default: "" },
        performedBy: { type: String, default: "" },
      },
    ],

    // =========================================================================
    // 6. TENANT ISOLATION REFERENCES
    // =========================================================================
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
  },
  {
    /** Automatically generates `createdAt` and `updatedAt` ISO timestamps */
    timestamps: true,
  }
);

// Compound indexes for optimal tenant queries, POS search, and filtering
productSchema.index({ ownerId: 1, sku: 1 });
productSchema.index({ ownerId: 1, barcode: 1 });
productSchema.index({ ownerId: 1, createdAt: -1 });
productSchema.index({ ownerId: 1, category: 1 });
productSchema.index({ ownerId: 1, status: 1 });
productSchema.index({ ownerId: 1, name: 1 });

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);

export default Product;

