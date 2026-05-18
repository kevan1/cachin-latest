/**
 * Continue an EXISTING p2p.me order by calling setSellOrderUpi from the
 * smart account. Use after `test-smart-account-order.ts` placed an order
 * but exited (e.g. no PAYMENT_ALIAS was provided).
 *
 * Flow:
 *   1. Poll the order until status=accepted + the merchant's pubkey is
 *      published in the subgraph.
 *   2. Call setSellOrderUpi(orderId, PAYMENT_ALIAS, merchantPubKey, 0n)
 *      from the smart account (sponsored gas via thirdweb 4337).
 *   3. Exit. Monitor on-chain for paid → completed.
 *
 * Run:
 *   cd /Users/kevan/Development/cachin-latest
 *   export PATH="$HOME/.nvm/versions/node/v24.8.0/bin:$PATH"
 *   ORDER_ID=539401 PAYMENT_ALIAS=miusuario.mp \
 *     P2P_RELAYER_PRIVATE_KEY=0x... \
 *     bun run scripts/set-payment-address.ts
 *
 * PAYMENT_ALIAS = your MercadoPago alias (e.g. `kevan.mp`), CBU, or CVU
 * — the destination where the merchant will send the ARS.
 */

import {
  createThirdwebClient,
  prepareTransaction,
  sendTransaction,
} from "thirdweb";
import { privateKeyToAccount as twPrivateKeyToAccount } from "thirdweb/wallets";
import { smartWallet } from "thirdweb/wallets/smart";
import { base as twBase } from "thirdweb/chains";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { createOrders } from "@p2pdotme/sdk/orders";
import { validateArgentinePaymentId } from "@p2pdotme/sdk/country";

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
  const PAYMENT_ALIAS = (process.env.PAYMENT_ALIAS ?? "").trim();
  if (!PAYMENT_ALIAS) {
    console.error("Missing PAYMENT_ALIAS. Pass PAYMENT_ALIAS=tu.alias.mp");
    process.exit(1);
  }
  if (!validateArgentinePaymentId(PAYMENT_ALIAS)) {
    console.error(`PAYMENT_ALIAS not a valid AR alias/CBU/CVU: ${PAYMENT_ALIAS}`);
    process.exit(1);
  }

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

  step(1, "Identities & target");
  kv("EOA", twEoa.address);
  kv("Smart account", smartAccount.address);
  kv("Order ID", ORDER_ID);
  kv("Payment alias", PAYMENT_ALIAS);

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

  step(2, "Wait for merchant accept + pubkey");
  const orderIdBig = BigInt(ORDER_ID);
  let acceptedPubkey: string | null = null;
  let lastStatus = "unknown";
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const got = await orders.getOrder({ orderId: orderIdBig });
    if (got.isErr()) {
      console.log(`   poll ${i + 1}/60 — getOrder err: ${got.error.message}`);
      continue;
    }
    const o: any = got.value;
    lastStatus = o.status;
    const pubkey = (o.pubkey ?? "").trim();
    console.log(
      `   poll ${i + 1}/60 — status=${o.status} pubkey=${pubkey ? pubkey.slice(0, 16) + "…" : "<empty>"}`,
    );
    if (
      (o.status === "accepted" || o.status === "placed") &&
      /^[0-9a-fA-F]{128}$/.test(pubkey)
    ) {
      acceptedPubkey = pubkey;
      break;
    }
    if (o.status === "cancelled" || o.status === "completed") {
      console.log(`\n   Order ended at ${o.status} — nothing to do.`);
      return;
    }
  }
  if (!acceptedPubkey) {
    console.log(
      `\n   Timed out (last status=${lastStatus}). Either merchant hasn't accepted yet or pubkey didn't publish.`,
    );
    return;
  }

  step(3, "setSellOrderUpi from smart account (sponsored gas)");
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

  const tx = prepareTransaction({
    client: tw,
    chain: twBase,
    to: setRes.value.to,
    data: setRes.value.data as `0x${string}`,
    value: 0n,
  });

  try {
    const sent = await sendTransaction({
      account: smartAccount,
      transaction: tx,
    });
    kv("tx hash", sent.transactionHash);
    console.log(`   https://basescan.org/tx/${sent.transactionHash}`);
  } catch (err: any) {
    console.log("✗ setSellOrderUpi submission failed.");
    console.log("Error:", err?.shortMessage ?? err?.message ?? err);
    if (err?.cause)
      console.log(
        "cause:",
        err.cause?.shortMessage ?? err.cause?.message ?? err.cause,
      );
    process.exit(1);
  }

  console.log(
    "\n🎉 Payment address set. Now poll order status: it should progress to paid → completed.",
  );
  console.log(
    `   bun run scripts/compare-orders.ts ${ORDER_ID}  # to inspect on-chain state`,
  );
}

main().catch((err) => {
  console.error("\nUnexpected:", err);
  process.exit(1);
});
