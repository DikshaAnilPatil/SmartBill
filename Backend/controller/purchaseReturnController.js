import mongoose from "mongoose";
import PurchaseReturn from "../models/PurchaseReturn.js";
import Purchase from "../models/Purchase.js";
import Product from "../models/productModel.js";
import Supplier from "../models/Supplier.js";
import { createNotification } from "../services/notificationService.js";

/**
 * Generate a unique Debit Note Number: DN-YYYYMMDD-XXXX
 */
const generateDebitNoteNo = async (ownerId) => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const countToday = await PurchaseReturn.countDocuments({
    ownerId,
    createdAt: {
      $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      $lte: new Date(new Date().setHours(23, 59, 59, 999)),
    },
  });

  const seq = String(countToday + 1).padStart(3, "0");
  return `DN-${dateStr}-${seq}`;
};

// ================= LIST PURCHASE RETURNS =================
export const getPurchaseReturns = async (req, res) => {
  try {
    const returns = await PurchaseReturn.find({ ownerId: req.user._id })
      .sort({ returnDate: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      message: "OK",
      purchaseReturns: returns,
    });
  } catch (error) {
    console.error("GET PURCHASE RETURNS ERROR:", error.message);
    return res
      .status(500)
      .json({ message: "Failed to fetch purchase returns." });
  }
};

// ================= GET SINGLE PURCHASE RETURN =================
export const getPurchaseReturnById = async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
    }).lean();

    if (!purchaseReturn) {
      return res
        .status(404)
        .json({ message: "Purchase return record not found." });
    }

    return res.status(200).json({
      message: "OK",
      purchaseReturn,
    });
  } catch (error) {
    console.error("GET PURCHASE RETURN ERROR:", error.message);
    return res
      .status(500)
      .json({ message: "Failed to fetch purchase return details." });
  }
};

// ================= CREATE PURCHASE RETURN =================
export const createPurchaseReturn = async (req, res) => {
  try {
    const {
      purchaseId,
      supplierId,
      supplierName,
      supplierInvoiceNo = "",
      returnDate,
      items = [],
      subtotal = 0,
      gstTotal = 0,
      totalReturnAmount = 0,
      settlementType = "Adjust from Supplier Balance",
      notes = "",
    } = req.body;

    // 1. Validations
    if (!supplierName || !String(supplierName).trim()) {
      return res.status(400).json({ message: "Supplier name is required." });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one product item is required for return." });
    }

    const validatedItems = [];
    for (const item of items) {
      const pName = String(item.productName || item.product || "").trim();
      const qty = Number(item.quantity || item.qty) || 0;
      const rate = Number(item.purchaseRate || item.rate) || 0;
      const gstR = Number(item.gstRate ?? item.gst) || 0;
      const reason = String(item.reason || "Damaged / Defective").trim();
      const condition = String(item.condition || "Damaged").trim();

      if (!pName) {
        return res
          .status(400)
          .json({ message: "Product name is required for all return items." });
      }
      if (qty <= 0) {
        return res
          .status(400)
          .json({ message: `Return quantity for "${pName}" must be greater than 0.` });
      }
      if (rate < 0) {
        return res
          .status(400)
          .json({ message: `Purchase rate for "${pName}" cannot be negative.` });
      }

      const itemAmount = qty * rate;
      const gstAmount = itemAmount * (gstR / 100);

      validatedItems.push({
        productId: item.productId || item.id || null,
        productName: pName,
        quantity: qty,
        unit: item.unit || "pcs",
        purchaseRate: rate,
        gstRate: gstR,
        gstAmount,
        itemAmount,
        reason,
        condition,
      });
    }

    const numTotal = Number(totalReturnAmount) || 0;
    if (numTotal <= 0) {
      return res
        .status(400)
        .json({ message: "Total return amount must be greater than 0." });
    }

    // 2. Generate Debit Note No
    const debitNoteNo = await generateDebitNoteNo(req.user._id);

    // 3. Create Purchase Return Record
    const newReturn = await PurchaseReturn.create({
      ownerId: req.user._id,
      debitNoteNo,
      purchaseId: purchaseId && mongoose.isValidObjectId(purchaseId) ? purchaseId : null,
      supplierId: supplierId && mongoose.isValidObjectId(supplierId) ? supplierId : null,
      supplierName: String(supplierName).trim(),
      supplierInvoiceNo: String(supplierInvoiceNo).trim(),
      returnDate: returnDate ? new Date(returnDate) : new Date(),
      items: validatedItems,
      subtotal: Number(subtotal) || 0,
      gstTotal: Number(gstTotal) || 0,
      totalReturnAmount: numTotal,
      settlementType,
      refundStatus: "Settled",
      notes: String(notes).trim(),
    });

    // 4. Inventory Integration: Deduct/reduce stock for returned items
    for (const item of validatedItems) {
      let product = null;
      const ownershipFilter = {
        $or: [{ userId: req.user._id }, { ownerId: req.user._id }],
      };

      if (item.productId && mongoose.isValidObjectId(item.productId)) {
        product = await Product.findOne({
          _id: item.productId,
          ...ownershipFilter,
        });
      }

      if (!product && item.productName) {
        const cleanName = String(item.productName).trim();
        product = await Product.findOne({
          name: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
          ...ownershipFilter,
        });
      }

      if (product) {
        // Decrement stock since damaged/faulty goods are returned to supplier
        product.stock = Math.max(0, (Number(product.stock) || 0) - Number(item.quantity));
        await product.save();
      }
    }

    // 5. Supplier Balance Integration:
    // If settlement is "Adjust from Supplier Balance" or "Supplier Credit Note", reduce supplier payable balance
    if (
      settlementType === "Adjust from Supplier Balance" ||
      settlementType === "Supplier Credit Note"
    ) {
      let supplierDoc = null;
      if (supplierId && mongoose.isValidObjectId(supplierId)) {
        supplierDoc = await Supplier.findOne({
          _id: supplierId,
          ownerId: req.user._id,
        });
      }
      if (!supplierDoc && supplierName) {
        supplierDoc = await Supplier.findOne({
          name: String(supplierName).trim(),
          ownerId: req.user._id,
        });
      }

      if (supplierDoc) {
        supplierDoc.balance = Math.max(
          0,
          (Number(supplierDoc.balance) || 0) - numTotal
        );
        await supplierDoc.save();
      }
    }

    // 6. In-App Notification
    try {
      await createNotification({
        ownerId: req.user._id,
        userId: req.user.actualUserId || req.user._id,
        title: `Debit Note Generated: ${debitNoteNo}`,
        message: `Purchase return of ₹${numTotal.toLocaleString("en-IN")} to ${supplierName} recorded (${settlementType}).`,
        type: "warning",
        category: "purchase",
        link: "purchase",
        metadata: {
          purchaseReturnId: newReturn._id,
          debitNoteNo,
          totalReturnAmount: numTotal,
          supplierName,
        },
      });
    } catch (notifErr) {
      console.warn("Purchase return notification notice:", notifErr.message);
    }

    return res.status(201).json({
      message: "Purchase return created successfully.",
      purchaseReturn: newReturn,
    });
  } catch (error) {
    console.error("CREATE PURCHASE RETURN ERROR:", error.message);
    return res
      .status(500)
      .json({ message: error.message || "Failed to process purchase return." });
  }
};
