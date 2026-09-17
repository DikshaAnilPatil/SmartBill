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

    // Make sure user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

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
      const settings = await AccountingSettings.findOne({ userId: req.user.id }).lean();
      if (settings?.strictNegativeCash) {
        const cashBalance = await getCashBalance(req.user.id);
        if (cashBalance - amountNumber < 0) {
          return res.status(400).json({ 
            message: `Strict Negative Cash Rule is enabled. Your cash balance is ${cashBalance}, which is insufficient for this ${amountNumber} expense.`
          });
        }
      }
    }

    // Create expense for the logged-in user
    const created = await Expense.create({
      user: req.user.id,

      category: String(category || "Other").trim(),

      description: String(description).trim(),

      amount: amountNumber,

      date: date || new Date(),

      paymentMode: finalPaymentMode,

      reference: String(reference ?? "").trim(),

      status: status === "Pending" ? "Pending" : "Paid",
    });

    // Return clean expense object
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
      const ownerId = req.user._id || req.user.id || req.user.ownerId;
      await createNotification({
        ownerId,
        userId: req.user.actualUserId || req.user._id || req.user.id,
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
      message: "Unable to create expense. Please try again.",
    });
  }
};

// ================= LIST EXPENSES =================

export const listExpenses = async (req, res) => {
  try {
    // Make sure user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    // IMPORTANT:
    // Only fetch expenses belonging to the logged-in user.
    const expenses = await Expense.find({
      user: req.user.id,
    }).sort({
      createdAt: -1,
    });

    const mapped = expenses.map((e) => ({
      id: e._id.toString(),
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
    });
  } catch (error) {
    console.error("LIST EXPENSES ERROR:", error);

    return res.status(500).json({
      message: "Unable to load expenses. Please try again.",
    });
  }
};

// ================= UPDATE EXPENSE =================

export const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      category,
      description,
      amount,
      date,
      paymentMode,
      reference,
      status,
    } = req.body;

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    const expenseDoc = await Expense.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!expenseDoc) {
      return res.status(404).json({
        message: "Expense not found.",
      });
    }

    if (category !== undefined) expenseDoc.category = String(category).trim();
    if (description !== undefined) expenseDoc.description = String(description).trim();
    if (amount !== undefined) expenseDoc.amount = Number(amount);
    if (date !== undefined) expenseDoc.date = date;
    if (paymentMode !== undefined) expenseDoc.paymentMode = String(paymentMode).trim();
    if (reference !== undefined) expenseDoc.reference = String(reference).trim();
    if (status !== undefined) expenseDoc.status = status === "Pending" ? "Pending" : "Paid";

    await expenseDoc.save();

    const expense = {
      id: expenseDoc._id.toString(),
      category: expenseDoc.category,
      description: expenseDoc.description,
      amount: expenseDoc.amount,
      date: expenseDoc.date,
      paymentMode: expenseDoc.paymentMode,
      reference: expenseDoc.reference,
      status: expenseDoc.status,
      createdAt: expenseDoc.createdAt,
      updatedAt: expenseDoc.updatedAt,
    };

    return res.status(200).json({
      message: "Expense updated successfully.",
      expense,
    });
  } catch (error) {
    console.error("UPDATE EXPENSE ERROR:", error);

    return res.status(500).json({
      message: "Unable to update expense. Please try again.",
    });
  }
};

// ================= DELETE EXPENSE =================

export const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    const expenseDoc = await Expense.findOneAndDelete({
      _id: id,
      user: req.user.id,
    });

    if (!expenseDoc) {
      return res.status(404).json({
        message: "Expense not found.",
      });
    }

    return res.status(200).json({
      message: "Expense deleted successfully.",
      id,
    });
  } catch (error) {
    console.error("DELETE EXPENSE ERROR:", error);

    return res.status(500).json({
      message: "Unable to delete expense. Please try again.",
    });
  }
};