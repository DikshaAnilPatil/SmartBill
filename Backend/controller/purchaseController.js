import Purchase from "../models/Purchase.js";
import Product from "../models/productModel.js";
import Supplier from "../models/Supplier.js";
import AccountingSettings from "../models/AccountingSettings.js";
import { getCashBalance } from "../utils/accountingUtils.js";
import mongoose from "mongoose";
import { createNotification } from "../services/notificationService.js";

// ================= LIST PURCHASES =================
export const getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find({ ownerId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ message: "OK", purchases });
  } catch (error) {
    console.error("GET PURCHASES ERROR:", error.message);
    return res.status(500).json({ message: "Failed to fetch purchases." });
  }
};

// ================= GET SINGLE PURCHASE =================
export const getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
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
      remainingAmount = 0,
      notes = "",
    } = req.body;

    // 1. Validations
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

      const itemAmount = qty * rate - disc;
      const gstAmount = itemAmount * (gstR / 100);

      validatedItems.push({
        productId: item.productId || item.id || null,
        productName: pName,
        quantity: qty,
        unit: item.unit || "pcs",
        purchaseRate: rate,
        gstRate: gstR,
        gstAmount,
        discount: disc,
        itemAmount,
      });
    }

    const numTotal = Number(totalAmount) || 0;
    const numPaid = Number(amountPaid) || 0;

    if (numPaid < 0) {
      return res.status(400).json({ message: "Amount paid cannot be negative." });
    }
    if (numPaid > numTotal) {
      return res.status(400).json({ message: "Amount paid cannot exceed total purchase amount." });
    }

    let finalPaid = 0;
    let finalRemaining = numTotal;
    let finalStatus = "Unpaid";

    if (paymentStatus === "Paid" || numPaid >= numTotal) {
      finalPaid = numTotal;
      finalRemaining = 0;
      finalStatus = "Paid";
    } else if (numPaid > 0) {
      finalPaid = numPaid;
      finalRemaining = Math.max(0, numTotal - numPaid);
      finalStatus = "Partially Paid";
    } else {
      finalPaid = 0;
      finalRemaining = numTotal;
      finalStatus = "Unpaid";
    }

    const finalPaymentMethod = ["Paid", "Partially Paid"].includes(finalStatus) ? paymentMethod : "Cash";

    // Enforce Strict Negative Cash Rule
    if (finalPaid > 0 && finalPaymentMethod === "Cash") {
      const settings = await AccountingSettings.findOne({ userId: req.user._id }).lean();
      if (settings?.strictNegativeCash) {
        const cashBalance = await getCashBalance(req.user._id);
        if (cashBalance - finalPaid < 0) {
          return res.status(400).json({ 
            message: `Strict Negative Cash Rule is enabled. Your cash balance is ${cashBalance}, which is insufficient for this ${finalPaid} payment.`
          });
        }
      }
    }

    const initialPayments =
      finalPaid > 0
        ? [
            {
              amount: finalPaid,
              paymentMethod: finalPaymentMethod,
              paymentDate: new Date(purchaseDate),
              referenceNo: String(purchaseOrderNo || supplierInvoiceNo || "").trim(),
              notes: "Initial Purchase Payment",
            },
          ]
        : [];

    // 2. Create Purchase Record
    const newPurchase = await Purchase.create({
      ownerId: req.user._id,
      supplierId: supplierId || null,
      supplierName: String(supplierName).trim(),
      supplierInvoiceNo: String(supplierInvoiceNo).trim(),
      purchaseOrderNo: String(purchaseOrderNo).trim(),
      purchaseDate: new Date(purchaseDate),
      dueDate: dueDate ? new Date(dueDate) : null,
      items: validatedItems,
      subtotal: Number(subtotal) || 0,
      gstTotal: Number(gstTotal) || 0,
      discountTotal: Number(discountTotal) || 0,
      totalAmount: numTotal,
      paymentStatus: finalStatus,
      paymentMethod: finalPaymentMethod,
      amountPaid: finalPaid,
      remainingAmount: finalRemaining,
      payments: initialPayments,
      notes: String(notes).trim(),
    });

    // 3. Inventory Integration: Increment stock for purchased products
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
        product.stock = (Number(product.stock) || 0) + Number(item.quantity);
        if (item.purchaseRate > 0) {
          product.cost = Number(item.purchaseRate);
        }
        await product.save();
      } else {
        // Auto-create product in inventory if it does not exist yet
        await Product.create({
          userId: req.user._id,
          ownerId: req.user._id,
          name: String(item.productName).trim(),
          sku: `PRD-${Date.now().toString().slice(-6)}`,
          category: "General",
          cost: Number(item.purchaseRate) || 0,
          price: (Number(item.purchaseRate) || 0) * 1.2,
          stock: Number(item.quantity) || 0,
          unit: item.unit || "Piece",
          gst: Number(item.gstRate) || 0,
          status: "Active",
        });
      }
    }

    // 4. Supplier Balance Integration: Increase supplier payable balance by remaining unpaid amount
    let supplierDoc = null;
    if (supplierId) {
      supplierDoc = await Supplier.findOne({ _id: supplierId, ownerId: req.user._id });
    }
    if (!supplierDoc) {
      supplierDoc = await Supplier.findOne({ name: String(supplierName).trim(), ownerId: req.user._id });
    }

    if (supplierDoc) {
      supplierDoc.balance = (Number(supplierDoc.balance) || 0) + finalRemaining;
      await supplierDoc.save();
    }

    try {
      await createNotification({
        ownerId: req.user._id,
        userId: req.user.actualUserId || req.user._id,
        title: `Purchase Recorded: #${newPurchase.supplierInvoiceNo || newPurchase.purchaseOrderNo || "Bill"}`,
        message: `Purchase of ₹${numTotal.toLocaleString("en-IN")} from ${supplierName} recorded (${finalStatus === "Paid" ? "Payment Cleared" : `Payment Due: ₹${finalRemaining}`}).`,
        type: "info",
        category: "purchase",
        link: "purchase",
        metadata: {
          purchaseId: newPurchase._id,
          totalAmount: numTotal,
          supplierName,
          paymentStatus: finalStatus,
        },
      });
    } catch (notifErr) {
      console.error("Purchase notification error:", notifErr.message);
    }

    return res.status(201).json({
      message: "Purchase saved successfully",
      purchase: newPurchase,
    });
  } catch (error) {
    console.error("CREATE PURCHASE ERROR:", error.message);
    return res.status(500).json({ message: error.message || "Failed to save purchase." });
  }
};

