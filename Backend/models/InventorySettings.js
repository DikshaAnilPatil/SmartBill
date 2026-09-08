import mongoose from "mongoose";

const inventorySettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    stockValueFormula: {
      type: String,
      default: "FIFO Method",
    },
    defaultItemType: {
      type: String,
      default: "Goods",
    },
    lowStockAlert: {
      type: String,
      default: "10",
    },
    enableSerialTracking: {
      type: Boolean,
      default: false,
    },
    enableBatchTracking: {
      type: Boolean,
      default: false,
    },
    enableMultiUnit: {
      type: Boolean,
      default: true,
    },
    preventNegativeStock: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("InventorySettings", inventorySettingsSchema);
