/**
 * Verify a social account (GitHub / X / LinkedIn / Instagram / Facebook) on
 * our SMART ACCOUNT, not the EOA.
 *
 * Why this exists
 * ───────────────
 * `verify-relayer-github.ts` submits the `socialVerify` tx with the EOA as
 * msg.sender, so the contract records the verification against the EOA
 * address. But cachin places orders FROM the smart account derived from
 * that EOA (factory 0xde320c…). Merchants inspecting the order's placer
 * see no social verification on the smart account → low reputation →
 * cancelled orders or stuck-at-"paid" settlements.
 *
 * This script pins the Reclaim flow to the smart account address and
 * submits the on-chain socialVerify via thirdweb's 4337 sendTransaction so
 * `msg.sender` in the contract is the smart account. The verification
 * lands on the address that actually places orders.
 *
 * Run:
 *   cd /Users/kevan/Development/cachin-latest
 *   export PATH="$HOME/.nvm/versions/node/v24.8.0/bin:$PATH"
 *   P2P_RELAYER_PRIVATE_KEY=0x... \
 *     SOCIAL_PLATFORM=github \
 *     bun run scripts/verify-relayer-smart-account.ts
 *
 * Supported platforms: github | x | instagram | linkedin | facebook
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
  createReclaimFlow,
  createZkkyc,
  DEFAULT_RECLAIM_PROVIDER_IDS,
  type SocialVerifyParams,
} from "@p2pdotme/sdk/zkkyc";

// ── CONFIG ──────────────────────────────────────────────────────────────
const RECLAIM_APP_ID = "0x6919872d9b927B184fBE6ae5257EAD85E88A833E";
const RECLAIM_APP_SECRET =
  "0x92e0370beb4533502fa3ecc3a81c9026626ae99d1995843e78f52e04f06146f2";

const THIRDWEB_CLIENT_ID = "f2f21a26b756b3c3b759f794f3c3fe18";
const AA_FACTORY = "0xde320c2e2b4953883f61774c006f9057a55b97d1" as `0x${string}`;
const REPUTATION_MANAGER =
  "0xCF613e08EE1B4c2669DdCf06A7d22c9856f6Aa1D" as `0x${string}`;

const PLATFORM = (process.env.SOCIAL_PLATFORM ?? "github") as
  | "github"
  | "x"
  | "instagram"
  | "linkedin"
  | "facebook";
// ────────────────────────────────────────────────────────────────────────

function step(n: number, title: string) {
  console.log(
    `\n── ${n}. ${title} ${"─".repeat(Math.max(0, 60 - title.length - 4))}`,
  );
}
function kv(k: string, v: unknown) {
  console.log(`   ${k.padEnd(20)} ${String(v)}`);
}

async function main() {
  const PK = process.env.P2P_RELAYER_PRIVATE_KEY;
  if (!PK || !PK.startsWith("0x") || PK.length !== 66) {
    console.error("Missing or malformed P2P_RELAYER_PRIVATE_KEY.");
    process.exit(1);
  }

  // ── Resolve smart account from EOA ──────────────────────────────────────
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

  step(1, "Configuration");
  kv("Chain", `${twBase.name} (${twBase.id})`);
  kv("Platform", PLATFORM);
  kv("EOA", twEoa.address);
  kv("Smart account", smartAccount.address);
  kv("Reputation Mgr", REPUTATION_MANAGER);
  console.log(
    "\n   Reclaim proof and on-chain socialVerify will be bound to the SMART ACCOUNT.",
  );

  // ── Reclaim session pinned to SMART ACCOUNT ─────────────────────────────
  step(2, "Start Reclaim session (smart account)");
  const proofResult = await createReclaimFlow({
    appId: RECLAIM_APP_ID,
    appSecret: RECLAIM_APP_SECRET,
    providerIds: DEFAULT_RECLAIM_PROVIDER_IDS,
    platform: PLATFORM,
    walletAddress: smartAccount.address as `0x${string}`,
    contextDescription: `cachin smart account ${smartAccount.address} — ${PLATFORM} verification`,
    onStatus: (s) => {
      switch (s.type) {
        case "session_created":
          console.log(`\n   sessionId: ${s.sessionId}`);
          console.log(
            "\n   ┌────────────────────────────────────────────────────────",
          );
          console.log(
            `   │ Open this URL (Reclaim Android app is the most reliable):`,
          );
          console.log(`   │ ${s.requestUrl}`);
          console.log(
            "   └────────────────────────────────────────────────────────",
          );
          break;
        case "polling_started":
          console.log("\n   Polling Reclaim every 5s for the proof…");
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

  // ── Encode socialVerify calldata ────────────────────────────────────────
  step(4, "Prepare socialVerify calldata");
  const zkkyc = createZkkyc({ reputationManagerAddress: REPUTATION_MANAGER });
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

  // ── Submit via smart account (4337, sponsored gas) ──────────────────────
  step(5, "Submit socialVerify via SMART ACCOUNT (sponsored gas)");
  const tx = prepareTransaction({
    client: tw,
    chain: twBase,
    to: prepared.value.to,
    data: prepared.value.data,
    value: 0n,
  });

  try {
    const sent = await sendTransaction({
      account: smartAccount,
      transaction: tx,
    });
    kv("userOp / tx hash", sent.transactionHash);
    console.log(`   https://basescan.org/tx/${sent.transactionHash}`);

    console.log("\n   Waiting for receipt…");
    const receipt = await waitForReceipt({
      client: tw,
      chain: twBase,
      transactionHash: sent.transactionHash,
    });
    kv("status", receipt.status);
    kv("block", receipt.blockNumber.toString());
    kv("gas used", receipt.gasUsed.toString());

    if (receipt.status === "success") {
      console.log(
        `\n🎉 ${PLATFORM} verified on the SMART ACCOUNT (${smartAccount.address}).`,
      );
      console.log(
        "   Run scripts/try-claim-campaign.ts again — `smart user rp` should now be > 0.",
      );
      console.log(
        "   Then place a new ARS PAY order from cachin and watch order-tracking.",
      );
    } else {
      console.log("\n⚠️ Tx reverted. Inspect on BaseScan.");
      process.exit(1);
    }
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
}

main().catch((err) => {
  console.error("\nUnexpected error:", err);
  process.exit(1);
});
