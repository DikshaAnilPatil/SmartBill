import mongoose from "mongoose";

const accountingSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    // Basic Accounting
    accountingMethod: { type: String, default: "Accrual" },
    doubleEntry: { type: Boolean, default: true },
    accountsReceivable: { type: Boolean, default: true },
    accountsPayable: { type: Boolean, default: true },
    autoLedgerEntries: { type: Boolean, default: true },

    // Financial Year
    fiscalYearStart: { type: String, default: "April" },

    // Currency & Number Format
    baseCurrency: { type: String, default: "INR (₹)" },
    numberFormat: { type: String, default: "Indian" },
    decimalPlaces: { type: Number, default: 2 },

    // Tax & Inventory Accounting
    enableTaxAccounting: { type: Boolean, default: true },
    trackCogs: { type: Boolean, default: true },
    inventoryValuation: { type: String, default: "FIFO" },

    // Sales & Purchase Accounting
    defaultSalesAccount: { type: String, default: "Sales Revenue" },
    defaultPurchaseAccount: { type: String, default: "Cost of Goods Sold" },
    trackReturns: { type: Boolean, default: true },
    trackDiscounts: { type: Boolean, default: true },
    enableRoundOff: { type: Boolean, default: true },

    // Payments & Journal
    defaultCashAccount: { type: String, default: "Cash in Hand" },
    enableJournalSettings: { type: Boolean, default: true },
    documentNumbering: { type: String, default: "Auto" },

    // Advanced Settings
    strictNegativeCash: { type: Boolean, default: false },
    enableCostCenters: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("AccountingSettings", accountingSettingsSchema);
