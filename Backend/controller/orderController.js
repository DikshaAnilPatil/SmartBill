import Order from "../models/Order.js";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";
import InvoiceSettings from "../models/InvoiceSettings.js";
import TransactionSettings from "../models/TransactionSettings.js";
import AccountingSettings from "../models/AccountingSettings.js";
import mongoose from "mongoose";
import { createNotification } from "../services/notificationService.js";
import { sendInvoiceEmail } from "../utils/emailService.js";

// ================= HELPERS =================
const generateInvoiceNo = async (ownerId) => {
  let settings = await InvoiceSettings.findOne({ userId: ownerId });

  let prefix = "INV";
  let startingNumber = 1;
  let financialYearWise = true;

  if (settings) {
    prefix = settings.invoicePrefix || "INV";
    startingNumber = settings.startingNumber != null ? settings.startingNumber : 1;
    if (settings.financialYearWise !== undefined) {
      financialYearWise = settings.financialYearWise;
    }
  }

  let yearStr = "";
  if (financialYearWise) {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed (April is 3)
    let startYear, endYear;
    if (currentMonth >= 3) {
      startYear = currentYear;
      endYear = currentYear + 1;
    } else {
      startYear = currentYear - 1;
      endYear = currentYear;
    }
    yearStr = `/${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
  }

  const totalCount = await Order.countDocuments();
  const ownerCount = await Order.countDocuments({ ownerId });
  let candidate = Math.max(totalCount + 1, ownerCount + startingNumber);
  let invoiceNo = `${prefix}${yearStr}-${String(candidate).padStart(4, "0")}`;

  // Guard against collision with any existing invoice across the database
  for (let attempt = 0; attempt < 100; attempt++) {
    const existing = await Order.exists({ invoiceNo });
    if (!existing) return invoiceNo;
    candidate += 1;
    invoiceNo = `${prefix}${yearStr}-${String(candidate).padStart(4, "0")}`;
  }

  return `${prefix}${yearStr}-${Date.now()}`;
};

// ================= CREATE ORDER =================
export const createOrder = async (req, res) => {
  const effectiveOwnerId = req.user.ownerId || req.user._id;
  const actualUserId = req.user.actualUserId || req.user._id;

  let session = null;
  let useTransaction = true;

  try {
    session = await Order.startSession();
    session.startTransaction();
  } catch (err) {
    session = null;
    useTransaction = false;
  }

  const decrementedItems = []; // Track stock changes for rollback in non-replica set mode

  const rollbackStock = async () => {
    for (const item of decrementedItems) {
      try {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: item.quantity },
        });
      } catch (rollbackErr) {
        console.error("Stock rollback error for product", item.productId, rollbackErr.message);
      }
    }
  };

  const abortSession = async () => {
    if (session && useTransaction) {
      try {
        await session.abortTransaction();
      } catch (e) {}
      session.endSession();
    } else {
      await rollbackStock();
    }
  };

  const commitSession = async () => {
    if (session && useTransaction) {
      await session.commitTransaction();
      session.endSession();
    }
  };

  try {
    const {
      customerId = null,
      customerName = "Walk-in Customer",
      customerPhone = "",
      customerGst = "",
      placeOfSupply = "",
      taxType = "Intra-State",
      items = [],
      cashDiscount = 0,
      amountPaid = 0,
      paymentMode = "Cash",
      splitPayments = [],
      notes = "",
      terms = "",
      date = new Date(),
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      await abortSession();
      return res.status(400).json({ message: "Order must contain at least one item." });
    }

    // Load business settings for transaction & accounting limits
    const [txSettings, accountingSettings] = await Promise.all([
      TransactionSettings.findOne({ userId: effectiveOwnerId }).lean(),
      AccountingSettings.findOne({ userId: effectiveOwnerId }).lean(),
    ]);

    const trackCogs = accountingSettings?.trackCogs === true;
    const allowNegativeStock = txSettings?.allowNegativeStock === true;
    const allowDiscount = txSettings?.allowDiscount !== false;
    const maxDiscountPercent = Number.isFinite(Number(txSettings?.maximumDiscount))
      ? Number(txSettings.maximumDiscount)
      : 100;

    const processedItems = [];
    let computedSubtotal = 0;
    let computedTotalDiscount = 0;
    let computedTotalGst = 0;
    let calculatedTotalCogs = 0;

    const queryOptions = session ? { session } : {};

    // ─────────────────────────────────────────────────────────────────
    // Authoritative Server-Side Item Resolution & Calculations
    // ─────────────────────────────────────────────────────────────────
    for (const rawItem of items) {
      const quantity = Number(rawItem.qty ?? rawItem.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        await abortSession();
        return res.status(400).json({
          message: `Invalid quantity for item "${rawItem.name || "Product"}". Quantity must be a positive number.`,
        });
      }

      // Build product identifiers scoped to current tenant
      const productIdentifiers = [];
      if (rawItem.productId && mongoose.isValidObjectId(rawItem.productId)) {
        productIdentifiers.push({ _id: rawItem.productId });
      }
      if (rawItem.sku && String(rawItem.sku).trim()) {
        const cleanSku = String(rawItem.sku).trim();
        productIdentifiers.push({
          sku: new RegExp(`^${cleanSku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
        });
      }
      if (rawItem.name && String(rawItem.name).trim()) {
        const cleanName = String(rawItem.name).trim();
        productIdentifiers.push({
          name: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
        });
      }

      const ownershipFilter = {
        $or: [{ userId: effectiveOwnerId }, { ownerId: effectiveOwnerId }],
      };

      let product = null;
      if (productIdentifiers.length > 0) {
        product = await Product.findOne(
          { $and: [ownershipFilter, { $or: productIdentifiers }] },
          null,
          queryOptions
        );
      }

      let unitPrice = 0;
      let unitCost = 0;
      let itemGstRate = 0;
      let itemName = rawItem.name || "Product";
      let itemSku = rawItem.sku || "";
      let itemHsn = rawItem.hsnCode || "";
      let itemUnit = rawItem.unit || "Piece";
      let itemBatch = rawItem.batchNo || "";

      if (product) {
        // Authoritative pricing from database
        unitPrice = Number(product.price) || 0;
        unitCost = Number(product.cost) || 0;
        itemGstRate = Number(product.gst) || 0;
        itemName = product.name;
        itemSku = product.sku;
        itemHsn = product.hsnCode || itemHsn;
        itemUnit = product.unit || itemUnit;
        itemBatch = product.batchNo || itemBatch;

        // Atomic inventory reduction
        const prevStock = Number(product.stock || 0);
        const newStock = prevStock - quantity;

        if (!allowNegativeStock) {
          const updatedProduct = await Product.findOneAndUpdate(
            { _id: product._id, stock: { $gte: quantity } },
            { 
              $inc: { stock: -quantity },
              $push: {
                stockHistory: {
                  date: new Date(),
                  type: "Sale",
                  quantity: -quantity,
                  previousStock: prevStock,
                  newStock,
                  reason: `Sale on Invoice`,
                  performedBy: req.user.name || "User",
                }
              }
            },
            { new: true, ...queryOptions }
          );

          if (!updatedProduct) {
            await abortSession();
            return res.status(400).json({
              message: `Insufficient stock for "${product.name}". Available: ${product.stock || 0}, Requested: ${quantity}.`,
            });
          }
        } else {
          await Product.findOneAndUpdate(
            { _id: product._id },
            { 
              $inc: { stock: -quantity },
              $push: {
                stockHistory: {
                  date: new Date(),
                  type: "Sale",
                  quantity: -quantity,
                  previousStock: prevStock,
                  newStock,
                  reason: `Sale on Invoice`,
                  performedBy: req.user.name || "User",
                }
              }
            },
            { new: true, ...queryOptions }
          );
        }
        decrementedItems.push({ productId: product._id, quantity });
      } else {
        // Auto-create product for custom/POS items without falsifying cost data
        unitPrice = Math.max(0, Number(rawItem.price) || 0);
        unitCost = Number(rawItem.cost) != null && !isNaN(Number(rawItem.cost))
          ? Math.max(0, Number(rawItem.cost))
          : 0;
        itemGstRate = Math.max(0, Number(rawItem.gstRate || rawItem.gst) || 0);
        itemSku = rawItem.sku && String(rawItem.sku).trim()
          ? String(rawItem.sku).trim().toUpperCase()
          : `SKU-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

        const initialStock = allowNegativeStock ? -quantity : 0;

        try {
          const createdDocs = await Product.create(
            [
              {
                userId: actualUserId,
                ownerId: effectiveOwnerId,
                name: itemName,
                sku: itemSku,
                category: rawItem.category || "General",
                supplier: rawItem.supplier || "",
                cost: unitCost,
                price: unitPrice,
                gst: itemGstRate,
                stock: initialStock,
                minStock: 10,
                unit: itemUnit,
                hsnCode: itemHsn,
                batchNo: itemBatch,
                status: "Active",
                stockHistory: [
                  {
                    date: new Date(),
                    type: "Sale",
                    quantity: -quantity,
                    previousStock: 0,
                    newStock: initialStock,
                    reason: `Initial Sale Auto-Created Product`,
                    performedBy: req.user.name || "User",
                  },
                ],
              },
            ],
            queryOptions
          );
          product = createdDocs[0];
          decrementedItems.push({ productId: product._id, quantity });
        } catch (createErr) {
          product = await Product.findOne(
            { ownerId: effectiveOwnerId, sku: itemSku },
            null,
            queryOptions
          );
        }
      }

      // Validate & compute item discount
      let itemDiscountPercent = Math.max(0, Number(rawItem.discount) || 0);
      if (!allowDiscount && itemDiscountPercent > 0) {
        await abortSession();
        return res.status(400).json({ message: "Discounts are disabled in Transaction Settings." });
      }
      if (itemDiscountPercent > maxDiscountPercent) {
        await abortSession();
        return res.status(400).json({
          message: `Discount of ${itemDiscountPercent}% on "${itemName}" exceeds maximum allowed limit of ${maxDiscountPercent}%.`,
        });
      }

      // Server-side authoritative line item arithmetic
      const lineBase = Math.round(unitPrice * quantity * 100) / 100;
      const lineDiscountAmount = Math.round(((lineBase * itemDiscountPercent) / 100) * 100) / 100;
      const lineTaxable = Math.max(0, lineBase - lineDiscountAmount);
      const lineGstAmount = Math.round(((lineTaxable * itemGstRate) / 100) * 100) / 100;
      const lineTotal = Math.round((lineTaxable + lineGstAmount) * 100) / 100;

      computedSubtotal += lineBase;
      computedTotalDiscount += lineDiscountAmount;
      computedTotalGst += lineGstAmount;

      if (trackCogs) {
        calculatedTotalCogs += unitCost * quantity;
      }

      processedItems.push({
        productId: product ? product._id : null,
        name: itemName,
        sku: itemSku,
        hsnCode: itemHsn,
        unit: itemUnit,
        batchNo: itemBatch,
        price: unitPrice,
        cost: unitCost,
        qty: quantity,
        discount: itemDiscountPercent,
        gstRate: itemGstRate,
        gst: lineGstAmount,
        amount: lineTotal,
      });
    }

    // Additional cash/order-level discount validation
    const validCashDiscount = Math.max(0, Number(cashDiscount) || 0);
    if (!allowDiscount && validCashDiscount > 0) {
      await abortSession();
      return res.status(400).json({ message: "Discounts are disabled in Transaction Settings." });
    }
    if (validCashDiscount > computedSubtotal) {
      await abortSession();
      return res.status(400).json({ message: "Cash discount cannot exceed the order subtotal." });
    }

    computedTotalDiscount += validCashDiscount;

    // Server-side authoritative grand total
    const authoritativeTotal = Math.max(
      0,
      Math.round((computedSubtotal - computedTotalDiscount + computedTotalGst) * 100) / 100
    );

    const paid = Math.max(0, Number(amountPaid) || 0);
    const balanceDue = Math.max(0, Math.round((authoritativeTotal - paid) * 100) / 100);
    const status = paid <= 0 ? "Due" : paid >= authoritativeTotal ? "Paid" : "Partial";

    // GST Breakdown based on Place of Supply
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (taxType === "Inter-State") {
      igstAmount = Math.round(computedTotalGst * 100) / 100;
    } else {
      cgstAmount = Math.round((computedTotalGst / 2) * 100) / 100;
      sgstAmount = Math.round((computedTotalGst - cgstAmount) * 100) / 100;
    }

    // Generate collision-safe invoice number
    const invoiceNo = await generateInvoiceNo(effectiveOwnerId);

    const initialPaymentHistory = paid > 0 ? [
      {
        amount: paid,
        paymentMode: paymentMode || "Cash",
        date: new Date(date),
        referenceNo: "",
        notes: "Initial payment on invoice creation",
      }
    ] : [];

    // Create Order in MongoDB
    const orderDocs = await Order.create(
      [
        {
          ownerId: effectiveOwnerId,
          customerId: customerId && mongoose.isValidObjectId(customerId) ? customerId : null,
          customerName: customerName || "Walk-in Customer",
          customerPhone: String(customerPhone || "").trim(),
          customerGst: String(customerGst || "").trim(),
          placeOfSupply: String(placeOfSupply || "").trim(),
          taxType: taxType === "Inter-State" ? "Inter-State" : "Intra-State",
          invoiceNo,
          items: processedItems,
          subtotal: Math.round(computedSubtotal * 100) / 100,
          gstRate: processedItems.length === 1 ? processedItems[0].gstRate : 0,
          gst: Math.round(computedTotalGst * 100) / 100,
          cgst: cgstAmount,
          sgst: sgstAmount,
          igst: igstAmount,
          discount: Math.round(computedTotalDiscount * 100) / 100,
          cashDiscount: validCashDiscount,
          totalOrderValue: authoritativeTotal,
          amountPaid: paid,
          balanceDue,
          paymentMode: paymentMode || "Cash",
          splitPayments: Array.isArray(splitPayments) ? splitPayments : [],
          paymentHistory: initialPaymentHistory,
          status,
          notes: String(notes || "").trim(),
          terms: String(terms || "").trim(),
          date: new Date(date),
          totalCogs: trackCogs ? calculatedTotalCogs : 0,
        },
      ],
      queryOptions
    );

    const newOrder = orderDocs[0];

    // ─────────────────────────────────────────────────────────────────
    // Atomic Customer Balance Update
    // ─────────────────────────────────────────────────────────────────
    let targetCustomer = null;
    if (customerId && mongoose.isValidObjectId(customerId)) {
      targetCustomer = await Customer.findOne(
        { _id: customerId, ownerId: effectiveOwnerId },
        null,
        queryOptions
      );
    } else if (customerName && customerName !== "Walk-in Customer") {
      const cleanCustomerName = String(customerName).trim();
      targetCustomer = await Customer.findOne(
        {
          ownerId: effectiveOwnerId,
          name: new RegExp(`^${cleanCustomerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
        },
        null,
        queryOptions
      );
    }

    if (targetCustomer) {
      const balanceChange = authoritativeTotal - paid;
      const custUpdate = {
        $inc: {
          totalOrderValue: authoritativeTotal,
          totalPaid: paid,
          invoices: 1,
          balance: balanceChange,
        },
      };

      if (paid > 0) {
        custUpdate.$push = {
          paymentHistory: {
            amount: paid,
            paymentMode: paymentMode || "Cash",
            date: new Date(date),
            referenceNo: "",
            notes: `Payment for Invoice #${invoiceNo}`,
            invoiceNo,
          },
        };
      }

      await Customer.findByIdAndUpdate(
        targetCustomer._id,
        custUpdate,
        queryOptions
      );

      if (!newOrder.customerId) {
        newOrder.customerId = targetCustomer._id;
        await newOrder.save(queryOptions);
      }
    }

    await commitSession();

    // Trigger Real-Time Notification & Alerts
    try {
      await createNotification({
        ownerId: effectiveOwnerId,
        userId: actualUserId,
        title: `New Sale: ${newOrder.invoiceNo}`,
        message: `Sale invoice ${newOrder.invoiceNo} for ₹${authoritativeTotal.toLocaleString("en-IN")} generated for ${customerName} (${paymentMode}).`,
        type: "success",
        category: "sale",
        link: "pos",
        metadata: {
          orderId: newOrder._id,
          invoiceNo: newOrder.invoiceNo,
          total: authoritativeTotal,
          amountPaid: paid,
          customerName,
          status,
        },
      });

      // Stock threshold alerts
      for (const item of processedItems) {
        if (item.productId && mongoose.isValidObjectId(item.productId)) {
          const updatedProd = await Product.findById(item.productId).lean();
          if (updatedProd) {
            const stock = Number(updatedProd.stock || 0);
            const minStock = Number(updatedProd.minStock ?? 10);
            if (stock <= 0) {
              await createNotification({
                ownerId: effectiveOwnerId,
                title: `Out of Stock: ${updatedProd.name}`,
                message: `${updatedProd.name} is now out of stock following invoice ${newOrder.invoiceNo}.`,
                type: "error",
                category: "stock",
                link: "inventory",
                metadata: { productId: updatedProd._id, stock: 0 },
              });
            } else if (stock <= minStock) {
              await createNotification({
                ownerId: effectiveOwnerId,
                title: `Low Stock: ${updatedProd.name}`,
                message: `${updatedProd.name} is down to ${stock} ${updatedProd.unit || "units"} (Minimum: ${minStock}).`,
                type: "warning",
                category: "stock",
                link: "inventory",
                metadata: { productId: updatedProd._id, stock },
              });
            }
          }
        }
      }
    } catch (notifErr) {
      console.error("Order notification creation error:", notifErr.message);
    }

    // Dispatch Invoice Email asynchronously
    try {
      const recipientEmail = targetCustomer?.email || req.user?.email;
      if (recipientEmail) {
        sendInvoiceEmail({
          toEmail: recipientEmail,
          invoiceNo: newOrder.invoiceNo,
          amount: `₹${authoritativeTotal.toLocaleString("en-IN")}`,
          userName: customerName,
          businessName: req.user.businessName || "Smart Bill",
        }).catch((err) => console.error("Invoice email trigger error:", err.message));
      }
    } catch (invErr) {
      console.error("Invoice email dispatch error:", invErr.message);
    }

    return res.status(201).json({
      message: "Order created successfully.",
      order: newOrder,
    });
  } catch (error) {
    await abortSession();
    console.error("CREATE ORDER ERROR:", error.message);
    return res.status(500).json({
      message: error.message || "Failed to create order.",
    });
  }
};

