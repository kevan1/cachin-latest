/**
 * Send USDC directly from an EOA (not its smart account) on Base.
 *
 * Companion to send-usdc.ts which sends from the SMART ACCOUNT (4337,
 * sponsored gas). This one signs the ERC20.transfer with the EOA itself
 * and pays gas in the EOA's ETH.
 *
 * Same two-step safety: dry-run by default, CONFIRM=yes to broadcast.
 *
 * Run:
 *   cd /Users/kevan/Development/cachin-latest
 *   export PATH="$HOME/.nvm/versions/node/v24.8.0/bin:$PATH"
 *
 *   TO=0x... AMOUNT=3.918 \
 *     P2P_RELAYER_PRIVATE_KEY=0x... \
 *     bun run scripts/send-usdc-from-eoa.ts
 *
 *   CONFIRM=yes TO=0x... AMOUNT=3.918 \
 *     P2P_RELAYER_PRIVATE_KEY=0x... \
 *     bun run scripts/send-usdc-from-eoa.ts
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  parseAbi,
  formatUnits,
  formatEther,
  parseUnits,
  isAddress,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const RPC_URL = "https://base-rpc.publicnode.com";

const ERC20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
]);

const kv = (k: string, v: unknown) =>
  console.log(`   ${k.padEnd(22)} ${String(v)}`);
const hdr = (t: string) =>
  console.log(`\n── ${t} ${"─".repeat(Math.max(0, 60 - t.length - 4))}`);

async function main() {
  const PK = process.env.P2P_RELAYER_PRIVATE_KEY;
  if (!PK || !PK.startsWith("0x") || PK.length !== 66) {
    console.error("Missing or malformed P2P_RELAYER_PRIVATE_KEY.");
    process.exit(1);
  }
  const TO_RAW = process.env.TO;
  const AMOUNT_RAW = process.env.AMOUNT;
  const CONFIRM = process.env.CONFIRM === "yes";
  if (!TO_RAW || !isAddress(TO_RAW)) {
    console.error(`Missing/invalid TO: ${TO_RAW}`);
    process.exit(1);
  }
  if (!AMOUNT_RAW) {
    console.error("Missing AMOUNT (human-readable USDC, e.g. 3.918).");
    process.exit(1);
  }
  const TO = TO_RAW as Address;
  const amountUnits = parseUnits(AMOUNT_RAW, 6);

  const account = privateKeyToAccount(PK as `0x${string}`);
  const transport = http(RPC_URL);
  const pub = createPublicClient({ chain: base, transport });
  const wc = createWalletClient({ chain: base, transport, account });

  hdr("Plan");
  kv("Mode", CONFIRM ? "LIVE (will broadcast)" : "DRY-RUN");
  kv("Chain", `${base.name} (${base.id})`);
  kv("Token", `USDC ${USDC}`);
  kv("From (EOA)", account.address);
  kv("To", TO);
  kv("Amount", `${AMOUNT_RAW} USDC (${amountUnits})`);

  hdr("Pre-flight");
  const ethBal = await pub.getBalance({ address: account.address });
  const usdcBal = (await pub.readContract({
    address: USDC,
    abi: ERC20,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;
  const toBal = (await pub.readContract({
    address: USDC,
    abi: ERC20,
    functionName: "balanceOf",
    args: [TO],
  })) as bigint;
  kv("EOA ETH balance", `${formatEther(ethBal)} ETH`);
  kv("EOA USDC balance", `${formatUnits(usdcBal, 6)} USDC`);
  kv("TO  USDC balance", `${formatUnits(toBal, 6)} USDC`);

  if (usdcBal < amountUnits) {
    console.error(
      `Insufficient USDC: have ${formatUnits(usdcBal, 6)}, want ${AMOUNT_RAW}.`,
    );
    process.exit(1);
  }
  if (ethBal < 10n ** 13n) {
    console.error(
      `Very low ETH for gas (${formatEther(ethBal)} ETH). Top up before transferring.`,
    );
    process.exit(1);
  }

  hdr("Simulation");
  try {
    const { request } = await pub.simulateContract({
      account,
      address: USDC,
      abi: ERC20,
      functionName: "transfer",
      args: [TO, amountUnits],
    });
    console.log("   ✓ simulation OK");
    if (!CONFIRM) {
      hdr("Dry-run complete");
      console.log("   Re-run with CONFIRM=yes to actually broadcast.");
      return;
    }

    hdr("Broadcast");
    const hash = await wc.writeContract(request);
    kv("tx hash", hash);
    console.log(`   https://basescan.org/tx/${hash}`);

    console.log("\n   Waiting for receipt…");
    const receipt = await pub.waitForTransactionReceipt({ hash });
    kv("status", receipt.status);
    kv("block", receipt.blockNumber.toString());
    kv("gas used", receipt.gasUsed.toString());

    if (receipt.status !== "success") {
      console.error("\n⚠️ Tx reverted.");
      process.exit(1);
    }

    hdr("Post-flight");
    const eoaAfter = (await pub.readContract({
      address: USDC,
      abi: ERC20,
      functionName: "balanceOf",
      args: [account.address],
    })) as bigint;
    const toAfter = (await pub.readContract({
      address: USDC,
      abi: ERC20,
      functionName: "balanceOf",
      args: [TO],
    })) as bigint;
    kv("EOA USDC", `${formatUnits(eoaAfter, 6)} (Δ ${formatUnits(eoaAfter - usdcBal, 6)})`);
    kv("TO  USDC", `${formatUnits(toAfter, 6)} (Δ ${formatUnits(toAfter - toBal, 6)})`);
    console.log(`\n🎉 Sent ${AMOUNT_RAW} USDC.`);
  } catch (err: any) {
    console.error("✗ Failed:", err?.shortMessage ?? err?.message ?? err);
    if (err?.cause)
      console.error(
        "cause:",
        err.cause?.shortMessage ?? err.cause?.message ?? err.cause,
      );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\nUnexpected:", e);
  process.exit(1);
});
