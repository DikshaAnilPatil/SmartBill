import Product from "../models/productModel.js";
import mongoose from "mongoose";
import { createNotification } from "../services/notificationService.js";

// Add Product
export const addProduct = async (req, res) => {
  try {
    const {
      name: rawName,
      sku: inputSku,
      barcode = "",
      category = "General",
      supplier = "",
      cost = 0,
      price = 0,
      wholesalePrice = 0,
      minPrice = 0,
      stock = 0,
      minStock = 10,
      gst = 0,
      unit = "Piece",
      hsnCode = "",
      batchNo = "",
      expiryDate = null,
      status = "Active",
    } = req.body;

    const name = String(rawName || "").trim();
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Product name is required.",
      });
    }

    const rawSku = inputSku && String(inputSku).trim()
      ? String(inputSku).trim()
      : `SKU-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

    const effectiveOwnerId = req.user.ownerId || req.user._id;
    const actualUserId = req.user.actualUserId || req.user._id;

    // Check if a product with this exact SKU already exists for this business/user
    const existingProduct = await Product.findOne({
      sku: rawSku,
      $or: [
        { ownerId: effectiveOwnerId },
        { userId: effectiveOwnerId },
        { userId: actualUserId },
        { ownerId: actualUserId },
      ],
    });

    // If duplicate SKU found (e.g. user copied & pasted rows in Excel), auto-differentiate with unique suffix
    const finalSku = existingProduct
      ? `${rawSku}-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`
      : rawSku;

    const initialStock = Math.max(0, Number(stock) || 0);

    const product = new Product({
      name,
      sku: finalSku,
      barcode: String(barcode || "").trim(),
      category: String(category || "General").trim(),
      supplier: String(supplier || "").trim(),
      cost: Number(cost) || 0,
      price: Number(price) || 0,
      wholesalePrice: Number(wholesalePrice) || 0,
      minPrice: Number(minPrice) || 0,
      stock: initialStock,
      minStock: Number(minStock) || 0,
      gst: Number(gst) || 0,
      unit: String(unit || "Piece").trim(),
      hsnCode: String(hsnCode || "").trim(),
      batchNo: String(batchNo || "").trim(),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      size: String(size || "").trim(),
      color: String(color || "").trim(),
      packSize: String(packSize || "").trim(),
      minOrderQty: Number(minOrderQty) || 1,
      warrantyMonths: Number(warrantyMonths) || 0,
      isPrescriptionOnly: Boolean(isPrescriptionOnly),
      status: status || "Active",
      userId: actualUserId,
      ownerId: effectiveOwnerId,
      stockHistory: initialStock > 0 ? [
        {
          date: new Date(),
          type: "Initial",
          quantity: initialStock,
          previousStock: 0,
          newStock: initialStock,
          reason: "Initial opening stock",
          performedBy: req.user.name || "User",
        }
      ] : [],
    });

    // Save product to MongoDB
    await product.save();

    // Trigger instant stock alert if initially low or out of stock
    try {
      const currentStock = Number(product.stock || 0);
      const threshold = Number(product.minStock ?? 10);
      if (currentStock <= 0) {
        await createNotification({
          ownerId: effectiveOwnerId,
          title: `Out of Stock: ${product.name}`,
          message: `${product.name} (SKU: ${product.sku || "N/A"}) was added with 0 stock.`,
          type: "error",
          category: "stock",
          link: "inventory",
          metadata: { productId: product._id, stock: 0 },
        });
      } else if (currentStock <= threshold) {
        await createNotification({
          ownerId: effectiveOwnerId,
          title: `Low Stock: ${product.name}`,
          message: `${product.name} has only ${currentStock} ${product.unit || "units"} remaining (Min threshold: ${threshold}).`,
          type: "warning",
          category: "stock",
          link: "inventory",
          metadata: { productId: product._id, stock: currentStock },
        });
      }
    } catch (notifErr) {
      console.error("Product notification error:", notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Product added successfully",
      product,
    });
  } catch (error) {
    console.error("ADD PRODUCT ERROR:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A product with this SKU already exists.",
        field: "sku",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Bulk Add / Import Products
export const bulkAddProducts = async (req, res) => {
  try {
    const {
      products,
      mode = "upsert", // "upsert" | "update_stock" | "create_only"
      stockMode = "replace", // "replace" | "add"
    } = req.body;

    const productsToInsert = Array.isArray(products)
      ? products
      : Array.isArray(req.body)
      ? req.body
      : [];

    if (!Array.isArray(productsToInsert) || productsToInsert.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No products provided for import.",
      });
    }

    const effectiveOwnerId = req.user.ownerId || req.user._id;
    const actualUserId = req.user.actualUserId || req.user._id;

    // Fetch existing products for this business/user
    const existingProducts = await Product.find({
      $or: [
        { ownerId: effectiveOwnerId },
        { userId: effectiveOwnerId },
        { userId: actualUserId },
        { ownerId: actualUserId },
      ],
    });

    const existingSkuMap = new Map();
    const existingNameMap = new Map();
    existingProducts.forEach((p) => {
      if (p.sku) existingSkuMap.set(String(p.sku).trim().toLowerCase(), p);
      if (p.name) existingNameMap.set(String(p.name).trim().toLowerCase(), p);
    });

    let createdCount = 0;
    let updatedCount = 0;
    const processedDocs = [];
    const stockAlertNotifications = [];
    let count = 0;

    for (const item of productsToInsert) {
      const name = String(item.name || "").trim();
      if (!name) continue;

      const rawSku = item.sku && String(item.sku).trim() ? String(item.sku).trim() : "";
      const skuLower = rawSku ? rawSku.toLowerCase() : "";
      const nameLower = name.toLowerCase();

      // Find existing match by SKU or Name
      const existing = (skuLower && existingSkuMap.get(skuLower)) || existingNameMap.get(nameLower);

      if (existing && mode !== "create_only") {
        // UPDATE EXISTING PRODUCT
        const currentStock = Number(existing.stock || 0);
        const importStock = Number(item.stock || 0);
        const newStock = stockMode === "add" ? currentStock + importStock : importStock;

        existing.stock = newStock;
        if (item.minStock !== undefined && item.minStock !== null && item.minStock !== "") {
          existing.minStock = Number(item.minStock) || 0;
        }

        if (mode !== "update_stock") {
          // Update details, category, and pricing
          if (name) existing.name = name;
          if (rawSku) existing.sku = rawSku;
          if (item.category) existing.category = String(item.category).trim();
          if (item.supplier !== undefined) existing.supplier = String(item.supplier).trim();
          if (item.cost !== undefined) existing.cost = Number(item.cost) || 0;
          if (item.price !== undefined) existing.price = Number(item.price) || 0;
          if (item.wholesalePrice !== undefined) existing.wholesalePrice = Number(item.wholesalePrice) || 0;
          if (item.minPrice !== undefined) existing.minPrice = Number(item.minPrice) || 0;
          if (item.gst !== undefined) existing.gst = Number(item.gst) || 0;
          if (item.unit) existing.unit = String(item.unit).trim();
          if (item.hsnCode) existing.hsnCode = String(item.hsnCode).trim();
          if (item.batchNo) existing.batchNo = String(item.batchNo).trim();
          if (item.status) existing.status = item.status || "Active";
        }

        if (!Array.isArray(existing.stockHistory)) {
          existing.stockHistory = [];
        }
        existing.stockHistory.push({
          date: new Date(),
          type: "Stock Adjustment",
          quantity: newStock - currentStock,
          previousStock: currentStock,
          newStock,
          reason: "Bulk Import / Update",
          performedBy: req.user.name || "User",
        });

        await existing.save();
        updatedCount++;
        processedDocs.push(existing);

        // Check stock alert threshold
        const threshold = Number(existing.minStock ?? 10);
        if (newStock <= 0) {
          stockAlertNotifications.push({
            ownerId: effectiveOwnerId,
            title: `Out of Stock: ${existing.name}`,
            message: `${existing.name} (SKU: ${existing.sku || "N/A"}) stock updated to 0.`,
            type: "error",
            category: "stock",
            link: "inventory",
            metadata: { productId: existing._id, stock: 0 },
          });
        } else if (newStock <= threshold) {
          stockAlertNotifications.push({
            ownerId: effectiveOwnerId,
            title: `Low Stock: ${existing.name}`,
            message: `${existing.name} has only ${newStock} ${existing.unit || "units"} remaining.`,
            type: "warning",
            category: "stock",
            link: "inventory",
            metadata: { productId: existing._id, stock: newStock },
          });
        }
      } else if (mode !== "update_stock") {
        // CREATE NEW PRODUCT
        let baseSku = rawSku || `SKU-${Date.now().toString(36).toUpperCase()}-${++count}`;
        let sku = baseSku;
        let skuKey = sku.toLowerCase();

        // If duplicate SKU exists in DB or earlier in this batch, auto-differentiate
        if (existingSkuMap.has(skuKey)) {
          sku = `${baseSku}-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
          skuKey = sku.toLowerCase();
        }

        const importStock = Number(item.stock) || 0;

        const newDoc = new Product({
          name,
          sku,
          category: String(item.category || "General").trim(),
          supplier: String(item.supplier || "").trim(),
          cost: Number(item.cost) || 0,
          price: Number(item.price) || 0,
          wholesalePrice: Number(item.wholesalePrice) || 0,
          minPrice: Number(item.minPrice) || 0,
          stock: importStock,
          minStock: Number(item.minStock) || 10,
          gst: Number(item.gst) || 0,
          unit: String(item.unit || "Piece").trim(),
          hsnCode: String(item.hsnCode || "").trim(),
          batchNo: String(item.batchNo || "").trim(),
          status: item.status || "Active",
          userId: actualUserId,
          ownerId: effectiveOwnerId,
          stockHistory: [
            {
              date: new Date(),
              type: "Initial",
              quantity: importStock,
              previousStock: 0,
              newStock: importStock,
              reason: "Bulk Import Creation",
              performedBy: req.user.name || "User",
            },
          ],
        });

        await newDoc.save();
        createdCount++;
        processedDocs.push(newDoc);

        // Keep local map updated for subsequent rows in this same batch
        existingSkuMap.set(skuKey, newDoc);
        existingNameMap.set(nameLower, newDoc);

        const currentStock = Number(newDoc.stock || 0);
        const threshold = Number(newDoc.minStock ?? 10);
        if (currentStock <= 0) {
          stockAlertNotifications.push({
            ownerId: effectiveOwnerId,
            title: `Out of Stock: ${newDoc.name}`,
            message: `${newDoc.name} was added with 0 stock.`,
            type: "error",
            category: "stock",
            link: "inventory",
            metadata: { productId: newDoc._id, stock: 0 },
          });
        } else if (currentStock <= threshold) {
          stockAlertNotifications.push({
            ownerId: effectiveOwnerId,
            title: `Low Stock: ${newDoc.name}`,
            message: `${newDoc.name} has only ${currentStock} ${newDoc.unit || "units"} remaining.`,
            type: "warning",
            category: "stock",
            link: "inventory",
            metadata: { productId: newDoc._id, stock: currentStock },
          });
        }
      }
    }

    if (processedDocs.length === 0 && productsToInsert.length > 0) {
      return res.status(400).json({
        success: false,
        message: "No valid products found to process.",
      });
    }

    // Trigger stock alert notifications in background
    if (stockAlertNotifications.length > 0) {
      stockAlertNotifications.slice(0, 5).forEach((notif) => {
        createNotification(notif).catch(() => {});
      });
    }

    return res.status(200).json({
      success: true,
      message: `Import completed: ${createdCount} created, ${updatedCount} updated.`,
      count: createdCount + updatedCount,
      createdCount,
      updatedCount,
      products: processedDocs,
    });
  } catch (error) {
    console.error("BULK ADD PRODUCTS ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Products for logged-in user and business with pagination
export const getProducts = async (req, res) => {
  try {
    const effectiveOwnerId = req.user.ownerId || req.user._id;
    const actualUserId = req.user.actualUserId || req.user._id;

    const {
      page,
      limit,
      search,
      category,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {
      $or: [
        { ownerId: effectiveOwnerId },
        { userId: effectiveOwnerId },
        { userId: actualUserId },
        { ownerId: actualUserId },
      ],
    };

    if (status && status !== "All") {
      query.status = status;
    }

    if (category && category !== "All") {
      query.category = category;
    }

    if (search && String(search).trim()) {
      const cleanSearch = String(search).trim();
      const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$and = [
        {
          $or: [
            { name: new RegExp(escaped, "i") },
            { sku: new RegExp(escaped, "i") },
            { barcode: new RegExp(escaped, "i") },
            { category: new RegExp(escaped, "i") },
            { hsnCode: new RegExp(escaped, "i") },
          ],
        },
      ];
    }

    const sortOption = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
    };

    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const [products, total] = await Promise.all([
        Product.find(query).sort(sortOption).skip(skip).limit(limitNum).lean(),
        Product.countDocuments(query),
      ]);

      return res.json({
        success: true,
        products,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }

    const products = await Product.find(query).sort(sortOption).lean();
    res.json({
      success: true,
      products,
      pagination: {
        total: products.length,
        page: 1,
        limit: products.length,
        totalPages: 1,
      },
    });
  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Stock Adjustment (Physical Audit, Damaged, Expired, Theft/Loss)
export const adjustStock = async (req, res) => {
  try {
    const { id } = req.params;
    const effectiveOwnerId = req.user.ownerId || req.user._id;
    const actualUserId = req.user.actualUserId || req.user._id;

    const product = await Product.findOne({
      _id: id,
      $or: [
        { ownerId: effectiveOwnerId },
        { userId: effectiveOwnerId },
        { userId: actualUserId },
        { ownerId: actualUserId },
      ],
    });

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    const {
      adjustmentType = "Add", // "Add", "Reduce", "Set Exact"
      quantity = 0,
      reason = "Stock Adjustment",
      notes = "",
    } = req.body;

    const qty = Number(quantity);
    if (!Number.isFinite(qty)) {
      return res.status(400).json({ success: false, message: "Invalid adjustment quantity." });
    }

    const prevStock = Number(product.stock || 0);
    let newStock = prevStock;
    let delta = 0;

    if (adjustmentType === "Add") {
      delta = Math.abs(qty);
      newStock = prevStock + delta;
    } else if (adjustmentType === "Reduce") {
      delta = -Math.abs(qty);
      newStock = Math.max(0, prevStock - Math.abs(qty));
    } else if (adjustmentType === "Set Exact") {
      newStock = Math.max(0, qty);
      delta = newStock - prevStock;
    }

    product.stock = newStock;
    if (!Array.isArray(product.stockHistory)) {
      product.stockHistory = [];
    }

    product.stockHistory.push({
      date: new Date(),
      type: "Stock Adjustment",
      quantity: delta,
      previousStock: prevStock,
      newStock,
      reason: notes ? `${reason} - ${notes}` : reason,
      performedBy: req.user.name || "User",
    });

    await product.save();

    return res.status(200).json({
      success: true,
      message: `Stock adjusted for "${product.name}". New Stock: ${newStock} ${product.unit || "units"}.`,
      product,
    });
  } catch (error) {
    console.error("ADJUST STOCK ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update a Single Product
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const effectiveOwnerId = req.user.ownerId || req.user._id;
    const actualUserId = req.user.actualUserId || req.user._id;

    const product = await Product.findOne({
      _id: id,
      $or: [
        { ownerId: effectiveOwnerId },
        { userId: effectiveOwnerId },
        { userId: actualUserId },
        { ownerId: actualUserId },
      ],
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const {
      name,
      sku,
      barcode,
      category,
      supplier,
      cost,
      price,
      wholesalePrice,
      minPrice,
      gst,
      stock,
      minStock,
      unit,
      hsnCode,
      batchNo,
      expiryDate,
      size,
      color,
      packSize,
      minOrderQty,
      warrantyMonths,
      isPrescriptionOnly,
      status,
    } = req.body;

    if (name !== undefined) product.name = name || product.name;
    if (sku !== undefined) product.sku = sku || product.sku;
    if (barcode !== undefined) product.barcode = String(barcode || "").trim();
    if (category !== undefined) product.category = category || product.category;
    if (supplier !== undefined) product.supplier = supplier || product.supplier;
    if (cost !== undefined) product.cost = Number(cost) || 0;
    if (price !== undefined) product.price = Number(price) || 0;
    if (wholesalePrice !== undefined) product.wholesalePrice = Number(wholesalePrice) || 0;
    if (minPrice !== undefined) product.minPrice = Number(minPrice) || 0;
    if (gst !== undefined) product.gst = Number(gst) || 0;
    if (stock !== undefined) product.stock = Number(stock) || 0;
    if (minStock !== undefined) product.minStock = Number(minStock) || 0;
    if (unit !== undefined) product.unit = unit || product.unit;
    if (hsnCode !== undefined) product.hsnCode = String(hsnCode).trim();
    if (batchNo !== undefined) product.batchNo = String(batchNo).trim();
    if (expiryDate !== undefined) product.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (size !== undefined) product.size = String(size).trim();
    if (color !== undefined) product.color = String(color).trim();
    if (packSize !== undefined) product.packSize = String(packSize).trim();
    if (minOrderQty !== undefined) product.minOrderQty = Number(minOrderQty) || 1;
    if (warrantyMonths !== undefined) product.warrantyMonths = Number(warrantyMonths) || 0;
    if (isPrescriptionOnly !== undefined) product.isPrescriptionOnly = Boolean(isPrescriptionOnly);
    if (status !== undefined) product.status = status || product.status;

    await product.save();

    // Trigger instant alert if updated stock is low or out of stock
    try {
      const currentStock = Number(product.stock || 0);
      const currentMinStock = Number(product.minStock ?? 10);
      if (currentStock <= 0) {
        await createNotification({
          ownerId: effectiveOwnerId,
          title: `Out of Stock: ${product.name}`,
          message: `${product.name} (SKU: ${product.sku || "N/A"}) stock has dropped to 0.`,
          type: "error",
          category: "stock",
          link: "inventory",
          metadata: { productId: product._id, stock: 0 },
        });
      } else if (currentStock <= currentMinStock) {
        await createNotification({
          ownerId: effectiveOwnerId,
          title: `Low Stock: ${product.name}`,
          message: `${product.name} has only ${currentStock} ${product.unit || "units"} remaining.`,
          type: "warning",
          category: "stock",
          link: "inventory",
          metadata: { productId: product._id, stock: currentStock },
        });
      }
    } catch (notifErr) {
      console.error("Product update notification error:", notifErr.message);
    }

    res.json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("UPDATE PRODUCT ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete a Single Product
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const effectiveOwnerId = req.user.ownerId || req.user._id;
    const actualUserId = req.user.actualUserId || req.user._id;

    const product = await Product.findOneAndDelete({
      _id: id,
      $or: [
        { ownerId: effectiveOwnerId },
        { userId: effectiveOwnerId },
        { userId: actualUserId },
        { ownerId: actualUserId },
      ],
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("DELETE PRODUCT ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get one product for the logged-in user.
export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product id." });
    }

    const effectiveOwnerId = req.user.ownerId || req.user._id;
    const actualUserId = req.user.actualUserId || req.user._id;

    const product = await Product.findOne({
      _id: id,
      $or: [
        { ownerId: effectiveOwnerId },
        { userId: effectiveOwnerId },
        { userId: actualUserId },
        { ownerId: actualUserId },
      ],
    });
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    return res.json({ success: true, product });
  } catch (error) {
    console.error("GET PRODUCT ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
