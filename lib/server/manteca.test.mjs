import assert from "node:assert/strict";
import test from "node:test";

import { extractMantecaQrQuote } from "./manteca.ts";

test("extracts a QR quote amount from common provider payload shapes", () => {
  const quote = extractMantecaQrQuote({
    amount: { fiat: "2500.50", usdc: "1.25" },
    merchantName: "SOLxAR",
    fxRate: "2000.4",
    fee: "10.25",
    discount: "5",
  });

  assert.equal(quote.amountFiat, 2500.5);
  assert.equal(quote.amountUsdc, 1.25);
  assert.equal(quote.paymentAddress, "SOLxAR");
  assert.equal(quote.rateArsPerUsdc, 2000.4);
  assert.equal(quote.feeArs, 10.25);
  assert.equal(quote.discountArs, 5);
});
