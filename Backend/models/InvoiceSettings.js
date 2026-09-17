import mongoose from "mongoose";

const invoiceSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    // General Settings
    invoicePrefix: { type: String, default: "INV" },
    startingNumber: { type: Number, default: 1 },
    autoNumbering: { type: Boolean, default: true },
    financialYearWise: { type: Boolean, default: true },
    invoiceTitle: { type: String, default: "Tax Invoice" },
    defaultType: { type: String, default: "Tax Invoice" },
    dateFormat: { type: String, default: "DD-MM-YYYY" },
    
    // Customer Display
    showCustomerName: { type: Boolean, default: true },
    showCustomerMobile: { type: Boolean, default: true },
    showBillingAddress: { type: Boolean, default: true },
    showShippingAddress: { type: Boolean, default: false },
    showCustomerGSTIN: { type: Boolean, default: true },
    
    // Item Columns
    showHSN: { type: Boolean, default: true },
    showDescription: { type: Boolean, default: true },
    showSKU: { type: Boolean, default: false },
    showDiscount: { type: Boolean, default: true },
    showTax: { type: Boolean, default: true },
    showBatch: { type: Boolean, default: false },
    
    // GST & Tax
    enableGST: { type: Boolean, default: true },
    defaultTaxMode: { type: String, default: "Exclusive" },
    taxInclusivePricing: { type: Boolean, default: false },
    
    // Payment
    defaultPaymentMode: { type: String, default: "Cash" },
    showPaymentStatus: { type: Boolean, default: true },
    showBalanceDue: { type: Boolean, default: true },
    
    // Bank & UPI
    bankName: { type: String, default: "" },
    accountHolder: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    branch: { type: String, default: "" },
    upiId: { type: String, default: "" },
    showBankDetails: { type: Boolean, default: false },
    showUPIQR: { type: Boolean, default: false },
    
    // Footer & Terms
    invoiceFooter: { type: String, default: "Thank you for your business!" },
    customerNotes: { type: String, default: "" },
    termsAndConditions: { type: String, default: "1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged on overdue payments." },
    signatureUrl: { type: String, default: "" },
    showSignature: { type: Boolean, default: false },
    
    // Appearance & Template Customization
    template: { type: String, default: "classic_gst" }, 
    defaultTemplate: { type: String, default: "classic_gst" },
    primaryColor: { type: String, default: "#2563eb" },
    secondaryColor: { type: String, default: "#64748b" },
    accentColor: { type: String, default: "#f59e0b" },
    fontFamily: { type: String, default: "Inter" },
    fontSize: { type: String, default: "medium" }, // small, medium, large
    paperSize: { type: String, default: "A4" }, // A4, A5, Thermal 80mm, Thermal 58mm
    headerLayout: { type: String, default: "standard" }, // standard, split, centered, banner, minimal
    tableStyle: { type: String, default: "bordered" }, // bordered, striped, minimal, modern_filled
    borderStyle: { type: String, default: "solid" }, // solid, subtle, rounded, clean
    
    // Logo & Header Options
    showLogo: { type: Boolean, default: true },
    logoPosition: { type: String, default: "left" }, // left, center, right
    logoSize: { type: String, default: "medium" }, // small, medium, large
    
    // Advanced Section & GST Toggles
    showPlaceOfSupply: { type: Boolean, default: true },
    showStateCode: { type: Boolean, default: true },
    showReverseCharge: { type: Boolean, default: false },
    showTaxBreakdown: { type: Boolean, default: true },
    showCess: { type: Boolean, default: false },
    showAmountInWords: { type: Boolean, default: true },
    showComputerGeneratedNotice: { type: Boolean, default: true },
    showPaidAmount: { type: Boolean, default: true },
    showTotalInWords: { type: Boolean, default: true },
    showDueDate: { type: Boolean, default: true },
    showPOReference: { type: Boolean, default: true },
    
    // Custom saved presets
    customTemplates: {
      type: [
        {
          id: { type: String },
          name: { type: String },
          template: { type: String },
          config: { type: mongoose.Schema.Types.Mixed },
          createdAt: { type: Date, default: Date.now },
          updatedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("InvoiceSettings", invoiceSettingsSchema);
