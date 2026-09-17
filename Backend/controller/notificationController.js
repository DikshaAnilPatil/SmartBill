import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import {
  registerSSEClient,
  syncRealtimeAlerts,
  broadcastUnreadCount,
  broadcastToOwner,
} from "../services/notificationService.js";

// ================= REAL-TIME SSE STREAM =================
export const streamNotifications = async (req, res) => {
  try {
    const ownerId = req.user._id;
    await registerSSEClient(ownerId, req, res);
  } catch (error) {
    console.error("STREAM NOTIFICATIONS ERROR:", error.message);
    if (!res.headersSent) {
      return res.status(500).json({
        message: "Failed to establish notification stream.",
        error: error.message,
      });
    }
  }
};

// ================= GET NOTIFICATIONS =================
export const getNotifications = async (req, res) => {
  try {
    const ownerId = req.user._id;

    // Synchronize live system alerts before responding
    await syncRealtimeAlerts(ownerId);

    const notifications = await Notification.find({ ownerId })
      .sort({ createdAt: -1 })
      .lean();

    const unreadCount = await Notification.countDocuments({
      ownerId,
      read: false,
    });

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("GET NOTIFICATIONS ERROR:", error.message);
    return res.status(500).json({
      message: "Failed to fetch notifications.",
      error: error.message,
    });
  }
};

// ================= MARK SINGLE NOTIFICATION AS READ =================
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user._id;

    if (!id || id === "undefined" || id === "null") {
      return res.status(400).json({ message: "Invalid notification ID." });
    }

    let notification = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      notification = await Notification.findOneAndUpdate(
        { _id: id, ownerId },
        { $set: { read: true } },
        { new: true }
      ).lean();
    }

    const unreadCount = await Notification.countDocuments({
      ownerId,
      read: false,
    });

    // Notify all open tabs/clients in real time
    broadcastToOwner(ownerId, {
      type: "NOTIFICATION_READ",
      notificationId: id,
      unreadCount,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      notification: notification || { _id: id, read: true },
      unreadCount,
    });
  } catch (error) {
    console.error("MARK AS READ ERROR:", error.message);
    return res.status(500).json({
      message: "Failed to mark notification as read.",
      error: error.message,
    });
  }
};

// ================= MARK ALL NOTIFICATIONS AS READ =================
export const markAllAsRead = async (req, res) => {
  try {
    const ownerId = req.user._id;

    await Notification.updateMany(
      { ownerId, read: false },
      { $set: { read: true } }
    );

    // Notify all open tabs/clients in real time
    broadcastToOwner(ownerId, {
      type: "ALL_READ",
      unreadCount: 0,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
      unreadCount: 0,
    });
  } catch (error) {
    console.error("MARK ALL AS READ ERROR:", error.message);
    return res.status(500).json({
      message: "Failed to mark all notifications as read.",
      error: error.message,
    });
  }
};

// ================= DELETE SINGLE NOTIFICATION =================
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user._id;

    if (!id || id === "undefined" || id === "null") {
      return res.status(400).json({ message: "Invalid notification ID." });
    }

    let deleted = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      deleted = await Notification.findOneAndDelete({
        _id: id,
        ownerId,
      }).lean();
    }

    const unreadCount = await Notification.countDocuments({
      ownerId,
      read: false,
    });

    // Notify all open tabs/clients in real time
    broadcastToOwner(ownerId, {
      type: "NOTIFICATION_DELETED",
      notificationId: id,
      unreadCount,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: "Notification removed.",
      unreadCount,
    });
  } catch (error) {
    console.error("DELETE NOTIFICATION ERROR:", error.message);
    return res.status(500).json({
      message: "Failed to delete notification.",
      error: error.message,
    });
  }
};

// ================= CLEAR ALL NOTIFICATIONS =================
export const clearAllNotifications = async (req, res) => {
  try {
    const ownerId = req.user._id;

    await Notification.deleteMany({ ownerId });

    // Notify all open tabs/clients in real time
    broadcastToOwner(ownerId, {
      type: "ALL_CLEARED",
      unreadCount: 0,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: "All notifications cleared.",
      unreadCount: 0,
    });
  } catch (error) {
    console.error("CLEAR ALL NOTIFICATIONS ERROR:", error.message);
    return res.status(500).json({
      message: "Failed to clear notifications.",
      error: error.message,
    });
  }
};
