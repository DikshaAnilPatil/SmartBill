import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import Supplier from "../models/Supplier.js";
import AccountingSettings from "../models/AccountingSettings.js";
import { getCashBalance } from "../utils/accountingUtils.js";
import mongoose from "mongoose";
import { createNotification } from "../services/notificationService.js";

// ================= LIST PURCHASES WITH PAGINATION =================
export const getPurchases = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const {
      page,
      limit,
      search,
      paymentStatus,
      supplierId,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = { ownerId };

    if (paymentStatus && paymentStatus !== "All") {
      query.paymentStatus = paymentStatus;
    }

    if (supplierId && mongoose.isValidObjectId(supplierId)) {
      query.supplierId = supplierId;
    }

    if (search && String(search).trim()) {
      const cleanSearch = String(search).trim();
      const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { supplierName: new RegExp(escaped, "i") },
        { supplierInvoiceNo: new RegExp(escaped, "i") },
        { purchaseOrderNo: new RegExp(escaped, "i") },
      ];
    }

    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) query.purchaseDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.purchaseDate.$lte = end;
      }
    }

    const sortOption = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
    };

    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const [purchases, total] = await Promise.all([
        Purchase.find(query).sort(sortOption).skip(skip).limit(limitNum).lean(),
        Purchase.countDocuments(query),
      ]);

      return res.status(200).json({
        message: "OK",
        purchases,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }

    const purchases = await Purchase.find(query).sort(sortOption).lean();
    return res.status(200).json({
      message: "OK",
      purchases,
      pagination: {
        total: purchases.length,
        page: 1,
        limit: purchases.length,
        totalPages: 1,
      },
    });
  } catch (error) {
    console.error("GET PURCHASES ERROR:", error.message);
    return res.status(500).json({ message: "Failed to fetch purchases." });
  }
};

// ================= GET SINGLE PURCHASE =================
export const getPurchaseById = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      ownerId,
    }).lean();

    if (!purchase) {
      return res.status(404).json({ message: "Purchase record not found." });
    }

    return res.status(200).json({ message: "OK", purchase });
  } catch (error) {
    console.error("GET PURCHASE ERROR:", error.message);
    return res.status(500).json({ message: "Failed to fetch purchase details." });
  }
};

