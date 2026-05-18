/**
 * Full end-to-end PAY order test against p2p.me on Base mainnet, with a
 * manual "did the fiat arrive?" gate before final settlement so you don't
 * lose USDC if the merchant is dishonest.
 *
 * Flow:
 *   1. approve USDC (only if allowance < amount)
 *   2. placeOrder (PAY, recipient = 0x0) — pegs the merchant
 *   3. setSellOrderUpi with PAYMENT_ALIAS
 *   4. poll until status=paid
 *   5. **pauses with a confirm prompt** — verify the fiat arrived in your MP
 *   6. paidBuyOrder (if you press y)
 *   7. poll until status=completed
 *
 * Sponsored gas all the way (thirdweb 4337 + paymaster). Smart account
 * pays only USDC + the 0.05 fixed fee.
 *
 * Run:
 *   cd /Users/kevan/Development/cachin-latest
 *   export PATH="$HOME/.nvm/versions/node/v24.8.0/bin:$PATH"
 *   FIAT_ARS=1500 PAYMENT_ALIAS=tu.alias.mp \
 *     P2P_RELAYER_PRIVATE_KEY=0x... \
 *     bun run scripts/full-pay-test.ts
 *
 * Defaults: FIAT_ARS=1500. Override with env var.
 *
 * If at the confirm prompt you press anything other than `y` (or Ctrl-C),
 * the script does NOT call paidBuyOrder — the order will auto-cancel after
 * the protocol window expires (you lose only the 0.05 USDC fee).
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
import {
  createPublicClient,
  http,
  parseAbi,
  parseUnits,
  formatUnits,
  encodeFunctionData,
} from "viem";
import { base } from "viem/chains";
import {
  createOrders,
  createRelayIdentity,
  type RelayIdentity,
  type RelayIdentityStore,
} from "@p2pdotme/sdk/orders";
import { createPrices } from "@p2pdotme/sdk/prices";
import { validateArgentinePaymentId } from "@p2pdotme/sdk/country";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * File-backed relay identity store — mirrors user-app-client's
 * createLocalStorageRelayStore but for node scripts. Persists the
 * identity across runs so encMerchantUpi from a prior placeOrder can
 * still be decrypted (the merchant encrypts to this exact identity's
 * pubkey at acceptance time, so we need its privkey to decrypt later).
 */
function createFileRelayStore(path: string): RelayIdentityStore {
  return {
    async get(): Promise<RelayIdentity | null> {
      if (!existsSync(path)) return null;
      try {
        return JSON.parse(readFileSync(path, "utf8")) as RelayIdentity;
      } catch {
        return null;
      }
    },
    async set(identity: RelayIdentity): Promise<void> {
      writeFileSync(path, JSON.stringify(identity, null, 2));
    },
  };
}

const THIRDWEB_CLIENT_ID = "f2f21a26b756b3c3b759f794f3c3fe18";
const AA_FACTORY = "0xde320c2e2b4953883f61774c006f9057a55b97d1" as `0x${string}`;
const DIAMOND = "0x4cad6eC90e65baBec9335cAd728DDC610c316368" as `0x${string}`;
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;
const SUBGRAPH_URL =
  "https://gateway.thegraph.com/api/b140f41e8237594d16b7cb2dcd11d799/subgraphs/id/7Q8UooxVQWokdG6QYW2Wa65Wh6eit2WDXTwpRdjz2fXA";
const RPC_URL = "https://base-rpc.publicnode.com";

const ERC20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address, address) view returns (uint256)",
]);

const step = (n: number, t: string) =>
  console.log(`\n── ${n}. ${t} ${"─".repeat(Math.max(0, 60 - t.length - 4))}`);
const kv = (k: string, v: unknown) =>
  console.log(`   ${k.padEnd(22)} ${String(v)}`);

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const onData = (data: string) => {
      process.stdin.pause();
      process.stdin.off("data", onData);
      resolve(data.trim());
    };
    process.stdin.on("data", onData);
  });
}

