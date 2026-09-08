/**
 * Dynamic URL Resolution Utility for Multi-App SmartBill Architecture.
 * Resolves URLs dynamically based on environment variables (e.g. VITE_ADMIN_URL, VITE_CRM_URL, VITE_LANDING_URL)
 * or intelligent runtime detection, eliminating broken localhost URLs in cloud/production deployments.
 */

export const getLandingUrl = () => {
  if (typeof window === "undefined") return "/";
  if (import.meta.env?.VITE_LANDING_URL) {
    return import.meta.env.VITE_LANDING_URL;
  }
  // In development, default to port 5173 if running on localhost
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `${window.location.protocol}//${window.location.hostname}:5173/`;
  }
  return "/";
};

export const getCrmUrl = (path = "") => {
  const cleanPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  if (typeof window === "undefined") return `/app${cleanPath}`;
  if (import.meta.env?.VITE_CRM_URL) {
    return `${import.meta.env.VITE_CRM_URL.replace(/\/+$/, "")}${cleanPath}`;
  }
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `${window.location.protocol}//${window.location.hostname}:5174${cleanPath}`;
  }
  return `/app${cleanPath}`;
};

export const getAdminUrl = (path = "") => {
  const cleanPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  if (typeof window === "undefined") return `/admin${cleanPath}`;
  if (import.meta.env?.VITE_ADMIN_URL) {
    return `${import.meta.env.VITE_ADMIN_URL.replace(/\/+$/, "")}${cleanPath}`;
  }
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `${window.location.protocol}//${window.location.hostname}:5175${cleanPath}`;
  }
  return `/admin${cleanPath}`;
};
