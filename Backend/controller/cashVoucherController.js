import CashVoucher from "../models/CashVoucher.js";
import Supplier from "../models/Supplier.js";

export function getVoucherBalanceDelta(voucher) {
  const amountDue = Number(voucher.amountDue);
  const amountPaid = Number(voucher.amountPaid ?? voucher.amount) || 0;

  // Legacy vouchers already reduced the supplier balance by their paid amount.
  if (!Number.isFinite(amountDue)) return amountPaid;
  return Math.round((amountDue - amountPaid) * 100) / 100;
}

function getAppliedBalanceDelta(voucher) {
  if (voucher.balanceAdjustmentApplied === true) {
    return getVoucherBalanceDelta(voucher);
  }

  // Vouchers created before net-delta accounting reduced the balance by paid amount.
  return -(Number(voucher.amountPaid ?? voucher.amount) || 0);
}

/**
 * Generate next sequence voucher number for the business e.g. CV-2026-0001
 */
async function generateNextVoucherNo(userId) {
  const year = new Date().getFullYear();
  const prefix = `CV-${year}-`;
  
  // Find latest voucher for this user starting with prefix
  const latest = await CashVoucher.findOne({
    userId,
    voucherNo: { $regex: `^${prefix}` },
  }).sort({ createdAt: -1 });

  if (!latest || !latest.voucherNo) {
    return `${prefix}0001`;
  }

  const parts = latest.voucherNo.split("-");
  const lastSeq = parseInt(parts[parts.length - 1], 10);
  const nextSeq = isNaN(lastSeq) ? 1 : lastSeq + 1;
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

// @desc    Get all cash vouchers for user business
// @route   GET /api/cash-vouchers
// @access  Private
export const getCashVouchers = async (req, res) => {
  try {
    const userId = req.user._id;
    const { search, paymentMode, accountHead, fromDate, toDate } = req.query;

    const filter = { userId };

    if (paymentMode && paymentMode !== "all") {
      filter.paymentMode = paymentMode;
    }

    if (accountHead && accountHead !== "all") {
      filter.accountHead = accountHead;
    }

    if (fromDate || toDate) {
      filter.voucherDate = {};
      if (fromDate) filter.voucherDate.$gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        filter.voucherDate.$lte = to;
      }
    }

    if (search) {
      const q = search.trim();
      filter.$or = [
        { voucherNo: { $regex: q, $options: "i" } },
        { supplierName: { $regex: q, $options: "i" } },
        { referenceNo: { $regex: q, $options: "i" } },
        { narration: { $regex: q, $options: "i" } },
      ];
    }

    const vouchers = await CashVoucher.find(filter)
      .populate("supplierId", "name phone email balance")
      .sort({ voucherDate: -1, createdAt: -1 });

    // Calculate Summary Stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allUserVouchers = await CashVoucher.find({ userId });
    const totalAmount = allUserVouchers.reduce((acc, v) => acc + (Number(v.amount) || 0), 0);
    const totalVouchers = allUserVouchers.length;

    const todayVouchers = allUserVouchers.filter((v) => new Date(v.voucherDate) >= today);
    const todayAmount = todayVouchers.reduce((acc, v) => acc + (Number(v.amount) || 0), 0);
    const todayCount = todayVouchers.length;

    res.status(200).json({
      success: true,
      vouchers,
      stats: {
        totalAmount,
        totalVouchers,
        todayAmount,
        todayCount,
      },
    });
  } catch (error) {
    console.error("GET CASH VOUCHERS ERROR:", error);
    res.status(500).json({ message: error.message || "Failed to fetch cash vouchers." });
  }
};

// @desc    Create a new cash voucher
// @route   POST /api/cash-vouchers
// @access  Private
export const createCashVoucher = async (req, res) => {
  try {
    const userId = req.user._id;
    const ownerId = req.user.ownerId || req.user._id;
    const {
      supplierId,
      supplierName,
      vendorPhone,
      vendorAddress,
      vendorGst,
      amount,
      amountDue,
      amountPaid,
      accountHead,
      referenceNo,
      paidBy,
      receivedBy,
      narration,
      voucherDate,
      adjustSupplierBalance,
    } = req.body;

    if (!supplierName || !supplierName.trim()) {
      return res.status(400).json({ message: "Vendor / Payee Name is required." });
    }

    const numAmountDue = Number(amountDue ?? amount);
    const numAmountPaid = Number(amountPaid ?? amount);
    if (!Number.isFinite(numAmountDue) || numAmountDue <= 0) {
      return res.status(400).json({ message: "Please enter a valid Amount Due greater than 0." });
    }
    if (!Number.isFinite(numAmountPaid) || numAmountPaid < 0) {
      return res.status(400).json({ message: "Amount Paid must be 0 or greater." });
    }
    const voucherNo = await generateNextVoucherNo(userId);

    const voucher = await CashVoucher.create({
      userId,
      voucherNo,
      voucherDate: voucherDate ? new Date(voucherDate) : new Date(),
      supplierId: supplierId || null,
      supplierName: supplierName.trim(),
      vendorPhone: vendorPhone || "",
      vendorAddress: vendorAddress || "",
      vendorGst: vendorGst || "",
      amount: numAmountPaid,
      amountDue: numAmountDue,
      amountPaid: numAmountPaid,
      remainingBalance: Math.round((numAmountDue - numAmountPaid) * 100) / 100,
      balanceAdjustmentApplied: false,
      paymentMode: "Cash",
      accountHead: accountHead || "Vendor Payment",
      referenceNo: referenceNo || "",
      paidBy: paidBy || req.user.name || "Cashier / Manager",
      receivedBy: receivedBy || "",
      narration: narration || "",
      adjustSupplierBalance: adjustSupplierBalance !== false,
      status: "Paid",
    });

    // Only a registered supplier receives the bill's net balance delta. Custom payees do not.
    if (supplierId && voucher.adjustSupplierBalance) {
      const balanceDelta = getVoucherBalanceDelta(voucher);
      const supplier = await Supplier.findOneAndUpdate(
        { _id: supplierId, ownerId },
        { $inc: { balance: balanceDelta } },
        { new: true }
      );
      if (supplier) {
        voucher.balanceAdjustmentApplied = true;
        await voucher.save();
      }
    }

    res.status(201).json({
      success: true,
      message: `Cash Voucher ${voucherNo} created successfully!`,
      voucher,
    });
  } catch (error) {
    console.error("CREATE CASH VOUCHER ERROR:", error);
    res.status(500).json({ message: error.message || "Failed to create cash voucher." });
  }
};

