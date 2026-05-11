import assert from "node:assert/strict";
import test from "node:test";

import { extractEmvAmount } from "./emvQr.ts";

test("extracts the fixed amount from EMV tag 54", () => {
  const qrData = "000201010212530303254071234.565802AR5909CAFE TEST6304ABCD";

  assert.equal(extractEmvAmount(qrData), 1234.56);
});

test("returns null when EMV tag 54 is missing", () => {
  const qrData = "00020101021253030325802AR5909CAFE TEST6304ABCD";

  assert.equal(extractEmvAmount(qrData), null);
});
