import Expense from "../models/Expense.js";
import { createNotification } from "../services/notificationService.js";
import AccountingSettings from "../models/AccountingSettings.js";
import { getCashBalance } from "../utils/accountingUtils.js";

// ================= CREATE EXPENSE =================
export const createExpense = async (req, res) => {
  try {
    const {
      category,
      description,
      amount,
      date,
      paymentMode,
      reference,
      status,
    } = req.body;

    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    const effectiveOwnerId = req.user.ownerId || req.user._id || req.user.id;
    const actualUserId = req.user.actualUserId || req.user._id || req.user.id;

    // Validate description
    if (!description || !String(description).trim()) {
      return res.status(400).json({
        message: "Description is required.",
        field: "description",
      });
    }

    // Validate amount
    const amountNumber = Number(amount);

    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({
        message: "Amount must be greater than 0.",
        field: "amount",
      });
    }

    const finalPaymentMode = String(paymentMode || "Cash").trim();
    
    // Enforce Strict Negative Cash Rule
    if (finalPaymentMode === "Cash") {
      const settings = await AccountingSettings.findOne({ userId: effectiveOwnerId }).lean();
      if (settings?.strictNegativeCash) {
        const cashBalance = await getCashBalance(effectiveOwnerId);
        if (cashBalance - amountNumber < 0) {
          return res.status(400).json({ 
            message: `Strict Negative Cash Rule is enabled. Your cash balance is ₹${cashBalance}, which is insufficient for this ₹${amountNumber} expense.`
          });
        }
      }
    }

    // Create expense with tenant isolation
    const created = await Expense.create({
      user: effectiveOwnerId,
      actualUser: actualUserId,
      category: String(category || "Other").trim(),
      description: String(description).trim(),
      amount: amountNumber,
      date: date ? new Date(date) : new Date(),
      paymentMode: finalPaymentMode,
      reference: String(reference ?? "").trim(),
      status: status === "Pending" ? "Pending" : "Paid",
    });

    const expense = {
      id: created._id.toString(),
      category: created.category,
      description: created.description,
      amount: created.amount,
      date: created.date,
      paymentMode: created.paymentMode,
      reference: created.reference,
      status: created.status,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };

    try {
      await createNotification({
        ownerId: effectiveOwnerId,
        userId: actualUserId,
        title: "Expense Logged",
        message: `Expense of ₹${amountNumber.toLocaleString("en-IN")} logged under '${created.category}'.`,
        type: "info",
        category: "expense",
        link: "expenses",
        metadata: {
          expenseId: created._id,
          amount: amountNumber,
          category: created.category,
        },
      });
    } catch (notifErr) {
      console.error("Expense notification error:", notifErr.message);
    }

    return res.status(201).json({
      message: "Expense created successfully.",
      expense,
    });
  } catch (error) {
    console.error("CREATE EXPENSE ERROR:", error);
    return res.status(500).json({
      message: error.message || "Unable to create expense. Please try again.",
    });
  }
};

// ================= LIST EXPENSES WITH PAGINATION =================
export const listExpenses = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    const effectiveOwnerId = req.user.ownerId || req.user._id || req.user.id;
    const {
      page,
      limit,
      search,
      category,
      paymentMode,
      status,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {
      $or: [{ user: effectiveOwnerId }, { user: req.user.actualUserId }],
    };

    if (category && category !== "All") {
      query.category = category;
    }

    if (paymentMode && paymentMode !== "All") {
      query.paymentMode = paymentMode;
    }

    if (status && status !== "All") {
      query.status = status;
    }

    if (search && String(search).trim()) {
      const cleanSearch = String(search).trim();
      const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { description: new RegExp(escaped, "i") },
        { reference: new RegExp(escaped, "i") },
        { category: new RegExp(escaped, "i") },
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

    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const [expenses, total] = await Promise.all([
        Expense.find(query).sort(sortOption).skip(skip).limit(limitNum).lean(),
        Expense.countDocuments(query),
      ]);

      const mapped = expenses.map((e) => ({
        id: e._id.toString(),
        _id: e._id.toString(),
        category: e.category,
        description: e.description,
        amount: e.amount,
        date: e.date,
        paymentMode: e.paymentMode,
        reference: e.reference,
        status: e.status,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));

      return res.status(200).json({
        expenses: mapped,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }

    const expenses = await Expense.find(query).sort(sortOption).lean();
    const mapped = expenses.map((e) => ({
      id: e._id.toString(),
      _id: e._id.toString(),
      category: e.category,
      description: e.description,
      amount: e.amount,
      date: e.date,
      paymentMode: e.paymentMode,
      reference: e.reference,
      status: e.status,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));

    return res.status(200).json({
      expenses: mapped,
      pagination: {
        total: mapped.length,
        page: 1,
        limit: mapped.length,
        totalPages: 1,
      },
    });
  } catch (error) {
    console.error("LIST EXPENSES ERROR:", error);
    return res.status(500).json({
      message: "Unable to load expenses. Please try again.",
    });
  }
};