import express from "express";
import { protect } from "../middleware/mid.js";

import {
  getBusinessSettings,
  updateBusinessSettings,
} from "../controller/businessSettingsController.js";

const router = express.Router();

// All business settings routes require login
router.use(protect);

// GET /api/settings/business
router.get("/", getBusinessSettings);

// PUT & POST /api/settings/business
router.put("/", updateBusinessSettings);
router.post("/", updateBusinessSettings);

export default router;