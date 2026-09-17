import Supplier from "../models/Supplier.js";
import Purchase from "../models/Purchase.js";
import { createNotification } from "../services/notificationService.js";
import mongoose from "mongoose";

// ================= LIST SUPPLIERS =================
export const getSuppliers = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const { search, status, page, limit } = req.query;

    const query = { ownerId };
    if (status && status !== "All") {
      query.status = status;
    }
    if (search && String(search).trim()) {
      const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: new RegExp(escaped, "i") },
        { phone: new RegExp(escaped, "i") },
        { email: new RegExp(escaped, "i") },
        { city: new RegExp(escaped, "i") },
      ];
    }

    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const [suppliers, total] = await Promise.all([
        Supplier.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        Supplier.countDocuments(query),
      ]);

      return res.status(200).json({
        message: "OK",
        suppliers,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }

    const suppliers = await Supplier.find(query).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ message: "OK", suppliers });
  } catch (error) {
    console.error("GET SUPPLIERS ERROR:", error.message);
    return res.status(500).json({ message: "Failed to fetch suppliers." });
  }
};

// ================= GET SINGLE SUPPLIER =================
export const getSupplier = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      ownerId,
    }).lean();

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found." });
    }

    return res.status(200).json({ message: "OK", supplier });
  } catch (error) {
    console.error("GET SUPPLIER ERROR:", error.message);
    return res.status(500).json({ message: "Failed to fetch supplier." });
  }
};

// ================= GET SUPPLIER DETAILS & LEDGER =================
export const getSupplierDetails = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      ownerId,
    }).lean();

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found." });
    }

    const purchases = await Purchase.find({
      ownerId,
      $or: [
        { supplierId: supplier._id },
        { supplierName: supplier.name },
      ],
    }).sort({ purchaseDate: -1, createdAt: -1 }).lean();

    const totalPurchases = purchases.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);
    const totalPaid = purchases.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
    const totalPayable = purchases.reduce((sum, p) => sum + (Number(p.remainingAmount) || 0), 0);

    return res.status(200).json({
      message: "OK",
      supplier,
      summary: {
        totalPurchases,
        totalPaid,
        totalPayable: supplier.balance || totalPayable,
        billsCount: purchases.length,
      },
      purchases,
    });
  } catch (error) {
    console.error("GET SUPPLIER DETAILS ERROR:", error.message);
    return res.status(500).json({ message: "Failed to fetch supplier ledger details." });
  }
};

// ================= CREATE SUPPLIER =================
export const createSupplier = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const actualUserId = req.user.actualUserId || req.user._id;

    const {
      name,
      contact,
      phone,
      email,
      city,
      state,
      address,
      gst,
      openingBalance = 0,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Supplier name is required." });
    }

    if (phone && !/^\d{10}$/.test(String(phone).trim())) {
      return res.status(400).json({ message: "Contact number must be exactly 10 digits." });
    }

    const opening = Number(openingBalance) || 0;

    const existing = await Supplier.findOne({
      ownerId,
      name: String(name).trim(),
    });

    if (existing) {
      return res.status(409).json({
        message: "A supplier with this name already exists.",
        field: "name",
      });
    }

    const supplier = await Supplier.create({
      ownerId,
      name: String(name).trim(),
      contact: contact || "",
      phone: phone || "",
      email: email || "",
      city: city || "",
      state: state || "",
      address: address || "",
      gst: gst || "",
      openingBalance: opening,
      totalPurchases: 0,
      totalPaid: 0,
      balance: opening,
      status: "Active",
    });

    try {
      await createNotification({
        ownerId,
        userId: actualUserId,
        title: "Supplier Registered",
        message: `Supplier "${supplier.name}" was successfully registered.`,
        type: "info",
        category: "purchase",
        link: "suppliers",
        metadata: { supplierId: supplier._id, supplierName: supplier.name },
      });
    } catch (notifErr) {
      console.error("Supplier notification error:", notifErr.message);
    }

    return res.status(201).json({ message: "OK", supplier });
  } catch (error) {
    console.error("CREATE SUPPLIER ERROR:", error.message);
    return res.status(500).json({ message: "Failed to create supplier." });
  }
};

// ================= RECORD SUPPLIER PAYMENT OUT (SETTLEMENT) =================
export const recordSupplierPayment = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const supplier = await Supplier.findOne({ _id: req.params.id, ownerId });

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found." });
    }

    const {
      amount,
      paymentMethod = "Bank Transfer",
      referenceNo = "",
      notes = "",
      purchaseBillNo = "",
      date = new Date(),
    } = req.body;

    const payAmount = Number(amount);
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      return res.status(400).json({ message: "Payment amount must be a positive number." });
    }

    supplier.balance = Math.round(((supplier.balance || 0) - payAmount) * 100) / 100;
    supplier.totalPaid = Math.round(((supplier.totalPaid || 0) + payAmount) * 100) / 100;

    if (!Array.isArray(supplier.paymentHistory)) {
      supplier.paymentHistory = [];
    }

    supplier.paymentHistory.push({
      amount: payAmount,
      paymentMethod,
      date: new Date(date),
      referenceNo: String(referenceNo || "").trim(),
      notes: String(notes || "").trim(),
      purchaseBillNo: String(purchaseBillNo || "").trim(),
    });

    await supplier.save();

    return res.status(200).json({
      success: true,
      message: `Payment out of ₹${payAmount.toLocaleString("en-IN")} recorded. Updated payable: ₹${supplier.balance.toLocaleString("en-IN")}.`,
      supplier,
    });
  } catch (error) {
    console.error("RECORD SUPPLIER PAYMENT ERROR:", error.message);
    return res.status(500).json({ message: error.message || "Failed to record payment." });
  }
};

// ================= UPDATE SUPPLIER =================
export const updateSupplier = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const { name, contact, phone, email, city, state, address, gst, status } = req.body;

    if (phone !== undefined && phone !== null && String(phone).trim() && !/^\d{10}$/.test(String(phone).trim())) {
      return res.status(400).json({ message: "Contact number must be exactly 10 digits." });
    }

    const supplier = await Supplier.findOne({
      _id: req.params.id,
      ownerId,
    });

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found." });
    }

    if (name !== undefined) supplier.name = String(name).trim() || supplier.name;
    if (contact !== undefined) supplier.contact = contact;
    if (phone !== undefined) supplier.phone = phone;
    if (email !== undefined) supplier.email = email;
    if (city !== undefined) supplier.city = city;
    if (state !== undefined) supplier.state = state;
    if (address !== undefined) supplier.address = address;
    if (gst !== undefined) supplier.gst = gst;
    if (status !== undefined) {
      supplier.status = ["Active", "Inactive"].includes(status)
        ? status
        : supplier.status;
    }

    await supplier.save();

    return res.status(200).json({ message: "OK", supplier });
  } catch (error) {
    console.error("UPDATE SUPPLIER ERROR:", error.message);
    return res.status(500).json({ message: "Failed to update supplier." });
  }
};

// ================= DELETE SUPPLIER =================
export const deleteSupplier = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const result = await Supplier.findOneAndDelete({
      _id: req.params.id,
      ownerId,
    });

    if (!result) {
      return res.status(404).json({ message: "Supplier not found." });
    }

    return res.status(200).json({ message: "Supplier deleted successfully." });
  } catch (error) {
    console.error("DELETE SUPPLIER ERROR:", error.message);
    return res.status(500).json({ message: "Failed to delete supplier." });
  }
};
