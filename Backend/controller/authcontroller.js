import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import Coupon from "../models/Coupon.js";
import Verification from "../models/verifiy.js";
import SystemSettings from "../models/SystemSettings.js";
import { notifySuperAdmins } from "../services/notificationService.js";
import { sendWelcomeEmail, sendPasswordResetEmail, sendVerificationOtpEmail } from "../utils/emailService.js";

// ======================================================
// HELPER: BUILD AUTH RESPONSE
// ======================================================

const buildAuthPayload = (user, ownerUser = null) => {
  const effectiveOwnerId = user.ownerId ? user.ownerId : user._id;
  const effectiveBusinessName =
    user.ownerId && ownerUser ? ownerUser.businessName : user.businessName;
  const effectiveBusinessType =
    user.ownerId && ownerUser ? ownerUser.businessType : user.businessType;

  const token = jwt.sign(
    {
      id: user._id,
      ownerId: effectiveOwnerId,
      role: user.role,
      businessType: effectiveBusinessType,
      permissions: user.permissions || {},
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return {
    message: "OK",
    token,
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      businessName: effectiveBusinessName,
      businessType: effectiveBusinessType,
      businessCategory: user.businessCategory || "",
      email: user.email,
      phone: user.phone,
      role: user.role,
      ownerId: effectiveOwnerId,
      department: user.department || "",
      permissions: user.permissions || {},
      status: user.status || "Active",
      tagline: user.tagline || "",
      address: user.address || "",
      city: user.city || "",
      state: user.state || "",
      pincode: user.pincode || "",
      country: user.country || "India",
      gstin: user.gstin || "",
      panNumber: user.panNumber || "",
      msmeNumber: user.msmeNumber || "",
      bankName: user.bankName || "",
      accountNumber: user.accountNumber || "",
      ifscCode: user.ifscCode || "",
      branchName: user.branchName || "",
      upiId: user.upiId || "",
      invoiceTerms: user.invoiceTerms || "",
      invoiceFooter: user.invoiceFooter || "",
      logoUrl: user.logoUrl || "",
      signatureUrl: user.signatureUrl || "",
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
      // ✅ CRITICAL: Always include subscription so plan-based features work after upgrade
      subscription: (() => {
        const sub = (user.ownerId && ownerUser ? ownerUser.subscription : user.subscription) || {};
        return {
          plan: sub.plan || "starter",
          status: sub.status || "trialing",
          trialEndsAt: sub.trialEndsAt || null,
          currentPeriodStart: sub.currentPeriodStart || null,
          currentPeriodEnd: sub.currentPeriodEnd || null,
        };
      })(),
    },
  };
};

// ======================================================
// HELPER: NORMALIZE PHONE
// ======================================================

const normalizePhone = (raw) => {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
};

const isValidIndianMobile = (raw) => {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return /^[6-9]\d{9}$/.test(digits);
};

// ======================================================
// REGISTER
// ======================================================

export const register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      businessName,
      businessType,
      businessCategory,
      email,
      phone,
      password,
    } = req.body;

    const normalizedBusinessType = ["Retail", "Wholesale"].includes(
      String(businessType ?? "Retail").trim()
    )
      ? String(businessType ?? "Retail").trim()
      : "Retail";

    const normalizedBusinessCategory = String(businessCategory ?? "").trim();

    const errors = [];

    if (!firstName || !String(firstName).trim()) {
      errors.push("First name is required.");
    }

    if (!lastName || !String(lastName).trim()) {
      errors.push("Last name is required.");
    }

    if (!businessName || !String(businessName).trim()) {
      errors.push("Business name is required.");
    }

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
    ) {
      errors.push("A valid email is required.");
    }

    const normalizedPhone = normalizePhone(phone);

    if (!isValidIndianMobile(normalizedPhone)) {
      errors.push("Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.");
    }

    if (!password || String(password).length < 8) {
      errors.push("Password must be at least 8 characters.");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: errors[0],
        errors,
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check duplicate phone
    const existingPhone = await User.findOne({
      phone: normalizedPhone,
    });

    if (existingPhone) {
      return res.status(409).json({
        message: "Mobile number already exists. Please sign in instead.",
        field: "phone",
      });
    }

    // Check duplicate email
    const existingEmail = await User.findOne({
      email: normalizedEmail,
    });

    if (existingEmail) {
      return res.status(409).json({
        message: "Email already exists. Please sign in instead.",
        field: "email",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Optional coupon processing
    const rawCouponCode = req.body.couponCode || req.body.coupon || "";
    let appliedCouponData = null;
    let extraTrialDays = 0;

    if (rawCouponCode && typeof rawCouponCode === "string" && rawCouponCode.trim()) {
      const normalizedCoupon = rawCouponCode.trim().toUpperCase();
      try {
        const coupon = await Coupon.findOne({ code: normalizedCoupon });
        const now = new Date();
        if (
          coupon &&
          coupon.status === "active" &&
          (!coupon.startDate || new Date(coupon.startDate) <= now) &&
          (!coupon.expiryDate || new Date(coupon.expiryDate) >= now) &&
          (coupon.maxUsageCount == null || coupon.usedCount < coupon.maxUsageCount)
        ) {
          appliedCouponData = {
            couponId: coupon._id,
            code: coupon.code,
            title: coupon.title,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
          };
          if (coupon.discountType === "trial_days") {
            extraTrialDays = Number(coupon.discountValue) || 14;
          }
        }
      } catch (couponErr) {
        console.warn("Coupon check error during registration:", couponErr);
      }
    }

    const planToActivate = (req.body.planName || req.body.subscriptionPlan || "").toLowerCase().replace(/\s*plan\s*/gi, "").trim();
    const defaultTrialDays = extraTrialDays > 0 ? (14 + extraTrialDays) : 14;
    const trialEnd = new Date(Date.now() + defaultTrialDays * 24 * 60 * 60 * 1000);
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const subscriptionData = planToActivate
      ? {
          plan: planToActivate,
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        }
      : {
          plan: "starter",
          status: "trialing",
          trialEndsAt: trialEnd,
          currentPeriodStart: new Date(),
        };

    const user = await User.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      businessName: String(businessName).trim(),
      businessType: normalizedBusinessType,
      businessCategory: normalizedBusinessCategory,
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashedPassword,
      subscription: subscriptionData,
    });

    if (appliedCouponData && appliedCouponData.couponId) {
      try {
        await Coupon.findByIdAndUpdate(appliedCouponData.couponId, {
          $inc: { usedCount: 1 },
          $push: {
            redemptions: {
              userId: user._id,
              ownerId: user._id,
              businessName: user.businessName,
              email: user.email,
              plan: planToActivate || "starter",
              originalAmount: 0,
              discountAmount: 0,
              finalAmount: 0,
              redeemedAt: new Date(),
            },
          },
        });
      } catch (cErr) {
        console.warn("Failed to record coupon redemption on registration:", cErr);
      }
    }

    // Notify SuperAdmins about new business registration
    try {
      const bName = user.businessName || `${user.firstName} ${user.lastName}`;
      await notifySuperAdmins({
        title: `New Business Registered: ${bName}`,
        message: `${user.firstName} ${user.lastName} (${user.email}, ${user.phone}) registered a new ${user.businessType || "Retail"} business.`,
        type: "info",
        category: "businesses",
        link: "businesses",
        metadata: {
          newUserId: user._id.toString(),
          email: user.email,
          businessName: bName,
          businessType: user.businessType,
        },
      });

      // If user registered with an activated plan, also broadcast the subscription notification
      if (planToActivate) {
        await notifySuperAdmins({
          title: `Subscription Payment: ${planToActivate.toUpperCase()} Plan`,
          message: `${bName} (${user.email}) activated the ${planToActivate.toUpperCase()} plan.`,
          type: "success",
          category: "subscription",
          link: "revenue",
          metadata: {
            businessId: user._id.toString(),
            businessName: bName,
            plan: planToActivate,
          },
        });
      }
    } catch (notifErr) {
      console.error("SuperAdmin registration notification error:", notifErr.message);
    }

    // Dispatch Welcome Email (checks SuperAdmin active/inactive setting in MongoDB)
    try {
      await sendWelcomeEmail({
        toEmail: user.email,
        userName: `${user.firstName} ${user.lastName}`.trim(),
        businessName: user.businessName || "Smart Bill",
      });
    } catch (welcomeErr) {
      console.error("Welcome email dispatch error:", welcomeErr.message);
    }

    return res.status(201).json(buildAuthPayload(user));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "Email or mobile number already exists.",
      });
    }

    console.error("REGISTER ERROR:", error);

    return res.status(500).json({
      message:
        "Something went wrong while creating your account. Please try again.",
    });
  }
};

