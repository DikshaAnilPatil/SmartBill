import Order from "../models/Order.js";
import Customer from "../models/Customer.js";
import Product from "../models/productModel.js";
import InvoiceSettings from "../models/InvoiceSettings.js";
import TransactionSettings from "../models/TransactionSettings.js";
import User from "../models/User.js";
import AccountingSettings from "../models/AccountingSettings.js";
import { getCashBalance } from "../utils/accountingUtils.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { createNotification } from "../services/notificationService.js";
import { sendInvoiceEmail } from "../utils/emailService.js";

// ================= HELPERS =================
// Generate a collision-safe invoice number for the given owner.
// Keeps retrying with the next sequential number whenever the previous
// candidate collides with an existing (unique) invoice number.
const generateInvoiceNo = async (ownerId) => {
  // Fetch settings
  let settings = await InvoiceSettings.findOne({ userId: ownerId });
  
  // Default values
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
  } else {
    // If not financial year wise, just use the current year or nothing. We will use just a dash.
    yearStr = ""; 
  }

  const count = await Order.countDocuments({ ownerId });
  let candidate = count + startingNumber;
  let invoiceNo = `${prefix}${yearStr}-${String(candidate).padStart(4, "0")}`;

  // Guard against rapid/duplicate creation races on the unique index.
  for (let attempt = 0; attempt < 20; attempt++) {
    // Check if exists for this owner
    const existing = await Order.exists({ invoiceNo, ownerId });
    if (!existing) return invoiceNo;
    candidate += 1;
    invoiceNo = `${prefix}${yearStr}-${String(candidate).padStart(4, "0")}`;
  }

  // Fall back to a timestamp-based suffix to guarantee uniqueness.
  return `${prefix}${yearStr}-${Date.now()}`;
};

