/**
 * Diagnose a stuck order. Reads:
 *   - current subgraph state of the order (status, amounts, paidAt)
 *   - USDC balance of the smart account (to see if escrow was pulled)
 *   - dispute window remaining (if known)
 *
 * Run:
 *   ORDER_ID=539401 P2P_RELAYER_PRIVATE_KEY=0x... \
 *     bun run scripts/inspect-order-state.ts
 */

import { createPublicClient, http, parseAbi, formatUnits } from "viem";
import { base } from "viem/chains";
import { createThirdwebClient } from "thirdweb";
import { privateKeyToAccount as twPrivateKeyToAccount } from "thirdweb/wallets";
import { smartWallet } from "thirdweb/wallets/smart";
import { base as twBase } from "thirdweb/chains";
import { createOrders } from "@p2pdotme/sdk/orders";

const THIRDWEB_CLIENT_ID = "f2f21a26b756b3c3b759f794f3c3fe18";
const AA_FACTORY = "0xde320c2e2b4953883f61774c006f9057a55b97d1" as `0x${string}`;
const DIAMOND = "0x4cad6eC90e65baBec9335cAd728DDC610c316368" as `0x${string}`;
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;
const SUBGRAPH_URL =
  "https://gateway.thegraph.com/api/b140f41e8237594d16b7cb2dcd11d799/subgraphs/id/7Q8UooxVQWokdG6QYW2Wa65Wh6eit2WDXTwpRdjz2fXA";
const RPC_URL = "https://base-rpc.publicnode.com";

const ERC20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

const kv = (k: string, v: unknown) =>
  console.log(`   ${k.padEnd(24)} ${String(v)}`);
const hdr = (t: string) =>
  console.log(`\n── ${t} ${"─".repeat(Math.max(0, 60 - t.length - 4))}`);

async function main() {
  const PK = process.env.P2P_RELAYER_PRIVATE_KEY;
  const ORDER_ID = process.env.ORDER_ID;
  if (!PK || !ORDER_ID) {
    console.error("Need ORDER_ID and P2P_RELAYER_PRIVATE_KEY env vars.");
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

  hdr("Identities");
  kv("EOA", twEoa.address);
  kv("Smart account", smartAccount.address);

  hdr("USDC balance & allowance");
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
  kv("smart USDC balance", `${formatUnits(bal, 6)} (${bal})`);
  kv("diamond allowance", `${formatUnits(allow, 6)} (${allow > 10n ** 30n ? "≈ MAX_UINT256" : allow})`);

  hdr(`Order ${ORDER_ID}`);
  const got = await orders.getOrder({ orderId: BigInt(ORDER_ID) });
  if (got.isErr()) {
    console.error("getOrder failed:", got.error.message);
    process.exit(1);
  }
  const o: any = got.value;
  const ts = (s: bigint | number) =>
    !s || Number(s) === 0 ? "-" : new Date(Number(s) * 1000).toISOString();
  kv("status", o.status);
  kv("type", o.type);
  kv("user", o.user);
  kv("recipient", o.recipient);
  kv("acceptedMerchant", o.acceptedMerchant);
  kv("placedAt", ts(o.placedAt));
  kv("acceptedAt", ts(o.acceptedAt));
  kv("paidAt", ts(o.paidAt));
  kv("completedAt", ts(o.completedAt));
  kv("usdcAmount", `${formatUnits(o.usdcAmount, 6)} USDC`);
  kv("actualUsdcAmount", `${formatUnits(o.actualUsdcAmount, 6)} USDC`);
  kv("actualFiatAmount", `${formatUnits(o.actualFiatAmount, 6)} ${o.currency}`);
  kv("fixedFeePaid", `${formatUnits(o.fixedFeePaid, 6)} USDC`);
  kv("disputeStatus", o.disputeStatus);

  const now = Math.floor(Date.now() / 1000);
  if (Number(o.paidAt) > 0) {
    const sincePaid = now - Number(o.paidAt);
    kv("time since paid", `${Math.floor(sincePaid / 60)}m ${sincePaid % 60}s`);
  }
}

main().catch((e) => {
  console.error("Unexpected:", e);
  process.exit(1);
});