// ================= CREATE PURCHASE =================
export const createPurchase = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const actualUserId = req.user.actualUserId || req.user._id;

    const {
      supplierId,
      supplierName,
      supplierInvoiceNo = "",
      purchaseOrderNo = "",
      purchaseDate,
      dueDate,
      items = [],
      subtotal = 0,
      gstTotal = 0,
      discountTotal = 0,
      totalAmount = 0,
      paymentStatus = "Unpaid",
      paymentMethod = "Cash",
      amountPaid = 0,
      notes = "",
    } = req.body;

    if (!supplierName || !String(supplierName).trim()) {
      return res.status(400).json({ message: "Supplier name is required." });
    }

    if (!purchaseDate) {
      return res.status(400).json({ message: "Purchase date is required." });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one product item is required." });
    }

    const validatedItems = [];
    let calculatedSubtotal = 0;
    let calculatedGstTotal = 0;
    let calculatedDiscountTotal = 0;

    for (const item of items) {
      const pName = String(item.productName || item.product || "").trim();
      const qty = Number(item.quantity || item.qty) || 0;
      const rate = Number(item.purchaseRate || item.rate) || 0;
      const gstR = Number(item.gstRate ?? item.gst) || 0;
      const disc = Number(item.discount) || 0;

      if (!pName) {
        return res.status(400).json({ message: "Product name is required for all item rows." });
      }
      if (qty <= 0) {
        return res.status(400).json({ message: `Quantity for product "${pName}" must be greater than 0.` });
      }
      if (rate < 0) {
        return res.status(400).json({ message: `Purchase rate for "${pName}" cannot be negative.` });
      }
      if (disc < 0 || disc > qty * rate) {
        return res.status(400).json({ message: `Discount for "${pName}" cannot exceed the item amount.` });
      }

      const itemAmount = Math.round((qty * rate - disc) * 100) / 100;
      const gstAmount = Math.round((itemAmount * (gstR / 100)) * 100) / 100;

      calculatedSubtotal += qty * rate;
      calculatedDiscountTotal += disc;
      calculatedGstTotal += gstAmount;

      validatedItems.push({
        productId: item.productId && mongoose.isValidObjectId(item.productId) ? item.productId : null,
        productName: pName,
        quantity: qty,
        unit: item.unit || "pcs",
        purchaseRate: rate,
        gstRate: gstR,
        gstAmount,
        discount: disc,
        itemAmount: itemAmount + gstAmount,
      });
    }

    const computedGrandTotal = Math.max(
      0,
      Math.round((calculatedSubtotal - calculatedDiscountTotal + calculatedGstTotal) * 100) / 100
    );

    const numPaid = Math.max(0, Number(amountPaid) || 0);

    if (numPaid > computedGrandTotal) {
      return res.status(400).json({ message: "Amount paid cannot exceed total purchase amount." });
    }

    let finalPaid = 0;
    let finalRemaining = computedGrandTotal;

    if (paymentStatus === "Paid") {
      finalPaid = computedGrandTotal;
      finalRemaining = 0;
    } else if (paymentStatus === "Partially Paid") {
      finalPaid = numPaid;
      finalRemaining = Math.max(0, Math.round((computedGrandTotal - numPaid) * 100) / 100);
    } else {
      finalPaid = 0;
      finalRemaining = computedGrandTotal;
    }

    const finalPaymentMethod = ["Paid", "Partially Paid"].includes(paymentStatus) ? paymentMethod : "Cash";

    // Enforce Strict Negative Cash Rule
    if (finalPaid > 0 && finalPaymentMethod === "Cash") {
      const settings = await AccountingSettings.findOne({ userId: ownerId }).lean();
      if (settings?.strictNegativeCash) {
        const cashBalance = await getCashBalance(ownerId);
        if (cashBalance - finalPaid < 0) {
          return res.status(400).json({ 
            message: `Strict Negative Cash Rule is enabled. Your cash balance is ₹${cashBalance}, which is insufficient for this ₹${finalPaid} payment.`
          });
        }
      }
    }

    // 2. Create Purchase Record
    const initialPaymentHistory = finalPaid > 0 ? [{
      amount: finalPaid,
      paymentMethod: finalPaymentMethod,
      date: new Date(purchaseDate),
      referenceNo: "",
      notes: "Initial payment on purchase creation",
    }] : [];

    const newPurchase = await Purchase.create({
      ownerId,
      supplierId: supplierId && mongoose.isValidObjectId(supplierId) ? supplierId : null,
      supplierName: String(supplierName).trim(),
      supplierInvoiceNo: String(supplierInvoiceNo).trim(),
      purchaseOrderNo: String(purchaseOrderNo).trim(),
      purchaseDate: new Date(purchaseDate),
      dueDate: dueDate ? new Date(dueDate) : null,
      items: validatedItems,
      subtotal: Math.round(calculatedSubtotal * 100) / 100,
      gstTotal: Math.round(calculatedGstTotal * 100) / 100,
      discountTotal: Math.round(calculatedDiscountTotal * 100) / 100,
      totalAmount: computedGrandTotal,
      paymentStatus,
      paymentMethod: finalPaymentMethod,
      amountPaid: finalPaid,
      remainingAmount: finalRemaining,
      notes: String(notes).trim(),
      receiptUrl: req.body.receiptUrl ? String(req.body.receiptUrl) : "",
      receiptName: req.body.receiptName ? String(req.body.receiptName) : "",
      paymentHistory: initialPaymentHistory,
    });

    // 3. Inventory Integration: Atomically increment stock for purchased products
    for (const item of validatedItems) {
      let product = null;
      const ownershipFilter = {
        $or: [{ userId: ownerId }, { ownerId }],
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
        const updateFields = {
          $inc: { stock: Number(item.quantity) },
        };
        if (item.purchaseRate > 0) {
          updateFields.$set = { cost: Number(item.purchaseRate) };
        }
        await Product.findByIdAndUpdate(product._id, updateFields);
      } else {
        // Auto-create product in inventory if it does not exist yet
        await Product.create({
          userId: actualUserId,
          ownerId,
          name: String(item.productName).trim(),
          sku: `PRD-${Date.now().toString().slice(-6)}`,
          category: "General",
          cost: Number(item.purchaseRate) || 0,
          price: Math.round(((Number(item.purchaseRate) || 0) * 1.2) * 100) / 100,
          stock: Number(item.quantity) || 0,
          unit: item.unit || "Piece",
          gst: Number(item.gstRate) || 0,
          status: "Active",
        });
      }
    }

    // 4. Supplier Balance Integration: Atomically increase supplier payable balance
    if (finalRemaining > 0) {
      if (supplierId && mongoose.isValidObjectId(supplierId)) {
        await Supplier.findByIdAndUpdate(supplierId, {
          $inc: { balance: finalRemaining },
        });
      } else if (supplierName) {
        await Supplier.findOneAndUpdate(
          { name: String(supplierName).trim(), ownerId },
          { $inc: { balance: finalRemaining } }
        );
      }
    }

    try {
      await createNotification({
        ownerId,
        userId: actualUserId,
        title: `Purchase Recorded: #${newPurchase.supplierInvoiceNo || newPurchase.purchaseOrderNo || "Bill"}`,
        message: `Purchase of ₹${computedGrandTotal.toLocaleString("en-IN")} from ${supplierName} recorded (${paymentStatus}).`,
        type: "info",
        category: "purchase",
        link: "purchase",
        metadata: {
          purchaseId: newPurchase._id,
          totalAmount: computedGrandTotal,
          supplierName,
          paymentStatus,
        },
      });
    } catch (notifErr) {
      console.error("Purchase notification error:", notifErr.message);
    }

    return res.status(201).json({
      message: "Purchase recorded successfully.",
      purchase: newPurchase,
    });
  } catch (error) {
    console.error("CREATE PURCHASE ERROR:", error.message);
    return res.status(500).json({
      message: error.message || "Failed to create purchase record.",
    });
  }
};

