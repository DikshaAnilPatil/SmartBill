import express from "express";
import { authMiddleware as protect } from "../middleware/auth.js";
import { getInvoiceSettings, updateInvoiceSettings } from "../controller/invoiceSettingsController.js";
import { requireFeature } from "../middleware/checkPlanLimits.js";

const router = express.Router();

router.use(protect);

router.route("/").get(getInvoiceSettings).put(requireFeature("invoiceCustomization"), updateInvoiceSettings).post(requireFeature("invoiceCustomization"), updateInvoiceSettings);

export default router;
