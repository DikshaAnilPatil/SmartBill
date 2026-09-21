import mongoose from "mongoose";

/**
 * ============================================================================
 * INVOICE SETTINGS SCHEMA (Multi-Tenant Invoice Configuration & Layout Engine)
 * ============================================================================
 * 
 * PURPOSE:
 * Defines tenant-level invoice customization, numbering rules, tax compliance 
 * (GST), payment gateway/UPI credentials, thermal/A4 print styling, and column 
 * visibility toggles for the SmartBill POS & Invoicing engine.
 * 
 * ROLE IN ARCHITECTURE:
 * - 1-to-1 relationship per merchant / business owner (userId).
 * - Acts as single source of truth for POS print templates & PDF generation.
 * - Enforces dynamic column projections (HSN, Batch, SKU, Discount, Tax).
 * - Configures hardware print profiles (A4, A5, Thermal 80mm/58mm).
 */

const invoiceSettingsSchema = new mongoose.Schema(
  {
    /**
     * @property {ObjectId} userId - Tenant reference (Strict 1-to-1 with User model)
     * Enforces tenant data isolation across the multi-tenant SaaS.
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // =========================================================================
    // 1. GENERAL INVOICE NUMBERING & FORMATTING
    // =========================================================================
    /** Prefix prepended to auto-generated bills (e.g., 'INV', 'BILL', 'SB') */
    invoicePrefix: { type: String, default: "INV" },
    /** Starting sequence number for new invoice counter */
    startingNumber: { type: Number, default: 1 },
    /** Automatically increments bill number on successful order generation */
    autoNumbering: { type: Boolean, default: true },
    /** Appends financial year notation to number sequence (e.g. INV/2026-27/001) */
    financialYearWise: { type: Boolean, default: true },
    /** Document title displayed on the header (e.g. 'Tax Invoice', 'Bill of Supply') */
    invoiceTitle: { type: String, default: "Tax Invoice" },
    /** Default invoice document classification */
    defaultType: { type: String, default: "Tax Invoice" },
    /** Date display formatting string */
    dateFormat: { type: String, default: "DD-MM-YYYY" },
    
    // =========================================================================
    // 2. CUSTOMER INFORMATION VISIBILITY TOGGLES
    // =========================================================================
    showCustomerName: { type: Boolean, default: true },
    showCustomerMobile: { type: Boolean, default: true },
    showBillingAddress: { type: Boolean, default: true },
    showShippingAddress: { type: Boolean, default: false },
    showCustomerGSTIN: { type: Boolean, default: true },
    
    // =========================================================================
    // 3. INVOICE TABLE ITEM COLUMN PROJECTIONS
    // =========================================================================
    showHSN: { type: Boolean, default: true },
    showDescription: { type: Boolean, default: true },
    showSKU: { type: Boolean, default: false },
    showDiscount: { type: Boolean, default: true },
    showTax: { type: Boolean, default: true },
    showBatch: { type: Boolean, default: false },
    
    // =========================================================================
    // 4. GST & TAX COMPLIANCE CONFIGURATION
    // =========================================================================
    /** Toggles GST tax calculation breakdowns on printable invoices */
    enableGST: { type: Boolean, default: true },
    /** Tax calculation mode: 'Exclusive' (Tax added to base price) or 'Inclusive' */
    defaultTaxMode: { type: String, default: "Exclusive" },
    /** When enabled, catalog product prices already include GST */
    taxInclusivePricing: { type: Boolean, default: false },
    
    // =========================================================================
    // 5. PAYMENT METHODS & SETTLEMENT DISPLAY
    // =========================================================================
    defaultPaymentMode: { type: String, default: "Cash" },
    showPaymentStatus: { type: Boolean, default: true },
    showBalanceDue: { type: Boolean, default: true },
    
    // =========================================================================
    // 6. BANKING, NEFT & UPI QR CODE INTEGRATION
    // =========================================================================
    bankName: { type: String, default: "" },
    accountHolder: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    branch: { type: String, default: "" },
    /** Merchant UPI VPA (e.g. merchant@okhdfcbank) used to dynamically generate QR */
    upiId: { type: String, default: "" },
    showBankDetails: { type: Boolean, default: false },
    /** Generates real-time scannable UPI payment QR code on the invoice footer */
    showUPIQR: { type: Boolean, default: false },
    
    // =========================================================================
    // 7. FOOTER, TERMS & DIGITAL SIGNATURE
    // =========================================================================
    invoiceFooter: { type: String, default: "Thank you for your business!" },
    customerNotes: { type: String, default: "" },
    termsAndConditions: { 
      type: String, 
      default: "1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged on overdue payments." 
    },
    signatureUrl: { type: String, default: "" },
    showSignature: { type: Boolean, default: false },
    
    // =========================================================================
    // 8. VISUAL BRANDING, TYPOGRAPHY & HARDWARE PRINT PROFILES
    // =========================================================================
    /** Active layout template key: 'classic_gst', 'minimal', 'modern', etc. */
    template: { type: String, default: "classic_gst" }, 
    defaultTemplate: { type: String, default: "classic_gst" },
    primaryColor: { type: String, default: "#2563eb" },
    secondaryColor: { type: String, default: "#64748b" },
    accentColor: { type: String, default: "#f59e0b" },
    fontFamily: { type: String, default: "Inter" },
    fontSize: { type: String, default: "medium" }, // 'small', 'medium', 'large'
    /** Output paper size: 'A4', 'A5', 'Thermal 80mm', 'Thermal 58mm' */
    paperSize: { type: String, default: "A4" },
    headerLayout: { type: String, default: "standard" }, // 'standard', 'split', 'centered', 'banner', 'minimal'
    tableStyle: { type: String, default: "bordered" }, // 'bordered', 'striped', 'minimal', 'modern_filled'
    borderStyle: { type: String, default: "solid" }, // 'solid', 'subtle', 'rounded', 'clean'
    
    // =========================================================================
    // 9. LOGO & HEADER DISPLAY OPTIONS
    // =========================================================================
    showLogo: { type: Boolean, default: true },
    logoPosition: { type: String, default: "left" }, // 'left', 'center', 'right'
    logoSize: { type: String, default: "medium" }, // 'small', 'medium', 'large'
    
    // =========================================================================
    // 10. ADVANCED GST & STATUTORY COMPLIANCE FIELDS
    // =========================================================================
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
    
    // =========================================================================
    // 11. SAVED CUSTOM PRESET TEMPLATES (Schemaless Extensibility)
    // =========================================================================
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
  { 
    /** Automatically generates `createdAt` and `updatedAt` ISO timestamps */
    timestamps: true 
  }
);

export default mongoose.model("InvoiceSettings", invoiceSettingsSchema);

