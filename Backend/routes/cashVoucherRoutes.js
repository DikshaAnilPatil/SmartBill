import express from "express";
import { authMiddleware as protect } from "../middleware/auth.js";
import {
  getCashVouchers,
  createCashVoucher,
  updateCashVoucher,
  deleteCashVoucher,
} from "../controller/cashVoucherController.js";

const router = express.Router();

router.use(protect);

router.route("/").get(getCashVouchers).post(createCashVoucher);
router.route("/:id").put(updateCashVoucher).delete(deleteCashVoucher);

export default router;
