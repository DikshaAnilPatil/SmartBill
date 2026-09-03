import nodemailer from "nodemailer";
import SystemSettings from "../models/SystemSettings.js";

/**
 * Query SystemSettings from MongoDB for the requested email template.
 * @param {string|number} templateIdentifier Template Name or ID
 */
export const getSystemTemplate = async (templateIdentifier) => {
  try {
    const settings = await SystemSettings.findOne({ key: "global_system_settings" }).lean();
    if (!settings || !Array.isArray(settings.emailTemplates)) {
      return null;
    }

    const searchKey = String(templateIdentifier).toLowerCase().replace(/email/g, "").trim();

    const template = settings.emailTemplates.find((t) => {
      if (t.id === templateIdentifier || t.id === Number(templateIdentifier)) return true;
      const tName = String(t.name).toLowerCase().replace(/email/g, "").trim();
      return tName === searchKey || tName.includes(searchKey) || searchKey.includes(tName);
    });

    return template || null;
  } catch (err) {
    console.error("Failed to query SystemSettings for email templates:", err);
    return null;
  }
};

/**
 * Replace placeholders like {user_name}, {invoice_no}, {amount}, {reset_link}, {expiry_date}
 */
export const replacePlaceholders = (text = "", variables = {}) => {
  if (!text) return "";
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match;
  });
};

/**
 * Construct an SMTP transporter — queries dynamic MongoDB SystemSettings first,
 * falling back to process.env environment variables if DB settings are empty.
 */
const getTransporter = async () => {
  let dbSettings = null;
  try {
    dbSettings = await SystemSettings.findOne({ key: "global_system_settings" }).lean();
  } catch (err) {
    console.warn("Could not fetch SystemSettings for SMTP config:", err.message);
  }

  // 1. Try DB dynamic SMTP configuration
  const dbUser = dbSettings?.smtpUser ? String(dbSettings.smtpUser).trim() : "";
  const dbPass = dbSettings?.smtpPass ? String(dbSettings.smtpPass).trim() : "";
  const dbHost = dbSettings?.smtpHost ? String(dbSettings.smtpHost).trim() : "";
  const dbPort = Number(dbSettings?.smtpPort || 587);

  if (dbUser && dbPass) {
    const host = dbHost || "smtp.gmail.com";
    console.log(`[SMTP] Using dynamic DB SMTP settings (${dbUser} via ${host}:${dbPort})`);
    return {
      transporter: nodemailer.createTransport({
        host,
        port: dbPort,
        secure: dbPort === 465,
        auth: { user: dbUser, pass: dbPass },
      }),
      fromAddress: dbSettings?.smtpFrom || `"Smart Bill System" <${dbUser}>`,
      isTest: false,
    };
  }

  // 2. Fall back to process.env environment variables
  const envHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const envPort = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  const envUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const envPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (envUser && envPass && !envUser.includes("your_email")) {
    const host = envHost || "smtp.gmail.com";
    console.log(`[SMTP] Using environment process.env SMTP settings (${envUser} via ${host}:${envPort})`);
    return {
      transporter: nodemailer.createTransport({
        host,
        port: envPort,
        secure: envPort === 465,
        auth: { user: envUser, pass: envPass },
      }),
      fromAddress: process.env.SMTP_FROM || `"Smart Bill System" <${envUser}>`,
      isTest: false,
    };
  }

  // 3. Automatic Ethereal test account fallback if real credentials missing
  try {
    const testAccount = await nodemailer.createTestAccount();
    return {
      transporter: nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      }),
      fromAddress: `"Smart Bill System" <${testAccount.user}>`,
      isTest: true,
    };
  } catch (err) {
    console.warn("Could not create Ethereal test account:", err.message);
    return { transporter: null, fromAddress: null, isTest: false };
  }
};

/**
 * Generic Email Dispatcher that respects active/inactive status & custom templates from MongoDB
 */
