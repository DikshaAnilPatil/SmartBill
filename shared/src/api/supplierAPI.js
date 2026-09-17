import axiosClient from "./axiosClient";

/**
 * Fetch all suppliers for the authenticated business owner.
 * @param {object} [params]
 * @returns {{ message: string, suppliers: Array, pagination?: object }}
 */
export const fetchSuppliers = (params = {}) =>
  axiosClient.get("/suppliers", { params }).then((res) => res.data);

/**
 * Fetch a single supplier by id.
 * @param {string} id
 * @returns {{ message: string, supplier: object }}
 */
export const fetchSupplier = (id) =>
  axiosClient.get(`/suppliers/${id}`).then((res) => res.data);

/**
 * Fetch detailed supplier ledger and purchase history.
 * @param {string} id
 * @returns {{ message: string, supplier: object, summary: object, purchases: Array }}
 */
export const fetchSupplierDetails = (id) =>
  axiosClient.get(`/suppliers/${id}/details`).then((res) => res.data);

/**
 * Create a new supplier in the database.
 * @param {{ name: string, contact?: string, phone?: string, email?: string, city?: string, state?: string, address?: string, gst?: string, openingBalance?: number }} payload
 * @returns {{ message: string, supplier: object }}
 */
export const createSupplier = (payload) =>
  axiosClient.post("/suppliers", payload).then((res) => res.data);

/**
 * Record a payment made out to a supplier.
 * @param {string} id
 * @param {{ amount: number, paymentMethod: string, referenceNo?: string, notes?: string, purchaseBillNo?: string, date?: string }} payload
 * @returns {{ success: boolean, message: string, supplier: object }}
 */
export const recordSupplierPayment = (id, payload) =>
  axiosClient.post(`/suppliers/${id}/payment`, payload).then((res) => res.data);

/**
 * Update an existing supplier.
 * @param {string} id
 * @param {object} payload
 * @returns {{ message: string, supplier: object }}
 */
export const updateSupplier = (id, payload) =>
  axiosClient.put(`/suppliers/${id}`, payload).then((res) => res.data);

/**
 * Delete a supplier.
 * @param {string} id
 * @returns {{ message: string }}
 */
export const deleteSupplier = (id) =>
  axiosClient.delete(`/suppliers/${id}`).then((res) => res.data);
