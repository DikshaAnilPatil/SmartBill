import axiosClient from "./axiosClient";

const normalizeProduct = (p) => {
  if (!p) return p;
  const id = p._id || p.id;
  const price = p.price ?? p.cost ?? 0;
  const lowStockAlert =
    p.stock !== undefined && p.minStock !== undefined && p.stock < p.minStock
      ? `Low stock: only ${p.stock} left (minimum required ${p.minStock})`
      : null;
  return { ...p, id, _id: id, price, lowStockAlert };
};

/**
 * Fetch all products for the logged-in user.
 * @param {object} [params]
 * @returns {{ products: Array, pagination?: object }}
 */
export const getProducts = (params = {}) =>
  axiosClient.get("/products", { params }).then((res) => {
    const raw = res.data.products || [];
    const products = raw.map(normalizeProduct);
    return { ...res.data, products };
  });

/**
 * Fetch a single product by id.
 * @param {string} id
 * @returns {{ product: object }}
 */
export const getProductById = (id) =>
  axiosClient.get(`/products/${id}`).then((res) => {
    return { ...res.data, product: normalizeProduct(res.data.product) };
  });

/**
 * Create a new product.
 * @param {object} payload product fields
 * @returns {{ message: string, product: object }}
 */
export const createProduct = (payload) =>
  axiosClient.post("/products", payload).then((res) => {
    return { ...res.data, product: normalizeProduct(res.data.product) };
  });

/**
 * Bulk create/import products in one fast request.
 * @param {Array<object>} products
 * @param {object} [options] - e.g. { mode: "upsert" | "update_stock" | "create_only", stockMode: "replace" | "add" }
 * @returns {{ message: string, count: number, createdCount: number, updatedCount: number, products: Array }}
 */
export const bulkCreateProducts = (products, options = {}) =>
  axiosClient.post("/products/bulk", { products, ...options }).then((res) => res.data);

/**
 * Perform manual stock adjustment (Physical Audit, Damaged, Expired, Theft/Loss).
 * @param {string} id
 * @param {{ adjustmentType: string, quantity: number, reason: string, notes?: string }} payload
 * @returns {{ success: boolean, message: string, product: object }}
 */
export const adjustProductStock = (id, payload) =>
  axiosClient.post(`/products/${id}/adjust`, payload).then((res) => {
    return { ...res.data, product: normalizeProduct(res.data.product) };
  });

/**
 * Update an existing product.
 * @param {string} id
 * @param {object} payload updated product fields
 * @returns {{ message: string, product: object }}
 */
export const updateProduct = (id, payload) =>
  axiosClient.put(`/products/${id}`, payload).then((res) => {
    return { ...res.data, product: normalizeProduct(res.data.product) };
  });

/**
 * Delete a product by id.
 * @param {string} id
 * @returns {{ message: string }}
 */
export const deleteProduct = (id) =>
  axiosClient.delete(`/products/${id}`).then((res) => res.data);
