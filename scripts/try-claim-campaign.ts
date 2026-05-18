/**
 * Diagnose campaign-claim state for our smart account, then (if eligible) call
 * `claimCampaignUsdc()` to pull the pending reward.
 *
 * Background
 * ──────────
 * The Reputation Manager has a campaign-bootstrap system. There are two
 * write functions:
 *
 *   1. `claimReward(campaignId, usernameHash)` — JOINS a campaign and credits
 *      the caller with the campaign's `rpReward` + `usdcReward`. Requires
 *      knowing a live campaign id + manager-username-hash, which p2p.me
 *      distributes as a URL: `https://p2p.me/?manager=<name>&id=<n>`. The
 *      usernameHash = `stringToHex(manager, { size: 32 })`.
 *
 *   2. `claimCampaignUsdc()` — parameterless. Withdraws whatever USDC has
 *      already been allocated to `msg.sender` via prior `claimReward` calls.
 *      Reverts if `userCampaignReward[msg.sender] == 0`.
 *
 * So before sending a tx, we read `userCampaignReward(smartAccount)`:
 *   - > 0   → safe to call `claimCampaignUsdc()`, will succeed.
 *   - == 0  → no pending reward. We'd revert. Need a campaign URL first.
 *
 * We also list recent `CampaignCreated` / `ManagerAddedOrUpdated` /
 * `RewardClaimed` events so we can see which campaigns are live and which
 * accounts have been claiming — useful for hypothesis-building when p2p.me
 * is unresponsive.
 *
 * Run:
 *   export PATH="$HOME/.nvm/versions/node/v24.8.0/bin:$PATH"
 *   P2P_RELAYER_PRIVATE_KEY=0x... bun run scripts/try-claim-campaign.ts
 *
 * Optional env:
 *   CLAIM_BLOCK_LOOKBACK=10000        # how far back to scan for events
 *   CAMPAIGN_ID=...                   # if set, also calls claimReward()
 *   CAMPAIGN_MANAGER=...              # required with CAMPAIGN_ID
 */

import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseAbi,
  parseAbiItem,
  formatUnits,
  stringToHex,
  type Address,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  createThirdwebClient,
  prepareTransaction,
  sendTransaction,
} from "thirdweb";
import { privateKeyToAccount as twPrivateKeyToAccount } from "thirdweb/wallets";
import { smartWallet } from "thirdweb/wallets/smart";
import { base as twBase } from "thirdweb/chains";

const THIRDWEB_CLIENT_ID = "f2f21a26b756b3c3b759f794f3c3fe18";
const AA_FACTORY = "0xde320c2e2b4953883f61774c006f9057a55b97d1" as Address;
const REPUTATION_MANAGER =
  "0xCF613e08EE1B4c2669DdCf06A7d22c9856f6Aa1D" as Address;
const RPC_URL = "https://base-rpc.publicnode.com";

// ABI fragments we need. Function signatures cross-checked against the
// reputation-manager ABI shipped in user-app-client v2025.5 (PR #43).
const READ_ABI = parseAbi([
  "function userCampaignReward(address user) view returns (uint256)",
  "function userClaimedCampaign(address user) view returns (uint256)",
  "function rmusers(address user) view returns (uint256 reputationPoints, uint256 voteCount, bool isBlacklisted)",
  "function nextCampaignId() view returns (uint256)",
  "function campaignManagers(uint256 campaignId, address manager) view returns (uint256 rpReward, uint256 usdcReward, bool active, bool requiresZk, uint256 claimLimit)",
]);

const EV_CAMPAIGN_CREATED = parseAbiItem(
  "event CampaignCreated(uint256 indexed campaignId)",
);
const EV_MANAGER_UPSERT = parseAbiItem(
  "event ManagerAddedOrUpdated(uint256 indexed campaignId, address indexed manager, uint256 rpReward, uint256 usdcReward, bool active, bytes32 usernameHash, bool requiresZk, uint256 claimLimit)",
);
const EV_REWARD_CLAIMED = parseAbiItem(
  "event RewardClaimed(uint256 indexed campaignId, address indexed user, address indexed manager, uint256 rp, uint256 usdc, bytes32 usernameHash)",
);
const EV_CAMPAIGN_TOGGLED = parseAbiItem(
  "event CampaignToggled(uint256 campaignId, bool isActive)",
);

