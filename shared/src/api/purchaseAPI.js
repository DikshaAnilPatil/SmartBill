import axiosClient from "./axiosClient";

/**
 * Create a purchase entry in the database.
 * Updates stock for purchased products and updates supplier payable balance automatically.
 * @param {object} payload
 * @returns {{ message: string, purchase: object }}
 */
export const createPurchase = (payload) =>
  axiosClient.post("/purchases", payload).then((res) => res.data);

/**
 * Fetch all purchase records for the logged-in user.
 * @param {object} [params]
 * @returns {{ message: string, purchases: Array, pagination?: object }}
 */
export const fetchPurchases = (params = {}) =>
  axiosClient.get("/purchases", { params }).then((res) => res.data);

/**
 * Fetch a single purchase record by ID.
 * @param {string} id
 * @returns {{ message: string, purchase: object }}
 */
export const fetchPurchaseById = (id) =>
  axiosClient.get(`/purchases/${id}`).then((res) => res.data);

/**
 * Record a payment (partial or full) against a purchase.
 * @param {string} id
 * @param {object} paymentData - { amount, paymentMethod, paymentDate, referenceNo, notes }
 * @returns {{ message: string, purchase: object }}
 */
export const recordPurchasePayment = (id, paymentData = {}) =>
  axiosClient.put(`/purchases/${id}/mark-paid`, paymentData).then((res) => res.data);

export const markPurchaseAsPaid = recordPurchasePayment;

/**
 * Process a purchase return / debit note against a purchase bill.
 * @param {string} id
 * @param {{ returnedItems: Array, refundAmount?: number, refundMode?: string, reason?: string, returnDate?: string }} payload
 * @returns {{ success: boolean, message: string, purchase: object, debitNoteNo: string }}
 */
export const createPurchaseReturn = (id, payload) =>
  axiosClient.post(`/purchases/${id}/return`, payload).then((res) => res.data);

/**
 * Delete a purchase record and revert its inventory stock and supplier balance.
 * @param {string} id
 * @returns {{ message: string }}
 */
export const deletePurchaseAPI = (id) =>
  axiosClient.delete(`/purchases/${id}`).then((res) => res.data);

export const deletePurchase = deletePurchaseAPI;

/**
 * Upload or attach a receipt image/PDF to a purchase record.
 * @param {string} id
 * @param {{ receiptUrl: string, receiptName?: string }} payload
 * @returns {{ message: string, purchase: object }}
 */
export const uploadPurchaseReceipt = (id, payload) =>
  axiosClient.put(`/purchases/${id}/receipt`, payload).then((res) => res.data);
