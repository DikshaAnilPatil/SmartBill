import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { sendEmployeeCredentialsEmail } from "../utils/emailService.js";

// ======================================================
// GET ALL EMPLOYEES FOR THE OWNER
// ======================================================
export const getEmployees = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;

    // Find all users created under this owner (ownerId matches owner's ID)
    const employees = await User.find({ ownerId })
      .select("-password")
      .sort({ createdAt: -1 });

    const formattedEmployees = employees.map((emp) => ({
      id: emp._id.toString(),
      _id: emp._id.toString(),
      name: `${emp.firstName} ${emp.lastName}`.trim(),
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone || "",
      role: emp.role || "Cashier",
      department: emp.department || "",
      permissions: emp.permissions || {},
      status: emp.status || "Active",
      lastActive: "Recent",
      createdAt: emp.createdAt,
    }));

    res.json({
      success: true,
      employees: formattedEmployees,
    });
  } catch (error) {
    console.error("GET EMPLOYEES ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch employees.",
    });
  }
};

// ======================================================
// CREATE NEW EMPLOYEE UNDER OWNER
// ======================================================
export const createEmployee = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const {
      name,
      firstName,
      lastName,
      email,
      phone,
      password,
      role,
      department,
      permissions,
      status,
    } = req.body;

    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required.",
        field: "email",
      });
    }

    if (!password || String(password).length < 4) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 4 characters.",
        field: "password",
      });
    }

    // Check existing email in DB
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email address already exists.",
        field: "email",
      });
    }

    // Fetch owner details for business info
    const owner = await User.findById(ownerId);
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Owner account not found.",
      });
    }

    // Name parsing
    let empFirstName = String(firstName || "").trim();
    let empLastName = String(lastName || "").trim();
    if (!empFirstName && name) {
      const parts = String(name).trim().split(" ");
      empFirstName = parts[0] || "Employee";
      empLastName = parts.slice(1).join(" ") || "";
    }
    if (!empFirstName) empFirstName = "Employee";

    const hashedPassword = await bcrypt.hash(password, 10);
    const cleanPhone = String(phone || "").replace(/\D/g, "");

    const newEmployee = await User.create({
      ownerId: owner._id,
      firstName: empFirstName,
      lastName: empLastName,
      email: normalizedEmail,
      phone: cleanPhone,
      password: hashedPassword,
      businessName: owner.businessName || "",
      businessType: owner.businessType || "Retail",
      role: role || "Cashier",
      department: department || "",
      permissions: permissions || {},
      status: status || "Active",
    });

    // Send login credentials via email to employee
    let emailStatus = "sent";
    let emailErrorDetail = null;

    try {
      const emailResult = await sendEmployeeCredentialsEmail({
        toEmail: newEmployee.email,
        employeeName: `${newEmployee.firstName} ${newEmployee.lastName}`.trim(),
        tempPassword: String(password),
        businessName: owner.businessName || "Smart Bill",
        role: newEmployee.role,
      });

      if (!emailResult || !emailResult.success) {
        emailStatus = "failed";
        emailErrorDetail = emailResult?.error || "Email delivery failed";
      }
    } catch (emailErr) {
      emailStatus = "failed";
      emailErrorDetail = emailErr.message || "Failed to dispatch email";
    }

    const message =
      emailStatus === "sent"
        ? "Employee created successfully. Login credentials sent to employee's email."
        : `Employee created successfully, BUT email failed to send: ${emailErrorDetail}`;

    res.status(201).json({
      success: true,
      message,
      emailSent: emailStatus === "sent",
      emailError: emailErrorDetail,
      employee: {
        id: newEmployee._id.toString(),
        _id: newEmployee._id.toString(),
        name: `${newEmployee.firstName} ${newEmployee.lastName}`.trim(),
        firstName: newEmployee.firstName,
        lastName: newEmployee.lastName,
        email: newEmployee.email,
        phone: newEmployee.phone,
        role: newEmployee.role,
        department: newEmployee.department,
        permissions: newEmployee.permissions,
        status: newEmployee.status,
        lastActive: "Just created",
      },
    });
  } catch (error) {
    console.error("CREATE EMPLOYEE ERROR:", error);
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or phone already registered.",
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create employee.",
    });
  }
};

// ======================================================
// UPDATE EMPLOYEE
// ======================================================
export const updateEmployee = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const { id } = req.params;
    const {
      name,
      firstName,
      lastName,
      email,
      phone,
      password,
      role,
      department,
      permissions,
      status,
    } = req.body;

    const employee = await User.findOne({ _id: id, ownerId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found or not owned by you.",
      });
    }

    if (email) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (normalizedEmail !== employee.email) {
        const existingEmail = await User.findOne({ email: normalizedEmail });
        if (existingEmail) {
          return res.status(409).json({
            success: false,
            message: "Another user is already using this email address.",
            field: "email",
          });
        }
        employee.email = normalizedEmail;
      }
    }

    if (firstName !== undefined) employee.firstName = String(firstName).trim();
    if (lastName !== undefined) employee.lastName = String(lastName).trim();
    if (name && (!firstName && !lastName)) {
      const parts = String(name).trim().split(" ");
      employee.firstName = parts[0] || employee.firstName;
      employee.lastName = parts.slice(1).join(" ");
    }

    if (phone !== undefined) {
      employee.phone = String(phone).replace(/\D/g, "");
    }

    if (role !== undefined) employee.role = role;
    if (department !== undefined) employee.department = department;
    if (permissions !== undefined) employee.permissions = permissions;
    if (status !== undefined) employee.status = status;

    if (password && String(password).trim().length > 0) {
      employee.password = await bcrypt.hash(password, 10);
    }

    await employee.save();

    res.json({
      success: true,
      message: "Employee updated successfully.",
      employee: {
        id: employee._id.toString(),
        _id: employee._id.toString(),
        name: `${employee.firstName} ${employee.lastName}`.trim(),
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        role: employee.role,
        department: employee.department,
        permissions: employee.permissions,
        status: employee.status,
        lastActive: "Updated just now",
      },
    });
  } catch (error) {
    console.error("UPDATE EMPLOYEE ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update employee.",
    });
  }
};

// ======================================================
// DELETE EMPLOYEE
// ======================================================
export const deleteEmployee = async (req, res) => {
  try {
    const ownerId = req.user.ownerId || req.user._id;
    const { id } = req.params;

    const result = await User.deleteOne({ _id: id, ownerId });
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    res.json({
      success: true,
      message: "Employee deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE EMPLOYEE ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete employee.",
    });
  }
};
