/**
 * Send USDC from the cachin relayer smart account on Base mainnet.
 *
 * Two-step safety:
 *   1. By default, runs a DRY-RUN — reads balances, simulates the transfer,
 *      prints the would-be receipt. No tx broadcast, no gas burned.
 *   2. Pass `CONFIRM=yes` to actually submit the transfer via thirdweb 4337
 *      (sponsored gas — the relayer EOA does NOT need ETH).
 *
 * Run:
 *   cd /Users/kevan/Development/cachin-latest
 *   export PATH="$HOME/.nvm/versions/node/v24.8.0/bin:$PATH"
 *
 *   # dry-run:
 *   TO=0x... AMOUNT=2 \
 *     P2P_RELAYER_PRIVATE_KEY=0x... \
 *     bun run scripts/send-usdc.ts
 *
 *   # actually send:
 *   CONFIRM=yes TO=0x... AMOUNT=2 \
 *     P2P_RELAYER_PRIVATE_KEY=0x... \
 *     bun run scripts/send-usdc.ts
 */

import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseAbi,
  formatUnits,
  parseUnits,
  isAddress,
  type Address,
} from "viem";
import { base } from "viem/chains";
import {
  createThirdwebClient,
  prepareTransaction,
  sendTransaction,
  waitForReceipt,
} from "thirdweb";
import { privateKeyToAccount as twPrivateKeyToAccount } from "thirdweb/wallets";
import { smartWallet } from "thirdweb/wallets/smart";
import { base as twBase } from "thirdweb/chains";

const THIRDWEB_CLIENT_ID = "f2f21a26b756b3c3b759f794f3c3fe18";
const AA_FACTORY = "0xde320c2e2b4953883f61774c006f9057a55b97d1" as Address;
// USDC on Base mainnet (native Circle USDC, not USDbC).
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const RPC_URL = "https://base-rpc.publicnode.com";

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

function bail(msg: string): never {
  console.error(`✖ ${msg}`);
  process.exit(1);
}
function header(t: string) {
  console.log(`\n── ${t} ${"─".repeat(Math.max(0, 60 - t.length - 4))}`);
}
function kv(k: string, v: unknown) {
  console.log(`   ${k.padEnd(22)} ${String(v)}`);
}

async function main() {
  const PK = process.env.P2P_RELAYER_PRIVATE_KEY;
  if (!PK || !PK.startsWith("0x") || PK.length !== 66)
    bail("Missing or malformed P2P_RELAYER_PRIVATE_KEY.");

  const TO_RAW = process.env.TO;
  const AMOUNT_RAW = process.env.AMOUNT;
  const CONFIRM = process.env.CONFIRM === "yes";

  if (!TO_RAW) bail("Missing TO. Pass `TO=0x...`.");
  if (!isAddress(TO_RAW))
    bail(`TO is not a valid address: ${TO_RAW}`);
  if (!AMOUNT_RAW)
    bail("Missing AMOUNT. Pass `AMOUNT=2` for 2 USDC (human-readable).");
  const TO = TO_RAW as Address;
  const amountUnits = parseUnits(AMOUNT_RAW, 6);

  // ── Resolve smart account ───────────────────────────────────────────────
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

  header("Plan");
  kv("Mode", CONFIRM ? "LIVE (will broadcast)" : "DRY-RUN (no broadcast)");
  kv("Chain", `${base.name} (${base.id})`);
  kv("Token", `USDC @ ${USDC}`);
  kv("From (smart)", smartAccount.address);
  kv("EOA owner", twEoa.address);
  kv("To", TO);
  kv("Amount (human)", `${AMOUNT_RAW} USDC`);
  kv("Amount (units)", amountUnits.toString());

  const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC_URL),
  });

  // ── Pre-flight: balances ────────────────────────────────────────────────
  header("Pre-flight balances");
  const fromBalBefore = (await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [smartAccount.address as Address],
  })) as bigint;
  const toBalBefore = (await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [TO],
  })) as bigint;
  kv("smart USDC balance", `${formatUnits(fromBalBefore, 6)} (${fromBalBefore})`);
  kv("to    USDC balance", `${formatUnits(toBalBefore, 6)} (${toBalBefore})`);

  if (fromBalBefore < amountUnits)
    bail(
      `Insufficient USDC. Smart account has ${formatUnits(
        fromBalBefore,
        6,
      )} but trying to send ${AMOUNT_RAW}.`,
    );

  // ── Simulate ────────────────────────────────────────────────────────────
  header("Simulation");
  try {
    const { result } = await publicClient.simulateContract({
      account: smartAccount.address as Address,
      address: USDC,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [TO, amountUnits],
    });
    kv("simulated return", String(result));
    console.log("   ✓ simulation succeeded — transfer would be allowed.");
  } catch (err: any) {
    console.log("   ✗ simulation FAILED — refusing to broadcast.");
    console.log("   ", err?.shortMessage ?? err?.message ?? err);
    process.exit(1);
  }

  if (!CONFIRM) {
    header("Dry-run complete");
    console.log(
      "   Re-run with CONFIRM=yes prefixed to actually broadcast the transfer.",
    );
    return;
  }

  // ── Broadcast ───────────────────────────────────────────────────────────
  header("Broadcast via smart account (sponsored gas)");
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [TO, amountUnits],
  });
  const tx = prepareTransaction({
    client: tw,
    chain: twBase,
    to: USDC,
    data,
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
  kv("gas used", receipt.gasUsed.toString());

  if (receipt.status !== "success") {
    console.log("\n⚠️ Tx reverted. Inspect on BaseScan.");
    process.exit(1);
  }

  // ── Post-flight balances ────────────────────────────────────────────────
  header("Post-flight balances");
  const fromBalAfter = (await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [smartAccount.address as Address],
  })) as bigint;
  const toBalAfter = (await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [TO],
  })) as bigint;
  kv("smart USDC balance", `${formatUnits(fromBalAfter, 6)} (Δ ${formatUnits(fromBalAfter - fromBalBefore, 6)})`);
  kv("to    USDC balance", `${formatUnits(toBalAfter, 6)} (Δ ${formatUnits(toBalAfter - toBalBefore, 6)})`);

  console.log(`\n🎉 Sent ${AMOUNT_RAW} USDC to ${TO}.`);
}

main().catch((err) => {
  console.error("\nUnexpected error:", err);
  process.exit(1);
});
