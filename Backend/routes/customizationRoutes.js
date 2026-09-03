import express from "express";
import { protect } from "../middleware/mid.js";
import {
  getCustomization,
  updateCustomization,
  resetCustomization,
} from "../controller/customizationController.js";

const router = express.Router();

router.use(protect);

router.get("/", getCustomization);
router.put("/", updateCustomization);
router.post("/", updateCustomization);
router.post("/reset", resetCustomization);

export default router;