async function main() {
  const PK = process.env.P2P_RELAYER_PRIVATE_KEY;
  if (!PK || !PK.startsWith("0x") || PK.length !== 66) {
    console.error("Missing P2P_RELAYER_PRIVATE_KEY");
    process.exit(1);
  }
  const FIAT_ARS_RAW = process.env.FIAT_ARS ?? "1500";
  const PAYMENT_ALIAS = (process.env.PAYMENT_ALIAS ?? "").trim();
  // If set, skip placement entirely and continue an existing order. Useful
  // when a previous run placed the order but failed at the subgraph lookup.
  const EXISTING_ORDER_ID = process.env.ORDER_ID ?? "";
  if (!PAYMENT_ALIAS) {
    console.error("Missing PAYMENT_ALIAS. Pass PAYMENT_ALIAS=tu.alias.mp");
    process.exit(1);
  }
  // The SDK accepts any non-empty string here — `validateArgentinePaymentId`
  // is an APP-level validator for alias/CBU input forms. user-app-client's
  // PAY flow passes the FULL raw EMV QR string (eg "00020126…6304ABCD"),
  // NOT just the alias. Accept either format.
  const looksLikeEmvQr = /^0002[\d]{2}/.test(PAYMENT_ALIAS);
  if (!looksLikeEmvQr && !validateArgentinePaymentId(PAYMENT_ALIAS)) {
    console.error(
      `PAYMENT_ALIAS doesn't look like a valid AR alias/CBU/CVU or EMV QR: ${PAYMENT_ALIAS.slice(0, 80)}…`,
    );
    process.exit(1);
  }
  if (looksLikeEmvQr) {
    console.log(`   (PAYMENT_ALIAS is EMV QR, len=${PAYMENT_ALIAS.length})`);
  } else {
    console.log(`   (PAYMENT_ALIAS is alias/CVU, len=${PAYMENT_ALIAS.length})`);
  }

  // ── Build clients ───────────────────────────────────────────────────────
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

  const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC_URL),
  });
  // Persist the relay identity to a file so a partial run can be resumed —
  // critical because the merchant encrypts encMerchantUpi to this identity's
  // pubkey, and we need its privkey to decrypt it back to call completeOrder.
  const relayStorePath = join(
    process.env.HOME ?? ".",
    ".cachin-relay-identity.json",
  );
  const relayStore = createFileRelayStore(relayStorePath);
  let existingIdentity = await relayStore.get();
  if (!existingIdentity) {
    const fresh = createRelayIdentity();
    await relayStore.set(fresh);
    existingIdentity = fresh;
    console.log(`   (new relay identity created at ${relayStorePath})`);
  } else {
    console.log(`   (reusing persisted relay identity from ${relayStorePath})`);
  }
  kv("relay identity pubKey", existingIdentity.publicKey.slice(0, 16) + "…");

  const orders = createOrders({
    publicClient,
    diamondAddress: DIAMOND,
    usdcAddress: USDC,
    subgraphUrl: SUBGRAPH_URL,
    relayIdentityStore: relayStore,
  });
  const prices = createPrices({
    publicClient,
    diamondAddress: DIAMOND,
    subgraphUrl: SUBGRAPH_URL,
  });

  step(1, "Configuration");
  kv("EOA", twEoa.address);
  kv("Smart account", smartAccount.address);
  kv("FIAT amount", `${FIAT_ARS_RAW} ARS`);
  kv("Payment alias", PAYMENT_ALIAS);

  // ── Pricing ─────────────────────────────────────────────────────────────
  step(2, "Resolve price (sell price, ARS)");
  const priceRes = await prices.getPriceConfig({ currency: "ARS" });
  if (priceRes.isErr()) {
    console.error("getPriceConfig failed:", priceRes.error.message);
    process.exit(1);
  }
  const sellPrice = priceRes.value.sellPrice;
  kv("sell price (6 dec)", sellPrice.toString());

  const fiatAmount = parseUnits(FIAT_ARS_RAW, 6);
  const usdcAmount = (fiatAmount * 1_000_000n + sellPrice - 1n) / sellPrice;
  kv("USDC needed (round-up)", `${formatUnits(usdcAmount, 6)} USDC`);
  kv("USDC + fixed fee", `${formatUnits(usdcAmount + 50_000n, 6)} USDC`);

  // ── Balances ────────────────────────────────────────────────────────────
  step(3, "Pre-flight balance & allowance");
  const bal = (await publicClient.readContract({
    address: USDC,
    abi: ERC20,
    functionName: "balanceOf",
    args: [smartAccount.address as `0x${string}`],
  })) as bigint;
  const allow = (await publicClient.readContract({
    address: USDC,
    abi: ERC20,
    functionName: "allowance",
    args: [smartAccount.address as `0x${string}`, DIAMOND],
  })) as bigint;
  kv("balance", `${formatUnits(bal, 6)} USDC`);
  kv("allowance", `${formatUnits(allow, 6)} USDC`);

  const totalNeeded = usdcAmount + 50_000n;
  if (bal < totalNeeded) {
    console.error(
      `Insufficient balance: have ${formatUnits(bal, 6)}, need ${formatUnits(totalNeeded, 6)}`,
    );
    process.exit(1);
  }

  // ── Approval (max if needed) ────────────────────────────────────────────
  if (allow < usdcAmount) {
    step(4, "Approve USDC (MAX_UINT256)");
    const MAX = 2n ** 256n - 1n;
    const approveRes = await orders.approveUsdc.prepare({ amount: MAX });
    if (approveRes.isErr()) {
      console.error("approveUsdc.prepare failed:", approveRes.error.message);
      process.exit(1);
    }
    const apTx = prepareTransaction({
      client: tw,
      chain: twBase,
      to: approveRes.value.to,
      data: approveRes.value.data as `0x${string}`,
      value: 0n,
    });
    const apSent = await sendTransaction({
      account: smartAccount,
      transaction: apTx,
    });
    kv("approve tx", apSent.transactionHash);
    await waitForReceipt({
      client: tw,
      chain: twBase,
      transactionHash: apSent.transactionHash,
    });
    console.log("   ✓ approval confirmed");
  } else {
    step(4, "Approval already sufficient — skipping");
  }

  // ── Place order (or skip if ORDER_ID was provided) ──────────────────────
  let orderId: string;
  if (EXISTING_ORDER_ID) {
    step(5, "Reusing existing order — skipping placement");
    orderId = EXISTING_ORDER_ID;
    kv("orderId", `#${orderId}`);
  } else {
    step(5, "placeOrder (PAY, recipient=0x0)");
    const placeRes = await orders.placeOrder.prepare({
      orderType: 2, // PAY
      currency: "ARS",
      user: smartAccount.address as `0x${string}`,
      recipientAddr: "0x0000000000000000000000000000000000000000",
      amount: usdcAmount,
      fiatAmount,
      fiatAmountLimit: 0n,
    });
    if (placeRes.isErr()) {
      console.error("placeOrder.prepare failed:", placeRes.error.message);
      process.exit(1);
    }
    const placeTx = prepareTransaction({
      client: tw,
      chain: twBase,
      to: placeRes.value.to,
      data: placeRes.value.data as `0x${string}`,
      value: 0n,
    });
    const placeSent = await sendTransaction({
      account: smartAccount,
      transaction: placeTx,
    });
    kv("placeOrder tx", placeSent.transactionHash);
    await waitForReceipt({
      client: tw,
      chain: twBase,
      transactionHash: placeSent.transactionHash,
    });

    // Lookup orderId via raw GraphQL (same pattern as test-smart-account-order.ts).
    step(6, "Look up orderId from subgraph (raw GraphQL)");
    let found: string | null = null;
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const q = `{ orders_collection(where: { userAddress: "${smartAccount.address.toLowerCase()}" }, orderBy: placedAt, orderDirection: desc, first: 1) { orderId } }`;
      try {
        const r = await fetch(SUBGRAPH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        });
        const j: any = await r.json();
        const id = j?.data?.orders_collection?.[0]?.orderId;
        if (id) {
          found = String(id);
          break;
        }
      } catch (e) {
        // swallow & retry
      }
      console.log(`   poll ${i + 1}/12 — not indexed yet`);
    }
    if (!found) {
      console.error(
        `Couldn't find new orderId after 60s. placeOrder tx: ${placeSent.transactionHash}`,
      );
      process.exit(1);
    }
    orderId = found;
    kv("orderId", `#${orderId}`);
  }

  // ── Wait for accepted + pubkey ──────────────────────────────────────────
  step(7, "Wait for merchant accept + pubkey");
  const orderIdBig = BigInt(orderId);
  let merchantPubKey: string | null = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const got = await orders.getOrder({ orderId: orderIdBig });
    if (got.isErr()) {
      console.log(`   poll ${i + 1}/30 — err: ${got.error.message}`);
      continue;
    }
    const o: any = got.value;
    const pk = (o.pubkey ?? "").trim();
    console.log(
      `   poll ${i + 1}/30 — status=${o.status} pubkey=${pk ? "yes" : "no"}`,
    );
    if (
      (o.status === "accepted" || o.status === "placed") &&
      /^[0-9a-fA-F]{128}$/.test(pk)
    ) {
      merchantPubKey = pk;
      break;
    }
    if (o.status === "cancelled" || o.status === "completed") {
      console.log(`\n   Order ended at ${o.status} unexpectedly.`);
      process.exit(1);
    }
  }
  if (!merchantPubKey) {
    console.error("Timed out waiting for accept+pubkey.");
    process.exit(1);
  }

  // ── Set payment address ─────────────────────────────────────────────────
  step(8, "setSellOrderUpi");
  const setRes = await orders.setSellOrderUpi.prepare({
    orderId: orderIdBig,
    paymentAddress: PAYMENT_ALIAS,
    merchantPublicKey: merchantPubKey,
    updatedAmount: 0n,
  });
  if (setRes.isErr()) {
    console.error("setSellOrderUpi.prepare failed:", setRes.error.message);
    process.exit(1);
  }
  const setTx = prepareTransaction({
    client: tw,
    chain: twBase,
    to: setRes.value.to,
    data: setRes.value.data as `0x${string}`,
    value: 0n,
  });
  const setSent = await sendTransaction({
    account: smartAccount,
    transaction: setTx,
  });
  kv("setSellOrderUpi tx", setSent.transactionHash);
  await waitForReceipt({
    client: tw,
    chain: twBase,
    transactionHash: setSent.transactionHash,
  });

  // ── Poll all the way to status=completed (or cancelled) ────────────────
  // For PAY orders the buyer does NOT call completeOrder — the merchant
  // does, automatically, ~30s after marking paid. Reaching `paid` is just
  // an intermediate state; we just wait for the terminal state.
  step(9, "Poll order until completed (or cancelled)");
  let reached: "completed" | "cancelled" | null = null;
  let lastEncMerchant = 0;
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const got = await orders.getOrder({ orderId: orderIdBig });
    if (got.isErr()) continue;
    const o: any = got.value;
    const encLen = String(o.encMerchantUpi ?? "").length;
    if (encLen !== lastEncMerchant) lastEncMerchant = encLen;
    console.log(
      `   poll ${i + 1}/90 — status=${o.status} actualUsdc=${formatUnits(o.actualUsdcAmount, 6)} actualFiat=${formatUnits(o.actualFiatAmount, 6)} encMerchantUpi=${encLen}`,
    );
    if (o.status === "completed") {
      reached = "completed";
      kv("completedAt", new Date(Number(o.completedAt) * 1000).toISOString());
      kv("actualUsdc", `${formatUnits(o.actualUsdcAmount, 6)} USDC`);
      kv("actualFiat", `${formatUnits(o.actualFiatAmount, 6)} ${o.currency}`);
      kv("encMerchantUpi", `${encLen} hex chars (populated by merchant)`);
      break;
    }
    if (o.status === "cancelled") {
      reached = "cancelled";
      kv("cancelledAt", new Date(Number(o.cancelledAt ?? 0) * 1000).toISOString());
      break;
    }
  }
  if (!reached) {
    console.error("\nTimed out (7.5 min). Inspect on the subgraph.");
    process.exit(1);
  }
  if (reached === "cancelled") {
    console.log(
      `\n   Order cancelled — most likely the merchant couldn't deliver fiat.`,
      `\n   You lost the ${formatUnits(50_000n, 6)} USDC flat fee. No further action.`,
    );
    process.exit(1);
  }

  // ── Post-flight ─────────────────────────────────────────────────────────
  step(10, "Post-flight balance");
  const balAfter = (await publicClient.readContract({
    address: USDC,
    abi: ERC20,
    functionName: "balanceOf",
    args: [smartAccount.address as `0x${string}`],
  })) as bigint;
  kv("balance", `${formatUnits(balAfter, 6)} USDC`);
  kv("Δ", `${formatUnits(balAfter - bal, 6)} USDC`);

  console.log(
    `\n🎉 PAY order #${orderId} completed end-to-end. Fix verified in production conditions.`,
  );
}

main().catch((err) => {
  console.error("\nUnexpected:", err);
  process.exit(1);
});
