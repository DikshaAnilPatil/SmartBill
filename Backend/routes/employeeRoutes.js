import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../controller/employeeController.js";
import { checkResourceLimit } from "../middleware/checkPlanLimits.js";

const router = express.Router();

// Apply auth middleware to all employee routes
router.use(authMiddleware);

router.get("/", getEmployees);
router.post("/", checkResourceLimit("users"), createEmployee);
router.put("/:id", updateEmployee);
router.delete("/:id", deleteEmployee);

export default router;
