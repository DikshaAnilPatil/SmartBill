import express from "express";
import { protect } from "../middleware/mid.js";

import {
  addProduct,
  bulkAddProducts,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
} from "../controller/productController.js";

const router = express.Router();

router.post("/bulk", protect, bulkAddProducts);
router.post("/", protect, addProduct);

router.get("/", protect, getProducts);
router.get("/:id", protect, getProduct);

router.put("/:id", protect, updateProduct);

router.delete("/:id", protect, deleteProduct);

export default router;
