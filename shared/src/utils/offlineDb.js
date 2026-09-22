/**
 * offlineDb.js
 * Browser IndexedDB manager for SmartBill POS Offline Resilience.
 * Allows cashiers to bill customers without interruption during internet outages.
 */

const DB_NAME = "SmartBill_Offline_DB";
const DB_VERSION = 1;
const STORE_ORDERS = "offline_orders";
const STORE_PRODUCTS = "cached_products";

const openDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this environment."));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_ORDERS)) {
        db.createObjectStore(STORE_ORDERS, { keyPath: "offlineId" });
      }
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        db.createObjectStore(STORE_PRODUCTS, { keyPath: "_id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Save an offline order when server is unreachable
 */
export const saveOfflineOrder = async (orderPayload) => {
  try {
    const db = await openDB();
    const offlineId = `OFFLINE_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const offlineRecord = {
      ...orderPayload,
      offlineId,
      isOfflineOrder: true,
      offlineCreatedAt: new Date().toISOString(),
      offlineInvoiceNo: `OFF-INV-${Date.now().toString().slice(-6)}`,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_ORDERS], "readwrite");
      const store = transaction.objectStore(STORE_ORDERS);
      const req = store.put(offlineRecord);

      req.onsuccess = () => resolve(offlineRecord);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("[OfflineDB] Failed to save offline order:", err);
    throw err;
  }
};

/**
 * Retrieve all pending offline orders awaiting sync
 */
export const getPendingOfflineOrders = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_ORDERS], "readonly");
      const store = transaction.objectStore(STORE_ORDERS);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[OfflineDB] Failed to load pending offline orders:", err);
    return [];
  }
};

/**
 * Remove an offline order after successful backend sync
 */
export const removeOfflineOrder = async (offlineId) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_ORDERS], "readwrite");
      const store = transaction.objectStore(STORE_ORDERS);
      const req = store.delete(offlineId);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("[OfflineDB] Failed to delete offline order:", err);
    return false;
  }
};

/**
 * Cache products locally for offline search and POS barcode scanning
 */
export const cacheProductsForOffline = async (products = []) => {
  try {
    if (!Array.isArray(products) || products.length === 0) return;
    const db = await openDB();
    const transaction = db.transaction([STORE_PRODUCTS], "readwrite");
    const store = transaction.objectStore(STORE_PRODUCTS);

    for (const product of products) {
      if (product?._id) {
        store.put(product);
      }
    }
  } catch (err) {
    console.warn("[OfflineDB] Product caching notice:", err);
  }
};

/**
 * Get locally cached products during network outage
 */
export const getCachedProducts = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PRODUCTS], "readonly");
      const store = transaction.objectStore(STORE_PRODUCTS);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[OfflineDB] Failed to load cached products:", err);
    return [];
  }
};