// ================= LIST ORDERS WITH PAGINATION =================
export const getOrders = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const {
      page,
      limit,
      search,
      status,
      customerId,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = { ownerId };

    if (status && status !== "All") {
      query.status = status;
    }

    if (customerId && mongoose.isValidObjectId(customerId)) {
      query.customerId = customerId;
    }

    if (search && String(search).trim()) {
      const cleanSearch = String(search).trim();
      const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { invoiceNo: new RegExp(escaped, "i") },
        { customerName: new RegExp(escaped, "i") },
        { customerPhone: new RegExp(escaped, "i") },
      ];
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const sortOption = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
    };

    // If explicit pagination requested
    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const [orders, total] = await Promise.all([
        Order.find(query).sort(sortOption).skip(skip).limit(limitNum).lean(),
        Order.countDocuments(query),
      ]);

      return res.status(200).json({
        message: "OK",
        orders,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }

    const orders = await Order.find(query).sort(sortOption).lean();
    return res.status(200).json({
      message: "OK",
      orders,
      pagination: {
        total: orders.length,
        page: 1,
        limit: orders.length,
        totalPages: 1,
      },
    });
  } catch (error) {
    console.error("GET ORDERS ERROR:", error.message);
    return res.status(500).json({ message: "Failed to fetch orders." });
  }
};

