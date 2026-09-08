import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import { createNotification } from "../services/notificationService.js";

// ================= LIST CUSTOMERS WITH PAGINATION =================
export const getCustomers = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const {
      page,
      limit,
      search,
      category,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = { ownerId };

    if (status && status !== "All") {
      query.status = status;
    }

    if (category && category !== "All") {
      query.category = category;
    }

    if (search && String(search).trim()) {
      const cleanSearch = String(search).trim();
      const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: new RegExp(escaped, "i") },
        { phone: new RegExp(escaped, "i") },
        { email: new RegExp(escaped, "i") },
        { city: new RegExp(escaped, "i") },
      ];
    }

    const sortOption = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
    };

    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const [customers, total] = await Promise.all([
        Customer.find(query).sort(sortOption).skip(skip).limit(limitNum).lean(),
        Customer.countDocuments(query),
      ]);

      return res.status(200).json({
        message: "OK",
        customers,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }

    const customers = await Customer.find(query).sort(sortOption).lean();
    return res.status(200).json({
      message: "OK",
      customers,
      pagination: {
        total: customers.length,
        page: 1,
        limit: customers.length,
        totalPages: 1,
      },
    });
  } catch (error) {
    console.error("GET CUSTOMERS ERROR:", error.message);
    return res.status(500).json({
      message: "Failed to fetch customers.",
    });
  }
};

// ================= GET SINGLE CUSTOMER =================
export const getCustomer = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const customer = await Customer.findOne({
      _id: req.params.id,
      ownerId,
    }).lean();

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found.",
      });
    }

    return res.status(200).json({
      message: "OK",
      customer,
    });
  } catch (error) {
    console.error("GET CUSTOMER ERROR:", error.message);
    return res.status(500).json({
      message: "Failed to fetch customer.",
    });
  }
};

// ================= GET CUSTOMER DETAILS (WITH INVOICES & METRICS) =================
export const getCustomerDetails = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const customer = await Customer.findOne({
      _id: req.params.id,
      ownerId,
    }).lean();

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found.",
      });
    }

    // Find all orders associated with this customer
    const orders = await Order.find({
      ownerId,
      $or: [
        { customerId: customer._id },
        { customerName: customer.name },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    const totalOrderValue = orders.reduce(
      (sum, o) => sum + Number(o.totalOrderValue || 0),
      0
    );
    const totalPaidValue = orders.reduce(
      (sum, o) => sum + Number(o.amountPaid || 0),
      0
    );
    const amountLeftToBePaid = orders.reduce(
      (sum, o) => sum + Number(o.balanceDue || 0),
      0
    );

    return res.status(200).json({
      message: "OK",
      customer,
      summary: {
        totalOrderValue,
        totalPaidValue,
        amountLeftToBePaid,
        invoicesCount: orders.length,
      },
      orders,
    });
  } catch (error) {
    console.error("GET CUSTOMER DETAILS ERROR:", error.message);
    return res.status(500).json({
      message: "Failed to fetch customer details.",
    });
  }
};

// ================= CREATE CUSTOMER =================
export const createCustomer = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const actualUserId = req.user.actualUserId || req.user._id;

    const {
      name,
      contact,
      phone,
      email,
      city,
      address,
      gst,
      category,
      creditLimit,
      shippingAddress,
      openingBalance = 0,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        message: "Customer name is required.",
      });
    }

    const cleanPhone = phone ? String(phone).trim() : "";
    const cleanEmail = email ? String(email).trim().toLowerCase() : "";

    // If phone is provided, check for uniqueness within tenant scope
    if (cleanPhone && cleanPhone.length >= 7) {
      const existingPhone = await Customer.findOne({
        ownerId,
        phone: cleanPhone,
      });
      if (existingPhone) {
        return res.status(409).json({
          message: "A customer with this phone number already exists.",
          field: "phone",
        });
      }
    }

    const opening = Number(openingBalance) || 0;

    const customer = await Customer.create({
      ownerId,
      userId: actualUserId,
      name: String(name).trim(),
      contact: contact || "",
      phone: cleanPhone,
      email: cleanEmail,
      city: city ? String(city).trim() : "",
      address: address ? String(address).trim() : "",
      gst: gst ? String(gst).trim() : "",
      category: category || "Retailer",
      creditLimit: Number(creditLimit) || 0,
      shippingAddress: shippingAddress ? String(shippingAddress).trim() : "",
      openingBalance: opening,
      totalOrderValue: 0,
      totalPaid: 0,
      balance: opening,
      invoices: 0,
      status: "Active",
    });

    try {
      await createNotification({
        ownerId,
        userId: actualUserId,
        title: "Customer Added",
        message: `${customer.name} was registered in your customer directory.`,
        type: "info",
        category: "customer",
        link: "customers",
        metadata: { customerId: customer._id, customerName: customer.name },
      });
    } catch (notifErr) {
      console.error("Customer notification error:", notifErr.message);
    }

    return res.status(201).json({
      message: "OK",
      customer,
    });
  } catch (error) {
    console.error("CREATE CUSTOMER ERROR:", error.message);
    return res.status(500).json({
      message: error.message || "Failed to create customer.",
    });
  }
};

// ================= UPDATE CUSTOMER =================
export const updateCustomer = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const {
      name,
      contact,
      phone,
      email,
      city,
      address,
      gst,
      category,
      creditLimit,
      shippingAddress,
      status,
    } = req.body;

    const customer = await Customer.findOne({
      _id: req.params.id,
      ownerId,
    });

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found.",
      });
    }

    if (name !== undefined) {
      customer.name = String(name).trim() || customer.name;
    }

    if (contact !== undefined) customer.contact = contact;

    if (phone !== undefined) {
      const cleanPhone = String(phone).trim();
      if (cleanPhone && cleanPhone !== customer.phone && cleanPhone.length >= 7) {
        const existingPhone = await Customer.findOne({
          ownerId,
          phone: cleanPhone,
          _id: { $ne: customer._id },
        });
        if (existingPhone) {
          return res.status(409).json({
            message: "Another customer with this phone number already exists.",
            field: "phone",
          });
        }
      }
      customer.phone = cleanPhone;
    }

    if (email !== undefined) customer.email = String(email).trim().toLowerCase();
    if (city !== undefined) customer.city = String(city).trim();
    if (address !== undefined) customer.address = String(address).trim();
    if (gst !== undefined) customer.gst = String(gst).trim();
    if (category !== undefined) customer.category = category;
    if (creditLimit !== undefined) customer.creditLimit = Number(creditLimit) || 0;
    if (shippingAddress !== undefined) customer.shippingAddress = String(shippingAddress).trim();

    if (status !== undefined) {
      customer.status = ["Active", "Inactive"].includes(status)
        ? status
        : customer.status;
    }

    await customer.save();

    return res.status(200).json({
      message: "OK",
      customer,
    });
  } catch (error) {
    console.error("UPDATE CUSTOMER ERROR:", error.message);
    return res.status(500).json({
      message: error.message || "Failed to update customer.",
    });
  }
};

// ================= DELETE CUSTOMER =================
export const deleteCustomer = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const result = await Customer.findOneAndDelete({
      _id: req.params.id,
      ownerId,
    });

    if (!result) {
      return res.status(404).json({
        message: "Customer not found.",
      });
    }

    return res.status(200).json({
      message: "Customer deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE CUSTOMER ERROR:", error.message);
    return res.status(500).json({
      message: error.message || "Failed to delete customer.",
    });
  }
};