import jwt from "jsonwebtoken";
import User from "../models/User.js";
import SystemSettings from "../models/SystemSettings.js";

/**
 * Authentication middleware — verifies the JWT from the Authorization header
 * and attaches the authenticated user to `req.user`.
 */
export const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : req.query?.token
      ? String(req.query.token).trim()
      : null;

    if (!token) {
      return res
        .status(401)
        .json({ message: "Not authorized, no token provided." });
    }

    const secret = process.env.JWT_SECRET || "smartbill_secret_key_123";
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      try {
        decoded = jwt.verify(token, "smartbill_secret_key_123`");
      } catch (err2) {
        throw err;
      }
    }

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res
        .status(401)
        .json({ message: "Not authorized, user not found." });
    }

    // Superadmin bypasses maintenance & suspension checks
    if (user.role !== "superadmin") {
      const systemSettings = await SystemSettings.findOne({ key: "global_system_settings" }).lean();
      if (systemSettings?.maintenanceMode) {
        return res.status(403).json({
          message: "The system is currently undergoing scheduled maintenance. Please try again later.",
        });
      }

      let ownerUser = null;
      if (user.ownerId) {
        ownerUser = await User.findById(user.ownerId);
      }

      const userStatus = user.status || "Active";
      const ownerStatus = ownerUser ? (ownerUser.status || "Active") : "Active";

      if (userStatus === "Suspended" || ownerStatus === "Suspended") {
        const reason = user.suspensionReason || ownerUser?.suspensionReason;
        return res.status(403).json({
          message: reason
            ? `Your account has been suspended by administration. Reason: ${reason}`
            : "Your account has been suspended by administration. Access denied.",
        });
      }

      if (userStatus === "Inactive" || ownerStatus === "Inactive") {
        return res.status(403).json({
          message: "Your account is deactivated. Access denied.",
        });
      }
    }

    const effectiveOwnerId = user.ownerId ? user.ownerId : user._id;

    req.user = {
      actualUserId: user._id,
      userId: user._id,
      ownerId: effectiveOwnerId,
      effectiveOwnerId: effectiveOwnerId,
      _id: effectiveOwnerId,
      id: effectiveOwnerId.toString(),
      email: user.email,
      role: user.role,
      businessName: user.businessName || "",
      businessType: user.businessType || "Retail",
      permissions: user.permissions || {},
    };

    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Not authorized, invalid or expired token." });
  }
};

/**
 * Authorization middleware — verifies if user's permissions grant access to specified module.
 */
export const requirePermission = (moduleKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    // SuperAdmin and Owner always have full permission
    if (req.user.role === "superadmin" || req.user.role === "owner") {
      return next();
    }

    const perms = req.user.permissions || {};
    const modPerm = perms[moduleKey];

    let hasAccess = true;
    if (modPerm === false || modPerm === undefined) {
      hasAccess = false;
    } else if (modPerm && typeof modPerm === "object") {
      if (modPerm.view === false && modPerm.manage === false) {
        hasAccess = false;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        message: `Forbidden: You do not have permission to access the ${moduleKey} module.`,
      });
    }

    next();
  };
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (allowedRoles = []) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }
    const userRole = String(req.user.role || "").toLowerCase().trim();
    const hasRole = roles.map((r) => String(r).toLowerCase().trim()).includes(userRole);

    if (!hasRole) {
      return res.status(403).json({
        message: `Forbidden: Requires one of the following roles: ${roles.join(", ")}`,
      });
    }
    next();
  };
};
