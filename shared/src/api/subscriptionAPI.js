import axios from "axios";
import axiosClient from "./axiosClient";

const PUBLIC_API_BASE_URL =
  import.meta.env.VITE_API_URL || "/api";

const publicAxios = axios.create({
  baseURL: PUBLIC_API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const subscriptionAPI = {
  getPublicPlans: async () => {
    try {
      const response = await publicAxios.get("/subscription-plans", {
        params: {
          _t: Date.now(),
        },
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      return response.data;
    } catch (err) {
      console.warn("Public subscription plans API warning, using local fallback:", err.message);
      return {
        success: true,
        count: 3,
        data: [
          {
            key: "starter",
            name: "Starter",
            price: 999,
            billingCycle: "monthly",
            maxUsers: 2,
            maxInvoicesPerMonth: 500,
            maxCustomers: 500,
            maxProducts: 500,
            features: {
              basicReports: true,
              advancedReports: false,
              gstReports: false,
              expenses: true,
              purchaseManagement: true,
              inventory: true,
              paymentTracking: true,
              paymentHistory: false,
              advancedPaymentHistory: false,
              invoiceCustomization: true,
              advancedInvoiceCustomization: false,
              unlimitedInvoiceCustomization: false,
              stockAlerts: true,
              advancedStockAlerts: false,
              enhancedStockMonitoring: false,
              dataExport: false,
            },
            status: "active",
          },
          {
            key: "pro",
            name: "Pro",
            price: 2499,
            billingCycle: "monthly",
            maxUsers: 10,
            maxInvoicesPerMonth: null,
            maxCustomers: 5000,
            maxProducts: 5000,
            features: {
              basicReports: true,
              advancedReports: true,
              gstReports: true,
              expenses: true,
              purchaseManagement: true,
              inventory: true,
              paymentTracking: true,
              paymentHistory: true,
              advancedPaymentHistory: false,
              invoiceCustomization: true,
              advancedInvoiceCustomization: true,
              unlimitedInvoiceCustomization: false,
              stockAlerts: true,
              advancedStockAlerts: true,
              enhancedStockMonitoring: false,
              dataExport: true,
            },
            status: "active",
          },
          {
            key: "enterprise",
            name: "Enterprise",
            price: 6999,
            billingCycle: "monthly",
            maxUsers: null,
            maxInvoicesPerMonth: null,
            maxCustomers: null,
            maxProducts: null,
            features: {
              basicReports: true,
              advancedReports: true,
              gstReports: true,
              expenses: true,
              purchaseManagement: true,
              inventory: true,
              paymentTracking: true,
              paymentHistory: true,
              advancedPaymentHistory: true,
              invoiceCustomization: true,
              advancedInvoiceCustomization: true,
              unlimitedInvoiceCustomization: true,
              stockAlerts: true,
              advancedStockAlerts: true,
              enhancedStockMonitoring: true,
              dataExport: true,
            },
            status: "active",
          },
        ],
      };
    }
  },

  /** Get prorated upgrade/downgrade pricing preview */
  getUpgradePreview: (newPlan) =>
    axiosClient
      .get(`/subscriptions/upgrade-preview?newPlan=${newPlan}`)
      .then((res) => res.data),

  /** Create a Razorpay order. Pass isUpgrade + proratedAmount for mid-cycle changes. */
  createOrder: (planName, options = {}) =>
    publicAxios
      .post("/subscriptions/create-order", { planName, ...options })
      .then((res) => res.data),

  /** Verify Razorpay payment and activate/schedule plan */
  verifyPayment: (payload) =>
    publicAxios
      .post("/subscriptions/verify-payment", payload)
      .then((res) => res.data),

  /** Get current subscription status, usage and plan details */
  getSubscriptionStatus: () =>
    axiosClient.get("/subscriptions/status").then((res) => res.data),
};

export default subscriptionAPI;
