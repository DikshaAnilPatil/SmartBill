import express from "express";

import {
  getSuppliers,
  getSupplier,
  getSupplierDetails,
  createSupplier,
  recordSupplierPayment,
  updateSupplier,
  deleteSupplier,
} from "../controller/supplierController.js";

import { protect } from "../middleware/mid.js";
import { checkResourceLimit } from "../middleware/checkPlanLimits.js";

const router = express.Router();

router.use(protect);

router.get("/", getSuppliers);
router.get("/:id", getSupplier);
router.get("/:id/details", getSupplierDetails);
router.post("/", checkResourceLimit("suppliers"), createSupplier);
router.post("/:id/payment", recordSupplierPayment);
router.put("/:id", updateSupplier);
router.delete("/:id", deleteSupplier);

export default router;