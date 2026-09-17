import mongoose from "mongoose";
import VendorSettings from "./models/VendorSettings.js";
import SystemSettings from "./models/SystemSettings.js";

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smartbill";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // 1. Verify VendorSettings exists separately
    let vSettings = await VendorSettings.findOne({ key: "global_vendor_settings" });
    if (!vSettings) {
      vSettings = await VendorSettings.create({ key: "global_vendor_settings", vendorGrouping: true });
    }
    console.log("VendorSettings doc:", vSettings);

    // 2. Verify SystemSettings does NOT have vendorGrouping
    let sysSettings = await SystemSettings.findOne({ key: "global_system_settings" });
    console.log("SystemSettings vendorGrouping:", sysSettings?.vendorGrouping);

  } catch (err) {
    console.error("Test Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