// ================= RECORD PAYMENT FOR PURCHASE =================
export const recordPurchasePayment = async (req, res) => {
  try {
    const { amount, paymentMethod = "Cash", paymentDate = new Date(), referenceNo = "", notes = "" } = req.body;
    const payNum = Number(amount);

    if (isNaN(payNum) || payNum <= 0) {
      return res.status(400).json({ message: "Please provide a valid payment amount greater than 0." });
    }

    const purchase = await Purchase.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
    });

    if (!purchase) {
      return res.status(404).json({ message: "Purchase record not found." });
    }

    const currentDue = Number(purchase.remainingAmount) > 0 
      ? Number(purchase.remainingAmount)
      : Math.max(0, Number(purchase.totalAmount || 0) - Number(purchase.amountPaid || 0));

    if (currentDue <= 0 && purchase.paymentStatus === "Paid") {
      return res.status(400).json({ message: "This purchase order is already fully cleared. No payment is due." });
    }

    const paymentApplied = Math.min(payNum, currentDue);

    // Enforce Strict Negative Cash Rule
    if (paymentMethod === "Cash") {
      const settings = await AccountingSettings.findOne({ userId: req.user._id }).lean();
      if (settings?.strictNegativeCash) {
        const cashBalance = await getCashBalance(req.user._id);
        if (cashBalance - paymentApplied < 0) {
          return res.status(400).json({
            message: `Strict Negative Cash Rule is enabled. Your cash balance is ${cashBalance}, which is insufficient for this ${paymentApplied} payment.`
          });
        }
      }
    }

    const newAmountPaid = (Number(purchase.amountPaid) || 0) + paymentApplied;
    const newRemainingDue = Math.max(0, (Number(purchase.totalAmount) || 0) - newAmountPaid);
    const newStatus = newRemainingDue === 0 ? "Paid" : "Partially Paid";

    purchase.amountPaid = newAmountPaid;
    purchase.remainingAmount = newRemainingDue;
    purchase.paymentStatus = newStatus;
    purchase.paymentMethod = paymentMethod;

    if (!Array.isArray(purchase.payments)) {
      purchase.payments = [];
    }

    purchase.payments.push({
      amount: paymentApplied,
      paymentMethod,
      paymentDate: new Date(paymentDate),
      referenceNo: String(referenceNo || "").trim(),
      notes: String(notes || "").trim(),
    });

    await purchase.save();

    // Reduce supplier balance
    let supplierDoc = null;
    if (purchase.supplierId) {
      supplierDoc = await Supplier.findOne({ _id: purchase.supplierId, ownerId: req.user._id });
    }
    if (!supplierDoc && purchase.supplierName) {
      supplierDoc = await Supplier.findOne({ name: String(purchase.supplierName).trim(), ownerId: req.user._id });
    }
    if (supplierDoc && paymentApplied > 0) {
      supplierDoc.balance = Math.max(0, (Number(supplierDoc.balance) || 0) - paymentApplied);
      await supplierDoc.save();
    }

    // Create Notification
    try {
      await createNotification({
        ownerId: req.user._id,
        userId: req.user.actualUserId || req.user._id,
        title: `Payment Recorded: #${purchase.supplierInvoiceNo || purchase.purchaseOrderNo || "Bill"}`,
        message: `Payment of ₹${paymentApplied.toLocaleString("en-IN")} recorded for ${purchase.supplierName}. Status: ${newStatus === "Paid" ? "Payment Cleared" : `Payment Due: ₹${newRemainingDue}`}`,
        type: "success",
        category: "purchase",
        link: "purchase",
        metadata: {
          purchaseId: purchase._id,
          amountPaid: paymentApplied,
          remainingAmount: newRemainingDue,
          paymentStatus: newStatus,
        },
      });
    } catch (notifErr) {
      console.error("Purchase payment notification error:", notifErr.message);
    }

    return res.status(200).json({
      message: newStatus === "Paid" ? "Full payment received. Purchase payment cleared!" : "Payment recorded successfully.",
      purchase,
    });
  } catch (error) {
    console.error("RECORD PURCHASE PAYMENT ERROR:", error.message);
    return res.status(500).json({ message: error.message || "Failed to record purchase payment." });
  }
};

