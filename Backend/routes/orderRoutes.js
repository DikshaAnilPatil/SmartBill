import express from "express";
import {
  createOrder,
  getOrders,
  getOrder,
  recordOrderPayment,
  createSalesReturn,
  deleteOrder,
} from "../controller/orderController.js";
import { protect } from "../middleware/mid.js";
import { checkInvoiceLimit } from "../middleware/checkPlanLimits.js";

const router = express.Router();

// All order routes require authentication.
router.use(protect);

router.post("/", checkInvoiceLimit, createOrder);
router.get("/", getOrders);
router.get("/:id", getOrder);
router.post("/:id/payment", recordOrderPayment);
router.post("/:id/return", createSalesReturn);
router.delete("/:id", deleteOrder);

export default router;
