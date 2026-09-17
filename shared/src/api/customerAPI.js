import axiosClient from "./axiosClient";

/**
 * Fetch all customers for the authenticated business owner.
 * @param {object} [params]
 * @returns {{ message: string, customers: Array, pagination?: object }}
 */
export const fetchCustomers = (params = {}) =>
  axiosClient.get("/customers", { params }).then((res) => res.data);

/**
 * Fetch a single customer by id.
 * @param {string} id
 */
export const fetchCustomer = (id) =>
  axiosClient.get(`/customers/${id}`).then((res) => res.data);

/**
 * Fetch detailed customer summary including all invoices, total paid, and balance due.
 * @param {string} id
 */
export const fetchCustomerDetails = (id) =>
  axiosClient.get(`/customers/${id}/details`).then((res) => res.data);

/**
 * Create a new customer in the database.
 * @param {object} payload
 */
export const createCustomer = (payload) =>
  axiosClient.post("/customers", payload).then((res) => res.data);

/**
 * Record a khata payment received from a customer (settlement).
 * @param {string} id
 * @param {{ amount: number, paymentMode: string, referenceNo?: string, notes?: string, invoiceNo?: string, date?: string }} payload
 */
export const recordCustomerPayment = (id, payload) =>
  axiosClient.post(`/customers/${id}/payment`, payload).then((res) => res.data);

/**
 * Update an existing customer.
 * @param {string} id
 * @param {object} payload
 */
export const updateCustomer = (id, payload) =>
  axiosClient.put(`/customers/${id}`, payload).then((res) => res.data);

/**
 * Delete a customer.
 * @param {string} id
 */
export const deleteCustomer = (id) =>
  axiosClient.delete(`/customers/${id}`).then((res) => res.data);