// ================= GET SINGLE ORDER =================
export const getOrder = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const order = await Order.findOne({
      _id: req.params.id,
      ownerId,
    }).lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    return res.status(200).json({ message: "OK", order });
  } catch (error) {
    console.error("GET ORDER ERROR:", error.message);
    return res.status(500).json({ message: "Failed to fetch order." });
  }
};

// ================= RECORD PAYMENT ON ORDER (INVOICE SETTLEMENT) =================
export const recordOrderPayment = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const order = await Order.findOne({ _id: req.params.id, ownerId });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.status === "Cancelled") {
      return res.status(400).json({ message: "Cannot record payment on a cancelled order." });
    }

    const { amount, paymentMode = "Cash", referenceNo = "", notes = "", date = new Date() } = req.body;
    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ message: "Payment amount must be a positive number." });
    }

    if (paymentAmount > order.balanceDue) {
      return res.status(400).json({
        message: `Payment amount (₹${paymentAmount}) exceeds balance due (₹${order.balanceDue}).`,
      });
    }

    const newAmountPaid = Math.round((order.amountPaid + paymentAmount) * 100) / 100;
    const newBalanceDue = Math.max(0, Math.round((order.totalOrderValue - newAmountPaid) * 100) / 100);
    const newStatus = newBalanceDue === 0 ? "Paid" : "Partial";

    if (!Array.isArray(order.paymentHistory)) {
      order.paymentHistory = [];
    }

    order.paymentHistory.push({
      amount: paymentAmount,
      paymentMode,
      date: new Date(date),
      referenceNo: String(referenceNo || "").trim(),
      notes: String(notes || "").trim(),
    });

    order.amountPaid = newAmountPaid;
    order.balanceDue = newBalanceDue;
    order.status = newStatus;

    await order.save();

    // Settle customer ledger balance
    if (order.customerId && mongoose.isValidObjectId(order.customerId)) {
      await Customer.findByIdAndUpdate(order.customerId, {
        $inc: {
          totalPaid: paymentAmount,
          balance: -paymentAmount,
        },
        $push: {
          paymentHistory: {
            amount: paymentAmount,
            paymentMode,
            date: new Date(date),
            referenceNo: String(referenceNo || "").trim(),
            notes: notes || `Payment against Invoice #${order.invoiceNo}`,
            invoiceNo: order.invoiceNo,
          },
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: `Payment of ₹${paymentAmount.toLocaleString("en-IN")} recorded successfully.`,
      order,
    });
  } catch (error) {
    console.error("RECORD ORDER PAYMENT ERROR:", error.message);
    return res.status(500).json({ message: error.message || "Failed to record payment." });
  }
};

