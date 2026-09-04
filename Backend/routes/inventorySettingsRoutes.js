import express from "express";
import { protect } from "../middleware/mid.js";
import { requireFeatureWhenEnabled } from "../middleware/checkPlanLimits.js";
import {
  getInventorySettings,
  updateInventorySettings,
} from "../controller/inventorySettingsController.js";

const router = express.Router();

// All inventory settings routes require authentication
router.use(protect);

// GET /api/settings/inventory
router.get("/", getInventorySettings);

// PUT /api/settings/inventory
router.put(
  "/",
  requireFeatureWhenEnabled("advancedInventory", [
    "enableSerialTracking",
    "enableBatchTracking",
    "enableMultiUnit",
    "enableBarcodeScanner",
  ]),
  updateInventorySettings,
);

export default router;
