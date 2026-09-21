import express from "express";
import cors from "cors";
import "dotenv/config";
import dns from "node:dns";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import seedAdmin from "./seed/admin.js";
import seedSubscriptionPlans from "./seed/seedPlans.js";
import migrateExistingUserTrials from "./seed/migrateTrials.js";
import productRoutes from "./routes/productRoutes.js";
import customizationRoutes from "./routes/customizationRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import purchaseRoutes from "./routes/purchaseRoutes.js";
import purchaseReturnRoutes from "./routes/purchaseReturnRoutes.js";
import businessSettingsRoutes from "./routes/businessSettingsRoutes.js";
import transactionSettingsRoutes from "./routes/transactionSettingsRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import invoiceSettingsRoutes from "./routes/invoiceSettingsRoutes.js";
import partySettingsRoutes from "./routes/partySettingsRoutes.js";
import accountingSettingsRoutes from "./routes/accountingSettingsRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import paymentSettingsRoutes from "./routes/paymentSettingsRoutes.js";
import subscriptionPlanRoutes from "./routes/subscriptionPlanRoutes.js";
import inventorySettingsRoutes from "./routes/inventorySettingsRoutes.js";
import subscriptionPublicRoutes from "./routes/subscriptionPublicRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import cashVoucherRoutes from "./routes/cashVoucherRoutes.js";

import {
  securityHeaders,
  authLimiter,
  apiLimiter,
  configuredCors,
} from "./middleware/security.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const port = process.env.PORT || 5000;

// Trust reverse proxy (needed for accurate IP rate limiting on Render / Railway / Cloudflare)
app.set("trust proxy", 1);

// Use reliable public DNS servers for Node's resolver.
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (err) {
  console.warn("Could not set custom DNS servers:", err.message);
}

// Connect to MongoDB
await connectDB();

// Seed the default Super Admin account (idempotent).
await seedAdmin();

// Seed default subscription plans (idempotent).
await seedSubscriptionPlans();

// Migrate existing user accounts to 14-day trial status (idempotent)
await migrateExistingUserTrials();

// 1. Apply Helmet Security Headers
app.use(securityHeaders);

// 2. Apply Production / Dev CORS
app.use(configuredCors());

// 3. Apply Global API Rate Limiter
app.use("/api", apiLimiter);

// 4. Production Cloud Health Check Endpoints (K8s / Render / Railway / AWS ALB)
const healthHandler = (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const statusCode = isDbConnected ? 200 : 503;
  res.status(statusCode).json({
    status: isDbConnected ? "healthy" : "degraded",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: isDbConnected ? "connected" : "disconnected",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
};

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// Public routes
app.use("/api/subscription-plans", subscriptionPublicRoutes);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes (with dedicated Auth Limiter for login/register protection)
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/products", productRoutes);
app.use("/api/settings/customization", customizationRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/purchase-returns", purchaseReturnRoutes);
app.use("/api/settings/business", businessSettingsRoutes);
app.use("/api/settings/invoice", invoiceSettingsRoutes);
app.use("/api/settings/party", partySettingsRoutes);
app.use("/api/settings/transaction", transactionSettingsRoutes);
app.use("/api/settings/payment", paymentSettingsRoutes);
app.use("/api/settings/accounting", accountingSettingsRoutes);
app.use("/api/settings/inventory", inventorySettingsRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/admin/coupons", couponRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin/subscription-plans", subscriptionPlanRoutes);
app.use("/api/cash-vouchers", cashVoucherRoutes);

app.get("/", (req, res) => {
  res.json({ message: "SmartBill API is operating normally.", status: "running" });
});

// 404 handler for unknown API routes
app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`Server started on port ${port} (http://localhost:${port} and http://127.0.0.1:${port})`);
});

// Graceful shutdown handling for container termination
const gracefulShutdown = (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log("HTTP server closed.");
    try {
      await mongoose.connection.close(false);
      console.log("MongoDB connection closed.");
      process.exit(0);
    } catch (err) {
      console.error("Error closing MongoDB connection:", err);
      process.exit(1);
    }
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));