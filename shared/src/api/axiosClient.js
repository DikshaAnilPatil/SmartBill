import axios from "axios";

// Base URL resolution order:
// 1. VITE_API_BASE_URL or VITE_API_URL (if configured in .env) e.g. http://localhost:5000/api
// 2. Fall back to same-origin proxy /api
const rawBaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL
    : "") || "/api";
const BASE_URL = rawBaseUrl.replace(/\/+$/, "");

const axiosClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000,
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

    // If request was canceled by AbortController or axios cancel, do not retry or treat as network error
    if (
      axios.isCancel(error) ||
      error?.name === "CanceledError" ||
      error?.code === "ERR_CANCELED" ||
      error?.message === "canceled" ||
      originalRequest?.signal?.aborted
    ) {
      return Promise.reject({
        name: "CanceledError",
        code: "ERR_CANCELED",
        isCanceled: true,
        message: "canceled",
        raw: error,
      });
    }

    // If network error occurred and we haven't tried the alternate fallback URL yet
    if (!error.response && originalRequest && !originalRequest._retryFallback) {
      originalRequest._retryFallback = true;
      try {
        const currentHost = typeof window !== "undefined" && window.location && window.location.hostname ? window.location.hostname : "127.0.0.1";
        const fallbackBase =
          originalRequest.baseURL === "/api" || !originalRequest.baseURL
            ? `${window.location.protocol}//${currentHost}:5000/api`
            : "/api";
        originalRequest.baseURL = fallbackBase;
        const token = typeof localStorage !== "undefined" ? localStorage.getItem("smartbill_token") : null;
        if (token) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return await axiosClient.request(originalRequest);
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
      } else if (status === 401 && !originalRequest?.url?.includes("/auth/login")) {
        try {
          localStorage.removeItem("smartbill_token");
          localStorage.removeItem("smartbill_user");
          window.dispatchEvent(new Event("userUpdated"));
          if (!window.location.pathname.includes("/login")) {
            window.location.href = "/login";
          }
        } catch {}
      }
    } else if (error.request) {
      if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
        message = "Server request timed out. Please try again.";
      } else {
        const hostName = typeof window !== "undefined" && window.location && window.location.hostname ? window.location.hostname : "localhost";
        message =
          `Cannot reach the backend server at ${hostName}:5000. Please ensure the backend server is running and accessible.`;
      }
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




