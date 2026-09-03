import express from "express";
import { authMiddleware as protect } from "../middleware/auth.js";
import { getInvoiceSettings, updateInvoiceSettings } from "../controller/invoiceSettingsController.js";

const router = express.Router();

router.use(protect);

router.route("/").get(getInvoiceSettings).put(updateInvoiceSettings).post(updateInvoiceSettings);

export default router;
