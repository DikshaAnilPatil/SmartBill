import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    sku: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      default: "General",
    },

    supplier: {
      type: String,
      trim: true,
      default: "",
    },

    cost: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    price: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    wholesalePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    minPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    gst: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    stock: {
      type: Number,
      default: 0,
    },

    minStock: {
      type: Number,
      default: 0,
      min: 0,
    },

    unit: {
      type: String,
      trim: true,
      default: "Piece",
    },

    hsnCode: {
      type: String,
      trim: true,
      default: "",
    },

    batchNo: {
      type: String,
      trim: true,
      default: "",
    },

    expiryDate: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["Active", "Inactive", "Discontinued"],
      default: "Active",
    },

    stockHistory: [
      {
        date: { type: Date, default: Date.now },
        type: { type: String, enum: ["Sale", "Purchase", "Sales Return", "Purchase Return", "Stock Adjustment", "Initial"], default: "Stock Adjustment" },
        quantity: { type: Number, required: true },
        previousStock: { type: Number, default: 0 },
        newStock: { type: Number, default: 0 },
        reason: { type: String, default: "" },
        referenceNo: { type: String, default: "" },
        performedBy: { type: String, default: "" },
      },
    ],

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
    timestamps: true,
  }
);

// Compound indexes for optimal tenant queries and search
productSchema.index({ ownerId: 1, sku: 1 });
productSchema.index({ ownerId: 1, createdAt: -1 });
productSchema.index({ ownerId: 1, category: 1 });
productSchema.index({ ownerId: 1, status: 1 });
productSchema.index({ ownerId: 1, name: 1 });

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);

export default Product;