// ================= SALES RETURN / CREDIT NOTE =================
export const createSalesReturn = async (req, res) => {
  const ownerId = req.user.ownerId || req.user._id;
  const actualUserId = req.user.actualUserId || req.user._id;

  try {
    const order = await Order.findOne({ _id: req.params.id, ownerId });
    if (!order) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    if (order.status === "Cancelled") {
      return res.status(400).json({ message: "Cannot process return on a cancelled invoice." });
    }

    const {
      returnedItems = [],
      refundAmount = 0,
      refundMode = "Credit", // "Credit" (adjusts customer balance), "Cash", "Bank", "UPI"
      reason = "Customer Return",
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
        return res.status(400).json({ message: `Invalid return quantity for ${retItem.name || "item"}.` });
      }

      // Check against sold quantity in order
      const originalItem = order.items.find(
        (i) => (retItem.productId && String(i.productId) === String(retItem.productId)) ||
               (retItem.sku && i.sku === retItem.sku) ||
               (retItem.name && i.name.toLowerCase() === String(retItem.name).toLowerCase())
      );

      if (!originalItem) {
        return res.status(400).json({
          message: `Item "${retItem.name || retItem.sku}" was not found in original invoice #${order.invoiceNo}.`,
        });
      }

      // Check previously returned quantity for this item
      const previouslyReturnedQty = (order.returnedItems || [])
        .filter((ri) => String(ri.productId) === String(originalItem.productId) || ri.sku === originalItem.sku)
        .reduce((sum, ri) => sum + (Number(ri.qty) || 0), 0);

      const maxReturnable = originalItem.qty - previouslyReturnedQty;
      if (retQty > maxReturnable) {
        return res.status(400).json({
          message: `Return quantity (${retQty}) for "${originalItem.name}" exceeds maximum returnable quantity (${maxReturnable}).`,
        });
      }

      const itemRate = Number(originalItem.price) || 0;
      const itemGstRate = Number(originalItem.gstRate) || 0;
      const itemDiscount = Number(originalItem.discount) || 0;
      const lineBase = itemRate * retQty;
      const lineDisc = (lineBase * itemDiscount) / 100;
      const lineTaxable = lineBase - lineDisc;
      const lineGst = (lineTaxable * itemGstRate) / 100;
      const lineReturnTotal = Math.round((lineTaxable + lineGst) * 100) / 100;

      calculatedReturnTotal += lineReturnTotal;

      validatedReturnedItems.push({
        productId: originalItem.productId,
        name: originalItem.name,
        sku: originalItem.sku,
        hsnCode: originalItem.hsnCode,
        unit: originalItem.unit,
        price: originalItem.price,
        cost: originalItem.cost,
        qty: retQty,
        discount: originalItem.discount,
        gstRate: originalItem.gstRate,
        gst: lineGst,
        amount: lineReturnTotal,
      });

      // Restore product stock and record history
      if (originalItem.productId && mongoose.isValidObjectId(originalItem.productId)) {
        const prod = await Product.findById(originalItem.productId);
        if (prod) {
          const prevStock = Number(prod.stock || 0);
          const newStock = prevStock + retQty;
          await Product.findByIdAndUpdate(originalItem.productId, {
            $inc: { stock: retQty },
            $push: {
              stockHistory: {
                date: new Date(returnDate),
                type: "Sales Return",
                quantity: retQty,
                previousStock: prevStock,
                newStock,
                reason: `Sales Return against Invoice #${order.invoiceNo}: ${reason}`,
                referenceNo: order.invoiceNo,
                performedBy: req.user.name || "User",
              },
            },
          });
        }
      }
    }

    const finalRefund = Math.min(
      calculatedReturnTotal,
      Number(refundAmount) > 0 ? Number(refundAmount) : calculatedReturnTotal
    );

    const creditNoteNo = `CN-${order.invoiceNo}-${(order.salesReturns?.length || 0) + 1}`;

    if (!Array.isArray(order.salesReturns)) {
      order.salesReturns = [];
    }
    if (!Array.isArray(order.returnedItems)) {
      order.returnedItems = [];
    }

    order.salesReturns.push({
      returnNo: creditNoteNo,
      returnDate: new Date(returnDate),
      reason,
      refundAmount: finalRefund,
      paymentMode: refundMode,
      items: validatedReturnedItems,
    });

    validatedReturnedItems.forEach((vi) => {
      order.returnedItems.push(vi);
    });

    order.refundAmount = Math.round(((order.refundAmount || 0) + finalRefund) * 100) / 100;

    // Calculate overall return status
    const totalSoldQty = order.items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
    const totalReturnedQty = order.returnedItems.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
    order.returnStatus = totalReturnedQty >= totalSoldQty ? "Returned" : "Partial";

    await order.save();

    // Settle Customer Ledger based on refund mode
    if (order.customerId && mongoose.isValidObjectId(order.customerId)) {
      if (refundMode === "Credit") {
        // Reduce customer outstanding balance
        await Customer.findByIdAndUpdate(order.customerId, {
          $inc: {
            totalOrderValue: -finalRefund,
            balance: -finalRefund,
          },
          $push: {
            paymentHistory: {
              amount: finalRefund,
              paymentMode: "Credit Note",
              date: new Date(returnDate),
              referenceNo: creditNoteNo,
              notes: `Credit Note #${creditNoteNo} for Sales Return on Invoice #${order.invoiceNo}`,
              invoiceNo: order.invoiceNo,
            },
          },
        });
      }
    }

    try {
      await createNotification({
        ownerId,
        userId: actualUserId,
        title: `Sales Return: ${creditNoteNo}`,
        message: `Credit note ${creditNoteNo} for ₹${finalRefund.toLocaleString("en-IN")} generated for ${order.customerName}.`,
        type: "warning",
        category: "sale",
        link: "pos",
        metadata: { orderId: order._id, invoiceNo: order.invoiceNo, creditNoteNo, refundAmount: finalRefund },
      });
    } catch (notifErr) {
      console.error("Sales return notification error:", notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Sales return processed successfully. Credit Note: ${creditNoteNo}`,
      order,
      creditNoteNo,
      refundAmount: finalRefund,
    });
  } catch (error) {
    console.error("CREATE SALES RETURN ERROR:", error.message);
    return res.status(500).json({ message: error.message || "Failed to process sales return." });
  }
};

// ================= DELETE / CANCEL ORDER =================
export const deleteOrder = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const order = await Order.findOne({ _id: req.params.id, ownerId });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.status === "Cancelled") {
      return res.status(400).json({ message: "Order is already cancelled." });
    }

    // 1. Restore product inventory stock
    for (const item of order.items) {
      const qty = Number(item.qty) || 0;
      if (qty > 0 && item.productId && mongoose.isValidObjectId(item.productId)) {
        const prod = await Product.findById(item.productId);
        if (prod) {
          const prevStock = Number(prod.stock || 0);
          const newStock = prevStock + qty;
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: qty },
            $push: {
              stockHistory: {
                date: new Date(),
                type: "Stock Adjustment",
                quantity: qty,
                previousStock: prevStock,
                newStock,
                reason: `Cancelled Invoice #${order.invoiceNo}`,
                referenceNo: order.invoiceNo,
                performedBy: req.user.name || "User",
              },
            },
          });
        }
      }
    }

    // 2. Rollback Customer khata balance
    if (order.customerId && mongoose.isValidObjectId(order.customerId)) {
      const balanceRollback = order.balanceDue || 0;
      const totalPaidRollback = order.amountPaid || 0;
      const orderValueRollback = order.totalOrderValue || 0;

      await Customer.findByIdAndUpdate(order.customerId, {
        $inc: {
          totalOrderValue: -orderValueRollback,
          totalPaid: -totalPaidRollback,
          balance: -balanceRollback,
          invoices: -1,
        },
      });
    }

    order.status = "Cancelled";
    await order.save();

    return res.status(200).json({
      success: true,
      message: `Invoice #${order.invoiceNo} was cancelled and inventory stock was restored.`,
      order,
    });
  } catch (error) {
    console.error("DELETE ORDER ERROR:", error.message);
    return res.status(500).json({ message: error.message || "Failed to cancel order." });
  }
};
