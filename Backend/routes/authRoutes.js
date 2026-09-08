import express from "express";
import {
  register,
  login,
  sendOtp,
  verifyOtp,
  getProfile,
  updateProfile,
  changePassword,
  verifyLoginOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} from "../controller/authcontroller.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// ================= AUTH =================
router.post("/register", register);
router.post("/login", login);
router.post("/verify-login-otp", verifyLoginOtp);

// ================= OTP & PASSWORD RECOVERY =================
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);

// ================= PROFILE & SECURITY =================
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);
router.put("/change-password", authMiddleware, changePassword);

export default router;
