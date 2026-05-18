/**
 * Confirm fiat receipt on a paid PAY order — triggers final on-chain
 * settlement of the USDC escrow.
 *
 * In the p2p.me state machine:
 *   placed → accepted → paid → completed
 *                       ▲       ▲
 *                merchant pays  buyer confirms
 *                fiat in MP     receipt via paidBuyOrder
 *
 * Despite the name `paidBuyOrder`, this is the generic "buyer confirms"
 * function used by ALL order types (BUY / SELL / PAY) — confirmed in
 * user-app-client/src/hooks/use-order-flow.ts.
 *
 * ⚠️  ONLY run this AFTER you have visually verified that the fiat amount
 *     actually arrived in your MercadoPago. Confirming a payment that
 *     didn't arrive forfeits your USDC.
 *
 * Run:
 *   cd /Users/kevan/Development/cachin-latest
 *   export PATH="$HOME/.nvm/versions/node/v24.8.0/bin:$PATH"
 *
 *   # safety dry-run (reads order state, doesn't broadcast):
 *   ORDER_ID=539401 \
 *     P2P_RELAYER_PRIVATE_KEY=0x... \
 *     bun run scripts/confirm-order.ts
 *
 *   # confirm for real:
 *   CONFIRM=yes ORDER_ID=539401 \
 *     P2P_RELAYER_PRIVATE_KEY=0x... \
 *     bun run scripts/confirm-order.ts
 */

import {
  createThirdwebClient,
  prepareTransaction,
  sendTransaction,
  waitForReceipt,
} from "thirdweb";
import { privateKeyToAccount as twPrivateKeyToAccount } from "thirdweb/wallets";
import { smartWallet } from "thirdweb/wallets/smart";
import { base as twBase } from "thirdweb/chains";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { createOrders } from "@p2pdotme/sdk/orders";

const THIRDWEB_CLIENT_ID = "f2f21a26b756b3c3b759f794f3c3fe18";
const AA_FACTORY = "0xde320c2e2b4953883f61774c006f9057a55b97d1" as `0x${string}`;
const DIAMOND = "0x4cad6eC90e65baBec9335cAd728DDC610c316368" as `0x${string}`;
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;
const SUBGRAPH_URL =
  "https://gateway.thegraph.com/api/b140f41e8237594d16b7cb2dcd11d799/subgraphs/id/7Q8UooxVQWokdG6QYW2Wa65Wh6eit2WDXTwpRdjz2fXA";
const RPC_URL = "https://base-rpc.publicnode.com";

const step = (n: number, t: string) =>
  console.log(`\n── ${n}. ${t} ${"─".repeat(Math.max(0, 60 - t.length - 4))}`);
const kv = (k: string, v: unknown) =>
  console.log(`   ${k.padEnd(22)} ${String(v)}`);

