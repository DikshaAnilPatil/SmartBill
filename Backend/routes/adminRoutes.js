import express from "express";
import { protect } from "../middleware/mid.js";
import {
  getAllBusinesses,
  updateBusinessStatus,
  grantBusinessAccess,
  getSystemSettings,
  updateSystemSettings,
  getAdminRevenueAnalytics,
  getSuperAdminDashboardStats,
  getAdminStaff,
  createAdminStaff,
  updateAdminStaff,
  deleteAdminStaff,
  updateRolePermissionsInBulk,
} from "../controller/adminController.js";

const router = express.Router();

router.use((req, res, next) => {
  console.log(`[AdminRouter] ${req.method} ${req.originalUrl} (url: ${req.url})`);
  next();
});

// GET, POST, PUT, DELETE /api/admin/staff - Manage internal admin staff accounts
router.get("/staff", protect, getAdminStaff);
router.post("/staff", protect, createAdminStaff);
router.put("/staff/:id", protect, updateAdminStaff);
router.delete("/staff/:id", protect, deleteAdminStaff);

// PUT /api/admin/roles/:roleId - Bulk update permissions for all users assigned to roleId
router.put("/roles/:roleId", protect, updateRolePermissionsInBulk);

// GET /api/admin/businesses - Fetch all owner accounts (SuperAdmin only)
router.get("/", protect, getAllBusinesses);
router.get("/businesses", protect, getAllBusinesses);

// GET /api/admin/revenue & /api/admin/revenue-analytics - Real-time revenue analytics
router.get("/revenue", protect, getAdminRevenueAnalytics);
router.get("/revenue-analytics", protect, getAdminRevenueAnalytics);

// GET /api/admin/dashboard-stats - Live SuperAdmin dashboard metrics
router.get("/dashboard-stats", protect, getSuperAdminDashboardStats);

// PUT & POST /api/admin/businesses/:id/status - Update business status (SuperAdmin only)
router.put("/businesses/:id/status", protect, updateBusinessStatus);
router.put("/:id/status", protect, updateBusinessStatus);
router.post("/businesses/:id/status", protect, updateBusinessStatus);
router.post("/:id/status", protect, updateBusinessStatus);

// PUT & POST /api/admin/businesses/:id/access - Grant business module access & reset password (SuperAdmin only)
router.put("/businesses/:id/access", protect, grantBusinessAccess);
router.put("/:id/access", protect, grantBusinessAccess);
router.post("/businesses/:id/access", protect, grantBusinessAccess);
router.post("/:id/access", protect, grantBusinessAccess);

// GET /api/admin/businesses/settings/system - Fetch system settings (SuperAdmin only)
router.get("/settings/system", protect, getSystemSettings);
router.get("/businesses/settings/system", protect, getSystemSettings);

// PUT & POST /api/admin/businesses/settings/system - Update system settings (SuperAdmin only)
router.put("/settings/system", protect, updateSystemSettings);
router.put("/businesses/settings/system", protect, updateSystemSettings);
router.post("/settings/system", protect, updateSystemSettings);
router.post("/businesses/settings/system", protect, updateSystemSettings);

export default router;
