import express from "express";
import {
  getPurchaseReturns,
  getPurchaseReturnById,
  createPurchaseReturn,
} from "../controller/purchaseReturnController.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireFeature } from "../middleware/checkPlanLimits.js";

const router = express.Router();

router.use(authMiddleware);

// List all purchase returns / debit notes
router.get("/", getPurchaseReturns);

// Get single purchase return
router.get("/:id", getPurchaseReturnById);

// Create a new purchase return / debit note
router.post("/", requireFeature("purchaseManagement"), createPurchaseReturn);

export default router;
