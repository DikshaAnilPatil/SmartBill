/**
 * security.js
 * Security middleware for SmartBill API:
 *  1. Helmet HTTP headers protection (XSS, Clickjacking, MIME sniffing)
 *  2. Rate limiting for Authentication & General APIs (Brute-force protection)
 *  3. Production-hardened CORS whitelisting
 */

import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";

/**
 * 1. HELMET SECURITY HEADERS
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: false, // Set to false to allow API JSON responses without restrictive HTML CSP
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allows loading images/assets across frontend portals
});

/**
 * 2. RATE LIMITERS
 */

// Stricter limiter for Auth endpoints (Login, Register, Forgot Password)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 auth requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many authentication attempts from this IP. Please try again after 15 minutes.",
  },
  skipSuccessfulRequests: false,
});

// General API limiter for standard operations
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // Limit each IP to 600 requests per windowMs (~40 req/min)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "API rate limit exceeded. Please slow down your requests.",
  },
});

/**
 * 3. PRODUCTION CORS CONFIGURATION
 */
export const configuredCors = () => {
  const isProduction = process.env.NODE_ENV === "production";

  // Production whitelist from environment variable, with fallback defaults
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : [
        "https://smartbill.com",
        "https://www.smartbill.com",
        "https://app.smartbill.com",
        "https://admin.smartbill.com",
      ];

  return cors({
    origin: (origin, callback) => {
      // In development, accept all local origins (localhost, 127.0.0.1, any port)
      if (!isProduction) {
        return callback(null, true);
      }

      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server webhooks)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin matches production whitelist
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS policy violation: Origin ${origin} not allowed.`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  });
};
