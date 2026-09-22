import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

describe("Instant Session & Token Revocation Security", () => {
  const secret = "test_jwt_secret_key_123";

  const createMockToken = (userId, role, tokenVersion) => {
    return jwt.sign(
      {
        id: userId,
        role,
        ownerId: userId,
        tokenVersion,
      },
      secret,
      { expiresIn: "7d" }
    );
  };

  const verifyTokenWithDbUser = (token, dbUser) => {
    const decoded = jwt.verify(token, secret);
    
    if (
      decoded.tokenVersion !== undefined &&
      dbUser.tokenVersion !== undefined &&
      decoded.tokenVersion !== dbUser.tokenVersion
    ) {
      throw new Error("401 Unauthorized: Session revoked");
    }

    return decoded;
  };

  it("should accept valid token when tokenVersion matches database record", () => {
    const dbUser = { _id: "user_101", role: "owner", tokenVersion: 0 };
    const token = createMockToken(dbUser._id, dbUser.role, dbUser.tokenVersion);

    const decoded = verifyTokenWithDbUser(token, dbUser);
    assert.equal(decoded.id, "user_101");
    assert.equal(decoded.tokenVersion, 0);
  });

  it("should immediately reject old token after password reset increments tokenVersion", () => {
    const dbUser = { _id: "user_101", role: "owner", tokenVersion: 0 };
    const oldToken = createMockToken(dbUser._id, dbUser.role, dbUser.tokenVersion);

    // Simulate password reset or password change incrementing tokenVersion
    dbUser.tokenVersion += 1;

    assert.throws(
      () => verifyTokenWithDbUser(oldToken, dbUser),
      /Session revoked/
    );
  });

  it("should accept new token issued after tokenVersion bump", () => {
    const dbUser = { _id: "user_101", role: "owner", tokenVersion: 1 };
    const newToken = createMockToken(dbUser._id, dbUser.role, dbUser.tokenVersion);

    const decoded = verifyTokenWithDbUser(newToken, dbUser);
    assert.equal(decoded.tokenVersion, 1);
  });

  it("should immediately revoke all active sessions when superadmin suspends a user", () => {
    const suspendedEmployee = { _id: "emp_202", role: "cashier", tokenVersion: 3 };
    const activeToken = createMockToken(suspendedEmployee._id, suspendedEmployee.role, suspendedEmployee.tokenVersion);

    // SuperAdmin suspends user
    suspendedEmployee.tokenVersion += 1;

    assert.throws(
      () => verifyTokenWithDbUser(activeToken, suspendedEmployee),
      /Session revoked/
    );
  });
});
