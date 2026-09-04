import axiosClient from "./axiosClient";

/**
 * Create an order (sale) and automatically update the customer's
 * running totals (total order value, amount paid, balance due).
 * @param {object} payload
 * @param {string|null} payload.customerId
 * @param {string} payload.customerName
 * @param {Array} payload.items
 * @param {number} payload.subtotal
 * @param {number} payload.gstRate
 * @param {number} payload.gst
 * @param {number} payload.totalOrderValue
* @param {number} payload.amountPaid
 * @param {string} payload.paymentMode
 * @returns {{ message: string, order: object }}
 */
export const createOrder = (payload) =>
  axiosClient.post("/orders", payload).then((res) => res.data);

/**
 * Fetch all orders for the authenticated business owner.
 * @returns {{ message: string, orders: Array }}
 */
export const fetchOrders = () =>
  axiosClient.get("/orders").then((res) => res.data);

/**
 * Fetch a single order by id.
 * @param {string} id
 * @returns {{ message: string, order: object }}
 */
export const fetchOrder = (id) =>
  axiosClient.get(`/orders/${id}`).then((res) => res.data);




