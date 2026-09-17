import express from "express";

import {
  getPurchases,
  getPurchaseById,
  createPurchase,
  recordPurchasePayment,
  markPurchaseAsPaid,
} from "../controller/purchaseController.js";

import { authMiddleware } from "../middleware/auth.js";
import { requireFeature } from "../middleware/checkPlanLimits.js";

const router = express.Router();

router.use(authMiddleware);

// Get all purchases
router.get("/", getPurchases);

// Get single purchase
router.get("/:id", getPurchaseById);

// Create purchase
router.post("/", requireFeature("purchaseManagement"), createPurchase);

// Record payment (partial or full installment) for purchase
router.put("/:id/pay", recordPurchasePayment);

// Mark an unpaid/partially paid purchase as fully paid
router.put("/:id/mark-paid", markPurchaseAsPaid);

export default router;