import mongoose from "mongoose";

const systemSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "global_system_settings",
      unique: true,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    autoBackup: {
      type: Boolean,
      default: true,
    },
    debugMode: {
      type: Boolean,
      default: false,
    },
    backupFrequency: {
      type: String,
      enum: ["hourly", "daily", "weekly", "monthly", "manual", "disabled"],
      default: "daily",
    },
    maxLoginAttempts: {
      type: Number,
      default: 5,
    },
    // Dynamic SMTP Configuration (Stored in DB so SuperAdmin can configure email server in UI)
    smtpHost: {
      type: String,
      default: "",
    },
    smtpPort: {
      type: Number,
      default: 587,
    },
    smtpUser: {
      type: String,
      default: "",
    },
    smtpPass: {
      type: String,
      default: "",
    },
    smtpFrom: {
      type: String,
      default: "",
    },
    emailTemplates: {
      type: [
        {
          id: { type: Number, required: true },
          name: { type: String, required: true },
          subject: { type: String, required: true },
          body: { type: String, default: "" },
          status: { type: String, enum: ["active", "inactive"], default: "active" },
        },
      ],
      default: [
        {
          id: 1,
          name: "Welcome Email",
          subject: "Welcome to SmartBill",
          body: "Hello {user_name},\n\nWelcome to SmartBill! We are excited to have you onboard.\n\nBest regards,\nSmartBill Team",
          status: "active",
        },
        {
          id: 2,
          name: "Invoice Email",
          subject: "Your Invoice - {invoice_no}",
          body: "Dear Customer,\n\nPlease find attached your invoice {invoice_no} for amount {amount}.\n\nThank you for your business!",
          status: "active",
        },
        {
          id: 3,
          name: "Password Reset",
          subject: "Reset Your Password",
          body: "Hello,\n\nYou requested to reset your password. Click the link below to proceed:\n{reset_link}\n\nIf you did not request this, please ignore this email.",
          status: "active",
        },
        {
          id: 4,
          name: "Subscription Reminder",
          subject: "Your subscription expires soon",
          body: "Hello,\n\nYour SmartBill subscription is scheduled to expire on {expiry_date}. Please renew to avoid service interruption.",
          status: "active",
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("SystemSettings", systemSettingsSchema);