export const sendSystemEmail = async ({
  templateName,
  toEmail,
  variables = {},
  defaultSubject = "",
  defaultBody = "",
  customHtml = null,
}) => {
  try {
    // 1. Fetch template settings from MongoDB
    const templateConfig = await getSystemTemplate(templateName);

    // 2. Check if template is disabled in SuperAdmin settings
    if (templateConfig && templateConfig.status === "inactive") {
      console.log(
        `[EMAIL SKIPPED] Email template "${templateName}" is currently set to INACTIVE in SuperAdmin settings.`
      );
      return {
        success: false,
        skipped: true,
        reason: `Email template "${templateName}" is disabled in SuperAdmin settings.`,
      };
    }

    // 3. Determine subject line & body text
    const rawSubject = templateConfig?.subject || defaultSubject || `Notification - ${templateName}`;
    const rawBody = templateConfig?.body || defaultBody;

    const finalSubject = replacePlaceholders(rawSubject, variables);
    const finalBody = replacePlaceholders(rawBody, variables);

    // 4. Build HTML layout
    const htmlContent = customHtml
      ? replacePlaceholders(customHtml, variables)
      : `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${finalSubject}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #0f172a; color: #ffffff; padding: 24px; text-align: center; }
    .header h2 { margin: 0; font-size: 20px; font-weight: 700; }
    .content { padding: 28px 24px; font-size: 14px; line-height: 1.7; white-space: pre-wrap; color: #334155; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${variables.business_name || "SmartBill"}</h2>
    </div>
    <div class="content">${finalBody}</div>
    <div class="footer">
      This is an automated system notification from ${variables.business_name || "SmartBill"}.
    </div>
  </div>
</body>
</html>
      `;

    // 5. Send via Transporter
    const { transporter, fromAddress, isTest } = await getTransporter();
    const info = await transporter.sendMail({
      from: fromAddress || process.env.SMTP_FROM || process.env.EMAIL_FROM || `"Smart Bill System" <no-reply@smartbill.com>`,
      to: toEmail,
      subject: finalSubject,
      html: htmlContent,
    });

    const previewUrl = isTest ? nodemailer.getTestMessageUrl(info) : null;
    if (previewUrl) {
      console.log(`[EMAIL TEST PREVIEW] View "${templateName}" email: ${previewUrl}`);
    } else {
      console.log(`[EMAIL SUCCESS] "${templateName}" email sent to ${toEmail}. Message ID: ${info.messageId}`);
    }

    return { success: true, messageId: info.messageId, previewUrl, isTest };
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send "${templateName}" email to ${toEmail}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Send Welcome Email to Business Owner or User
 */
export const sendWelcomeEmail = async ({
  toEmail,
  userName = "User",
  businessName = "Smart Bill",
  tempPassword = "",
  role = "Owner",
  portalUrl = process.env.CLIENT_URL || "http://localhost:5173/login",
}) => {
  return sendSystemEmail({
    templateName: "Welcome Email",
    toEmail,
    variables: {
      user_name: userName,
      employee_name: userName,
      temp_password: tempPassword,
      business_name: businessName,
      role: role,
      portal_url: portalUrl,
    },
    defaultSubject: `Welcome to ${businessName}`,
    defaultBody: `Hello ${userName},\n\nWelcome to ${businessName}! We are excited to have you onboard.\n\nBest regards,\n${businessName} Team`,
  });
};

/**
 * Send Employee Login Credentials via Email
 */
export const sendEmployeeCredentialsEmail = async ({
  toEmail,
  employeeName,
  tempPassword,
  businessName = "Smart Bill",
  role = "Employee",
  portalUrl = process.env.CLIENT_URL || "http://localhost:5173/login",
}) => {
  return sendWelcomeEmail({
    toEmail,
    userName: employeeName,
    businessName,
    tempPassword,
    role,
    portalUrl,
  });
};

/**
 * Send Invoice Email
 */
export const sendInvoiceEmail = async ({
  toEmail,
  invoiceNo,
  amount,
  userName = "Valued Customer",
  businessName = "Smart Bill",
}) => {
  return sendSystemEmail({
    templateName: "Invoice Email",
    toEmail,
    variables: {
      invoice_no: invoiceNo,
      amount: amount,
      user_name: userName,
      business_name: businessName,
    },
    defaultSubject: `Your Invoice - ${invoiceNo}`,
    defaultBody: `Dear ${userName},\n\nPlease find attached your invoice ${invoiceNo} for amount ${amount}.\n\nThank you for your business!`,
  });
};

/**
 * Send Password Reset Email
 */
export const sendPasswordResetEmail = async ({
  toEmail,
  userName = "User",
  resetLink = "#",
  otp = "",
  businessName = "Smart Bill",
}) => {
  const customHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - SmartBill</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f1f5f9; padding: 30px 0 50px; }
    .main { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 36px 32px 30px; text-align: center; }
    .logo-text { color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
    .badge-sub { color: #94a3b8; font-size: 13px; margin: 6px 0 0; font-weight: 500; }
    .content { padding: 36px 32px; }
    .greeting { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 14px; }
    .desc { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px; }
    .otp-card { background: #f8fafc; border: 2px dashed #93c5fd; border-radius: 14px; padding: 24px 20px; text-align: center; margin: 24px 0; }
    .otp-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #64748b; margin-bottom: 8px; }
    .otp-code { font-family: 'SF Pro Mono', 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; color: #1d4ed8; letter-spacing: 8px; margin: 6px 0; }
    .otp-expiry { font-size: 12px; color: #dc2626; font-weight: 600; margin-top: 8px; }
    .btn-container { text-align: center; margin: 28px 0 20px; }
    .btn-reset { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 13px 32px; font-size: 14px; font-weight: 600; border-radius: 10px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
    .security-notice { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-top: 26px; }
    .security-title { font-size: 12px; font-weight: 700; color: #92400e; margin: 0 0 4px; }
    .security-desc { font-size: 12px; color: #b45309; line-height: 1.5; margin: 0; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main">
      <div class="header">
        <h1 class="logo-text">SmartBill</h1>
        <p class="badge-sub">Enterprise Billing, Inventory & Management</p>
      </div>
      <div class="content">
        <h2 class="greeting">Hello {user_name},</h2>
        <p class="desc">
          We received a request to reset the password for your account. 
          Use the 6-digit verification code below to verify your identity and set a new password.
        </p>

        <div class="otp-card">
          <div class="otp-label">Your Security Verification Code</div>
          <div class="otp-code">${otp}</div>
          <div class="otp-expiry">⏳ Valid for 15 minutes only</div>
        </div>

        <div class="btn-container">
          <a href="${resetLink}" class="btn-reset" target="_blank">Open Reset Password Page →</a>
        </div>

        <div class="security-notice">
          <div class="security-title">🔒 Security Tip</div>
          <p class="security-desc">
            Never share this OTP with anyone. SmartBill will never ask for your verification code. 
            If you did not request this code, you can safely ignore this email.
          </p>
        </div>
      </div>
      <div class="footer">
        © ${new Date().getFullYear()} SmartBill Inc. All rights reserved.<br>
        This is an automated system email. Please do not reply directly to this message.
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return sendSystemEmail({
    templateName: "Password Reset",
    toEmail,
    customHtml,
    variables: {
      user_name: userName,
      reset_link: resetLink,
      otp: otp,
      business_name: businessName,
    },
    defaultSubject: `🔐 Your SmartBill Verification Code: ${otp || ""}`,
    defaultBody: `Hello ${userName},\n\nYour 6-digit SmartBill password reset OTP code is: ${otp}\n\nReset Link: ${resetLink}\n\nThis code expires in 15 minutes.\n\nBest regards,\n${businessName} Team`,
  });
};

/**
 * Send Subscription Reminder Email
 */
export const sendSubscriptionReminderEmail = async ({
  toEmail,
  userName = "Business Owner",
  expiryDate = "soon",
  businessName = "Smart Bill",
}) => {
  return sendSystemEmail({
    templateName: "Subscription Reminder",
    toEmail,
    variables: {
      user_name: userName,
      expiry_date: expiryDate,
      business_name: businessName,
    },
    defaultSubject: "Your subscription expires soon",
    defaultBody: `Hello ${userName},\n\nYour SmartBill subscription is scheduled to expire on ${expiryDate}. Please renew your plan to avoid service interruption.`,
  });
};
