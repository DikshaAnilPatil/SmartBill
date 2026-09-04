import TransactionSettings from "../models/TransactionSettings.js";

// GET /api/settings/transaction
export const getTransactionSettings = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    let transaction = await TransactionSettings.findOne({ userId });

    // If no transaction settings exist yet, create default settings
    if (!transaction) {
      transaction = await TransactionSettings.create({
        userId,

        // 1. Pricing & Billing Rules
        salePrice: "Retail Price",
        allowPriceEditing: false,
        allowNegativeStock: false,

        // 2. Discount Management
        allowDiscount: true,
        discountType: "Percentage",
        discountAppliedOn: "Item-wise",
        maximumDiscount: "20",

        // 3. Payment & Checkout
        defaultPaymentMode: "Cash",
        enableRoundOff: false,
        cashDiscountPercent: "0",
        showPrintPreview: true,
        printAfterSaving: false,
      });
    }

    return res.status(200).json({
      message: "Transaction settings retrieved successfully.",
      transactionSettings: transaction,
    });
  } catch (error) {
    console.error("GET TRANSACTION SETTINGS ERROR:", error);

    return res.status(500).json({
      message: "Failed to retrieve transaction settings.",
    });
  }
};

// PUT /api/settings/transaction
export const updateTransactionSettings = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const {
      salePrice,
      allowPriceEditing,
      allowNegativeStock,

      allowDiscount,
      discountType,
      discountAppliedOn,
      maximumDiscount,

      defaultPaymentMode,
      enableRoundOff,
      cashDiscountPercent,
      showPrintPreview,
      printAfterSaving,
    } = req.body;

    const updateDoc = {
      salePrice: salePrice ?? "Retail Price",
      allowPriceEditing: allowPriceEditing ?? false,
      allowNegativeStock: allowNegativeStock ?? false,

      allowDiscount: allowDiscount ?? true,
      discountType: discountType ?? "Percentage",
      discountAppliedOn: discountAppliedOn ?? "Item-wise",
      maximumDiscount: maximumDiscount !== undefined ? String(maximumDiscount) : "20",

      defaultPaymentMode: defaultPaymentMode ?? "Cash",
      enableRoundOff: enableRoundOff ?? false,
      cashDiscountPercent: cashDiscountPercent !== undefined ? String(cashDiscountPercent) : "0",
      showPrintPreview: showPrintPreview ?? true,
      printAfterSaving: printAfterSaving ?? false,
    };

    const transaction = await TransactionSettings.findOneAndUpdate(
      { userId },
      { $set: updateDoc },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      message: "Transaction settings saved successfully.",
      transactionSettings: transaction,
    });
  } catch (error) {
    console.error("UPDATE TRANSACTION SETTINGS ERROR:", error);

    return res.status(400).json({
      message:
        error.message || "Failed to save transaction settings.",
    });
  }
};

export default {
  getTransactionSettings,
  updateTransactionSettings,
};