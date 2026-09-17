import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { toast } from "sonner";
import {
  getNotifications as fetchNotificationsAPI,
  markNotificationAsRead as apiMarkAsRead,
  markAllNotificationsAsRead as apiMarkAllAsRead,
  deleteNotification as apiDeleteNotification,
  clearAllNotifications as apiClearAll,
  getNotificationStreamUrl,
} from "@shared/api/notificationAPI";

export const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  loading: false,
  connected: false,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  deleteNotification: async () => {},
  clearAllNotifications: async () => {},
  refresh: async () => {},
});

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};

export function NotificationProvider({ children, onNav }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Fetch initial notifications from database
  const refresh = useCallback(async () => {
    const token = localStorage.getItem("smartbill_token");
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      setLoading(true);
      const res = await fetchNotificationsAPI();
      if (res && Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
        setUnreadCount(
          typeof res.unreadCount === "number"
            ? res.unreadCount
            : res.notifications.filter((n) => n && !n.read).length
        );
      }
    } catch (err) {
      console.warn("[Notifications] Failed to load notifications:", err?.message || err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark single notification as read
  const markAsRead = useCallback(
    async (id) => {
      if (!id) return;
      const targetId = String(id);
      try {
        // Optimistic update
        setNotifications((prev) => {
          const list = Array.isArray(prev) ? prev : [];
          return list.map((n) =>
            n && String(n._id || n.id) === targetId ? { ...n, read: true } : n
          );
        });
        setUnreadCount((prev) => Math.max(0, prev - 1));

        const res = await apiMarkAsRead(id);
        if (res && typeof res.unreadCount === "number") {
          setUnreadCount(res.unreadCount);
        }
      } catch (err) {
        console.error("[Notifications] markAsRead error:", err);
        refresh();
      }
    },
    [refresh]
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      // Optimistic update
      setNotifications((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        return list.map((n) => (n ? { ...n, read: true } : n));
      });
      setUnreadCount(0);

      await apiMarkAllAsRead();
      try {
        toast.success("All notifications marked as read");
      } catch (_) {}
    } catch (err) {
      console.error("[Notifications] markAllAsRead error:", err);
      refresh();
    }
  }, [refresh]);

  // Delete single notification
  const deleteNotification = useCallback(
    async (id) => {
      if (!id) return;
      const targetId = String(id);
      try {
        // Optimistic update
        setNotifications((prev) => {
          const list = Array.isArray(prev) ? prev : [];
          return list.filter((n) => n && String(n._id || n.id) !== targetId);
        });
        setUnreadCount((prev) => Math.max(0, prev - 1));

        const res = await apiDeleteNotification(id);
        if (res && typeof res.unreadCount === "number") {
          setUnreadCount(res.unreadCount);
        }
        try {
          toast.success("Notification removed");
        } catch (_) {}
      } catch (err) {
        console.error("[Notifications] deleteNotification error:", err);
        refresh();
      }
    },
    [refresh]
  );

  // Clear all notifications
  const clearAllNotifications = useCallback(async () => {
    try {
      setNotifications([]);
      setUnreadCount(0);

      await apiClearAll();
      try {
        toast.success("All notifications cleared");
      } catch (_) {}
    } catch (err) {
      console.error("[Notifications] clearAllNotifications error:", err);
      refresh();
    }
  }, [refresh]);

  // Connect to real-time SSE stream
  useEffect(() => {
    let isSubscribed = true;

    const connectSSE = () => {
      const token = localStorage.getItem("smartbill_token");
      if (!token) {
        setConnected(false);
        return;
      }

      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch (_) {}
      }

      try {
        const streamUrl = getNotificationStreamUrl();
        const es = new EventSource(streamUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (!isSubscribed) return;
          setConnected(true);
        };

        es.onmessage = (event) => {
          if (!isSubscribed || !event.data) return;

          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
              case "CONNECTED":
                setConnected(true);
                if (typeof data.unreadCount === "number") {
                  setUnreadCount(data.unreadCount);
                }
                break;

              case "NEW_NOTIFICATION": {
                const newNotif = data.notification;
                if (!newNotif) break;

                if (
                  newNotif.metadata?.status === "Suspended" ||
                  newNotif.title === "Account Suspended"
                ) {
                  const suspReason = newNotif.metadata?.reason || "";
                  const suspMsg =
                    newNotif.message ||
                    "Your business account has been suspended by administration.";
                  try {
                    sessionStorage.setItem(
                      "smartbill_suspension_notice",
                      JSON.stringify({
                        reason: suspReason,
                        message: suspMsg,
                      })
                    );
                    localStorage.removeItem("smartbill_token");
                    localStorage.removeItem("smartbill_user");
                    window.dispatchEvent(new Event("userUpdated"));
                  } catch (_) {}
                  try {
                    es.close();
                  } catch (_) {}
                  if (!window.location.pathname.includes("/login")) {
                    window.location.href = "/login";
                  }
                  return;
                }

                const newNotifId = String(newNotif._id || newNotif.id || "");

                setNotifications((prev) => {
                  const safeList = Array.isArray(prev) ? prev : [];
                  if (newNotifId) {
                    const exists = safeList.some((item) => {
                      if (!item) return false;
                      const itemId = String(item._id || item.id || "");
                      return itemId === newNotifId;
                    });
                    if (exists) return safeList;
                  }
                  return [newNotif, ...safeList];
                });

                if (typeof data.unreadCount === "number") {
                  setUnreadCount(data.unreadCount);
                } else {
                  setUnreadCount((prev) => prev + 1);
                }

                try {
                  const toastFn =
                    newNotif.type === "error"
                      ? toast.error
                      : newNotif.type === "warning"
                      ? toast.warning
                      : newNotif.type === "success"
                      ? toast.success
                      : toast.info;

                  toastFn(newNotif.title, {
                    description: newNotif.message,
                    duration: 6000,
                    action:
                      newNotif.link && onNav
                        ? {
                            label: "View",
                            onClick: () => onNav(newNotif.link),
                          }
                        : undefined,
                  });
                } catch (_) {}
                break;
              }

              case "NOTIFICATION_READ": {
                const targetId = String(data.notificationId || "");
                if (targetId) {
                  setNotifications((prev) => {
                    const safeList = Array.isArray(prev) ? prev : [];
                    return safeList.map((n) =>
                      n && String(n._id || n.id) === targetId
                        ? { ...n, read: true }
                        : n
                    );
                  });
                }
                if (typeof data.unreadCount === "number") {
                  setUnreadCount(data.unreadCount);
                }
                break;
              }

              case "ALL_READ": {
                setNotifications((prev) => {
                  const safeList = Array.isArray(prev) ? prev : [];
                  return safeList.map((n) => (n ? { ...n, read: true } : n));
                });
                setUnreadCount(0);
                break;
              }

              case "NOTIFICATION_DELETED": {
                const delId = String(data.notificationId || "");
                if (delId) {
                  setNotifications((prev) => {
                    const safeList = Array.isArray(prev) ? prev : [];
                    return safeList.filter(
                      (n) => n && String(n._id || n.id) !== delId
                    );
                  });
                }
                if (typeof data.unreadCount === "number") {
                  setUnreadCount(data.unreadCount);
                }
                break;
              }

              case "ALL_CLEARED": {
                setNotifications([]);
                setUnreadCount(0);
                break;
              }

              case "UNREAD_COUNT_UPDATED": {
                if (typeof data.unreadCount === "number") {
                  setUnreadCount(data.unreadCount);
                }
                break;
              }

              case "INVENTORY_SETTINGS_UPDATED": {
                if (data.settings) {
                  try {
                    localStorage.setItem(
                      "smartbill_inventorySettings",
                      JSON.stringify(data.settings)
                    );
                    window.dispatchEvent(
                      new CustomEvent("inventorySettingsUpdated", {
                        detail: data.settings,
                      })
                    );
                  } catch (_) {}
                }
                break;
              }

              case "ACCOUNT_SUSPENDED": {
                const suspReason = data.reason || "";
                const suspMsg =
                  data.message ||
                  "Your business account has been suspended by administration.";
                try {
                  sessionStorage.setItem(
                    "smartbill_suspension_notice",
                    JSON.stringify({
                      reason: suspReason,
                      message: suspMsg,
                    })
                  );
                  localStorage.removeItem("smartbill_token");
                  localStorage.removeItem("smartbill_user");
                  window.dispatchEvent(new Event("userUpdated"));
                } catch (_) {}
                try {
                  es.close();
                } catch (_) {}
                if (!window.location.pathname.includes("/login")) {
                  window.location.href = "/login";
                }
                break;
              }

              default:
                break;
            }

            if (
              data.type === "NEW_NOTIFICATION" &&
              data.notification?.category === "stock"
            ) {
              window.dispatchEvent(new CustomEvent("stockUpdated"));
            }
          } catch (parseErr) {
            console.debug("[SSE] parse warning:", parseErr?.message);
          }
        };

        es.onerror = () => {
          if (!isSubscribed) return;
          setConnected(false);
          try {
            es.close();
          } catch (_) {}

          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isSubscribed) connectSSE();
          }, 3000);
        };
      } catch (err) {
        console.error("[SSE] Connection setup error:", err?.message);
        setConnected(false);
      }
    };

    refresh();
    connectSSE();

    const pollInterval = setInterval(() => {
      if (isSubscribed && localStorage.getItem("smartbill_token")) {
        fetchNotificationsAPI()
          .then((res) => {
            if (res && Array.isArray(res.notifications)) {
              setNotifications(res.notifications);
              setUnreadCount(
                typeof res.unreadCount === "number"
                  ? res.unreadCount
                  : res.notifications.filter((n) => n && !n.read).length
              );
            }
          })
          .catch(() => {});
      }
    }, 8000);

    const handleAuthChange = () => {
      refresh();
      connectSSE();
    };

    window.addEventListener("userUpdated", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("focus", refresh);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch (_) {}
      }
      window.removeEventListener("userUpdated", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh, onNav]);

  const value = {
    notifications: Array.isArray(notifications) ? notifications : [],
    unreadCount,
    loading,
    connected,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    refresh,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
