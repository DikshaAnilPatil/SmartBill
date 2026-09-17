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
 * @returns {{ message: string, purchases: Array }}
 */
export const fetchPurchases = () =>
  axiosClient.get("/purchases").then((res) => res.data);

/**
 * Fetch a single purchase record by ID.
 * @param {string} id
 * @returns {{ message: string, purchase: object }}
 */
export const fetchPurchaseById = (id) =>
  axiosClient.get(`/purchases/${id}`).then((res) => res.data);

/**
 * Mark a purchase as fully paid.
 * @param {string} id
 * @returns {{ message: string, purchase: object }}
 */
export const markPurchaseAsPaid = (id) =>
  axiosClient.put(`/purchases/${id}/mark-paid`).then((res) => res.data);

/**
 * Record a payment installment towards a purchase.
 * @param {string} id
 * @param {object} paymentData - { amount, paymentMethod, paymentDate, referenceNo, notes }
 * @returns {{ message: string, purchase: object }}
 */
export const recordPurchasePayment = (id, paymentData) =>
  axiosClient.put(`/purchases/${id}/pay`, paymentData).then((res) => res.data);

/**
 * Create a purchase return / Debit Note.
 * Deducts stock from inventory and updates supplier balance.
 * @param {object} payload
 * @returns {{ message: string, purchaseReturn: object }}
 */
export const createPurchaseReturn = (payload) =>
  axiosClient.post("/purchase-returns", payload).then((res) => res.data);

/**
 * Fetch all purchase return / Debit Note records.
 * @returns {{ message: string, purchaseReturns: Array }}
 */
export const fetchPurchaseReturns = () =>
  axiosClient.get("/purchase-returns").then((res) => res.data);

/**
 * Fetch a single purchase return record by ID.
 * @param {string} id
 * @returns {{ message: string, purchaseReturn: object }}
 */
export const fetchPurchaseReturnById = (id) =>
  axiosClient.get(`/purchase-returns/${id}`).then((res) => res.data);




