import axiosClient from "./axiosClient";

export const adminAPI = {
  /**
   * Fetch all registered business owner records for SuperAdmin
   */
  getAllBusinesses: async () => {
    const res = await axiosClient.get("/admin/businesses");
    return res.data;
  },

  /**
   * Update status (Active / Suspended) and suspension reason for a business owner
   */
  updateBusinessStatus: async (businessId, status, reason = "") => {
    const res = await axiosClient.put(`/admin/businesses/${businessId}/status`, {
      status,
      reason,
    });
    return res.data;
  },

  /**
   * Grant module permissions & issue secure temporary password for a business owner
   */
  grantBusinessAccess: async (businessId, permissions) => {
    const res = await axiosClient.put(`/admin/businesses/${businessId}/access`, {
      permissions,
    });
    return res.data;
  },

  /**
   * Fetch SuperAdmin System Settings from MongoDB
   */
  getSystemSettings: async () => {
    const res = await axiosClient.get("/admin/businesses/settings/system");
    return res.data;
  },

  /**
   * Update SuperAdmin System Settings in MongoDB
   */
  updateSystemSettings: async (settingsData) => {
    const res = await axiosClient.put(
      "/admin/businesses/settings/system",
      settingsData
    );
    return res.data;
  },

  /**
   * Fetch multi-dimensional real-time revenue analytics across all business owners
   */
  getRevenueAnalytics: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.timeframe) query.append("timeframe", params.timeframe);
    if (params.businessId && params.businessId !== "all") query.append("businessId", params.businessId);

    const url = `/admin/revenue${query.toString() ? `?${query.toString()}` : ""}`;
    const res = await axiosClient.get(url);
    return res.data;
  },

  /**
   * Fetch live KPI dashboard summary stats for SuperAdmin
   */
  getDashboardStats: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.range) query.append("range", params.range);

    const url = `/admin/dashboard-stats${query.toString() ? `?${query.toString()}` : ""}`;
    const res = await axiosClient.get(url);
    return res.data;
  },
};

export default adminAPI;



