import axios from "axios";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("smartbill_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchCashVouchers = async (params = {}) => {
  const response = await axios.get(`${API_URL}/api/cash-vouchers`, {
    headers: getAuthHeaders(),
    params,
  });
  return response.data;
};

export const createCashVoucher = async (payload) => {
  const response = await axios.post(`${API_URL}/api/cash-vouchers`, payload, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const updateCashVoucher = async (id, payload) => {
  const response = await axios.put(`${API_URL}/api/cash-vouchers/${id}`, payload, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const deleteCashVoucher = async (id) => {
  const response = await axios.delete(`${API_URL}/api/cash-vouchers/${id}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export default {
  fetchCashVouchers,
  createCashVoucher,
  updateCashVoucher,
  deleteCashVoucher,
};
