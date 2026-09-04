import express from "express";
import { protect } from "../middleware/mid.js";
import { checkResourceLimit } from "../middleware/checkPlanLimits.js";

import {
  addProduct,
  bulkAddProducts,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
} from "../controller/productController.js";

const router = express.Router();

router.post("/bulk", protect, checkResourceLimit("products"), bulkAddProducts);
router.post("/", protect, checkResourceLimit("products"), addProduct);

router.get("/", protect, getProducts);
router.get("/:id", protect, getProduct);

router.put("/:id", protect, updateProduct);

router.delete("/:id", protect, deleteProduct);

export default router;