/**
 * Mark Purchase as Paid / Record Supplier Payment
 */
export const markPurchaseAsPaid = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const purchase = await Purchase.findOne({ _id: req.params.id, ownerId });
    if (!purchase) {
      return res.status(404).json({ message: "Purchase record not found." });
    }

    const {
      amountPaid,
      paymentMethod = "Bank Transfer",
      referenceNo = "",
      paymentDate,
      notes = "",
      receiptUrl,
      receiptName,
    } = req.body;

    const payAmount = Number(amountPaid) || purchase.remainingAmount || 0;
    if (payAmount <= 0) {
      return res.status(400).json({ message: "Payment amount must be greater than zero." });
    }

    const previousRemaining = purchase.remainingAmount || 0;
    const newPaidTotal = (purchase.amountPaid || 0) + payAmount;
    const newRemaining = Math.max(0, (purchase.totalAmount || 0) - newPaidTotal);
    const newStatus = newRemaining === 0 ? "Paid" : "Partially Paid";

    purchase.amountPaid = newPaidTotal;
    purchase.remainingAmount = newRemaining;
    purchase.paymentStatus = newStatus;
    purchase.paymentMethod = paymentMethod;

    if (receiptUrl) {
      purchase.receiptUrl = String(receiptUrl);
      if (receiptName) purchase.receiptName = String(receiptName);
    }

    if (!Array.isArray(purchase.paymentHistory)) {
      purchase.paymentHistory = [];
    }

    purchase.paymentHistory.push({
      amount: payAmount,
      paymentMethod,
      date: paymentDate ? new Date(paymentDate) : new Date(),
      referenceNo: String(referenceNo || "").trim(),
      notes: String(notes || "").trim(),
    });

    await purchase.save();

    // Adjust supplier balance
    if (previousRemaining > newRemaining) {
      const balanceReduction = previousRemaining - newRemaining;
      if (purchase.supplierId && mongoose.isValidObjectId(purchase.supplierId)) {
        await Supplier.findByIdAndUpdate(purchase.supplierId, { $inc: { balance: -balanceReduction } });
      } else if (purchase.supplierName) {
        await Supplier.findOneAndUpdate(
          { name: purchase.supplierName, ownerId },
          { $inc: { balance: -balanceReduction } }
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: `Payment of ₹${payAmount.toLocaleString("en-IN")} recorded. Status: ${newStatus}.`,
      purchase,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to record payment." });
  }
};

/**
 * Upload / Attach Supplier Receipt or Invoice Image/PDF
 */
export const uploadPurchaseReceipt = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const { receiptUrl, receiptName = "Supplier Receipt" } = req.body;
    if (!receiptUrl) {
      return res.status(400).json({ message: "Receipt file content or URL is required." });
    }

    const purchase = await Purchase.findOneAndUpdate(
      { _id: req.params.id, ownerId },
      { $set: { receiptUrl: String(receiptUrl), receiptName: String(receiptName) } },
      { returnDocument: "after" }
    );

    if (!purchase) {
      return res.status(404).json({ message: "Purchase record not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Receipt attached successfully.",
      purchase,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to attach receipt." });
  }
};

/**
 * Delete Purchase & Atomically Reverse Stock and Supplier Balance
 */
export const deletePurchase = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const purchase = await Purchase.findOne({ _id: req.params.id, ownerId });
    if (!purchase) {
      return res.status(404).json({ message: "Purchase record not found." });
    }

    // Revert inventory stock atomically for each purchase item
    if (Array.isArray(purchase.items)) {
      for (const item of purchase.items) {
        const qty = Number(item.quantity || item.qty) || 0;
        if (qty > 0) {
          if (item.product && mongoose.isValidObjectId(item.product)) {
            await Product.findByIdAndUpdate(item.product, { $inc: { stock: -qty } });
          } else if (item.productName) {
            await Product.findOneAndUpdate(
              { name: item.productName, ownerId },
              { $inc: { stock: -qty } }
            );
          }
        }
      }
    }

    // Revert supplier balance
    const remainingDue = Number(purchase.remainingAmount) || 0;
    if (remainingDue > 0) {
      if (purchase.supplierId && mongoose.isValidObjectId(purchase.supplierId)) {
        await Supplier.findByIdAndUpdate(purchase.supplierId, { $inc: { balance: -remainingDue } });
      } else if (purchase.supplierName) {
        await Supplier.findOneAndUpdate(
          { name: purchase.supplierName, ownerId },
          { $inc: { balance: -remainingDue } }
        );
      }
    }

    await Purchase.deleteOne({ _id: purchase._id, ownerId });

    return res.status(200).json({
      success: true,
      message: "Purchase bill deleted and inventory stock reversed.",
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to delete purchase." });
  }
};