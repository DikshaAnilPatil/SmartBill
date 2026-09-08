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

    status: {
      type: String,
      enum: ["Active", "Inactive", "Discontinued"],
      default: "Active",
    },

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
