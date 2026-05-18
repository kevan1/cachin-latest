/**
 * Smart Account experiment — does the protocol actually settle orders that
 * come from a smart account (vs. our current EOA)?
 *
 * What this does:
 *  1. Derives a Thirdweb smart account from the relayer EOA (deterministic,
 *     same factory as user-app-client: 0xde320c2e2b4953883f61774c006f9057a55b97d1).
 *  2. Prints the smart account address.
 *  3. If smart account doesn't have USDC, transfers `ORDER_USDC + 0.5` USDC
 *     from the EOA to the smart account so it can escrow.
 *  4. From the smart account, sends approveUsdc + placeOrder(PAY, ARS).
 *  5. Optionally calls setSellOrderUpi if PAYMENT_ALIAS is provided.
 *  6. Prints the orderId and exits — monitor the order in the subgraph after.
 *
 * Run:
 *   cd /Users/kevan/Development/cachin-latest
 *   P2P_RELAYER_PRIVATE_KEY=0x... \
 *     [PAYMENT_ALIAS=username.mp] \
 *     [FIAT_ARS=7500] \
 *     bun run scripts/test-smart-account-order.ts
 */

import { createPublicClient, http, parseUnits, encodeFunctionData, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { createThirdwebClient, prepareTransaction, sendTransaction } from "thirdweb";
import { privateKeyToAccount as twPrivateKeyToAccount } from "thirdweb/wallets";
import { smartWallet } from "thirdweb/wallets/smart";
import { base as twBase } from "thirdweb/chains";
import { createOrders } from "@p2pdotme/sdk/orders";
import { createPrices } from "@p2pdotme/sdk/prices";
import { createProfile } from "@p2pdotme/sdk/profile";
import { validateArgentinePaymentId } from "@p2pdotme/sdk/country";

// ── CONFIG ───────────────────────────────────────────────────────────────
const THIRDWEB_CLIENT_ID = "f2f21a26b756b3c3b759f794f3c3fe18";
const AA_FACTORY = "0xde320c2e2b4953883f61774c006f9057a55b97d1" as `0x${string}`;

const RPC_URL = "https://mainnet.base.org";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;
const DIAMOND = "0x4cad6eC90e65baBec9335cAd728DDC610c316368" as `0x${string}`;
const SUBGRAPH_URL =
  "https://gateway.thegraph.com/api/b140f41e8237594d16b7cb2dcd11d799/subgraphs/id/7Q8UooxVQWokdG6QYW2Wa65Wh6eit2WDXTwpRdjz2fXA";
// ────────────────────────────────────────────────────────────────────────

const step = (n: number, t: string) =>
  console.log(`\n── ${n}. ${t} ${"─".repeat(Math.max(0, 60 - t.length - 4))}`);
const kv = (k: string, v: unknown) => console.log(`   ${k.padEnd(20)} ${String(v)}`);

async function main() {
  const PK = process.env.P2P_RELAYER_PRIVATE_KEY;
  if (!PK || !PK.startsWith("0x") || PK.length !== 66) {
    console.error("Missing or malformed P2P_RELAYER_PRIVATE_KEY (need 0x + 64 hex).");
    process.exit(1);
  }

  const FIAT_ARS_RAW = process.env.FIAT_ARS ?? "7500";
  const PAYMENT_ALIAS = (process.env.PAYMENT_ALIAS ?? "").trim();

  // ── 1. Setup ───────────────────────────────────────────────────────
  step(1, "Setup");

  const eoa = privateKeyToAccount(PK as `0x${string}`);
  const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });

  const tw = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
  const twEoa = twPrivateKeyToAccount({ client: tw, privateKey: PK as `0x${string}` });

  const wallet = smartWallet({
    chain: twBase,
    factoryAddress: AA_FACTORY,
    sponsorGas: true, // Thirdweb's free-tier paymaster covers the deploy + ops
  });
  const smartAccount = await wallet.connect({ client: tw, personalAccount: twEoa });

  kv("EOA address", eoa.address);
  kv("Smart account", smartAccount.address);

  const smartCode = await publicClient.getCode({ address: smartAccount.address });
  const isDeployed = smartCode && smartCode !== "0x";
  kv("Smart deployed?", isDeployed ? "yes" : "no (deploys on first tx)");

  // ── 2. Balance check ───────────────────────────────────────────────
  step(2, "Balances");

  const erc20Abi = parseAbi([
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256) returns (bool)",
  ]);

  const eoaUsdc = await publicClient.readContract({
    address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [eoa.address],
  });
  const smartUsdc = await publicClient.readContract({
    address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [smartAccount.address],
  });

  kv("EOA USDC", (Number(eoaUsdc) / 1e6).toFixed(6));
  kv("Smart USDC", (Number(smartUsdc) / 1e6).toFixed(6));

  // ── 3. Compute order amount ────────────────────────────────────────
  step(3, "Resolve order amount");

  // Use the cachin SDK's prices to get the current ARS sellPrice (USDC/ARS).
  const prices = createPrices({ publicClient: publicClient as any, diamondAddress: DIAMOND });
  const priceRes = await prices.getPriceConfig({ currency: "ARS" });
  if (priceRes.isErr()) {
    console.error("getPriceConfig failed:", priceRes.error.message);
    process.exit(1);
  }
  const sellPrice = priceRes.value.sellPrice;
  const fiatAmount = parseUnits(FIAT_ARS_RAW, 6);
  // round-up: (fiat * 1e6 + sellPrice - 1) / sellPrice
  const usdcAmount = (fiatAmount * 1_000_000n + sellPrice - 1n) / sellPrice;
  kv("FIAT amount", `${FIAT_ARS_RAW} ARS`);
  kv("USDC amount (incl. round-up)", (Number(usdcAmount) / 1e6).toFixed(6));

  // Need a small buffer for protocol fees (~0.05 USDC flat under $10).
  const bufferUsdc = parseUnits("0.5", 6);
  const requiredAtSmart = usdcAmount + bufferUsdc;

  // ── 4. Fund smart account from EOA if needed ──────────────────────
  if (smartUsdc < requiredAtSmart) {
    step(4, "Top-up smart account with USDC from EOA");
    const toSend = requiredAtSmart - smartUsdc;
    if (eoaUsdc < toSend) {
      console.error(
        `EOA has only ${Number(eoaUsdc) / 1e6} USDC — need ${Number(toSend) / 1e6} more for the smart account.`,
      );
      process.exit(1);
    }
    kv("Transfer", `${(Number(toSend) / 1e6).toFixed(6)} USDC EOA→Smart`);

    // EOA needs ETH for this single transfer tx (~$0.01 on Base).
    const walletClientEoa = (await import("viem")).createWalletClient({
      chain: base, transport: http(RPC_URL), account: eoa,
    });
    const transferData = encodeFunctionData({
      abi: erc20Abi, functionName: "transfer", args: [smartAccount.address, toSend],
    });
    const transferHash = await walletClientEoa.sendTransaction({
      to: USDC, data: transferData, value: 0n,
    });
    kv("transfer tx", transferHash);
    await publicClient.waitForTransactionReceipt({ hash: transferHash });
    kv("transfer confirmed", "yes");
  } else {
    kv("Skip top-up", "smart already has enough USDC");
  }

  // ── 5. Approve USDC to Diamond (from SMART account) ───────────────
  step(5, "approveUsdc from smart account");

  const orders = createOrders({
    publicClient: publicClient as any,
    diamondAddress: DIAMOND,
    usdcAddress: USDC,
    subgraphUrl: SUBGRAPH_URL,
  });
  const profile = createProfile({
    publicClient: publicClient as any,
    diamondAddress: DIAMOND,
    usdcAddress: USDC,
  });

  const allowanceRes = await profile.getUsdcAllowance({ owner: smartAccount.address });
  const allowance = allowanceRes.isOk() ? allowanceRes.value : 0n;
  kv("Current allowance", (Number(allowance) / 1e6).toFixed(6));

  if (allowance < usdcAmount) {
    const approveRes = await orders.approveUsdc.prepare({ amount: requiredAtSmart });
    if (approveRes.isErr()) {
      console.error("approveUsdc.prepare failed:", approveRes.error.message);
      process.exit(1);
    }
    const approveTx = prepareTransaction({
      client: tw, chain: twBase,
      to: approveRes.value.to,
      data: approveRes.value.data as `0x${string}`,
      value: 0n,
    });
    kv("Sending approve via smart account…", "");
    const approveSent = await sendTransaction({ account: smartAccount, transaction: approveTx });
    kv("approve userOp/tx", approveSent.transactionHash);
  } else {
    kv("Skip approve", "allowance sufficient");
  }

  // ── 6. placeOrder PAY-ARS from smart account ──────────────────────
  step(6, "placeOrder (PAY, ARS) from smart account");

  const placeRes = await orders.placeOrder.prepare({
    orderType: 2, // PAY
    currency: "ARS",
    user: smartAccount.address as `0x${string}`,
    // recipientAddr MUST be 0x0 for PAY — see scripts/compare-orders.ts.
    // Working order 539380 (user-app-client) used 0x0; our 535977 used
    // smartAccount.address and got cancelled with actualUsdcAmount=0.
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
    client: tw, chain: twBase,
    to: placeRes.value.to,
    data: placeRes.value.data as `0x${string}`,
    value: 0n,
  });
  kv("Sending placeOrder via smart account…", "");
  const placeSent = await sendTransaction({ account: smartAccount, transaction: placeTx });
  kv("placeOrder userOp/tx", placeSent.transactionHash);

  // ── 7. Find the orderId from the receipt (best-effort via subgraph) ─
  step(7, "Lookup orderId via subgraph");

  // Subgraph indexing lag, so poll a bit.
  let orderId: string | null = null;
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const q = `{ orders_collection(where: { userAddress: "${smartAccount.address.toLowerCase()}" }, orderBy: placedAt, orderDirection: desc, first: 1) { orderId } }`;
    const r = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    });
    const j: any = await r.json();
    const id = j?.data?.orders_collection?.[0]?.orderId;
    if (id) {
      orderId = id;
      break;
    }
    console.log(`   poll ${i + 1}/8 — not indexed yet`);
  }
  if (!orderId) {
    console.log("\n⚠️ Order not found in subgraph yet — check manually with smart account address.");
    return;
  }
  kv("orderId", `#${orderId}`);

  // ── 8. Optionally setSellOrderUpi ─────────────────────────────────
  if (!PAYMENT_ALIAS) {
    console.log(
      "\n   PAYMENT_ALIAS not set → skipping setSellOrderUpi.",
      "\n   To complete the flow, run again with: PAYMENT_ALIAS=username.mp",
    );
    return;
  }
  if (!validateArgentinePaymentId(PAYMENT_ALIAS)) {
    console.error("\n   PAYMENT_ALIAS is not a valid Argentine alias/CBU/CVU:", PAYMENT_ALIAS);
    return;
  }

  step(8, "Wait for merchant accept, then setSellOrderUpi");

  // Poll order until status=accepted + pubkey ready
  let acceptedPubkey: string | null = null;
  const orderIdBig = BigInt(orderId);
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const got = await orders.getOrder({ orderId: orderIdBig });
    if (got.isErr()) {
      console.log(`   poll ${i + 1}/24 — getOrder err: ${got.error.message}`);
      continue;
    }
    const o = got.value;
    console.log(`   poll ${i + 1}/24 — status=${o.status}`);
    if (o.status === "accepted" && /^[0-9a-fA-F]{128}$/.test((o.pubkey ?? "").trim())) {
      acceptedPubkey = o.pubkey as string;
      break;
    }
    if (o.status === "cancelled" || o.status === "completed") {
      console.log(`\n   Order ended at ${o.status} before we could setUpi.`);
      return;
    }
  }
  if (!acceptedPubkey) {
    console.log("\n   Timed out waiting for accepted+pubkey — see subgraph.");
    return;
  }

  const setRes = await orders.setSellOrderUpi.prepare({
    orderId: orderIdBig,
    paymentAddress: PAYMENT_ALIAS,
    merchantPublicKey: acceptedPubkey,
    updatedAmount: 0n,
  });
  if (setRes.isErr()) {
    console.error("setSellOrderUpi.prepare failed:", setRes.error.message);
    return;
  }
  const setTx = prepareTransaction({
    client: tw, chain: twBase,
    to: setRes.value.to,
    data: setRes.value.data as `0x${string}`,
    value: 0n,
  });
  kv("Sending setSellOrderUpi via smart account…", "");
  const setSent = await sendTransaction({ account: smartAccount, transaction: setTx });
  kv("setSellOrderUpi tx", setSent.transactionHash);

  console.log(
    "\n🎉 Order placed + payment address set. Monitor subgraph for paid/settled status.",
  );
}

main().catch((err) => {
  console.error("\nUnexpected error:", err);
  process.exit(1);
});
