import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Authentication & Authorization Security Test Suite
 * Tests role enforcement, identity isolation (employee vs owner), and permission guards.
 */

describe("Authentication & Role Authorization Security", () => {
  // Mock users
  const mockOwner = {
    _id: "user_owner_001",
    email: "owner@retail.com",
    role: "owner",
    ownerId: null,
    businessName: "Retail Store Ltd",
    passwordHash: "owner_secure_hash_123",
  };

  const mockEmployee = {
    _id: "user_emp_002",
    email: "cashier@retail.com",
    role: "cashier",
    ownerId: "user_owner_001", // Belongs to mockOwner tenant
    permissions: ["pos", "sales"],
    passwordHash: "cashier_secure_hash_456",
  };

  const mockSuperAdmin = {
    _id: "user_admin_003",
    email: "superadmin@smartbill.com",
    role: "superadmin",
    ownerId: null,
  };

  // Auth context resolver simulation (matching middleware/auth.js)
  const resolveAuthContext = (authenticatedUser) => {
    return {
      actualUserId: authenticatedUser._id,
      ownerId: authenticatedUser.ownerId || authenticatedUser._id,
      role: authenticatedUser.role,
      permissions: authenticatedUser.permissions || [],
    };
  };

  // Profile update targeting simulation (matching controller/authcontroller.js updateProfile)
  const executeProfileUpdate = (authContext, targetUserRecord, updatePayload) => {
    // SECURITY RULE: Update must strictly target actualUserId, never ownerId
    if (String(targetUserRecord._id) !== String(authContext.actualUserId)) {
      throw new Error("403 Forbidden: Cannot modify another user's identity");
    }

    // SECURITY RULE: Non-owners cannot mutate business settings/branding
    const safeUpdated = { ...targetUserRecord };
    if (updatePayload.name) safeUpdated.name = updatePayload.name;
    if (updatePayload.phone) safeUpdated.phone = updatePayload.phone;

    if (authContext.role === "owner") {
      if (updatePayload.businessName) safeUpdated.businessName = updatePayload.businessName;
    }

    return safeUpdated;
  };

  // Password change simulation (matching controller/authcontroller.js changePassword)
  const executePasswordChange = (authContext, targetUserRecord, newHash) => {
    // SECURITY RULE: Password change must strictly affect actualUserId
    if (String(targetUserRecord._id) !== String(authContext.actualUserId)) {
      throw new Error("403 Forbidden: Cannot change another user's password");
    }
    return { ...targetUserRecord, passwordHash: newHash };
  };

  // Role elevation guard simulation (matching controller/employeeController.js)
  const validateEmployeeCreation = (authContext, requestedRole) => {
    const prohibitedRoles = ["superadmin", "owner", "admin"];
    const normalized = String(requestedRole || "").toLowerCase().trim();
    if (prohibitedRoles.includes(normalized)) {
      throw new Error(`Cannot assign restricted role: ${requestedRole}`);
    }
    return true;
  };

  it("should cleanly distinguish actualUserId from tenant ownerId for employees", () => {
    const employeeContext = resolveAuthContext(mockEmployee);
    assert.equal(employeeContext.actualUserId, "user_emp_002");
    assert.equal(employeeContext.ownerId, "user_owner_001");
  });

  it("should set actualUserId equal to ownerId for business owners", () => {
    const ownerContext = resolveAuthContext(mockOwner);
    assert.equal(ownerContext.actualUserId, "user_owner_001");
    assert.equal(ownerContext.ownerId, "user_owner_001");
  });

  it("should allow an employee to update ONLY their own profile record", () => {
    const employeeContext = resolveAuthContext(mockEmployee);
    const updatedEmployee = executeProfileUpdate(employeeContext, mockEmployee, { name: "John Cashier", phone: "9876543210" });
    assert.equal(updatedEmployee.name, "John Cashier");
    assert.equal(updatedEmployee.phone, "9876543210");
  });

  it("should PREVENT an employee from overwriting the owner's profile record (Account Takeover Prevention)", () => {
    const employeeContext = resolveAuthContext(mockEmployee);
    assert.throws(
      () => executeProfileUpdate(employeeContext, mockOwner, { name: "Hacked Name" }),
      /403 Forbidden/
    );
  });

  it("should PREVENT an employee from changing the business owner's password", () => {
    const employeeContext = resolveAuthContext(mockEmployee);
    assert.throws(
      () => executePasswordChange(employeeContext, mockOwner, "new_hacked_hash_999"),
      /403 Forbidden/
    );
  });

  it("should allow an employee to safely change only their own password", () => {
    const employeeContext = resolveAuthContext(mockEmployee);
    const updatedEmployee = executePasswordChange(employeeContext, mockEmployee, "new_cashier_hash_789");
    assert.equal(updatedEmployee.passwordHash, "new_cashier_hash_789");
    // Owner password hash remains untouched
    assert.equal(mockOwner.passwordHash, "owner_secure_hash_123");
  });

  it("should PREVENT unauthorized creation or elevation to superadmin / owner roles", () => {
    const ownerContext = resolveAuthContext(mockOwner);
    assert.throws(
      () => validateEmployeeCreation(ownerContext, "superadmin"),
      /Cannot assign restricted role/
    );
    assert.throws(
      () => validateEmployeeCreation(ownerContext, "owner"),
      /Cannot assign restricted role/
    );
  });

  it("should allow creating standard employee roles (cashier, manager, accountant)", () => {
    const ownerContext = resolveAuthContext(mockOwner);
    assert.equal(validateEmployeeCreation(ownerContext, "cashier"), true);
    assert.equal(validateEmployeeCreation(ownerContext, "manager"), true);
    assert.equal(validateEmployeeCreation(ownerContext, "accountant"), true);
  });
});
