import mongoose from "mongoose";
import SystemSettings from "./Backend/models/SystemSettings.js";
import User from "./Backend/models/User.js";

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smartbill";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB successfully");

    let settings = await SystemSettings.findOne({ key: "global_system_settings" });
    if (!settings) {
      settings = await SystemSettings.create({ key: "global_system_settings" });
    }
    console.log("Original vendorGrouping:", settings.vendorGrouping);

    settings.vendorGrouping = true;
    await settings.save();
    console.log("Updated vendorGrouping to true:", settings.vendorGrouping);

    settings.vendorGrouping = false;
    await settings.save();
    console.log("Reset vendorGrouping to false:", settings.vendorGrouping);

    const owners = await User.find({ role: "owner" }).select("firstName lastName businessName businessType").lean();
    console.log(`Found ${owners.length} owners in DB.`);
    owners.forEach(o => {
      console.log(`- Owner: ${o.firstName} ${o.lastName}, Business: ${o.businessName}, Category: ${o.businessType || "N/A"}`);
    });

  } catch (err) {
    console.error("Test Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