const CLAIM_USDC_ABI = parseAbi(["function claimCampaignUsdc()"]);
const CLAIM_REWARD_ABI = parseAbi([
  "function claimReward(uint256 campaignId, bytes32 usernameHash)",
]);

// Reputation-manager custom errors (selector → label). Sourced from
// user-app-client/src/lib/errors.ts (`hexContractErrors` table) so we can
// translate raw selectors like 0x3fb087f4 into something human-readable.
const RM_ERRORS: Record<string, string> = {
  "0x3fb087f4": "NoRewards (userCampaignReward == 0 — must join a campaign first)",
  "0x7a551e38": "CampaignNotActive (campaign is toggled off)",
  "0x668ca75d": "InvalidManagerDetails (manager+id pair doesn't exist)",
  "0x22a5e34b": "ManagerNotFound",
  "0xa1610e37": "ManagerInactive",
  "0x626b7c00": "RewardAlreadyClaimed (this address already claimed this campaign)",
  "0x902ade67": "OnlyNewUsersAllowed (account has existing rep / orders)",
  "0x65f577de": "ZkVerificationRequired (need zkPassport / aadhaar / social proof first)",
  "0x6500fe81": "MonthlyClaimLimitReached",
  "0x3eedee0f": "InvalidCampaignId",
  "0x412dd2b1": "InsufficientRP",
  "0x2f950361": "UnclaimedRewardsExist (must run claimCampaignUsdc() first)",
  "0x584a7938": "NotWhitelisted",
  "0xc23cefef": "UserIsBlacklisted",
  "0x73380d99": "NoRewardsToClaim",
};

function decodeRmError(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/0x[a-fA-F0-9]{8}/);
  if (!match) return null;
  return RM_ERRORS[match[0].toLowerCase()] ?? null;
}

function explainTxError(err: any): string {
  const parts = [err?.shortMessage ?? err?.message ?? String(err)];
  if (err?.cause)
    parts.push(`cause: ${err.cause?.shortMessage ?? err.cause?.message ?? err.cause}`);
  const decoded =
    decodeRmError(err?.message) ||
    decodeRmError(err?.shortMessage) ||
    decodeRmError(err?.cause?.message) ||
    decodeRmError(err?.cause?.shortMessage) ||
    decodeRmError(err?.data);
  if (decoded) parts.push(`→ ${decoded}`);
  return parts.join("\n   ");
}

function header(t: string) {
  console.log(`\n── ${t} ${"─".repeat(Math.max(0, 60 - t.length - 4))}`);
}
function kv(k: string, v: unknown) {
  console.log(`   ${k.padEnd(22)} ${String(v)}`);
}

