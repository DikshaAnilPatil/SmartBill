import express from "express";

import {
  getPurchases,
  getPurchaseById,
  createPurchase,
  markPurchaseAsPaid,
  uploadPurchaseReceipt,
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

// Mark an unpaid/partially paid purchase as fully paid / record payment
router.put("/:id/mark-paid", markPurchaseAsPaid);

// Upload / attach invoice or receipt image/PDF
router.put("/:id/receipt", uploadPurchaseReceipt);

// Delete / Cancel purchase (reverts stock and supplier balance)
router.delete("/:id", deletePurchase);

export default router;