// ================= CREATE ORDER =================
// Creates an order and automatically updates the customer's running totals:
//   totalOrderValue += orderTotal
//   totalPaid        += amountPaid
//   balance          = totalOrderValue - totalPaid
//   invoices         += 1
export const createOrder = async (req, res) => {
  let session = null;
  let useTransaction = true;

  try {
    session = await Order.startSession();
    session.startTransaction();
  } catch (err) {
    // Standalone MongoDB without replica set does not support transactions.
    session = null;
    useTransaction = false;
  }

  const abortSession = async () => {
    if (session && useTransaction) {
      try {
        await session.abortTransaction();
      } catch (e) {}
      session.endSession();
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
      subtotal = 0,
      gstRate = 0,
      gst = 0,
      discount = 0,
      cashDiscount = 0,
      totalOrderValue = 0,
      amountPaid = 0,
      paymentMode = "Cash",
    } = req.body;

    if (!items || items.length === 0) {
      await abortSession();
      return res
        .status(400)
        .json({ message: "Order must contain at least one item." });
    }

    // Load user's transaction settings
    const txSettings = await TransactionSettings.findOne({
      userId: req.user._id,
    }).lean();

    const accountingSettings = await AccountingSettings.findOne({ userId: req.user._id }).lean();
    const trackCogs = accountingSettings?.trackCogs === true;

    const allowNegativeStock = txSettings?.allowNegativeStock === true;
    const allowDiscount = txSettings?.allowDiscount !== false;
    const maxDiscountPercent = Number(txSettings?.maximumDiscount || 100);

    // Validate discount limit
    if (!allowDiscount) {
      for (const item of items) {
        if (Number(item.discount) > 0) {
          await abortSession();
          return res.status(400).json({
            message: `Discounts are disabled in Transaction Settings.`,
          });
        }
      }
    } else if (Number.isFinite(maxDiscountPercent) && maxDiscountPercent < 100) {
      for (const item of items) {
        const itemDisc = Number(item.discount) || 0;
        if (itemDisc > maxDiscountPercent) {
          await abortSession();
          return res.status(400).json({
            message: `Discount of ${itemDisc}% on "${item.name}" exceeds the maximum allowed limit of ${maxDiscountPercent}%.`,
          });
        }
      }
    }

    const total = Number(totalOrderValue) || 0;
    const paid = Number(amountPaid) || 0;
    const balanceDue = Math.max(0, total - paid);

    const status = paid <= 0 ? "Due" : paid >= total ? "Paid" : "Partial";

    let calculatedTotalCogs = 0;

    // Decrease inventory before creating the order. Auto-create product if not yet in database.
    for (const item of items) {
      const quantity = Number(item.qty);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        await abortSession();
        return res.status(400).json({
          message: "Each item quantity must be a positive whole number.",
        });
      }

      const productIdentifiers = [];
      if (item.sku && String(item.sku).trim()) {
        const cleanSku = String(item.sku).trim();
        productIdentifiers.push({
          sku: new RegExp(`^${cleanSku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
        });
      }
      if (item.productId && mongoose.isValidObjectId(item.productId)) {
        productIdentifiers.push({ _id: item.productId });
      }
      if (item.name && String(item.name).trim()) {
        const cleanName = String(item.name).trim();
        productIdentifiers.push({
          name: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
        });
      }

      const ownershipFilter = {
        $or: [{ userId: req.user._id }, { ownerId: req.user._id }],
      };

      const queryOptions = session ? { session } : {};

      let product = null;
      if (productIdentifiers.length > 0) {
        product = await Product.findOne(
          { $and: [ownershipFilter, { $or: productIdentifiers }] },
          null,
          queryOptions
        );
      }

      if (!product) {
        // Auto-create product if missing so invoice generation always succeeds
        const itemSku =
          item.sku && String(item.sku).trim()
            ? String(item.sku).trim().toUpperCase()
            : `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const initialStock = allowNegativeStock ? -quantity : 0;

        const createProductOptions = session ? { session } : {};
        try {
          const createdProductDocs = await Product.create(
            [
              {
                userId: req.user._id,
                name: item.name || "Product",
                sku: itemSku,
                category: item.category || "General",
                supplier: item.supplier || "General Supplier",
                cost: Number(item.price) || 0,
                price: Number(item.price) || 0,
                gst: Number(item.gst) || 0,
                stock: initialStock,
                minStock: 10,
                unit: "Piece",
                status: "Active",
              },
            ],
            createProductOptions
          );
          product = createdProductDocs[0];
        } catch (createErr) {
          // If SKU unique constraint collided, query existing product by SKU
          product = await Product.findOne(
            { userId: req.user._id, sku: itemSku },
            null,
            queryOptions
          );
        }
      } else {
        // Check stock constraint if negative stock is NOT allowed
        if (!allowNegativeStock && (product.stock || 0) < quantity) {
          await abortSession();
          return res.status(400).json({
            message: `Insufficient stock for "${product.name}". Available: ${product.stock || 0}, Requested: ${quantity}. (Negative stock is disabled in Transaction Settings)`,
          });
        }

        if (allowNegativeStock) {
          // Decrement stock allowing negative values
          await Product.findOneAndUpdate(
            { _id: product._id },
            { $inc: { stock: -quantity } },
            { new: true, ...queryOptions }
          );
        } else {
          // Decrement stock ensuring non-negative
          const updatedProduct = await Product.findOneAndUpdate(
            { _id: product._id, stock: { $gte: quantity } },
            { $inc: { stock: -quantity } },
            { new: true, ...queryOptions }
          );

          if (!updatedProduct) {
            await Product.findOneAndUpdate(
              { _id: product._id },
              { stock: 0 },
              { new: true, ...queryOptions }
            );
          }
        }
      }

      if (trackCogs && product) {
        calculatedTotalCogs += (Number(product.cost) || 0) * quantity;
      }
    }

    // Generate a unique invoice number.
    const invoiceNo = await generateInvoiceNo(req.user._id);

    const createOptions = session ? { session } : {};

    const orderDocs = await Order.create(
      [
        {
          ownerId: req.user._id,
          customerId: customerId || null,
          customerName: customerName || "Walk-in Customer",
          invoiceNo,
          items,
          subtotal: Number(subtotal) || 0,
          gstRate: Number(gstRate) || 0,
          gst: Number(gst) || 0,
          discount: Number(discount) || 0,
          cashDiscount: Number(cashDiscount) || 0,
          totalOrderValue: total,
          amountPaid: paid,
          balanceDue,
          paymentMode,
          splitPayments: Array.isArray(req.body.splitPayments) ? req.body.splitPayments : [],
          status,
          totalCogs: trackCogs ? calculatedTotalCogs : 0,
        },
      ],
      createOptions
    );

    const newOrder = orderDocs[0];

    // Update the customer's running totals atomically if customer exists.
    let targetCustomer = null;

    if (customerId && mongoose.isValidObjectId(customerId)) {
      targetCustomer = await Customer.findOne(
        {
          _id: customerId,
          $or: [{ userId: req.user._id }, { ownerId: req.user._id }],
        },
        null,
        createOptions
      );
    }

    if (!targetCustomer && customerName && customerName !== "Walk-in Customer") {
      const cleanCustomerName = String(customerName).trim();
      targetCustomer = await Customer.findOne(
        {
          $or: [{ userId: req.user._id }, { ownerId: req.user._id }],
          name: new RegExp(`^${cleanCustomerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
        },
        null,
        createOptions
      );
    }

    if (targetCustomer) {
      targetCustomer.totalOrderValue = (targetCustomer.totalOrderValue || 0) + total;
      targetCustomer.totalPaid = (targetCustomer.totalPaid || 0) + paid;
      targetCustomer.invoices = (targetCustomer.invoices || 0) + 1;
      targetCustomer.balance = targetCustomer.totalOrderValue - targetCustomer.totalPaid;
      await targetCustomer.save(createOptions);

      newOrder.customerId = targetCustomer._id;
      await newOrder.save(createOptions);
    }

    await commitSession();

    // Trigger Real-Time Notification for New Sale
    try {
      await createNotification({
        ownerId: req.user._id,
        userId: req.user.actualUserId || req.user._id,
        title: `New Sale: ${newOrder.invoiceNo}`,
        message: `Sale invoice ${newOrder.invoiceNo} for ₹${total.toLocaleString("en-IN")} generated for ${customerName} (${paymentMode}).`,
        type: "success",
        category: "sale",
        link: "pos",
        metadata: {
          orderId: newOrder._id,
          invoiceNo: newOrder.invoiceNo,
          total,
          amountPaid: paid,
          customerName,
          status,
        },
      });

      // Check remaining stock for products in order and emit instant alerts if low
      for (const item of items) {
        if (item.productId && mongoose.isValidObjectId(item.productId)) {
          const updatedProd = await Product.findById(item.productId).lean();
          if (updatedProd) {
            const stock = Number(updatedProd.stock || 0);
            const minStock = Number(updatedProd.minStock ?? 10);
            if (stock <= 0) {
              await createNotification({
                ownerId: req.user._id,
                title: `Out of Stock: ${updatedProd.name}`,
                message: `${updatedProd.name} is now out of stock following invoice ${newOrder.invoiceNo}.`,
                type: "error",
                category: "stock",
                link: "inventory",
                metadata: { productId: updatedProd._id, stock: 0 },
              });
            } else if (stock <= minStock) {
              await createNotification({
                ownerId: req.user._id,
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

    // Dispatch Invoice Email (checks SuperAdmin active/inactive setting in MongoDB)
    try {
      const recipientEmail = targetCustomer?.email || req.user?.email;
      if (recipientEmail) {
        sendInvoiceEmail({
          toEmail: recipientEmail,
          invoiceNo: newOrder.invoiceNo,
          amount: `₹${total.toLocaleString("en-IN")}`,
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
    if (error.stack) console.error(error.stack);

    return res.status(500).json({
      message: error.message || "Failed to create order.",
    });
  }
};

// ================= LIST ORDERS =================
export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ ownerId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ message: "OK", orders });
  } catch (error) {
    console.error("GET ORDERS ERROR:", error.message);
    return res.status(500).json({ message: "Failed to fetch orders." });
  }
};

// ================= GET SINGLE ORDER =================
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
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
