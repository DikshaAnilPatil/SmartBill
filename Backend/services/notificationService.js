import Notification from "../models/Notification.js";
import Product from "../models/productModel.js";
import User from "../models/User.js";
import InventorySettings from "../models/InventorySettings.js";

/**
 * In-memory registry of active Server-Sent Events (SSE) connections.
 * Maps ownerId (string) -> Set of active Express `res` streams.
 */
const sseClients = new Map();

/**
 * Dedicated registry of active Super Admin SSE connections for instant system alerts.
 */
const superAdminSockets = new Set();

/**
 * Registers an active client connection for real-time Server-Sent Events.
 */
export const registerSSEClient = async (ownerId, req, res) => {
  const ownerKey = String(ownerId);

  // Set SSE response headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Flush headers immediately if supported
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  // Register the response stream in our client map
  if (!sseClients.has(ownerKey)) {
    sseClients.set(ownerKey, new Set());
  }
  sseClients.get(ownerKey).add(res);

  // Check if this connection belongs to a Super Admin
  try {
    const user = await User.findById(ownerId).select("role email").lean();
    if (
      user?.role === "superadmin" ||
      user?.role === "super-admin" ||
      user?.role === "admin" ||
      user?.email === "gawaliomkar2005@gmail.com"
    ) {
      superAdminSockets.add(res);
      console.log(`[NotificationService] SuperAdmin connected to live SSE stream (Owner ID: ${ownerKey})`);
    } else {
      console.log(`[NotificationService] Business Owner connected to live SSE stream (Owner ID: ${ownerKey})`);
    }
  } catch (err) {
    console.warn("[NotificationService] Role lookup warning on SSE register:", err.message);
  }

  // Run live sync for low stock / trial alerts on initial connection
  try {
    await syncRealtimeAlerts(ownerId);
  } catch (err) {
    console.error("[NotificationService] initial syncRealtimeAlerts error:", err.message);
  }

  // Calculate current unread count
  const unreadCount = await Notification.countDocuments({
    ownerId,
    read: false,
  }).catch(() => 0);

  // Send initial handshake message
  res.write(
    `data: ${JSON.stringify({
      type: "CONNECTED",
      message: "Real-time notification stream active.",
      unreadCount,
      timestamp: new Date().toISOString(),
    })}\n\n`
  );
  if (typeof res.flush === "function") res.flush();

  // Heartbeat ping interval every 25 seconds to keep proxies & browser sockets alive
  const pingInterval = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
      if (typeof res.flush === "function") res.flush();
    } catch (_) {
      clearInterval(pingInterval);
    }
  }, 25000);

  // Clean up on client disconnect
  const cleanup = () => {
    clearInterval(pingInterval);
    superAdminSockets.delete(res);
    const clientSet = sseClients.get(ownerKey);
    if (clientSet) {
      clientSet.delete(res);
      if (clientSet.size === 0) {
        sseClients.delete(ownerKey);
      }
    }
    console.log(`[NotificationService] SSE client disconnected (Owner ID: ${ownerKey})`);
  };

  req.on("close", cleanup);
  res.on("finish", cleanup);
  res.on("error", cleanup);
};

/**
 * Broadcasts an SSE payload to all active client streams for the given ownerId.
 */
export const broadcastToOwner = (ownerId, payload) => {
  if (!ownerId) return;
  const ownerKey = String(ownerId);
  const clientSet = sseClients.get(ownerKey);

  if (clientSet && clientSet.size > 0) {
    const dataStr = `data: ${JSON.stringify(payload)}\n\n`;
    for (const clientRes of Array.from(clientSet)) {
      try {
        clientRes.write(dataStr);
        if (typeof clientRes.flushHeaders === "function") clientRes.flushHeaders();
        if (typeof clientRes.flush === "function") clientRes.flush();
      } catch (err) {
        console.warn("[NotificationService] SSE write failed, cleaning up socket:", err.message);
        clientSet.delete(clientRes);
        superAdminSockets.delete(clientRes);
      }
    }
  }
};

/**
 * Broadcasts an updated unread count to all active client tabs.
 */
