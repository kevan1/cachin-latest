import assert from "node:assert/strict";
import test from "node:test";

import { buildPrePaymentConfirmation } from "./paymentConfirmation.ts";

test("builds a QR pre-payment confirmation with totals and zero discounts", () => {
  const confirmation = buildPrePaymentConfirmation({
    amount: "15000",
    currency: "ARS",
    destination: "CAFE TEST",
    arsRate: 1500,
  });

  assert.equal(confirmation.destination, "CAFE TEST");
  assert.equal(confirmation.amountArs, 15000);
  assert.equal(confirmation.amountUsdc, 10);
  assert.equal(confirmation.feeArs, 0);
  assert.equal(confirmation.discountArs, 0);
  assert.equal(confirmation.finalTotalArs, 15000);
  assert.equal(confirmation.finalTotalUsdc, 10);
  assert.equal(confirmation.display.amount, "ARS$15,000.00");
  assert.equal(confirmation.display.rate, "1 USDC = ARS$1,500.00");
  assert.equal(confirmation.display.fee, "ARS$0.00");
  assert.equal(confirmation.display.discount, "None");
  assert.equal(confirmation.display.finalTotal, "ARS$15,000.00");
  assert.equal(confirmation.display.finalTotalSecondary, "$10.00 USDC");
});
