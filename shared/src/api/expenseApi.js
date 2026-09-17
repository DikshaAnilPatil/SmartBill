import axiosClient from "./axiosClient";

/**
 * Get all expenses.
 */
export const getExpenses = () =>
  axiosClient.get("/expenses").then((res) => res.data);

/**
 * Create a new expense.
 *
 * @param {{
 *   category: string,
 *   description: string,
 *   amount: number,
 *   date: string,
 *   paymentMode: string,
 *   reference?: string,
 *   status: string
 * }} payload
 */
export const createExpense = (payload) =>
  axiosClient.post("/expenses", payload).then((res) => res.data);

/**
 * Update an existing expense.
 *
 * @param {string} id
 * @param {object} payload
 */
export const updateExpense = (id, payload) =>
  axiosClient.put(`/expenses/${id}`, payload).then((res) => res.data);

/**
 * Delete an expense.
 *
 * @param {string} id
 */
export const deleteExpense = (id) =>
  axiosClient.delete(`/expenses/${id}`).then((res) => res.data);