async function main() {
  const PK = process.env.P2P_RELAYER_PRIVATE_KEY;
  if (!PK || !PK.startsWith("0x") || PK.length !== 66) {
    console.error("Missing or malformed P2P_RELAYER_PRIVATE_KEY");
    process.exit(1);
  }

  const LOOKBACK = BigInt(process.env.CLAIM_BLOCK_LOOKBACK ?? "10000");
  const CAMPAIGN_ID_ENV = process.env.CAMPAIGN_ID;
  const CAMPAIGN_MANAGER_ENV = process.env.CAMPAIGN_MANAGER;

  // ── Resolve EOA + smart account ─────────────────────────────────────────
  const eoa = privateKeyToAccount(PK as `0x${string}`);
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

  header("Identities");
  kv("EOA", eoa.address);
  kv("Smart account", smartAccount.address);
  kv("Reputation Manager", REPUTATION_MANAGER);
  kv("RPC", RPC_URL);

  const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC_URL),
  });

  // ── Read on-chain state ─────────────────────────────────────────────────
  header("On-chain state");
  const head = await publicClient.getBlockNumber();
  kv("head block", head.toString());

  try {
    const next = await publicClient.readContract({
      address: REPUTATION_MANAGER,
      abi: READ_ABI,
      functionName: "nextCampaignId",
    });
    kv("nextCampaignId", `${next.toString()} (so ${next - 1n} is the latest id)`);
  } catch (e: any) {
    kv("nextCampaignId", `(read failed: ${e?.shortMessage ?? e?.message})`);
  }

  const accounts: [string, Address][] = [
    ["EOA", eoa.address as Address],
    ["smart", smartAccount.address as Address],
  ];
  for (const [label, addr] of accounts) {
    try {
      const [rp, voteCount, isBlacklisted] = (await publicClient.readContract({
        address: REPUTATION_MANAGER,
        abi: READ_ABI,
        functionName: "rmusers",
        args: [addr],
      })) as readonly [bigint, bigint, boolean];
      kv(
        `${label} user`,
        `rp=${rp} voteCount=${voteCount} blacklisted=${isBlacklisted}`,
      );
    } catch (e: any) {
      kv(`${label} user`, `(read failed: ${e?.shortMessage ?? e?.message})`);
    }
    try {
      const r = await publicClient.readContract({
        address: REPUTATION_MANAGER,
        abi: READ_ABI,
        functionName: "userCampaignReward",
        args: [addr],
      });
      kv(`${label} campaignReward`, `${r.toString()} (${formatUnits(r, 6)} USDC)`);
    } catch (e: any) {
      kv(
        `${label} campaignReward`,
        `(read failed: ${e?.shortMessage ?? e?.message})`,
      );
    }
    try {
      const c = await publicClient.readContract({
        address: REPUTATION_MANAGER,
        abi: READ_ABI,
        functionName: "userClaimedCampaign",
        args: [addr],
      });
      kv(`${label} userClaimedCampaign`, c.toString());
    } catch (e: any) {
      kv(
        `${label} userClaimedCampaign`,
        `(read failed: ${e?.shortMessage ?? e?.message})`,
      );
    }
  }

  // ── Discover campaigns ──────────────────────────────────────────────────
  const fromBlock = head - LOOKBACK;
  header(`Campaign discovery (last ${LOOKBACK.toString()} blocks)`);
  kv("from block", fromBlock.toString());
  kv("to block", head.toString());

  try {
    const created = await publicClient.getLogs({
      address: REPUTATION_MANAGER,
      event: EV_CAMPAIGN_CREATED,
      fromBlock,
      toBlock: head,
    });
    kv("CampaignCreated", `${created.length} event(s)`);
    created.slice(-10).forEach((l) => {
      console.log(
        `      • campaignId=${l.args.campaignId} block=${l.blockNumber} tx=${l.transactionHash}`,
      );
    });
  } catch (e: any) {
    kv(
      "CampaignCreated",
      `(getLogs failed: ${e?.shortMessage ?? e?.message})`,
    );
  }

  try {
    const upserts = await publicClient.getLogs({
      address: REPUTATION_MANAGER,
      event: EV_MANAGER_UPSERT,
      fromBlock,
      toBlock: head,
    });
    kv("ManagerAddedOrUpdated", `${upserts.length} event(s)`);
    upserts.slice(-10).forEach((l) => {
      const a = l.args as any;
      console.log(
        `      • campaignId=${a.campaignId} active=${a.active} rp=${a.rpReward} usdc=${formatUnits(a.usdcReward, 6)} usernameHash=${a.usernameHash} requiresZk=${a.requiresZk} claimLimit=${a.claimLimit} manager=${a.manager}`,
      );
    });
  } catch (e: any) {
    kv(
      "ManagerAddedOrUpdated",
      `(getLogs failed: ${e?.shortMessage ?? e?.message})`,
    );
  }

  try {
    const toggled = await publicClient.getLogs({
      address: REPUTATION_MANAGER,
      event: EV_CAMPAIGN_TOGGLED,
      fromBlock,
      toBlock: head,
    });
    kv("CampaignToggled", `${toggled.length} event(s)`);
    toggled.slice(-5).forEach((l) => {
      const a = l.args as any;
      console.log(
        `      • campaignId=${a.campaignId} → isActive=${a.isActive} (block ${l.blockNumber})`,
      );
    });
  } catch (e: any) {
    kv(
      "CampaignToggled",
      `(getLogs failed: ${e?.shortMessage ?? e?.message})`,
    );
  }

  try {
    const claims = await publicClient.getLogs({
      address: REPUTATION_MANAGER,
      event: EV_REWARD_CLAIMED,
      fromBlock,
      toBlock: head,
    });
    kv("RewardClaimed", `${claims.length} event(s)`);
    claims.slice(-10).forEach((l) => {
      const a = l.args as any;
      console.log(
        `      • campaignId=${a.campaignId} user=${a.user} manager=${a.manager} rp=${a.rp} usdc=${formatUnits(a.usdc, 6)} tx=${l.transactionHash}`,
      );
    });
  } catch (e: any) {
    kv("RewardClaimed", `(getLogs failed: ${e?.shortMessage ?? e?.message})`);
  }

  // ── Optional: join campaign via env ─────────────────────────────────────
  if (CAMPAIGN_ID_ENV && CAMPAIGN_MANAGER_ENV) {
    header(
      `Joining campaign id=${CAMPAIGN_ID_ENV} manager="${CAMPAIGN_MANAGER_ENV}"`,
    );
    const usernameHash = stringToHex(CAMPAIGN_MANAGER_ENV, { size: 32 });
    kv("usernameHash", usernameHash);
    const data = encodeFunctionData({
      abi: CLAIM_REWARD_ABI,
      functionName: "claimReward",
      args: [BigInt(CAMPAIGN_ID_ENV), usernameHash as `0x${string}`],
    });
    const tx = prepareTransaction({
      client: tw,
      chain: twBase,
      to: REPUTATION_MANAGER,
      data,
      value: 0n,
    });
    try {
      const sent = await sendTransaction({
        account: smartAccount,
        transaction: tx,
      });
      console.log(`   ✓ tx submitted: ${sent.transactionHash}`);
      console.log(`   https://basescan.org/tx/${sent.transactionHash}`);
    } catch (err: any) {
      console.log("   ✗ tx failed.");
      console.log("   ", explainTxError(err));
    }
    return; // don't also try claimCampaignUsdc in same run.
  }

  // ── Decide whether to call claimCampaignUsdc() ──────────────────────────
  header("Decision");
  const reward = await publicClient.readContract({
    address: REPUTATION_MANAGER,
    abi: READ_ABI,
    functionName: "userCampaignReward",
    args: [smartAccount.address as Address],
  });
  kv("smart.campaignReward", `${reward.toString()} (${formatUnits(reward, 6)} USDC)`);

  if (reward === 0n) {
    console.log(`
   Nothing to claim. claimCampaignUsdc() would revert.

   To bootstrap a reward, we need a campaign id + manager username from
   p2p.me. Look at the "ManagerAddedOrUpdated" list above — any with
   active=true and requiresZk=false is a candidate. Try:

     CAMPAIGN_ID=<id> CAMPAIGN_MANAGER=<name> \\
       P2P_RELAYER_PRIVATE_KEY=0x... \\
       bun run scripts/try-claim-campaign.ts

   The username string is whatever was stored in usernameHash above —
   stringToHex(name, { size: 32 }). For known campaigns you'll have to
   reverse-engineer the manager name from the hash or ask p2p.me.
`);
    return;
  }

  header("Calling claimCampaignUsdc() from smart account");
  const data = encodeFunctionData({
    abi: CLAIM_USDC_ABI,
    functionName: "claimCampaignUsdc",
    args: [],
  });
  const tx = prepareTransaction({
    client: tw,
    chain: twBase,
    to: REPUTATION_MANAGER,
    data,
    value: 0n,
  });
  try {
    const sent = await sendTransaction({
      account: smartAccount,
      transaction: tx,
    });
    console.log(`✓ tx submitted: ${sent.transactionHash}`);
    console.log(`  https://basescan.org/tx/${sent.transactionHash}`);
  } catch (err: any) {
    console.log("✗ tx failed.");
    console.log("   ", explainTxError(err));
  }
}

main().catch((err) => {
  console.error("\nUnexpected:", err);
  process.exit(1);
});