export const broadcastUnreadCount = async (ownerId) => {
  try {
    if (!ownerId) return;
    const unreadCount = await Notification.countDocuments({
      ownerId,
      read: false,
    });
    broadcastToOwner(ownerId, {
      type: "UNREAD_COUNT_UPDATED",
      unreadCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[NotificationService] broadcastUnreadCount error:", error.message);
  }
};

/**
 * Creates a single persistent notification, stores it in MongoDB,
 * and immediately broadcasts it to all connected SSE clients in real-time.
 */
export const createNotification = async ({
  ownerId,
  userId = null,
  title,
  message,
  type = "info",
  category = "system",
  link = "",
  metadata = {},
}) => {
  try {
    if (!ownerId || !title || !message) return null;

    // SuperAdmin should never receive store stock/inventory alerts
    if (category === "stock") {
      const recipient = await User.findById(ownerId).select("role").lean();
      if (recipient?.role === "superadmin") {
        return null;
      }
    }

    const notification = await Notification.create({
      ownerId,
      userId: userId || ownerId,
      title: String(title).trim(),
      message: String(message).trim(),
      type,
      category,
      link,
      metadata,
      read: false,
    });

    const unreadCount = await Notification.countDocuments({
      ownerId,
      read: false,
    }).catch(() => 0);

    // Push real-time notification to all active client sessions immediately!
    broadcastToOwner(ownerId, {
      type: "NEW_NOTIFICATION",
      notification: notification.toObject ? notification.toObject() : notification,
      unreadCount,
      timestamp: new Date().toISOString(),
    });

    return notification;
  } catch (error) {
    console.error("[NotificationService] createNotification error:", error.message);
    return null;
  }
};

/**
 * Broadcasts a notification to all active Super Admin accounts on the platform
 * and immediately delivers it live to all open Super Admin browser tabs.
 */
export const notifySuperAdmins = async ({
  title,
  message,
  type = "info",
  category = "system",
  link = "super-dashboard",
  metadata = {},
}) => {
  try {
    const superAdmins = await User.find({
      $or: [
        { role: { $in: ["superadmin", "super-admin", "admin"] } },
        { email: "gawaliomkar2005@gmail.com" },
      ],
    }).lean();

    console.log(`[NotificationService] notifySuperAdmins: broadcasting "${title}" to ${superAdmins.length} admin account(s) and ${superAdminSockets.size} open admin live socket(s).`);

    for (const admin of superAdmins) {
      await createNotification({
        ownerId: admin._id,
        userId: admin._id,
        title,
        message,
        type,
        category,
        link,
        metadata,
      });
    }
  } catch (err) {
    console.error("[NotificationService] notifySuperAdmins error:", err.message);
  }
};

/**
 * Scans real-time live data and generates alerts if not already generated.
 * Separates SuperAdmin alerts (platform monitoring, businesses, subscriptions)
 * from Business Owner alerts (stock levels, invoices, personal trial).
 */
export const syncRealtimeAlerts = async (ownerId) => {
  try {
    if (!ownerId) return;

    const user = await User.findById(ownerId).lean();
    if (!user) return;

    // ── SUPER ADMIN NOTIFICATION SYNC ──
    if (user.role === "superadmin") {
      // 1. Remove any legacy/stale stock notifications on the superadmin account
      await Notification.deleteMany({
        ownerId,
        category: "stock",
      });

      // 2. Alert SuperAdmin on businesses with expiring trials (within 24h)
      const now = new Date();
      const next24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const expiringBusinesses = await User.find({
        role: "owner",
        $or: [
          { "subscription.status": "trialing", "subscription.trialEndsAt": { $gte: now, $lte: next24h } },
          { subscriptionStatus: "trial", trialEndsAt: { $gte: now, $lte: next24h } },
        ],
      }).lean();

      for (const b of expiringBusinesses) {
        const bIdStr = b._id.toString();
        const existingAlert = await Notification.findOne({
          ownerId,
          category: "businesses",
          "metadata.expiringBusinessId": bIdStr,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        }).lean();

        if (!existingAlert) {
          const bName = b.businessName || `${b.firstName} ${b.lastName}`;
          await createNotification({
            ownerId,
            title: `Trial Expiring Soon: ${bName}`,
            message: `${bName} (${b.email}) trial will expire within 24 hours. Consider following up for subscription renewal.`,
            type: "warning",
            category: "businesses",
            link: "businesses",
            metadata: { expiringBusinessId: bIdStr, email: b.email },
          });
        }
      }

      // 3. Ensure SuperAdmin has an initial operational status notification if empty
      const notifCount = await Notification.countDocuments({ ownerId });
      if (notifCount === 0) {
        await createNotification({
          ownerId,
          title: "Admin System Active",
          message: "Welcome to Super Admin. Business registrations, plan subscriptions, and platform alerts will appear in this feed.",
          type: "info",
          category: "system",
          link: "super-dashboard",
          metadata: { systemNotice: true },
        });
      }

      return; // Stop here for SuperAdmin — no inventory low stock checks!
    }

    // ── BUSINESS OWNER / USER NOTIFICATION SYNC ──

    // 1. Sync Low Stock & Out of Stock Alerts for the owner's inventory
    const invSettings = await InventorySettings.findOne({ userId: ownerId }).lean();
    const globalThreshold = Number(invSettings?.lowStockAlert || 10);

    const products = await Product.find({
      $or: [{ userId: ownerId }, { ownerId: ownerId }],
      status: { $ne: "Inactive" },
    }).lean();

    // Get all existing unread stock notifications for this owner
    const existingStockNotifs = await Notification.find({
      ownerId,
      category: "stock",
      read: false,
    }).lean();

    const existingProductAlertMap = new Set();
    for (const notif of existingStockNotifs) {
      if (notif.metadata?.productId) {
        existingProductAlertMap.add(notif.metadata.productId.toString());
      }
    }

    for (const prod of products) {
      const stock = Number(prod.stock || 0);
      const minStock =
        prod.minStock !== undefined && prod.minStock !== null && prod.minStock !== ""
          ? Number(prod.minStock)
          : globalThreshold;
      const prodIdStr = prod._id.toString();

      if (stock <= 0) {
        if (!existingProductAlertMap.has(prodIdStr)) {
          await createNotification({
            ownerId,
            title: `Out of Stock: ${prod.name}`,
            message: `${prod.name} (SKU: ${prod.sku || "N/A"}) is completely out of stock. Replenish inventory now.`,
            type: "error",
            category: "stock",
            link: "inventory",
            metadata: { productId: prodIdStr, sku: prod.sku, stock: 0 },
          });
          existingProductAlertMap.add(prodIdStr);
        }
      } else if (stock <= minStock) {
        if (!existingProductAlertMap.has(prodIdStr)) {
          await createNotification({
            ownerId,
            title: `Low Stock Alert: ${prod.name}`,
            message: `${prod.name} has only ${stock} ${prod.unit || "units"} remaining (Minimum threshold: ${minStock}).`,
            type: "warning",
            category: "stock",
            link: "inventory",
            metadata: { productId: prodIdStr, sku: prod.sku, stock },
          });
          existingProductAlertMap.add(prodIdStr);
        }
      }
    }

    // 2. Sync Trial / Subscription Expiry Alerts for this business owner
    const trialEnd = user.subscription?.trialEndsAt || user.trialEndsAt;
    const isTrial = user.subscription?.status === "trialing" || user.subscriptionStatus === "trial";
    if (isTrial && trialEnd) {
      const now = new Date();
      const trialEnds = new Date(trialEnd);
      const msLeft = trialEnds.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

      if (daysLeft <= 3 && daysLeft >= 0) {
        const existingTrialNotif = await Notification.findOne({
          ownerId,
          category: "subscription",
          read: false,
          "metadata.trialDaysLeft": daysLeft,
        }).lean();

        if (!existingTrialNotif) {
          await createNotification({
            ownerId,
            title: daysLeft === 0 ? "Trial Expires Today" : `Trial Ends in ${daysLeft} Day${daysLeft > 1 ? "s" : ""}`,
            message: `Your SmartBill 14-day free trial will end ${daysLeft === 0 ? "today" : `in ${daysLeft} day(s)`}. Upgrade to retain uninterrupted access.`,
            type: "warning",
            category: "subscription",
            link: "settings",
            metadata: { trialAlert: true, trialDaysLeft: daysLeft },
          });
        }
      }
    }
  } catch (error) {
    console.error("[NotificationService] syncRealtimeAlerts error:", error.message);
  }
};