// ================= MARK PURCHASE AS PAID =================
export const markPurchaseAsPaid = async (req, res) => {
  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
    });

    if (!purchase) {
      return res.status(404).json({
        message: "Purchase record not found.",
      });
    }

    // If already paid, no update is required
    if (purchase.paymentStatus === "Paid" && Number(purchase.remainingAmount || 0) === 0) {
      return res.status(200).json({
        message: "Purchase payment is already fully cleared.",
        purchase,
      });
    }

    const previousRemainingAmount = Number(purchase.remainingAmount) > 0
      ? Number(purchase.remainingAmount)
      : Math.max(0, (Number(purchase.totalAmount) || 0) - (Number(purchase.amountPaid) || 0));

    // Update purchase payment details
    purchase.paymentStatus = "Paid";
    purchase.amountPaid = Number(purchase.totalAmount) || 0;
    purchase.remainingAmount = 0;

    if (!Array.isArray(purchase.payments)) {
      purchase.payments = [];
    }

    if (previousRemainingAmount > 0) {
      purchase.payments.push({
        amount: previousRemainingAmount,
        paymentMethod: purchase.paymentMethod || "Cash",
        paymentDate: new Date(),
        referenceNo: String(purchase.purchaseOrderNo || purchase.supplierInvoiceNo || "").trim(),
        notes: "Full payment settlement",
      });
    }

    await purchase.save();

    // Find the supplier
    let supplierDoc = null;

    if (purchase.supplierId) {
      supplierDoc = await Supplier.findOne({
        _id: purchase.supplierId,
        ownerId: req.user._id,
      });
    }

    if (!supplierDoc && purchase.supplierName) {
      supplierDoc = await Supplier.findOne({
        name: String(purchase.supplierName).trim(),
        ownerId: req.user._id,
      });
    }

    // Reduce supplier payable balance by the amount that was previously due
    if (supplierDoc && previousRemainingAmount > 0) {
      supplierDoc.balance = Math.max(
        0,
        (Number(supplierDoc.balance) || 0) - previousRemainingAmount
      );

      await supplierDoc.save();
    }

    // Create notification
    try {
      await createNotification({
        ownerId: req.user._id,
        userId: req.user.actualUserId || req.user._id,
        title: `Purchase Paid: #${
          purchase.supplierInvoiceNo ||
          purchase.purchaseOrderNo ||
          "Bill"
        }`,
        message: `Payment of ₹${Number(
          purchase.totalAmount || 0
        ).toLocaleString("en-IN")} to ${
          purchase.supplierName
        } has been fully cleared.`,
        type: "success",
        category: "purchase",
        link: "purchase",
        metadata: {
          purchaseId: purchase._id,
          totalAmount: purchase.totalAmount,
          supplierName: purchase.supplierName,
          paymentStatus: "Paid",
        },
      });
    } catch (notifErr) {
      console.error(
        "Purchase payment notification error:",
        notifErr.message
      );
    }

    return res.status(200).json({
      message: "Purchase marked as fully paid & cleared.",
      purchase,
    });
  } catch (error) {
    console.error("MARK PURCHASE AS PAID ERROR:", error.message);

    return res.status(500).json({
      message: error.message || "Failed to mark purchase as paid.",
    });
  }
};