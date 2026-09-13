import Supplier from "../models/Supplier.js";
import { createNotification } from "../services/notificationService.js";

// ================= LIST SUPPLIERS =================
export const getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find({ ownerId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ message: "OK", suppliers });
  } catch (error) {
    console.error("GET SUPPLIERS ERROR:", error.message);
    return res.status(500).json({ message: "Failed to fetch suppliers." });
  }
};

// ================= GET SINGLE SUPPLIER =================
export const getSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
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

// ================= CREATE SUPPLIER =================
export const createSupplier = async (req, res) => {
  try {
    const {
      name,
      contact,
      phone,
      email,
      city,
      address,
      gst,
      openingBalance = 0,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Supplier name is required." });
    }

    const opening = Number(openingBalance) || 0;

    const existing = await Supplier.findOne({
      ownerId: req.user._id,
      name: String(name).trim(),
    });

    if (existing) {
      return res.status(409).json({
        message: "A supplier with this name already exists.",
        field: "name",
      });
    }

    const supplier = await Supplier.create({
      ownerId: req.user._id,
      name: String(name).trim(),
      contact: contact || "",
      phone: phone || "",
      email: email || "",
      city: city || "",
      address: address || "",
      gst: gst || "",
      openingBalance: opening,
      balance: opening,
      status: "Active",
    });

    try {
      await createNotification({
        ownerId: req.user._id,
        userId: req.user.actualUserId || req.user._id,
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

// ================= UPDATE SUPPLIER =================
export const updateSupplier = async (req, res) => {
  try {
    const { name, contact, phone, email, city, address, gst, status } = req.body;

    const supplier = await Supplier.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
    });

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found." });
    }

    if (name !== undefined) supplier.name = String(name).trim() || supplier.name;
    if (contact !== undefined) supplier.contact = contact;
    if (phone !== undefined) supplier.phone = phone;
    if (email !== undefined) supplier.email = email;
    if (city !== undefined) supplier.city = city;
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
    const result = await Supplier.findOneAndDelete({
      _id: req.params.id,
      ownerId: req.user._id,
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

