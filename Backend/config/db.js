import mongoose from "mongoose";
import dns from "dns";

// Fix Windows Node.js DNS SRV resolution issue for MongoDB Atlas cluster
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch (dnsErr) {
  console.warn("[DB] Custom DNS server config notice:", dnsErr.message);
}

const dropLegacyIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const names = collections.map((c) => c.name);

    if (names.includes("users")) {
      const indexes = await db.collection("users").indexes();
      if (indexes.some((idx) => idx.name === "phone_1")) {
        await db.collection("users").dropIndex("phone_1");
        console.log("[DB] Successfully dropped legacy phone_1 index from users.");
      }
    }

    if (names.includes("accountingsettings")) {
      const indexes = await db.collection("accountingsettings").indexes();
      if (indexes.some((idx) => idx.name === "ownerId_1")) {
        await db.collection("accountingsettings").dropIndex("ownerId_1");
        console.log("[DB] Successfully dropped legacy ownerId_1 index from accountingsettings.");
      }
    }

    if (names.includes("orders")) {
      const indexes = await db.collection("orders").indexes();
      if (indexes.some((idx) => idx.name === "invoiceNo_1")) {
        await db.collection("orders").dropIndex("invoiceNo_1");
        console.log("[DB] Successfully dropped legacy global invoiceNo_1 index from orders.");
      }
    }

    if (names.includes("products")) {
      const indexes = await db.collection("products").indexes();
      if (indexes.some((idx) => idx.name === "sku_1")) {
        await db.collection("products").dropIndex("sku_1");
        console.log("[DB] Successfully dropped legacy global sku_1 index from products.");
      }
    }
  } catch (err) {
    console.warn("[DB] Index cleanup notice:", err.message);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await dropLegacyIndexes();
  } catch (error) {
    console.warn("MongoDB Atlas Connection failed:", error.message);
    console.log("Attempting fallback to local MongoDB...");
    try {
      const conn = await mongoose.connect("mongodb://127.0.0.1:27017/smartbill", {
        serverSelectionTimeoutMS: 3000,
      });
      console.log(`Local MongoDB Connected: ${conn.connection.host}`);
      await dropLegacyIndexes();
    } catch (localErr) {
      console.error("MongoDB Connection Failed: Please ensure your IP address is whitelisted in MongoDB Atlas Network Access settings (https://cloud.mongodb.com).");
      process.exit(1);
    }
  }
};

export default connectDB;