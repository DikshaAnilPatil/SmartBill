import express from "express";

import {
  getPurchases,
  getPurchaseById,
  createPurchase,
  markPurchaseAsPaid,
  deletePurchase,
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

// Mark an unpaid/partially paid purchase as fully paid
router.put("/:id/mark-paid", markPurchaseAsPaid);

// Delete / Cancel purchase (reverts stock and supplier balance)
router.delete("/:id", deletePurchase);

export default router;