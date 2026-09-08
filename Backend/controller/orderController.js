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

  const count = await Order.countDocuments({ ownerId });
  let candidate = count + startingNumber;
  let invoiceNo = `${prefix}${yearStr}-${String(candidate).padStart(4, "0")}`;

  for (let attempt = 0; attempt < 20; attempt++) {
    const existing = await Order.exists({ invoiceNo, ownerId });
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
      items = [],
      cashDiscount = 0,
      amountPaid = 0,
      paymentMode = "Cash",
      splitPayments = [],
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
      const quantity = Number(rawItem.qty);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        await abortSession();
        return res.status(400).json({
          message: `Invalid quantity for item "${rawItem.name || "Product"}". Quantity must be a positive whole number.`,
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

      if (product) {
        // Authoritative pricing from database
        unitPrice = Number(product.price) || 0;
        unitCost = Number(product.cost) || 0;
        itemGstRate = Number(product.gst) || 0;
        itemName = product.name;
        itemSku = product.sku;

        // Atomic inventory reduction
        if (!allowNegativeStock) {
          const updatedProduct = await Product.findOneAndUpdate(
            { _id: product._id, stock: { $gte: quantity } },
            { $inc: { stock: -quantity } },
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
            { $inc: { stock: -quantity } },
            { new: true, ...queryOptions }
          );
        }
        decrementedItems.push({ productId: product._id, quantity });
      } else {
        // Auto-create product for custom/POS items without falsifying cost data
        unitPrice = Math.max(0, Number(rawItem.price) || 0);
        // Do NOT set cost equal to selling price to preserve margin tracking
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
                unit: rawItem.unit || "Piece",
                status: "Active",
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

    // Generate collision-safe invoice number
    const invoiceNo = await generateInvoiceNo(effectiveOwnerId);

    // Create Order in MongoDB
    const orderDocs = await Order.create(
      [
        {
          ownerId: effectiveOwnerId,
          customerId: customerId && mongoose.isValidObjectId(customerId) ? customerId : null,
          customerName: customerName || "Walk-in Customer",
          invoiceNo,
          items: processedItems,
          subtotal: Math.round(computedSubtotal * 100) / 100,
          gstRate: processedItems.length === 1 ? processedItems[0].gstRate : 0,
          gst: Math.round(computedTotalGst * 100) / 100,
          discount: Math.round(computedTotalDiscount * 100) / 100,
          cashDiscount: validCashDiscount,
          totalOrderValue: authoritativeTotal,
          amountPaid: paid,
          balanceDue,
          paymentMode: paymentMode || "Cash",
          splitPayments: Array.isArray(splitPayments) ? splitPayments : [],
          status,
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
      await Customer.findByIdAndUpdate(
        targetCustomer._id,
        {
          $inc: {
            totalOrderValue: authoritativeTotal,
            totalPaid: paid,
            invoices: 1,
            balance: balanceChange,
          },
        },
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
      query.$or = [
        { invoiceNo: new RegExp(cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
        { customerName: new RegExp(cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
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

    // Default: Return standard ordered list with total count for full backward compatibility
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
