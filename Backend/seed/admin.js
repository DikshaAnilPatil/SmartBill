import bcrypt from "bcryptjs";
import User from "../models/User.js";

/**
 * Seed a default Super Admin account from environment variables.
 * Safe & production-ready:
 * - Reads credentials strictly from process.env (SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
 * - Zero hardcoded credentials in source code
 * - Never logs plaintext passwords
 * - Idempotent
 */
const seedAdmin = async () => {
  const adminEmail = process.env.SUPERADMIN_EMAIL
    ? String(process.env.SUPERADMIN_EMAIL).trim().toLowerCase()
    : null;
  const adminPassword = process.env.SUPERADMIN_PASSWORD
    ? String(process.env.SUPERADMIN_PASSWORD)
    : null;

  try {
    // If no superadmin env credentials provided, check if any superadmin already exists
    if (!adminEmail || !adminPassword) {
      const existingSuperAdmin = await User.findOne({ role: "superadmin" }).select("email");
      if (existingSuperAdmin) {
        console.log(`[SEED] Active Super Admin account verified (${existingSuperAdmin.email}).`);
      } else {
        console.log("[SEED] No SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD configured. Skipping initial admin seed.");
      }
      return;
    }

    const existing = await User.findOne({ email: adminEmail });

    if (existing) {
      let changed = false;
      if (existing.role !== "superadmin") {
        existing.role = "superadmin";
        changed = true;
      }
      if (!existing.businessName) {
        existing.businessName = "SmartBill";
        changed = true;
      }
      if (adminPassword) {
        existing.password = await bcrypt.hash(adminPassword, 12);
        changed = true;
      }

      if (changed) {
        await existing.save();
        console.log(`[SEED] Super Admin account synced (${adminEmail}).`);
      } else {
        console.log(`[SEED] Configured Super Admin verified (${adminEmail}).`);
      }
      return;
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    const firstName = process.env.SUPERADMIN_FIRST_NAME || "System";
    const lastName = process.env.SUPERADMIN_LAST_NAME || "Admin";
    const phone = process.env.SUPERADMIN_PHONE ? String(process.env.SUPERADMIN_PHONE).replace(/\D/g, "") : "9999999999";

    await User.create({
      firstName,
      lastName,
      businessName: "SmartBill Administration",
      email: adminEmail,
      phone,
      businessType: "Services",
      password: hashedPassword,
      role: "superadmin",
      status: "Active",
    });

    console.log(`[SEED] Super Admin account created successfully for: ${adminEmail}`);
  } catch (error) {
    console.error("[SEED] Super Admin seeding error:", error.message);
  }
};

export default seedAdmin;
