import express from "express";
import {
  createSubscriptionOrder,
  verifySubscriptionPayment,
  getSubscriptionStatus,
  getUpgradePreview,
} from "../controller/subscriptionController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Optional auth helper middleware: sets req.user if valid token is present, but doesn't block unauthenticated / expired callers
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : req.query?.token
      ? String(req.query.token).trim()
      : null;

    if (token) {
      const secret = process.env.JWT_SECRET || "smartbill_secret_key_123";
      let decoded;
      try {
        decoded = jwt.verify(token, secret);
      } catch {
        decoded = jwt.verify(token, "smartbill_secret_key_123`");
      }

      if (decoded?.id) {
        const dbUser = await User.findById(decoded.id).select("-password");
        if (dbUser) {
          const effectiveOwnerId = dbUser.ownerId || dbUser._id;
          req.user = {
            actualUserId: dbUser._id,
            userId: dbUser._id,
            ownerId: effectiveOwnerId,
            effectiveOwnerId: effectiveOwnerId,
            _id: effectiveOwnerId,
            id: effectiveOwnerId.toString(),
            email: dbUser.email,
            role: dbUser.role,
            businessName: dbUser.businessName || "",
            businessType: dbUser.businessType || "Retail",
            permissions: dbUser.permissions || {},
          };
        }
      }
    }
  } catch (err) {
    // Non-blocking for optional auth
  }
  next();
};

// Prorated upgrade/downgrade preview (requires auth — reads current plan from user record)
router.get("/upgrade-preview", authMiddleware, getUpgradePreview);

router.post("/create-order", optionalAuth, createSubscriptionOrder);
router.post("/verify-payment", optionalAuth, verifySubscriptionPayment);
router.get("/status", authMiddleware, getSubscriptionStatus);

export default router;