// ======================================================
// LOGIN
// ======================================================

const detectIdentifier = (raw) => {
  const trimmed = String(raw ?? "").trim();

  if (!trimmed) {
    return { type: "none" };
  }

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

  if (isEmail) {
    return {
      type: "email",
      value: trimmed.toLowerCase(),
    };
  }

  const digits = trimmed.replace(/\D/g, "");

  const normalized =
    digits.startsWith("91") && digits.length === 12
      ? digits.slice(2)
      : digits;

  if (isValidIndianMobile(normalized)) {
    return {
      type: "phone",
      value: normalized,
    };
  }

  return {
    type: "none",
  };
};

export const login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    const rawIdentifier = (email && String(email).trim()) ? String(email).trim() : (phone && String(phone).trim() ? String(phone).trim() : "");

    const identifier = detectIdentifier(rawIdentifier);

    if (identifier.type === "phone" && !isValidIndianMobile(identifier.value)) {
      return res.status(400).json({
        message: "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
      });
    }

    if (rawIdentifier && identifier.type === "none" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(rawIdentifier).trim())) {
      return res.status(400).json({
        message: "Enter a valid email address or 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
      });
    }

    if (!rawIdentifier || !password) {
      return res.status(400).json({
        message: "A valid email or mobile number and password are required.",
      });
    }

    const systemSettings = await SystemSettings.findOne({ key: "global_system_settings" }).lean();

    // Resilient Lookup: Search both by case-insensitive Email AND normalized Phone number
    let candidates = [];

    // 1. Case-insensitive email search
    const cleanEmail = rawIdentifier.toLowerCase();
    const emailCandidate = await User.findOne({
      email: { $regex: `^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
    });
    if (emailCandidate) {
      candidates.push(emailCandidate);
    }

    // 2. 10-digit normalized phone search
    const digits = rawIdentifier.replace(/\D/g, "");
    const normalizedPhone = digits.length >= 10 ? digits.slice(-10) : digits;
    if (normalizedPhone && normalizedPhone.length === 10) {
      const phoneCandidates = await User.find({
        $or: [
          { phone: normalizedPhone },
          { phone: `+91${normalizedPhone}` },
          { phone: `+91 ${normalizedPhone}` }
        ]
      });
      for (const pc of phoneCandidates) {
        if (!candidates.some((c) => c._id.toString() === pc._id.toString())) {
          candidates.push(pc);
        }
      }
    }

    if (candidates.length === 0) {
      return res.status(400).json({
        message: "No account found with this email or mobile number. Please check your credentials or register.",
      });
    }

    let user = null;
    let passwordMatched = false;

    for (const candidate of candidates) {
      const match = await bcrypt.compare(password, candidate.password);
      if (match) {
        passwordMatched = true;
        user = candidate;
        if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
          user.failedLoginAttempts = 0;
          user.lockoutUntil = null;
          await user.save();
        }
        break;
      }
    }

    if (!user) {
      return res.status(400).json({
        message: "Incorrect password. Please try again or click 'Forgot Password?' to reset.",
      });
    }

    let ownerUser = null;
    if (user.ownerId) {
      ownerUser = await User.findById(user.ownerId);
    }

    const userStatus = user.status || "Active";
    const ownerStatus = ownerUser ? (ownerUser.status || "Active") : "Active";

    if (user.role !== "superadmin") {
      if (systemSettings?.maintenanceMode) {
        return res.status(403).json({
          message: "The system is currently undergoing scheduled maintenance. Please try again later.",
        });
      }

      if (userStatus === "Suspended" || ownerStatus === "Suspended") {
        const reason = user.suspensionReason || ownerUser?.suspensionReason || "";
        return res.status(403).json({
          code: "ACCOUNT_SUSPENDED",
          status: "Suspended",
          isSuspended: true,
          suspensionReason: reason,
          message: reason
            ? `Your account has been suspended by administration. Reason: ${reason}`
            : "Your account has been suspended by administration. Please contact support.",
        });
      }

      if (userStatus === "Inactive" || ownerStatus === "Inactive") {
        return res.status(403).json({
          message: "Your account is deactivated. Please contact your business owner or support.",
        });
      }
    }

    if (user.ownerId && !ownerUser) {
      ownerUser = await User.findById(user.ownerId);
    }

    return res.status(200).json(buildAuthPayload(user, ownerUser));
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      message:
        "Something went wrong while signing in. Please try again.",
    });
  }
};

// ======================================================
// GET CURRENT USER PROFILE
// ======================================================

export const getProfile = async (req, res) => {
  try {
    const userId = req.user.actualUserId || req.user.userId || req.user._id;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User profile not found.",
      });
    }

    let ownerUser = null;
    if (user.ownerId) {
      ownerUser = await User.findById(user.ownerId);
    }

    const payload = buildAuthPayload(user, ownerUser);

    return res.status(200).json({
      message: "Profile fetched successfully.",
      user: payload.user,
    });
  } catch (error) {
    console.error("GET PROFILE ERROR:", error);

    return res.status(500).json({
      message: "Unable to load your profile. Please try again.",
    });
  }
};

// ======================================================
// UPDATE CURRENT USER PROFILE
// ======================================================

export const updateProfile = async (req, res) => {
  let updateFields = {};
  let userId = null;

  try {
    userId = req.user.actualUserId || req.user.userId || req.user._id;

    const currentUserDoc = await User.findById(userId);
    if (!currentUserDoc) {
      return res.status(404).json({
        message: "User profile not found.",
      });
    }

    const isEmployee = Boolean(currentUserDoc.ownerId);

    const {
      firstName,
      lastName,
      businessName,
      businessType,
      email,
      phone,
    } = req.body;

    // Use provided values or keep existing ones from database
    const resolvedFirstName = firstName !== undefined ? String(firstName).trim() : currentUserDoc.firstName;
    const resolvedLastName = lastName !== undefined ? String(lastName).trim() : (currentUserDoc.lastName || "");
    const resolvedEmail = email !== undefined ? String(email).trim().toLowerCase() : currentUserDoc.email;

    if (!resolvedFirstName) {
      return res.status(400).json({
        message: "First name is required.",
        field: "firstName",
      });
    }

    // Only owners can set/require business name
    let resolvedBusinessName = currentUserDoc.businessName;
    if (!isEmployee) {
      resolvedBusinessName = businessName !== undefined ? String(businessName).trim() : currentUserDoc.businessName;
      if (!resolvedBusinessName) {
        return res.status(400).json({
          message: "Business name is required.",
          field: "businessName",
        });
      }
    }

    if (!resolvedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resolvedEmail)) {
      return res.status(400).json({
        message: "A valid email is required.",
        field: "email",
      });
    }

    let normalizedPhone = phone !== undefined ? normalizePhone(phone) : currentUserDoc.phone;
    if (!normalizedPhone || normalizedPhone.length < 5) {
      normalizedPhone = currentUserDoc.phone || "";
    }

    const normalizedBusinessType = isEmployee
      ? currentUserDoc.businessType
      : (String(businessType ?? currentUserDoc.businessType ?? "Retail").trim() || "Retail");

    // Check whether email belongs to another user (only if email changed)
    if (resolvedEmail && resolvedEmail !== currentUserDoc.email) {
      const existingEmail = await User.findOne({
        email: resolvedEmail,
        _id: { $ne: userId },
      });

      if (existingEmail) {
        return res.status(409).json({
          message: "Email already belongs to another account.",
          field: "email",
        });
      }
    }

    updateFields = {
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      email: resolvedEmail,
      phone: normalizedPhone,
    };

    if (!isEmployee) {
      updateFields.businessName = resolvedBusinessName;
      updateFields.businessType = normalizedBusinessType;

      const extraFields = [
        "tagline",
        "address",
        "city",
        "state",
        "pincode",
        "country",
        "gstin",
        "panNumber",
        "msmeNumber",
        "bankName",
        "accountNumber",
        "ifscCode",
        "branchName",
        "upiId",
        "invoiceTerms",
        "invoiceFooter",
        "logoUrl",
        "signatureUrl",
      ];

      extraFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updateFields[field] = req.body[field];
        }
      });

      // Sync to BusinessSettings collection only for business owners
      try {
        await BusinessSettings.findOneAndUpdate(
          { userId },
          {
            $set: {
              businessName: updateFields.businessName,
              ownerName: `${updateFields.firstName} ${updateFields.lastName}`.trim(),
              phone: updateFields.phone,
              email: updateFields.email,
              businessType: updateFields.businessType,
              address: updateFields.address || "",
              city: updateFields.city || "",
              state: updateFields.state || "",
              pincode: updateFields.pincode || "",
              country: updateFields.country || "India",
            },
          },
          { upsert: true, new: true }
        );
      } catch (bsErr) {
        console.warn("Sync to BusinessSettings warning:", bsErr.message);
      }
    }

    if (req.body.twoFactorEnabled !== undefined) {
      updateFields.twoFactorEnabled = Boolean(req.body.twoFactorEnabled);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        message: "User profile not found.",
      });
    }

    let ownerUser = null;
    if (updatedUser.ownerId) {
      ownerUser = await User.findById(updatedUser.ownerId);
    }

    const authPayload = buildAuthPayload(updatedUser, ownerUser);

    return res.status(200).json({
      message: "Profile updated successfully.",
      token: authPayload.token,
      user: authPayload.user,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const isEmail = error.keyPattern?.email || String(error.message || "").includes("email");
      if (isEmail) {
        return res.status(409).json({
          message: "Email already belongs to another account.",
          field: "email",
        });
      }

      // Handle non-email index conflicts (e.g. legacy phone_1 index in MongoDB)
      console.warn("Legacy index conflict on profile update:", error.message);
      try {
        const fallbackFields = { ...updateFields };
        delete fallbackFields.phone;

        const retryUser = await User.findByIdAndUpdate(
          userId,
          { $set: fallbackFields },
          { new: true, runValidators: false }
        ).select("-password");

        if (retryUser) {
          const authPayload = buildAuthPayload(retryUser);
          return res.status(200).json({
            message: "Profile updated successfully.",
            token: authPayload.token,
            user: authPayload.user,
          });
        }
      } catch (retryErr) {
        console.error("Retry profile update failed:", retryErr.message);
      }
    }

    console.error("UPDATE PROFILE ERROR:", error);

    return res.status(500).json({
      message:
        "Something went wrong while updating your profile. Please try again.",
    });
  }
};

// ======================================================
// OTP HELPERS
// ======================================================

// Generate a 6-digit OTP.
const generateOtp = () =>
  crypto.randomInt(100000, 999999).toString();

// ======================================================
// SEND OTP
// ======================================================

export const sendOtp = async (req, res) => {
  try {
    const { phone, email } = req.body;

    const normalizedPhone = normalizePhone(phone);

    if (!isValidIndianMobile(normalizedPhone)) {
      return res.status(400).json({
        message: "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
        field: "phone",
      });
    }

    // Check if this number is already registered
    const existingUser = await User.findOne({
      phone: normalizedPhone,
    });

    if (existingUser) {
      return res.status(409).json({
        message:
          "This phone number is already registered. Please sign in instead.",
        field: "phone",
      });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await Verification.deleteMany({
      phone: normalizedPhone,
    });

    await Verification.create({
      phone: normalizedPhone,
      otp,
      expiresAt,
    });

    console.log(`[REGISTRATION OTP] Generated OTP for phone ${normalizedPhone}${email ? ` and email ${email}` : ""}`);

    // If email is provided, send OTP to email as well
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      try {
        await sendVerificationOtpEmail({
          toEmail: String(email).trim().toLowerCase(),
          otp,
          phone: normalizedPhone,
        });
      } catch (mailErr) {
        console.warn("[REGISTRATION OTP] Email dispatch warning:", mailErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully.",
      otp,
    });
  } catch (error) {
    console.error("SEND OTP ERROR:", error);

    return res.status(500).json({
      message:
        "Something went wrong while sending the OTP. Please try again.",
    });
  }
};

// ======================================================
// VERIFY OTP
// ======================================================

export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    const normalizedPhone = normalizePhone(phone);

    if (!isValidIndianMobile(normalizedPhone)) {
      return res.status(400).json({
        message: "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
        field: "phone",
      });
    }

    if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
      return res.status(400).json({
        message: "A valid 6-digit OTP is required.",
        field: "otp",
      });
    }

    const record = await Verification.findOne({
      phone: normalizedPhone,
    });

    if (!record) {
      return res.status(400).json({
        message:
          "No OTP was sent to this number. Please request a new OTP.",
        field: "otp",
      });
    }

    if (record.expiresAt < new Date()) {
      await Verification.deleteOne({
        _id: record._id,
      });

      return res.status(400).json({
        message: "OTP has expired. Please request a new one.",
        field: "otp",
      });
    }

    if (record.otp !== String(otp).trim()) {
      return res.status(400).json({
        message: "Incorrect OTP. Please try again.",
        field: "otp",
      });
    }

    record.verified = true;

    await record.save();

    return res.status(200).json({
      message: "Phone number verified successfully.",
      verified: true,
    });
  } catch (error) {
    console.error("VERIFY OTP ERROR:", error);

    return res.status(500).json({
      message:
        "Something went wrong while verifying the OTP. Please try again.",
    });
  }
};

// ======================================================
// FORGOT PASSWORD
// ======================================================

export const forgotPassword = async (req, res) => {
  try {
    const { email, phone, identifier: rawId } = req.body;
    const rawIdentifier = (email && String(email).trim()) || (phone && String(phone).trim()) || rawId;
    const identifier = detectIdentifier(rawIdentifier);

    if (identifier.type === "none") {
      return res.status(400).json({
        message: "A valid email address or 10-digit Indian mobile number is required.",
      });
    }

    if (identifier.type === "phone" && !isValidIndianMobile(identifier.value)) {
      return res.status(400).json({
        message: "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
      });
    }

    let user = null;
    if (identifier.type === "email") {
      user = await User.findOne({
        email: { $regex: new RegExp(`^${identifier.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      });
    } else {
      user = await User.findOne({
        $or: [
          { phone: identifier.value },
          { phone: `+91${identifier.value}` },
          { phone: `91${identifier.value}` },
        ],
      });
    }

    if (!user) {
      const label = identifier.type === "email" ? "email address" : "mobile number";
      return res.status(404).json({
        message: `No account found with this ${label}. Please check and try again.`,
      });
    }

    const targetKey =
      identifier.type === "email"
        ? (user.email || identifier.value).toLowerCase().trim()
        : normalizePhone(user.phone || identifier.value);

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins validity

    // Clean up all existing records for this user to avoid stale OTP collisions
    await Verification.deleteMany({
      $or: [
        { phone: targetKey },
        { phone: identifier.value },
        ...(user.email ? [{ phone: user.email }, { phone: user.email.toLowerCase().trim() }] : []),
        ...(user.phone ? [{ phone: user.phone }, { phone: normalizePhone(user.phone) }] : []),
      ],
    });

    await Verification.create({
      phone: targetKey,
      otp,
      expiresAt,
    });

    // Safe audit logging (never log raw OTP codes)
    console.log(`[PASSWORD RESET OTP] Password reset requested for user: ${user.email || user.phone}`);

    // Dispatch Password Reset Email if user has an email
    if (user.email) {
      const clientUrl = process.env.CLIENT_URL || "http://localhost:5174";
      const resetLink = `${clientUrl}/forgot?email=${encodeURIComponent(user.email)}`;
      const mailRes = await sendPasswordResetEmail({
        toEmail: user.email,
        userName: `${user.firstName} ${user.lastName}`.trim(),
        resetLink,
        otp,
        businessName: user.businessName || "Smart Bill",
      });

      if (!mailRes.success && !mailRes.previewUrl) {
        console.error("Real email dispatch failed:", mailRes.error || mailRes.reason);
        if (identifier.type === "email") {
          return res.status(500).json({
            message: mailRes.error || mailRes.reason || "Failed to send email. Please check your email configuration.",
          });
        }
      }
    }

    return res.status(200).json({
      message: `Verification code has been sent to your registered ${identifier.type === "email" ? "email" : "mobile"}. Please check your inbox.`,
      identifier: targetKey,
      type: identifier.type,
    });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    return res.status(500).json({
      message: "Something went wrong while processing your request. Please try again.",
    });
  }
};

