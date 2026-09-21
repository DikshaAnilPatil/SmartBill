import InvoiceSettings from "../models/InvoiceSettings.js";

// @desc    Get invoice settings for user / tenant
// @route   GET /api/settings/invoice
// @access  Private
export const getInvoiceSettings = async (req, res) => {
  try {
    const tenantId = req.user.ownerId || req.user._id;
    let settings = await InvoiceSettings.findOne({ userId: tenantId });
    
    // Create defaults if they don't exist
    if (!settings) {
      settings = await InvoiceSettings.create({ userId: tenantId });
    }
    
    res.status(200).json({ settings });
  } catch (error) {
    console.error("GET INVOICE SETTINGS ERROR:", error.message);
    res.status(500).json({ message: "Failed to fetch invoice settings." });
  }
};

// @desc    Update invoice settings
// @route   PUT /api/settings/invoice
// @access  Private
export const updateInvoiceSettings = async (req, res) => {
  try {
    const tenantId = req.user.ownerId || req.user._id;
    const { _id, userId, createdAt, updatedAt, __v, ...cleanData } = req.body || {};
    
    const settings = await InvoiceSettings.findOneAndUpdate(
      { userId: tenantId },
      { 
        $set: cleanData,
        $setOnInsert: { userId: tenantId }
      },
      { new: true, upsert: true, runValidators: true }
    );
    
    res.status(200).json({ message: "Invoice settings updated successfully", settings });
  } catch (error) {
    console.error("UPDATE INVOICE SETTINGS ERROR:", error.message);
    res.status(500).json({ message: error.message || "Failed to update invoice settings." });
  }
};

