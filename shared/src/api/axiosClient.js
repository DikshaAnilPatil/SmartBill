import axios from "axios";

// Base URL resolution order:
// 1. VITE_API_URL (if set) e.g. /api or http://127.0.0.1:5000/api
// 2. Fall back to same-origin proxy /api
const BASE_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

const axiosClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Request interceptor: attach JWT token if present in localStorage.
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("smartbill_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with auto-fallback between proxy and direct host
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If network error occurred and we haven't tried the alternate fallback URL yet
    if (!error.response && originalRequest && !originalRequest._retryFallback) {
      originalRequest._retryFallback = true;
      try {
        const fallbackBase =
          originalRequest.baseURL === "/api" || !originalRequest.baseURL
            ? "http://127.0.0.1:5000/api"
            : "/api";
        originalRequest.baseURL = fallbackBase;
        return await axios(originalRequest);
      } catch (fallbackError) {
        if (fallbackError.response) {
          const status = fallbackError.response.status;
          const data = fallbackError.response.data || {};
          const isSusp = Boolean(
            data.isSuspended ||
            data.status === "Suspended" ||
            data.code === "ACCOUNT_SUSPENDED" ||
            (status === 403 && typeof data.message === "string" && /suspended/i.test(data.message))
          );
          return Promise.reject({
            message: data.message || `Request failed with status ${status}`,
            status,
            field: data.field || null,
            errors: data.errors || null,
            raw: fallbackError,
            data,
            isSuspended: isSusp,
            suspensionReason: data.suspensionReason || null,
          });
        }
      }
    }

    let message = "Network error. Please check your connection and try again.";
    let status = null;
    let field = null;
    let errors = null;
    let data = {};
    let isSuspended = false;
    let suspensionReason = null;

    if (error.response) {
      // Server responded with a non-2xx status.
      status = error.response.status;
      data = error.response.data || {};
      message = data.message || `Request failed with status ${status}`;
      field = data.field || null;
      errors = data.errors || null;
      suspensionReason = data.suspensionReason || null;
      isSuspended = Boolean(
        data.isSuspended ||
        data.status === "Suspended" ||
        data.code === "ACCOUNT_SUSPENDED" ||
        (status === 403 && typeof message === "string" && /suspended/i.test(message))
      );

      // If active session token was rejected due to suspension and not login endpoint
      if (isSuspended && !originalRequest?.url?.includes("/auth/login")) {
        try {
          sessionStorage.setItem(
            "smartbill_suspension_notice",
            JSON.stringify({
              reason: suspensionReason || "",
              message: message,
            })
          );
          localStorage.removeItem("smartbill_token");
          localStorage.removeItem("smartbill_user");
          window.dispatchEvent(new Event("userUpdated"));
          if (!window.location.pathname.includes("/login")) {
            window.location.href = "/login";
          }
        } catch {}
      }
    } else if (error.request) {
      // Request was made but no response received (server offline / CORS / proxy).
      message =
        "Cannot reach the server. Make sure the backend is running on port 5000.";
    }

    return Promise.reject({
      message,
      status,
      field,
      errors,
      raw: error,
      data,
      isSuspended,
      suspensionReason,
    });
  }
);

export default axiosClient;