// @desc    Update a cash voucher
// @route   PUT /api/cash-vouchers/:id
// @access  Private
export const updateCashVoucher = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const existing = await CashVoucher.findOne({ _id: id, userId });
    if (!existing) {
      return res.status(404).json({ message: "Cash Voucher not found." });
    }

    const oldBalanceDelta = getAppliedBalanceDelta(existing);
    const oldAdjust = existing.adjustSupplierBalance;
    const oldSupplierId = existing.supplierId;

    const requestedDue = req.body.amountDue ?? req.body.amount;
    const requestedPaid = req.body.amountPaid ?? req.body.amount;
    const newAmountDue = Number(requestedDue ?? existing.amountDue ?? existing.amount);
    const newAmountPaid = Number(requestedPaid ?? existing.amountPaid ?? existing.amount);
    if (!Number.isFinite(newAmountDue) || newAmountDue <= 0) {
      return res.status(400).json({ message: "Please enter a valid Amount Due greater than 0." });
    }
    if (!Number.isFinite(newAmountPaid) || newAmountPaid < 0) {
      return res.status(400).json({ message: "Amount Paid must be 0 or greater." });
    }
    const allowedFields = [
      "voucherDate", "supplierId", "supplierName", "vendorPhone", "vendorAddress",
      "vendorGst", "accountHead", "referenceNo", "paidBy", "receivedBy", "narration",
      "adjustSupplierBalance",
    ];
    const updateFields = Object.fromEntries(
      allowedFields.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field))
        .map((field) => [field, req.body[field]])
    );
    Object.assign(updateFields, {
      amount: newAmountPaid,
      amountDue: newAmountDue,
      amountPaid: newAmountPaid,
      remainingBalance: Math.round((newAmountDue - newAmountPaid) * 100) / 100,
      paymentMode: "Cash",
    });

    const updated = await CashVoucher.findOneAndUpdate(
      { _id: id, userId },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    const newAdjust = updated.adjustSupplierBalance;
    const newSupplierId = updated.supplierId;

    const newBalanceDelta = getVoucherBalanceDelta(updated);
    const ownerId = req.user.ownerId || req.user._id;

    // Revert the old net delta, then apply the updated voucher's net delta.
    if (oldSupplierId && oldAdjust && (existing.balanceAdjustmentApplied === true || existing.balanceAdjustmentApplied === undefined)) {
      await Supplier.findOneAndUpdate(
        { _id: oldSupplierId, ownerId },
        { $inc: { balance: -oldBalanceDelta } }
      );
    }

    if (newSupplierId && newAdjust) {
      await Supplier.findOneAndUpdate(
        { _id: newSupplierId, ownerId },
        { $inc: { balance: newBalanceDelta } }
      );
      updated.balanceAdjustmentApplied = true;
      await updated.save();
    }

    res.status(200).json({
      success: true,
      message: "Cash Voucher updated successfully!",
      voucher: updated,
    });
  } catch (error) {
    console.error("UPDATE CASH VOUCHER ERROR:", error);
    res.status(500).json({ message: error.message || "Failed to update cash voucher." });
  }
};

// @desc    Delete a cash voucher
// @route   DELETE /api/cash-vouchers/:id
// @access  Private
export const deleteCashVoucher = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const voucher = await CashVoucher.findOne({ _id: id, userId });
    if (!voucher) {
      return res.status(404).json({ message: "Cash Voucher not found." });
    }

    // Revert balance on supplier if it was adjusted
    if (
      voucher.supplierId &&
      voucher.adjustSupplierBalance &&
      voucher.balanceAdjustmentApplied !== false
    ) {
      const balanceDelta = getAppliedBalanceDelta(voucher);
      await Supplier.findOneAndUpdate(
        { _id: voucher.supplierId, ownerId: req.user.ownerId || req.user._id },
        { $inc: { balance: -balanceDelta } }
      );
    }

    await CashVoucher.deleteOne({ _id: id, userId });

    res.status(200).json({
      success: true,
      message: `Cash Voucher ${voucher.voucherNo} deleted successfully.`,
    });
  } catch (error) {
    console.error("DELETE CASH VOUCHER ERROR:", error);
    res.status(500).json({ message: error.message || "Failed to delete cash voucher." });
  }
};