// ======================================================
// VERIFY RESET OTP (STEP 2: VERIFY CODE FIRST)
// ======================================================

export const verifyResetOtp = async (req, res) => {
  try {
    const { identifier: rawId, email, phone, otp } = req.body;
    const rawIdentifier = (email && String(email).trim()) || (phone && String(phone).trim()) || rawId;
    const identifier = detectIdentifier(rawIdentifier);

    if (identifier.type === "none" || !otp) {
      return res.status(400).json({
        message: "A valid email/phone and 6-digit OTP are required.",
      });
    }

    if (identifier.type === "phone" && !isValidIndianMobile(identifier.value)) {
      return res.status(400).json({
        message: "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
      });
    }

    let user = null;
    if (identifier.type === "email") {
      user = await User.findOne({
        email: { $regex: new RegExp(`^${identifier.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      });
    } else {
      user = await User.findOne({
        $or: [
          { phone: identifier.value },
          { phone: `+91${identifier.value}` },
          { phone: `91${identifier.value}` },
        ],
      });
    }

    if (!user) {
      return res.status(404).json({
        message: "No account found with this email/mobile number.",
      });
    }

    const targetKey =
      identifier.type === "email"
        ? (user.email || identifier.value).toLowerCase().trim()
        : normalizePhone(user.phone || identifier.value);

    // Fetch the newest active verification record
    const record = await Verification.findOne({
      $or: [
        { phone: targetKey },
        { phone: identifier.value },
        ...(user.email ? [{ phone: user.email }, { phone: user.email.toLowerCase().trim() }] : []),
        ...(user.phone ? [{ phone: user.phone }, { phone: normalizePhone(user.phone) }] : []),
      ],
    }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({
        message: "No OTP was requested for this account, or it has expired. Please request a new code.",
      });
    }

    if (record.expiresAt < new Date()) {
      await Verification.deleteMany({
        $or: [
          { phone: targetKey },
          { phone: identifier.value },
          ...(user.email ? [{ phone: user.email }, { phone: user.email.toLowerCase().trim() }] : []),
          ...(user.phone ? [{ phone: user.phone }, { phone: normalizePhone(user.phone) }] : []),
        ],
      });
      return res.status(400).json({
        message: "OTP has expired. Please request a new code.",
      });
    }

    const enteredOtp = String(otp ?? "").trim();
    const expectedOtp = String(record.otp ?? "").trim();

    console.log(`[VERIFY RESET OTP] Target: ${targetKey}, Expected: ${expectedOtp}, Entered: ${enteredOtp}`);

    if (expectedOtp !== enteredOtp) {
      return res.status(400).json({
        message: "Invalid OTP code. Please check your email and enter the correct 6-digit code.",
      });
    }

    record.verified = true;
    await record.save();

    return res.status(200).json({
      message: "OTP verified successfully. You can now set a new password.",
      verified: true,
    });
  } catch (error) {
    console.error("VERIFY RESET OTP ERROR:", error);
    return res.status(500).json({
      message: "Something went wrong while verifying OTP. Please try again.",
    });
  }
};

// ======================================================
// RESET PASSWORD (STEP 3: SET NEW PASSWORD)
// ======================================================

export const resetPassword = async (req, res) => {
  try {
    const { identifier: rawId, email, phone, otp, newPassword } = req.body;
    const rawIdentifier = (email && String(email).trim()) || (phone && String(phone).trim()) || rawId;
    const identifier = detectIdentifier(rawIdentifier);

    if (identifier.type === "none" || !otp || !newPassword) {
      return res.status(400).json({
        message: "Email or mobile number, 6-digit OTP, and new password are required.",
      });
    }

    if (identifier.type === "phone" && !isValidIndianMobile(identifier.value)) {
      return res.status(400).json({
        message: "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        message: "New password must be at least 8 characters long.",
      });
    }

    let user = null;
    if (identifier.type === "email") {
      user = await User.findOne({
        email: { $regex: new RegExp(`^${identifier.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      });
    } else {
      user = await User.findOne({
        $or: [
          { phone: identifier.value },
          { phone: `+91${identifier.value}` },
          { phone: `91${identifier.value}` },
        ],
      });
    }

    if (!user) {
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    const targetKey =
      identifier.type === "email"
        ? (user.email || identifier.value).toLowerCase().trim()
        : normalizePhone(user.phone || identifier.value);

    const record = await Verification.findOne({
      $or: [
        { phone: targetKey },
        { phone: identifier.value },
        ...(user.email ? [{ phone: user.email }, { phone: user.email.toLowerCase().trim() }] : []),
        ...(user.phone ? [{ phone: user.phone }, { phone: normalizePhone(user.phone) }] : []),
      ],
    }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({
        message: "No OTP was requested for this account, or it has expired. Please request a new code.",
      });
    }

    if (record.expiresAt < new Date()) {
      await Verification.deleteMany({
        $or: [
          { phone: targetKey },
          { phone: identifier.value },
          ...(user.email ? [{ phone: user.email }, { phone: user.email.toLowerCase().trim() }] : []),
          ...(user.phone ? [{ phone: user.phone }, { phone: normalizePhone(user.phone) }] : []),
        ],
      });
      return res.status(400).json({
        message: "OTP has expired. Please request a new code.",
      });
    }

    const enteredOtp = String(otp ?? "").trim();
    const expectedOtp = String(record.otp ?? "").trim();

    if (expectedOtp !== enteredOtp) {
      return res.status(400).json({
        message: "Invalid OTP code. Please enter the correct 6-digit code.",
      });
    }

    // Hash new password and save
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;
    await user.save();

    // Clean up all used OTPs for this user
    await Verification.deleteMany({
      $or: [
        { phone: targetKey },
        { phone: identifier.value },
        ...(user.email ? [{ phone: user.email }, { phone: user.email.toLowerCase().trim() }] : []),
        ...(user.phone ? [{ phone: user.phone }, { phone: normalizePhone(user.phone) }] : []),
      ],
    });

    return res.status(200).json({
      message: "Password reset successfully! You can now sign in with your new password.",
    });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    return res.status(500).json({
      message: "Something went wrong while resetting password. Please try again.",
    });
  }
};

// ======================================================
// CHANGE PASSWORD
// ======================================================

export const changePassword = async (req, res) => {
  try {
    const userId = req.user.actualUserId || req.user.userId || req.user._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required.",
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters long.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Current password is incorrect.",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.status(200).json({
      message: "Password updated successfully.",
    });
  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error);
    return res.status(500).json({
      message: "Something went wrong while updating password. Please try again.",
    });
  }
};

// ======================================================
// VERIFY 2FA LOGIN OTP
// ======================================================

export const verifyLoginOtp = async (req, res) => {
  try {
    const { userId, phone, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({
        message: "User ID and OTP are required.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    let ownerUser = null;
    if (user.ownerId) {
      ownerUser = await User.findById(user.ownerId);
    }

    const userStatus = user.status || "Active";
    const ownerStatus = ownerUser ? (ownerUser.status || "Active") : "Active";

    if (user.role !== "superadmin") {
      if (userStatus === "Suspended" || ownerStatus === "Suspended") {
        const reason = user.suspensionReason || ownerUser?.suspensionReason || "";
        return res.status(403).json({
          code: "ACCOUNT_SUSPENDED",
          status: "Suspended",
          isSuspended: true,
          suspensionReason: reason,
          message: reason
            ? `Your account has been suspended by administration. Reason: ${reason}`
            : "Your account has been suspended by administration. Please contact support.",
        });
      }

      if (userStatus === "Inactive" || ownerStatus === "Inactive") {
        return res.status(403).json({
          message: "Your account is deactivated. Please contact your business owner or support.",
        });
      }
    }

    const targetPhone = phone || normalizePhone(user.phone);
    const record = await Verification.findOne({
      phone: targetPhone,
    });

    if (!record) {
      return res.status(400).json({
        message: "No OTP was requested. Please sign in again.",
      });
    }

    if (record.expiresAt < new Date()) {
      await Verification.deleteOne({ _id: record._id });
      return res.status(400).json({
        message: "OTP has expired. Please sign in again to request a new code.",
      });
    }

    if (record.otp !== String(otp).trim()) {
      return res.status(400).json({
        message: "Invalid OTP code. Please enter the 6-digit code sent to your phone.",
      });
    }

    // Clean up used OTP
    await Verification.deleteOne({ _id: record._id });

    if (user.ownerId && !ownerUser) {
      ownerUser = await User.findById(user.ownerId);
    }

    return res.status(200).json(buildAuthPayload(user, ownerUser));
  } catch (err) {
    console.error("VERIFY LOGIN OTP ERROR:", err);
    return res.status(500).json({
      message: "Failed to verify 2FA OTP. Please try again.",
    });
  }
};