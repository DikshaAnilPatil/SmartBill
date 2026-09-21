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
      eWayBillNo = "",
      taxType = "GST Regular",
      itcEligible = true,
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
        hsnCode: item.hsnCode ? String(item.hsnCode).trim() : "",
        batchNo: item.batchNo ? String(item.batchNo).trim() : "",
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        itcEligible: item.itcEligible !== false,
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
    let finalStatus = "Unpaid";

    if (paymentStatus === "Paid" || numPaid >= computedGrandTotal) {
      finalPaid = computedGrandTotal;
      finalRemaining = 0;
      finalStatus = "Paid";
    } else if (numPaid > 0) {
      finalPaid = numPaid;
      finalRemaining = Math.max(0, Math.round((computedGrandTotal - numPaid) * 100) / 100);
      finalStatus = finalRemaining === 0 ? "Paid" : "Partially Paid";
    } else {
      finalPaid = 0;
      finalRemaining = computedGrandTotal;
      finalStatus = "Unpaid";
    }

    const finalPaymentMethod = ["Paid", "Partially Paid"].includes(finalStatus) ? paymentMethod : "Cash";

    // Enforce Strict Negative Cash Rule
    if (finalPaid > 0 && finalPaymentMethod === "Cash") {
      const settings = await AccountingSettings.findOne({
        $or: [{ userId: ownerId }, { ownerId: ownerId }],
      }).lean();
      if (settings?.strictNegativeCash === true) {
        const cashBalance = await getCashBalance(ownerId);
        if (cashBalance - finalPaid < 0) {
          return res.status(400).json({ 
            message: `Strict Negative Cash Rule is enabled in your Accounting Settings. Your cash balance is ₹${cashBalance}, which is insufficient for this ₹${finalPaid} payment. You can disable this rule under Settings > Accounting or choose another payment method.`
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
      eWayBillNo: String(eWayBillNo).trim(),
      taxType: taxType || "GST Regular",
      itcEligible: itcEligible !== false,
      purchaseDate: new Date(purchaseDate),
      dueDate: dueDate ? new Date(dueDate) : null,
      items: validatedItems,
      subtotal: Math.round(calculatedSubtotal * 100) / 100,
      gstTotal: Math.round(calculatedGstTotal * 100) / 100,
      discountTotal: Math.round(calculatedDiscountTotal * 100) / 100,
      totalAmount: computedGrandTotal,
      paymentStatus: finalStatus,
      paymentMethod: finalPaymentMethod,
      amountPaid: finalPaid,
      remainingAmount: finalRemaining,
      payments: initialPayments,
      notes: String(notes).trim(),
      receiptUrl: req.body.receiptUrl ? String(req.body.receiptUrl) : "",
      receiptName: req.body.receiptName ? String(req.body.receiptName) : "",
      paymentHistory: initialPaymentHistory,
    });

    // 3. Inventory Integration: Atomically increment stock & update Weighted Average Cost (WAC)
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
        const currentStock = Math.max(0, Number(product.stock) || 0);
        const currentCost = Number(product.cost) || 0;
        const incomingQty = Number(item.quantity) || 0;
        const incomingRate = Number(item.purchaseRate) || 0;

        // Enterprise Weighted Average Costing (WAC) formula
        let newWeightedCost = incomingRate > 0 ? incomingRate : currentCost;
        if (currentStock + incomingQty > 0 && incomingRate > 0) {
          newWeightedCost = Math.round((((currentStock * currentCost) + (incomingQty * incomingRate)) / (currentStock + incomingQty)) * 100) / 100;
        }

        const updateFields = {
          $inc: { stock: incomingQty },
          $push: {
            stockHistory: {
              date: new Date(purchaseDate),
              type: "Purchase",
              quantity: incomingQty,
              previousStock: currentStock,
              newStock: currentStock + incomingQty,
              reason: `Purchase Inward Bill #${newPurchase.supplierInvoiceNo || newPurchase.purchaseOrderNo || "Bill"}`,
              referenceNo: newPurchase.supplierInvoiceNo || "",
              performedBy: req.user.name || "User",
            },
          },
          $set: {},
        };
        if (incomingRate > 0) {
          updateFields.$set.cost = newWeightedCost;
        }
        if (item.hsnCode) {
          updateFields.$set.hsnCode = item.hsnCode;
        }
        if (item.batchNo) {
          updateFields.$set.batchNo = item.batchNo;
        }
        if (item.expiryDate) {
          updateFields.$set.expiryDate = item.expiryDate;
        }

        if (Object.keys(updateFields.$set).length === 0) {
          delete updateFields.$set;
        }

        await Product.findByIdAndUpdate(product._id, updateFields);
      } else {
        // Auto-create product in inventory with provided procurement metadata
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
          hsnCode: item.hsnCode || "",
          batchNo: item.batchNo || "",
          expiryDate: item.expiryDate || null,
          status: "Active",
          stockHistory: [
            {
              date: new Date(purchaseDate),
              type: "Purchase",
              quantity: Number(item.quantity) || 0,
              previousStock: 0,
              newStock: Number(item.quantity) || 0,
              reason: `Initial Inward Bill #${newPurchase.supplierInvoiceNo || "Bill"}`,
              referenceNo: newPurchase.supplierInvoiceNo || "",
              performedBy: req.user.name || "User",
            },
          ],
        });
      }
    }

    // 4. Supplier Balance Integration: Atomically update supplier totals & balance
    const supplierUpdate = {
      $inc: {
        totalPurchases: computedGrandTotal,
        totalPaid: finalPaid,
        balance: finalRemaining,
      },
    };
    if (finalPaid > 0) {
      supplierUpdate.$push = {
        paymentHistory: {
          amount: finalPaid,
          paymentMethod: finalPaymentMethod,
          date: new Date(purchaseDate),
          referenceNo: "",
          notes: `Payment for Purchase #${newPurchase.supplierInvoiceNo || newPurchase._id}`,
          purchaseBillNo: newPurchase.supplierInvoiceNo || "",
        },
      };
    }

    if (supplierId && mongoose.isValidObjectId(supplierId)) {
      await Supplier.findByIdAndUpdate(supplierId, supplierUpdate);
    } else if (supplierName) {
      await Supplier.findOneAndUpdate(
        { name: String(supplierName).trim(), ownerId },
        supplierUpdate
      );
    }

    try {
      await createNotification({
        ownerId,
        userId: actualUserId,
        title: `Purchase Recorded: #${newPurchase.supplierInvoiceNo || newPurchase.purchaseOrderNo || "Bill"}`,
        message: `Purchase of ₹${computedGrandTotal.toLocaleString("en-IN")} from ${supplierName} recorded (${finalStatus === "Paid" ? "Payment Cleared" : `Payment Due: ₹${finalRemaining}`}).`,
        type: "info",
        category: "purchase",
        link: "purchase",
        metadata: {
          purchaseId: newPurchase._id,
          totalAmount: computedGrandTotal,
          supplierName,
          paymentStatus: finalStatus,
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
 * Record payment (partial or full) for a purchase
 */
export const recordPurchasePayment = async (req, res) => {
  return markPurchaseAsPaid(req, res);
};

/**
 * Mark Purchase as Paid / Record Supplier Payment
 */
export const markPurchaseAsPaid = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const actualUserId = req.user.actualUserId || req.user._id;
    const purchase = await Purchase.findOne({ _id: req.params.id, ownerId });
    if (!purchase) {
      return res.status(404).json({ message: "Purchase record not found." });
    }

    const {
      amount,
      amountPaid,
      paymentMethod = "Cash",
      referenceNo = "",
      paymentDate,
      notes = "",
      receiptUrl,
      receiptName,
    } = req.body;

    const currentDue =
      Number(purchase.remainingAmount) > 0
        ? Number(purchase.remainingAmount)
        : Math.max(
            0,
            (Number(purchase.totalAmount) || 0) - (Number(purchase.amountPaid) || 0)
          );

    const inputAmount = Number(amountPaid || amount);
    const payAmount = inputAmount > 0 ? inputAmount : currentDue;

    if (payAmount <= 0 && purchase.paymentStatus === "Paid") {
      return res.status(200).json({
        message: "Purchase payment is already fully cleared.",
        purchase,
      });
    }

    if (payAmount <= 0) {
      return res
        .status(400)
        .json({ message: "Payment amount must be greater than zero." });
    }

    const paymentApplied = Math.min(payAmount, currentDue > 0 ? currentDue : payAmount);

    // Enforce Strict Negative Cash Rule
    if (paymentMethod === "Cash") {
      const settings = await AccountingSettings.findOne({
        $or: [{ userId: ownerId }, { ownerId: ownerId }],
      }).lean();
      if (settings?.strictNegativeCash === true) {
        const cashBalance = await getCashBalance(ownerId);
        if (cashBalance - paymentApplied < 0) {
          return res.status(400).json({
            message: `Strict Negative Cash Rule is enabled in your Accounting Settings. Your cash balance is ₹${cashBalance}, which is insufficient for this ₹${paymentApplied} payment. You can disable this rule under Settings > Accounting or choose another payment method.`,
          });
        }
      }
    }

    const newPaidTotal = (Number(purchase.amountPaid) || 0) + paymentApplied;
    const newRemaining = Math.max(0, (Number(purchase.totalAmount) || 0) - newPaidTotal);
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
      amount: paymentApplied,
      paymentMethod,
      date: paymentDate ? new Date(paymentDate) : new Date(),
      referenceNo: String(referenceNo || "").trim(),
      notes: String(notes || "").trim(),
    });

    if (!Array.isArray(purchase.payments)) {
      purchase.payments = [];
    }
    purchase.payments.push({
      amount: paymentApplied,
      paymentMethod,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      referenceNo: String(referenceNo || purchase.purchaseOrderNo || purchase.supplierInvoiceNo || "").trim(),
      notes: notes || "Supplier payment",
    });

    await purchase.save();

    // Adjust supplier balance & totalPaid
    const supplierUpdate = {
      $inc: {
        totalPaid: paymentApplied,
        balance: -paymentApplied,
      },
      $push: {
        paymentHistory: {
          amount: paymentApplied,
          paymentMethod,
          date: paymentDate ? new Date(paymentDate) : new Date(),
          referenceNo: String(referenceNo || "").trim(),
          notes: notes || `Payment for Bill #${purchase.supplierInvoiceNo || purchase._id}`,
          purchaseBillNo: purchase.supplierInvoiceNo || "",
        },
      },
    };

    if (purchase.supplierId && mongoose.isValidObjectId(purchase.supplierId)) {
      await Supplier.findByIdAndUpdate(purchase.supplierId, supplierUpdate);
    } else if (purchase.supplierName) {
      await Supplier.findOneAndUpdate(
        { name: purchase.supplierName, ownerId },
        supplierUpdate
      );
    }

    // Create Notification
    try {
      await createNotification({
        ownerId,
        userId: actualUserId,
        title: `Payment Recorded: #${purchase.supplierInvoiceNo || purchase.purchaseOrderNo || "Bill"}`,
        message: `Payment of ₹${paymentApplied.toLocaleString("en-IN")} recorded for ${purchase.supplierName}. Status: ${newStatus === "Paid" ? "Payment Cleared" : `Payment Due: ₹${newRemaining}`}`,
        type: "success",
        category: "purchase",
        link: "purchase",
        metadata: {
          purchaseId: purchase._id,
          amountPaid: paymentApplied,
          remainingAmount: newRemaining,
          paymentStatus: newStatus,
        },
      });
    } catch (notifErr) {
      console.error("Purchase payment notification error:", notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Payment of ₹${paymentApplied.toLocaleString("en-IN")} recorded. Status: ${newStatus}.`,
      purchase,
    });
  } catch (err) {
    console.error("RECORD PURCHASE PAYMENT ERROR:", err.message);
    return res.status(500).json({ message: err.message || "Failed to record payment." });
  }
};

/**
 * Purchase Return / Debit Note
 */
export const createPurchaseReturn = async (req, res) => {
  const ownerId = req.user.ownerId || req.user._id;
  const actualUserId = req.user.actualUserId || req.user._id;

  try {
    const purchase = await Purchase.findOne({ _id: req.params.id, ownerId });
    if (!purchase) {
      return res.status(404).json({ message: "Purchase record not found." });
    }

    const {
      returnedItems = [],
      refundAmount = 0,
      refundMode = "Credit", // "Credit" (reduces payable balance), "Cash", "Bank"
      reason = "Goods Defective / Damaged",
      returnDate = new Date(),
    } = req.body;

    if (!Array.isArray(returnedItems) || returnedItems.length === 0) {
      return res.status(400).json({ message: "At least one item must be specified for return." });
    }

    let calculatedReturnTotal = 0;
    const validatedReturnedItems = [];

    for (const retItem of returnedItems) {
      const retQty = Number(retItem.qty ?? retItem.quantity);
      if (!Number.isFinite(retQty) || retQty <= 0) {
        return res.status(400).json({ message: `Invalid return quantity for ${retItem.productName || "item"}.` });
      }

      // Check original item in purchase
      const originalItem = purchase.items.find(
        (i) => (retItem.productId && String(i.productId) === String(retItem.productId)) ||
               (retItem.productName && i.productName.toLowerCase() === String(retItem.productName).toLowerCase())
      );

      if (!originalItem) {
        return res.status(400).json({
          message: `Product "${retItem.productName}" was not found in purchase bill.`,
        });
      }

      const itemRate = Number(originalItem.purchaseRate) || 0;
      const itemGstRate = Number(originalItem.gstRate) || 0;
      const lineTaxable = itemRate * retQty;
      const lineGst = (lineTaxable * itemGstRate) / 100;
      const lineReturnTotal = Math.round((lineTaxable + lineGst) * 100) / 100;

      calculatedReturnTotal += lineReturnTotal;

      validatedReturnedItems.push({
        productId: originalItem.productId,
        productName: originalItem.productName,
        quantity: retQty,
        unit: originalItem.unit,
        purchaseRate: itemRate,
        gstRate: itemGstRate,
        gstAmount: lineGst,
        discount: 0,
        itemAmount: lineReturnTotal,
        hsnCode: originalItem.hsnCode,
        batchNo: originalItem.batchNo,
        expiryDate: originalItem.expiryDate,
        itcEligible: originalItem.itcEligible,
      });

      // Deduct product stock in inventory
      if (originalItem.productId && mongoose.isValidObjectId(originalItem.productId)) {
        const prod = await Product.findById(originalItem.productId);
        if (prod) {
          const prevStock = Number(prod.stock || 0);
          const newStock = Math.max(0, prevStock - retQty);
          await Product.findByIdAndUpdate(originalItem.productId, {
            $inc: { stock: -retQty },
            $push: {
              stockHistory: {
                date: new Date(returnDate),
                type: "Purchase Return",
                quantity: -retQty,
                previousStock: prevStock,
                newStock,
                reason: `Purchase Return to ${purchase.supplierName}: ${reason}`,
                referenceNo: purchase.supplierInvoiceNo || "",
                performedBy: req.user.name || "User",
              },
            },
          });
        }
      }
    }

    const finalDebitAmount = Math.min(
      calculatedReturnTotal,
      Number(refundAmount) > 0 ? Number(refundAmount) : calculatedReturnTotal
    );

    const debitNoteNo = `DN-${purchase.supplierInvoiceNo || purchase._id.toString().slice(-6)}-${(purchase.purchaseReturns?.length || 0) + 1}`;

    if (!Array.isArray(purchase.purchaseReturns)) {
      purchase.purchaseReturns = [];
    }

    purchase.purchaseReturns.push({
      returnNo: debitNoteNo,
      returnDate: new Date(returnDate),
      reason,
      refundAmount: finalDebitAmount,
      paymentMode: refundMode,
      items: validatedReturnedItems,
    });

    purchase.returnStatus = "Partial";
    await purchase.save();

    // Adjust supplier balance (payable decrease)
    if (refundMode === "Credit") {
      const supplierUpdate = {
        $inc: {
          totalPurchases: -finalDebitAmount,
          balance: -finalDebitAmount,
        },
        $push: {
          paymentHistory: {
            amount: finalDebitAmount,
            paymentMethod: "Debit Note",
            date: new Date(returnDate),
            referenceNo: debitNoteNo,
            notes: `Debit Note #${debitNoteNo} for Purchase Return against Bill #${purchase.supplierInvoiceNo || ""}`,
            purchaseBillNo: purchase.supplierInvoiceNo || "",
          },
        },
      };

      if (purchase.supplierId && mongoose.isValidObjectId(purchase.supplierId)) {
        await Supplier.findByIdAndUpdate(purchase.supplierId, supplierUpdate);
      } else if (purchase.supplierName) {
        await Supplier.findOneAndUpdate(
          { name: purchase.supplierName, ownerId },
          supplierUpdate
        );
      }
    }

    try {
      await createNotification({
        ownerId,
        userId: actualUserId,
        title: `Debit Note Created: ${debitNoteNo}`,
        message: `Debit note ${debitNoteNo} for ₹${finalDebitAmount.toLocaleString("en-IN")} issued to ${purchase.supplierName}.`,
        type: "warning",
        category: "purchase",
        link: "purchase",
        metadata: { purchaseId: purchase._id, debitNoteNo, refundAmount: finalDebitAmount },
      });
    } catch (notifErr) {
      console.error("Debit note notification error:", notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Debit note issued successfully. Reference: ${debitNoteNo}`,
      debitNoteNo,
      refundAmount: finalDebitAmount,
      purchase,
    });
  } catch (error) {
    console.error("CREATE PURCHASE RETURN ERROR:", error.message);
    return res.status(500).json({ message: error.message || "Failed to issue debit note." });
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
          if (item.productId && mongoose.isValidObjectId(item.productId)) {
            await Product.findByIdAndUpdate(item.productId, {
              $inc: { stock: -qty },
              $push: {
                stockHistory: {
                  date: new Date(),
                  type: "Stock Adjustment",
                  quantity: -qty,
                  reason: `Cancelled Purchase Bill #${purchase.supplierInvoiceNo || purchase._id}`,
                  performedBy: req.user.name || "User",
                },
              },
            });
          } else if (item.productName) {
            await Product.findOneAndUpdate(
              { name: item.productName, ownerId },
              {
                $inc: { stock: -qty },
                $push: {
                  stockHistory: {
                    date: new Date(),
                    type: "Stock Adjustment",
                    quantity: -qty,
                    reason: `Cancelled Purchase Bill #${purchase.supplierInvoiceNo || purchase._id}`,
                    performedBy: req.user.name || "User",
                  },
                },
              }
            );
          }
        }
      }
    }

    // Revert supplier balance & totalPurchases & totalPaid
    const totalAmount = Number(purchase.totalAmount) || 0;
    const amountPaid = Number(purchase.amountPaid) || 0;
    const remainingDue = Number(purchase.remainingAmount) || 0;

    const supplierUpdate = {
      $inc: {
        totalPurchases: -totalAmount,
        totalPaid: -amountPaid,
        balance: -remainingDue,
      },
    };

    if (purchase.supplierId && mongoose.isValidObjectId(purchase.supplierId)) {
      await Supplier.findByIdAndUpdate(purchase.supplierId, supplierUpdate);
    } else if (purchase.supplierName) {
      await Supplier.findOneAndUpdate(
        { name: purchase.supplierName, ownerId },
        supplierUpdate
      );
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