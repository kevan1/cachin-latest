/**
 * Verify the cachin RELAYER address with GitHub via Reclaim Protocol.
 *
 * One-time bootstrap so merchants stop cancelling our PAY orders.
 * After this runs successfully the relayer earns reputation points
 * on Base mainnet and ARS merchants should settle our orders.
 *
 * Run:
 *   cd /Users/kevan/Development/cachin-latest
 *   bun add -d @reclaimprotocol/js-sdk     # peer dep, one-time
 *   P2P_RELAYER_PRIVATE_KEY=0x... \
 *     bun run scripts/verify-relayer-github.ts
 *
 * What it does:
 *   1. Starts a Reclaim GitHub-verification session pinned to the relayer
 *      address (so the proof can ONLY be submitted by that address).
 *   2. Prints a Reclaim URL — open it in your browser, log in to GitHub,
 *      let Reclaim generate the proof.
 *   3. Polls Reclaim's API every 5s until the proof is published.
 *   4. Encodes a `socialVerify` call against the Reputation Manager on Base
 *      mainnet and submits it signed by the relayer key.
 *   5. Waits for tx confirmation, prints the block + gas used.
 *
 * After success, place a new ARS PAY order from cachin — merchants should
 * progress it to paid + settle on-chain with `actualUsdcAmount > 0`.
 */

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import {
  createReclaimFlow,
  createZkkyc,
  DEFAULT_RECLAIM_PROVIDER_IDS,
  type SocialVerifyParams,
} from "@p2pdotme/sdk/zkkyc";

// ── CONFIG ──────────────────────────────────────────────────────────────
const RECLAIM_APP_ID = "0x6919872d9b927B184fBE6ae5257EAD85E88A833E";
const RECLAIM_APP_SECRET =
  "0x92e0370beb4533502fa3ecc3a81c9026626ae99d1995843e78f52e04f06146f2";

// Platform can be overridden by SOCIAL_PLATFORM env var. Supported:
//   github | x | instagram | linkedin | facebook
const PLATFORM = (process.env.SOCIAL_PLATFORM ??
  "github") as "github" | "x" | "instagram" | "linkedin" | "facebook";

// Base mainnet Reputation Manager (from user-app-client/.env.example).
const REPUTATION_MANAGER_ADDRESS =
  "0xCF613e08EE1B4c2669DdCf06A7d22c9856f6Aa1D" as `0x${string}`;
const RPC_URL = "https://mainnet.base.org";
// ────────────────────────────────────────────────────────────────────────

function step(n: number, title: string) {
  console.log(`\n── ${n}. ${title} ${"─".repeat(Math.max(0, 60 - title.length - 4))}`);
}
function kv(key: string, value: unknown) {
  console.log(`   ${key.padEnd(18)} ${String(value)}`);
}

async function main(): Promise<void> {
  const PRIVATE_KEY = process.env.P2P_RELAYER_PRIVATE_KEY;
  if (!PRIVATE_KEY || !PRIVATE_KEY.startsWith("0x") || PRIVATE_KEY.length !== 66) {
    console.error("Missing or malformed P2P_RELAYER_PRIVATE_KEY.");
    console.error("Run with:");
    console.error("  P2P_RELAYER_PRIVATE_KEY=0x... bun run scripts/verify-relayer-github.ts");
    process.exit(1);
  }

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

  step(1, "Configuration");
  kv("Chain", `${base.name} (${base.id})`);
  kv("Platform", PLATFORM);
  kv("Relayer address", account.address);
  kv("Reputation Mgr", REPUTATION_MANAGER_ADDRESS);

  // ── 2. Reclaim session ────────────────────────────────────────────────
  step(2, "Start Reclaim session");
  const proofResult = await createReclaimFlow({
    appId: RECLAIM_APP_ID,
    appSecret: RECLAIM_APP_SECRET,
    providerIds: DEFAULT_RECLAIM_PROVIDER_IDS,
    platform: PLATFORM,
    walletAddress: account.address,
    contextDescription: `cachin relayer ${account.address} — GitHub verification`,
    onStatus: (s) => {
      switch (s.type) {
        case "session_created":
          console.log(`\n   sessionId: ${s.sessionId}`);
          console.log("\n   ┌─────────────────────────────────────────────────────────");
          console.log("   │ Open this URL in your browser to verify with GitHub:");
          console.log(`   │ ${s.requestUrl}`);
          console.log("   └─────────────────────────────────────────────────────────");
          break;
        case "polling_started":
          console.log("\n   Polling Reclaim every 5s for the proof…");
          console.log("   (Ctrl-C to abort)");
          break;
        case "proof_received":
          console.log("\n   ✓ proof received from Reclaim");
          break;
        case "proof_transformed":
          console.log("   ✓ proof transformed for on-chain use");
          break;
      }
    },
  });

  if (proofResult.isErr()) {
    console.error(
      `\n✖ Reclaim flow failed (${proofResult.error.code}): ${proofResult.error.message}`,
    );
    process.exit(1);
  }
  const proof = proofResult.value;

  step(3, "Proof summary");
  kv("_socialName", proof._socialName);
  kv("sessionId", proof.sessionId);
  kv("proofs", proof.proofs.length);

  // ── 4. Encode socialVerify ────────────────────────────────────────────
  step(4, "Prepare socialVerify calldata");
  const zkkyc = createZkkyc({ reputationManagerAddress: REPUTATION_MANAGER_ADDRESS });
  const prepared = zkkyc.prepareSocialVerify({
    _socialName: proof._socialName,
    proofs: [...proof.proofs] as SocialVerifyParams["proofs"],
  });
  if (prepared.isErr()) {
    console.error(
      `   ✖ prepareSocialVerify failed (${prepared.error.code}): ${prepared.error.message}`,
    );
    process.exit(1);
  }
  kv("to", prepared.value.to);
  kv("calldata bytes", (prepared.value.data.length - 2) / 2);

  // ── 5. Submit on-chain ────────────────────────────────────────────────
  step(5, "Submit socialVerify on Base mainnet");
  const transport = http(RPC_URL);
  const publicClient = createPublicClient({ chain: base, transport });
  const walletClient = createWalletClient({ chain: base, transport, account });

  const hash = await walletClient.sendTransaction({
    account,
    chain: base,
    to: prepared.value.to,
    data: prepared.value.data,
    value: 0n,
  });
  kv("tx hash", hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  kv("status", receipt.status);
  kv("block", receipt.blockNumber.toString());
  kv("gas used", receipt.gasUsed.toString());

  if (receipt.status === "success") {
    console.log(
      "\n🎉 Relayer verified on-chain. Now try a new ARS PAY order from cachin — merchants should settle.",
    );
  } else {
    console.log("\n⚠️ Tx reverted. Inspect on BaseScan:");
    console.log(`   https://basescan.org/tx/${hash}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nUnexpected error:", err);
  process.exit(1);
});
