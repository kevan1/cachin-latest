/**
 * Compare a working order from user-app-client vs a stuck order from cachin.
 *
 * Pulls both via the SDK's `orders.getOrder()` so we see exactly what the
 * subgraph returns for each — placer (`user`), recipientAddr, pubkey,
 * circleId, etc. The diff tells us whether the difference is in WHO
 * placed it or WHAT params were used.
 *
 * Run:
 *   cd /Users/kevan/Development/cachin-latest
 *   export PATH="$HOME/.nvm/versions/node/v24.8.0/bin:$PATH"
 *   bun run scripts/compare-orders.ts 539380 535977
 *
 * Arg1 = the "working" order (from user-app-client).
 * Arg2 = our stuck order (cachin).
 * You can also pass any other orderIds to inspect.
 */

import { createOrders } from "@p2pdotme/sdk/orders";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const SUBGRAPH_URL =
  "https://gateway.thegraph.com/api/b140f41e8237594d16b7cb2dcd11d799/subgraphs/id/7Q8UooxVQWokdG6QYW2Wa65Wh6eit2WDXTwpRdjz2fXA";
const DIAMOND = "0x4cad6eC90e65baBec9335cAd728DDC610c316368" as const;
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

async function getOne(orders: ReturnType<typeof createOrders>, id: string) {
  console.log(`\n── Order ${id} ${"─".repeat(60 - id.length - 9)}`);
  const r = await orders.getOrder({ orderId: BigInt(id) });
  if (!r || (typeof r.isOk === "function" && r.isErr())) {
    const err = (r as any)?.error ?? r;
    console.log("  ✖ getOrder failed:", err?.message ?? err);
    return;
  }
  const o: any = (r as any).value ?? r;
  // Print every field. We don't know the exact schema, so dump verbatim.
  const sorted = Object.keys(o).sort();
  for (const k of sorted) {
    const v = (o as any)[k];
    if (typeof v === "bigint") {
      console.log(`  ${k.padEnd(28)} ${v.toString()}`);
    } else if (typeof v === "object" && v !== null) {
      console.log(`  ${k.padEnd(28)} ${JSON.stringify(v)}`);
    } else {
      console.log(`  ${k.padEnd(28)} ${String(v)}`);
    }
  }
}

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    console.error("Usage: bun run scripts/compare-orders.ts <orderId> [<orderId> ...]");
    process.exit(1);
  }
  const publicClient = createPublicClient({
    chain: base,
    transport: http("https://base-rpc.publicnode.com"),
  });
  const orders = createOrders({
    publicClient,
    diamondAddress: DIAMOND,
    usdcAddress: USDC,
    subgraphUrl: SUBGRAPH_URL,
  });
  console.log(`Diamond:  ${DIAMOND}`);
  console.log(`Subgraph: ${SUBGRAPH_URL}`);
  for (const id of ids) await getOne(orders, id);
}

main().catch((e) => {
  console.error("Unexpected:", e);
  process.exit(1);
});
