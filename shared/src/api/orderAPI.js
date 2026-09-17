import axiosClient from "./axiosClient";

/**
 * Create an order (sale) and automatically update the customer's
 * running totals (total order value, amount paid, balance due).
 * @param {object} payload
 * @returns {{ message: string, order: object }}
 */
export const createOrder = (payload) =>
  axiosClient.post("/orders", payload).then((res) => res.data);

/**
 * Fetch all orders for the authenticated business owner.
 * @param {object} [params] - { page, limit, search, status, customerId, startDate, endDate }
 * @returns {{ message: string, orders: Array, pagination: object }}
 */
export const fetchOrders = (params = {}) =>
  axiosClient.get("/orders", { params }).then((res) => res.data);

/**
 * Fetch a single order by id.
 * @param {string} id
 * @returns {{ message: string, order: object }}
 */
export const fetchOrder = (id) =>
  axiosClient.get(`/orders/${id}`).then((res) => res.data);

/**
 * Settle payment against an unpaid or partially paid invoice.
 * @param {string} id
 * @param {{ amount: number, paymentMode: string, referenceNo?: string, notes?: string, date?: string }} payload
 * @returns {{ success: boolean, message: string, order: object }}
 */
export const recordOrderPayment = (id, payload) =>
  axiosClient.post(`/orders/${id}/payment`, payload).then((res) => res.data);

/**
 * Process a sales return / credit note against an invoice.
 * @param {string} id
 * @param {{ returnedItems: Array, refundAmount?: number, refundMode?: string, reason?: string, returnDate?: string }} payload
 * @returns {{ success: boolean, message: string, order: object, creditNoteNo: string }}
 */
export const createSalesReturn = (id, payload) =>
  axiosClient.post(`/orders/${id}/return`, payload).then((res) => res.data);

/**
 * Cancel an invoice and restore its inventory stock.
 * @param {string} id
 * @returns {{ success: boolean, message: string }}
 */
export const cancelOrder = (id) =>
  axiosClient.delete(`/orders/${id}`).then((res) => res.data);
