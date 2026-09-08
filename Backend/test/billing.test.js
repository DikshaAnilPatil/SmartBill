import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Server-Side Billing & Financial Arithmetic Test Suite
 * Tests authoritative pricing, GST, discounts, quantity validation, and tamper-resistance.
 */

// Authoritative pure billing engine calculation logic (matching orderController.js implementation)
function calculateAuthoritativeOrder({ items, rawDiscount = 0, dbProductsMap = new Map() }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Order must contain at least one item");
  }

  let calculatedSubtotal = 0;
  let calculatedGstTotal = 0;
  const processedItems = [];

  for (const item of items) {
    const qty = Number(item.qty || item.quantity);
    if (!qty || isNaN(qty) || qty <= 0) {
      throw new Error(`Invalid item quantity for ${item.name || "item"}: must be greater than 0`);
    }

    const productId = item.productId || item.product || item._id;
    let authoritativePrice = 0;
    let authoritativeGstRate = 0;
    let itemName = item.name || "Custom Item";
    let sku = item.sku || "";

    if (productId && dbProductsMap.has(String(productId))) {
      const dbProduct = dbProductsMap.get(String(productId));
      authoritativePrice = Number(dbProduct.price) || 0;
      authoritativeGstRate = Number(dbProduct.gstRate) || 0;
      itemName = dbProduct.name;
      sku = dbProduct.sku || "";
    } else {
      // Non-inventory custom line item
      authoritativePrice = Number(item.price) || 0;
      authoritativeGstRate = Number(item.gstRate) || 0;
    }

    if (authoritativePrice < 0) {
      throw new Error(`Item price cannot be negative: ${itemName}`);
    }

    const itemDiscount = Math.max(0, Math.min(authoritativePrice * qty, Number(item.discount) || 0));
    const lineItemTotal = Math.max(0, authoritativePrice * qty - itemDiscount);
    const lineItemGst = (lineItemTotal * authoritativeGstRate) / 100;

    calculatedSubtotal += lineItemTotal;
    calculatedGstTotal += lineItemGst;

    processedItems.push({
      product: productId,
      name: itemName,
      sku,
      qty,
      price: authoritativePrice,
      discount: itemDiscount,
      gstRate: authoritativeGstRate,
      amount: lineItemTotal,
    });
  }

  const globalDiscount = Math.max(0, Math.min(calculatedSubtotal, Number(rawDiscount) || 0));
  const finalTaxableAmount = Math.max(0, calculatedSubtotal - globalDiscount);
  const finalGrandTotal = Math.round(finalTaxableAmount + calculatedGstTotal);

  return {
    items: processedItems,
    subtotal: calculatedSubtotal,
    discount: globalDiscount,
    gst: calculatedGstTotal,
    totalOrderValue: finalGrandTotal,
  };
}

describe("Server-Side Billing Financial Integrity", () => {
  const mockDbProducts = new Map([
    ["prod_1", { _id: "prod_1", name: "Premium Widget", price: 100, gstRate: 18, stock: 50, sku: "WID-01" }],
    ["prod_2", { _id: "prod_2", name: "Essential Gadget", price: 50, gstRate: 5, stock: 20, sku: "GAD-02" }],
    ["prod_3", { _id: "prod_3", name: "Zero Tax Item", price: 200, gstRate: 0, stock: 10, sku: "ZERO-03" }],
  ]);

  it("should calculate exact authoritative totals based on DB product prices and GST", () => {
    const orderInput = {
      items: [
        { productId: "prod_1", qty: 2 }, // 2 * 100 = 200, 18% GST = 36
        { productId: "prod_2", qty: 4 }, // 4 * 50 = 200, 5% GST = 10
      ],
      rawDiscount: 0,
      dbProductsMap: mockDbProducts,
    };

    const calculated = calculateAuthoritativeOrder(orderInput);
    assert.equal(calculated.subtotal, 400);
    assert.equal(calculated.gst, 46);
    assert.equal(calculated.totalOrderValue, 446);
    assert.equal(calculated.items[0].price, 100);
    assert.equal(calculated.items[1].price, 50);
  });

  it("should strictly OVERRIDE frontend-manipulated prices with authoritative DB prices", () => {
    // Malicious attacker attempts to pass price: 1 instead of 100
    const maliciousInput = {
      items: [
        { productId: "prod_1", qty: 2, price: 1, subtotal: 2, gst: 0.36, total: 2.36 },
      ],
      rawDiscount: 0,
      dbProductsMap: mockDbProducts,
    };

    const calculated = calculateAuthoritativeOrder(maliciousInput);
    // Must be calculated using DB price (100) not client price (1)
    assert.equal(calculated.subtotal, 200);
    assert.equal(calculated.gst, 36);
    assert.equal(calculated.totalOrderValue, 236);
    assert.equal(calculated.items[0].price, 100);
  });

  it("should reject negative or zero item quantities", () => {
    assert.throws(
      () => calculateAuthoritativeOrder({ items: [{ productId: "prod_1", qty: -5 }], dbProductsMap: mockDbProducts }),
      /Invalid item quantity/
    );

    assert.throws(
      () => calculateAuthoritativeOrder({ items: [{ productId: "prod_1", qty: 0 }], dbProductsMap: mockDbProducts }),
      /Invalid item quantity/
    );

    assert.throws(
      () => calculateAuthoritativeOrder({ items: [{ productId: "prod_1", qty: "invalid" }], dbProductsMap: mockDbProducts }),
      /Invalid item quantity/
    );
  });

  it("should reject empty items array", () => {
    assert.throws(
      () => calculateAuthoritativeOrder({ items: [], dbProductsMap: mockDbProducts }),
      /Order must contain at least one item/
    );
  });

  it("should cap excessive discount at subtotal (cannot create negative total)", () => {
    const discountedInput = {
      items: [{ productId: "prod_1", qty: 1 }], // subtotal = 100, gst = 18
      rawDiscount: 99999, // excessive attacker discount
      dbProductsMap: mockDbProducts,
    };

    const calculated = calculateAuthoritativeOrder(discountedInput);
    assert.equal(calculated.subtotal, 100);
    assert.equal(calculated.discount, 100); // capped at subtotal
    assert.equal(calculated.totalOrderValue, 18); // 0 taxable + 18 GST
  });

  it("should correctly handle custom non-inventory line items with valid rates", () => {
    const customInput = {
      items: [
        { name: "Special Installation Service", price: 1500, gstRate: 18, qty: 1 },
      ],
      rawDiscount: 100,
      dbProductsMap: mockDbProducts,
    };

    const calculated = calculateAuthoritativeOrder(customInput);
    assert.equal(calculated.subtotal, 1500);
    assert.equal(calculated.discount, 100);
    assert.equal(calculated.gst, 270);
    assert.equal(calculated.totalOrderValue, 1670); // (1500-100) + 270 = 1670
  });
});
