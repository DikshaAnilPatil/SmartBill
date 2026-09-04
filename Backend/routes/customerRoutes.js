import express from "express";

import {
  getCustomers,
  getCustomer,
  getCustomerDetails,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../controller/customerController.js";

import { protect } from "../middleware/mid.js";
import { checkResourceLimit } from "../middleware/checkPlanLimits.js";

const router = express.Router();

// All customer routes require authentication.
router.use(protect);

router.get("/", getCustomers);
router.get("/:id", getCustomer);
router.get("/:id/details", getCustomerDetails);
router.post("/", checkResourceLimit("customers"), createCustomer);
router.put("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);

export default router;