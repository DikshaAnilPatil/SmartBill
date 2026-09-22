import axiosClient from "./axiosClient";
 
export const fetchCashVouchers = async (params = {}) => {
  const response = await axiosClient.get("/cash-vouchers", {
    params,
  });
  return response.data;
};

export const createCashVoucher = async (payload) => {
  const response = await axiosClient.post("/cash-vouchers", payload);
  return response.data;
};

export const updateCashVoucher = async (id, payload) => {
  const response = await axiosClient.put(`/cash-vouchers/${id}`, payload);
  return response.data;
};

export const deleteCashVoucher = async (id) => {
  const response = await axiosClient.delete(`/cash-vouchers/${id}`);
  return response.data;
};

export default {
  fetchCashVouchers,
  createCashVoucher,
  updateCashVoucher,
  deleteCashVoucher,
};
