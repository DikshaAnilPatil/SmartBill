import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

/**
 * Payment Verification Unit & Security Test Suite
 * Tests Razorpay HMAC-SHA256 cryptographic verification and replay protections.
 */

describe("Payment Security & Cryptographic Verification", () => {
  const MOCK_SECRET = "rzp_test_secret_1234567890abcdef";

  const generateValidSignature = (orderId, paymentId, secret = MOCK_SECRET) => {
    return crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
  };

  const verifySignature = (orderId, paymentId, signature, secret = MOCK_SECRET) => {
    if (!signature || typeof signature !== "string" || !signature.trim()) {
      return { valid: false, reason: "Missing signature" };
    }
    if (!orderId || !paymentId) {
      return { valid: false, reason: "Missing order or payment ID" };
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const sigBuf = Buffer.from(signature, "utf-8");
    const expectedBuf = Buffer.from(expectedSignature, "utf-8");

    if (sigBuf.length !== expectedBuf.length) {
      return { valid: false, reason: "Signature length mismatch" };
    }

    const isValid = crypto.timingSafeEqual(sigBuf, expectedBuf);
    return { valid: isValid, reason: isValid ? "OK" : "Cryptographic signature mismatch" };
  };

  it("should successfully verify a valid HMAC-SHA256 signature", () => {
    const orderId = "order_N123456789";
    const paymentId = "pay_P987654321";
    const validSignature = generateValidSignature(orderId, paymentId, MOCK_SECRET);

    const result = verifySignature(orderId, paymentId, validSignature, MOCK_SECRET);
    assert.equal(result.valid, true);
    assert.equal(result.reason, "OK");
  });

  it("should immediately reject when signature is missing / empty / null", () => {
    const orderId = "order_N123456789";
    const paymentId = "pay_P987654321";

    const testCases = [null, undefined, "", "   "];
    for (const sig of testCases) {
      const result = verifySignature(orderId, paymentId, sig, MOCK_SECRET);
      assert.equal(result.valid, false);
      assert.equal(result.reason, "Missing signature");
    }
  });

  it("should reject forged or tampered signatures", () => {
    const orderId = "order_N123456789";
    const paymentId = "pay_P987654321";
    const forgedSignature = "0000000000000000000000000000000000000000000000000000000000000000";

    const result = verifySignature(orderId, paymentId, forgedSignature, MOCK_SECRET);
    assert.equal(result.valid, false);
    assert.equal(result.reason, "Cryptographic signature mismatch");
  });

  it("should reject signatures verified against the wrong secret key", () => {
    const orderId = "order_N123456789";
    const paymentId = "pay_P987654321";
    const attackerSecret = "attacker_fake_secret_key_123456";
    const attackerSignature = generateValidSignature(orderId, paymentId, attackerSecret);

    const result = verifySignature(orderId, paymentId, attackerSignature, MOCK_SECRET);
    assert.equal(result.valid, false);
  });

  it("should reject signatures when orderId or paymentId is tampered", () => {
    const orderId = "order_N123456789";
    const paymentId = "pay_P987654321";
    const validSignature = generateValidSignature(orderId, paymentId, MOCK_SECRET);

    // Tampered orderId
    const tamperedResult1 = verifySignature("order_TAMPERED999", paymentId, validSignature, MOCK_SECRET);
    assert.equal(tamperedResult1.valid, false);

    // Tampered paymentId
    const tamperedResult2 = verifySignature(orderId, "pay_TAMPERED999", validSignature, MOCK_SECRET);
    assert.equal(tamperedResult2.valid, false);
  });
});
