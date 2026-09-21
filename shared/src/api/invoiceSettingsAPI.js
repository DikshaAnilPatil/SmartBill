import axiosClient from "./axiosClient";

export const getInvoiceSettings = async () => {
  const response = await axiosClient.get("/settings/invoice");
  return response.data || response;
};

export const updateInvoiceSettings = async (data) => {
  const response = await axiosClient.put("/settings/invoice", data);
  return response.data || response;
};




