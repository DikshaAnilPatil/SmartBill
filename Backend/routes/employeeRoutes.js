import express from "express";
import { protect, requirePermission } from "../middleware/mid.js";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../controller/employeeController.js";
import { checkResourceLimit } from "../middleware/checkPlanLimits.js";

const router = express.Router();

// Apply auth and staff management permission check
router.use(protect);
router.use(requirePermission("users"));

router.get("/", getEmployees);
router.post("/", checkResourceLimit("users"), createEmployee);
router.put("/:id", updateEmployee);
router.delete("/:id", deleteEmployee);

export default router;
