import express from "express";

import {
  createExpense,
  listExpenses,
} from "../controller/expenseController.js";

import { authMiddleware } from "../middleware/auth.js";
import { requireFeature } from "../middleware/checkPlanLimits.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", listExpenses);
router.post("/", requireFeature("expenses"), createExpense);

export default router;