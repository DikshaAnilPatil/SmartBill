import mongoose from "mongoose";

const vendorSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "global_vendor_settings",
      unique: true,
    },
    vendorGrouping: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("VendorSettings", vendorSettingsSchema);