async function main() {
  const PK = process.env.P2P_RELAYER_PRIVATE_KEY;
  if (!PK || !PK.startsWith("0x") || PK.length !== 66) {
    console.error("Missing or malformed P2P_RELAYER_PRIVATE_KEY.");
    process.exit(1);
  }
  const ORDER_ID = process.env.ORDER_ID;
  if (!ORDER_ID || !/^\d+$/.test(ORDER_ID)) {
    console.error("Missing ORDER_ID. Pass ORDER_ID=539401");
    process.exit(1);
  }
  const CONFIRM = process.env.CONFIRM === "yes";

  const tw = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
  const twEoa = twPrivateKeyToAccount({
    client: tw,
    privateKey: PK as `0x${string}`,
  });
  const wallet = smartWallet({
    chain: twBase,
    factoryAddress: AA_FACTORY,
    sponsorGas: true,
  });
  const smartAccount = await wallet.connect({
    client: tw,
    personalAccount: twEoa,
  });

  step(1, "Plan");
  kv("Mode", CONFIRM ? "LIVE (will broadcast paidBuyOrder)" : "DRY-RUN");
  kv("EOA", twEoa.address);
  kv("Smart account", smartAccount.address);
  kv("Order ID", ORDER_ID);

  const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC_URL),
  });
  const orders = createOrders({
    publicClient,
    diamondAddress: DIAMOND,
    usdcAddress: USDC,
    subgraphUrl: SUBGRAPH_URL,
  });

  // ── 2. Read order from subgraph ─────────────────────────────────────────
  step(2, "Read current order state");
  const got = await orders.getOrder({ orderId: BigInt(ORDER_ID) });
  if (got.isErr()) {
    console.error("getOrder failed:", got.error.message);
    process.exit(1);
  }
  const o: any = got.value;
  kv("status", o.status);
  kv("user", o.user);
  kv("recipient", o.recipient);
  kv("acceptedMerchant", o.acceptedMerchant);
  kv("usdcAmount", `${formatUnits(o.usdcAmount, 6)} USDC`);
  kv("actualUsdcAmount", `${formatUnits(o.actualUsdcAmount, 6)} USDC`);
  kv("actualFiatAmount", `${formatUnits(o.actualFiatAmount, 6)} ${o.currency}`);
  kv("paidAt", new Date(Number(o.paidAt) * 1000).toISOString());

  // ── 3. Sanity checks ────────────────────────────────────────────────────
  step(3, "Sanity checks");
  if (
    smartAccount.address.toLowerCase() !== String(o.user).toLowerCase()
  ) {
    console.error(
      `   ✖ Smart account (${smartAccount.address}) is not the order's user (${o.user}). Aborting.`,
    );
    process.exit(1);
  }
  if (o.status !== "paid") {
    console.error(
      `   ✖ Order status is "${o.status}", expected "paid". Cannot confirm yet.`,
    );
    if (o.status === "completed") {
      console.log("     (Already completed. Nothing to do.)");
      process.exit(0);
    }
    process.exit(1);
  }
  if (o.actualUsdcAmount === 0n) {
    console.error(
      "   ✖ actualUsdcAmount is 0. Settlement amounts not yet recorded.",
    );
    process.exit(1);
  }
  console.log("   ✓ Checks pass. Order is in 'paid' state, signer is the buyer.");

  // ── 4. Bank-side reminder ───────────────────────────────────────────────
  step(4, "Manual verification");
  console.log(
    `   ⚠️  Have you confirmed that ${formatUnits(o.actualFiatAmount, 6)} ${o.currency} arrived in your MercadoPago alias?`,
  );
  console.log(
    "      If not, do NOT proceed. Re-run without CONFIRM and check first.",
  );
  console.log(
    "      Falsely confirming forfeits your USDC to the merchant.",
  );

  if (!CONFIRM) {
    step(5, "Dry-run complete");
    console.log(
      "   Re-run with CONFIRM=yes to actually broadcast paidBuyOrder.",
    );
    return;
  }

  // ── 5. Broadcast paidBuyOrder ───────────────────────────────────────────
  step(5, "Broadcast paidBuyOrder via smart account (sponsored gas)");
  const prep = await orders.paidBuyOrder.prepare({
    orderId: BigInt(ORDER_ID),
  });
  if (prep.isErr()) {
    console.error("paidBuyOrder.prepare failed:", prep.error.message);
    process.exit(1);
  }
  const tx = prepareTransaction({
    client: tw,
    chain: twBase,
    to: prep.value.to,
    data: prep.value.data as `0x${string}`,
    value: 0n,
  });

  let txHash: `0x${string}`;
  try {
    const sent = await sendTransaction({
      account: smartAccount,
      transaction: tx,
    });
    txHash = sent.transactionHash;
    kv("tx hash", txHash);
    console.log(`   https://basescan.org/tx/${txHash}`);
  } catch (err: any) {
    console.log("✗ Submission failed.");
    console.log("Error:", err?.shortMessage ?? err?.message ?? err);
    if (err?.cause)
      console.log(
        "cause:",
        err.cause?.shortMessage ?? err.cause?.message ?? err.cause,
      );
    process.exit(1);
  }

  console.log("\n   Waiting for receipt…");
  const receipt = await waitForReceipt({
    client: tw,
    chain: twBase,
    transactionHash: txHash,
  });
  kv("status", receipt.status);
  kv("block", receipt.blockNumber.toString());

  if (receipt.status !== "success") {
    console.log("\n⚠️ Tx reverted. Inspect on BaseScan.");
    process.exit(1);
  }

  console.log(
    "\n🎉 paidBuyOrder confirmed. Order should now transition to 'completed' in the next block.",
  );
  console.log(
    `   bun run scripts/compare-orders.ts ${ORDER_ID}  # to verify completion`,
  );
}

main().catch((err) => {
  console.error("\nUnexpected:", err);
  process.exit(1);
});
