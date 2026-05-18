import crypto from "crypto";
import { Connection } from "@solana/web3.js";
import { validateArgentinePaymentId } from "@p2pdotme/sdk/country";
import { createOrders, type Order } from "@p2pdotme/sdk/orders";
import { createPrices } from "@p2pdotme/sdk/prices";
import { createProfile } from "@p2pdotme/sdk/profile";
import {
  createPublicClient,
  formatUnits,
  http,
  isAddress,
  parseAbiItem,
  parseEventLogs,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import {
  createThirdwebClient,
  prepareTransaction as twPrepareTransaction,
  sendTransaction as twSendTransaction,
  waitForReceipt as twWaitForReceipt,
} from "thirdweb";
import { privateKeyToAccount as twPrivateKeyToAccount } from "thirdweb/wallets";
import { smartWallet } from "thirdweb/wallets/smart";
import {
  base as twBaseChain,
  baseSepolia as twBaseSepoliaChain,
} from "thirdweb/chains";

// Thirdweb client ID for routing 4337 userOps. Public — not a secret.
const THIRDWEB_CLIENT_ID = "f2f21a26b756b3c3b759f794f3c3fe18";
// p2p.me canonical Account Abstraction factory on Base mainnet — same one
// user-app-client uses. Smart accounts derived from this factory are the
// only buyers merchants actually fulfill PAY-ARS orders for (verified by
// inspecting 20 recent completed orders, 100% smart-account-placed).
const AA_FACTORY =
  "0xde320c2e2b4953883f61774c006f9057a55b97d1" as `0x${string}`;

const SIX_DECIMALS = 6;
const SCALE_6 = 1_000_000n;
const P2P_EVM_RPC_ENV_NAMES = [
  "P2P_EVM_RPC",
  "P2P_ENV_RPC",
  "EXPO_PUBLIC_P2P_EVM_RPC",
] as const;
const P2P_EVM_CHAIN_ENV_NAMES = [
  "P2P_EVM_CHAIN",
  "EXPO_PUBLIC_P2P_EVM_CHAIN",
] as const;
const P2P_EVM_CHAIN_ID_ENV_NAMES = [
  "P2P_EVM_CHAIN_ID",
  "EXPO_PUBLIC_P2P_EVM_CHAIN_ID",
] as const;
const P2P_DIAMOND_ADDRESS_ENV_NAMES = [
  "P2P_DIAMOND_ADDRESS",
  "EXPO_PUBLIC_P2P_DIAMOND_ADDRESS",
] as const;
const P2P_USDC_ADDRESS_ENV_NAMES = [
  "P2P_USDC_ADDRESS",
  "EXPO_PUBLIC_P2P_USDC_ADDRESS",
] as const;
const P2P_SUBGRAPH_URL_ENV_NAMES = [
  "P2P_SUBGRAPH_URL",
  "EXPO_PUBLIC_P2P_SUBGRAPH_URL",
] as const;
const P2P_RELAYER_PRIVATE_KEY_ENV_NAMES = ["P2P_RELAYER_PRIVATE_KEY"] as const;
const P2P_BRIDGE_SIM_FEE_BPS_ENV_NAMES = [
  "P2P_BRIDGE_SIM_FEE_BPS",
  "EXPO_PUBLIC_P2P_BRIDGE_SIM_FEE_BPS",
] as const;
const P2P_REQUIRED_ENV_NAMES = {
  P2P_EVM_RPC: [...P2P_EVM_RPC_ENV_NAMES],
  P2P_DIAMOND_ADDRESS: [...P2P_DIAMOND_ADDRESS_ENV_NAMES],
  P2P_USDC_ADDRESS: [...P2P_USDC_ADDRESS_ENV_NAMES],
  P2P_SUBGRAPH_URL: [...P2P_SUBGRAPH_URL_ENV_NAMES],
  P2P_RELAYER_PRIVATE_KEY: [...P2P_RELAYER_PRIVATE_KEY_ENV_NAMES],
};

type JsonRecord = Record<string, unknown>;
type EnvNameList = readonly string[];
type EnvIssue = {
  envName: string;
  issue: "missing" | "invalid";
  acceptedNames: string[];
  detail?: string;
};

export class P2PApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: JsonRecord;

  constructor(status: number, code: string, message: string, details?: JsonRecord) {
    super(message);
    this.name = "P2PApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function asRecord(input: unknown): JsonRecord {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new P2PApiError(400, "INVALID_BODY", "Request body must be a JSON object.");
  }
  return input as JsonRecord;
}

function ensureString(
  record: JsonRecord,
  key: string,
  opts?: { required?: boolean; trim?: boolean }
): string {
  const required = opts?.required ?? true;
  const trim = opts?.trim ?? true;
  const value = record[key];

  if (value === undefined || value === null) {
    if (!required) return "";
    throw new P2PApiError(400, "MISSING_FIELD", `Missing required field: ${key}`);
  }

  if (typeof value !== "string") {
    throw new P2PApiError(400, "INVALID_FIELD", `Field ${key} must be a string.`);
  }

  const normalized = trim ? value.trim() : value;
  if (required && normalized.length === 0) {
    throw new P2PApiError(400, "INVALID_FIELD", `Field ${key} cannot be empty.`);
  }

  return normalized;
}

function parseAmount6(value: string, fieldName: string): bigint {
  try {
    if (!/^\d+(\.\d+)?$/.test(value)) {
      throw new Error("not a decimal number");
    }
    const parsed = parseUnits(value, SIX_DECIMALS);
    if (parsed <= 0n) {
      throw new Error("must be greater than zero");
    }
    return parsed;
  } catch (error) {
    throw new P2PApiError(400, "INVALID_AMOUNT", `Invalid ${fieldName}: ${value}`, {
      field: fieldName,
      reason: error instanceof Error ? error.message : "unknown",
    });
  }
}

function parseOptionalAmount6(value: string, fieldName: string): bigint {
  try {
    if (!/^\d+(\.\d+)?$/.test(value)) {
      throw new Error("not a decimal number");
    }
    const parsed = parseUnits(value, SIX_DECIMALS);
    if (parsed < 0n) {
      throw new Error("must be positive");
    }
    return parsed;
  } catch (error) {
    throw new P2PApiError(400, "INVALID_AMOUNT", `Invalid ${fieldName}: ${value}`, {
      field: fieldName,
      reason: error instanceof Error ? error.message : "unknown",
    });
  }
}

function parseOrderId(value: unknown): bigint {
  if (typeof value === "bigint") return value;

  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) {
      throw new P2PApiError(400, "INVALID_ORDER_ID", "orderId must be a positive integer.");
    }
    return BigInt(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new P2PApiError(400, "INVALID_ORDER_ID", "orderId must be numeric.");
    }
    return BigInt(trimmed);
  }

  throw new P2PApiError(400, "INVALID_ORDER_ID", "Missing or invalid orderId.");
}

function getEnvValue(envNames: EnvNameList): string {
  for (const envName of envNames) {
    const value = (process.env[envName] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function addMissingEnvIssue(issues: EnvIssue[], envNames: EnvNameList) {
  issues.push({
    envName: envNames[0],
    issue: "missing",
    acceptedNames: [...envNames],
  });
}

function addInvalidEnvIssue(
  issues: EnvIssue[],
  envNames: EnvNameList,
  detail: string
) {
  issues.push({
    envName: envNames[0],
    issue: "invalid",
    acceptedNames: [...envNames],
    detail,
  });
}

function requireEnv(envNames: EnvNameList, issues: EnvIssue[]): string | null {
  const value = getEnvValue(envNames);
  if (!value) {
    addMissingEnvIssue(issues, envNames);
    return null;
  }
  return value;
}

function requireAddress(envNames: EnvNameList, issues: EnvIssue[]): Address | null {
  const value = requireEnv(envNames, issues);
  if (!value) return null;
  if (!isAddress(value)) {
    addInvalidEnvIssue(issues, envNames, "must be a valid EVM address");
    return null;
  }
  return value;
}

function normalizePrivateKey(
  raw: string,
  envNames: EnvNameList,
  issues: EnvIssue[]
): Hex | null {
  const trimmed = raw.trim();
  const withPrefix = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(withPrefix)) {
    addInvalidEnvIssue(
      issues,
      envNames,
      "must be a 32-byte hex private key"
    );
    return null;
  }
  return withPrefix as Hex;
}

function resolveEvmChain() {
  const raw = getEnvValue(P2P_EVM_CHAIN_ENV_NAMES).toLowerCase();
  if (raw === "base" || raw === "mainnet" || raw === "base-mainnet") {
    return base;
  }

  const chainId = getEnvValue(P2P_EVM_CHAIN_ID_ENV_NAMES);
  if (chainId === "8453") return base;

  return baseSepolia;
}

function getSolanaRpcUrl(): string {
  const rpcUrl =
    process.env.SOLANA_RPC ||
    process.env.EXPO_PUBLIC_SOLANA_RPC ||
    "https://api.devnet.solana.com";
  return rpcUrl.trim();
}

function getBridgeFeeBps(): number {
  const raw = getEnvValue(P2P_BRIDGE_SIM_FEE_BPS_ENV_NAMES) || "20";
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return 20;
  if (value < 0) return 0;
  if (value > 1000) return 1000;
  return value;
}

function divideRoundedUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new P2PApiError(500, "INVALID_PRICE", "Sell price must be greater than zero.");
  }
  return (numerator + denominator - 1n) / denominator;
}

function ensureSdkOk<T>(label: string, result: any): T {
  if (result && typeof result.isErr === "function" && result.isErr()) {
    const sdkError = result.error;
    const message =
      sdkError && typeof sdkError.message === "string"
        ? sdkError.message
        : "Unknown SDK error";
    const code =
      sdkError && typeof sdkError.code === "string"
        ? sdkError.code
        : "SDK_ERROR";
    throw new P2PApiError(502, code, `${label} failed: ${message}`);
  }

  if (result && typeof result.isOk === "function" && result.isOk()) {
    return result.value as T;
  }

  throw new P2PApiError(502, "SDK_ERROR", `${label} returned an unexpected result.`);
}

function isMerchantPublicKeyReady(pubkey: string): boolean {
  return /^[0-9a-fA-F]{128}$/.test(pubkey.trim());
}

function throwIfP2PEnvIssues(issues: EnvIssue[]): never {
  const missingEnv = issues
    .filter((issue) => issue.issue === "missing")
    .map((issue) => issue.envName);
  const invalidEnv = issues
    .filter((issue) => issue.issue === "invalid")
    .map((issue) => ({
      envName: issue.envName,
      detail: issue.detail ?? "invalid value",
    }));

  const problems: string[] = [];
  if (missingEnv.length > 0) {
    problems.push(`missing ${missingEnv.join(", ")}`);
  }
  if (invalidEnv.length > 0) {
    problems.push(
      `invalid ${invalidEnv
        .map((issue) => `${issue.envName} (${issue.detail})`)
        .join(", ")}`
    );
  }

  throw new P2PApiError(
    500,
    "P2P_ENV_MISCONFIGURED",
    `P2P backend env is misconfigured: ${problems.join("; ")}.`,
    {
      missingEnv,
      invalidEnv,
      acceptedEnvNames: P2P_REQUIRED_ENV_NAMES,
    }
  );
}

function hashSuffix(input: string, length: number): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, length);
}

function formatAmount6(value: bigint): string {
  return formatUnits(value, SIX_DECIMALS);
}

// Cache the smart account across Vercel function invocations within the
// same warm container. The 4337 handshake (factory CREATE2 + signer derive)
// is ~1-2 seconds — caching skips that on hot paths.
let cachedSmartAccount: Awaited<ReturnType<typeof connectSmartAccount>> | null = null;

async function connectSmartAccount(privateKey: `0x${string}`, chainId: number) {
  const tw = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
  const twEoa = twPrivateKeyToAccount({ client: tw, privateKey });
  const twChain = chainId === base.id ? twBaseChain : twBaseSepoliaChain;
  const wallet = smartWallet({
    chain: twChain,
    factoryAddress: AA_FACTORY,
    sponsorGas: true,
  });
  const account = await wallet.connect({ client: tw, personalAccount: twEoa });
  return { tw, twChain, smartAccount: account };
}

async function getP2PClients() {
  const issues: EnvIssue[] = [];
  const rpcUrl = requireEnv(P2P_EVM_RPC_ENV_NAMES, issues);
  const diamondAddress = requireAddress(P2P_DIAMOND_ADDRESS_ENV_NAMES, issues);
  const usdcAddress = requireAddress(P2P_USDC_ADDRESS_ENV_NAMES, issues);
  const subgraphUrl = requireEnv(P2P_SUBGRAPH_URL_ENV_NAMES, issues);
  const relayerPrivateKeyRaw = requireEnv(P2P_RELAYER_PRIVATE_KEY_ENV_NAMES, issues);
  const relayerPrivateKey = relayerPrivateKeyRaw
    ? normalizePrivateKey(
        relayerPrivateKeyRaw,
        P2P_RELAYER_PRIVATE_KEY_ENV_NAMES,
        issues
      )
    : null;

  if (issues.length > 0) {
    throwIfP2PEnvIssues(issues);
  }

  const chain = resolveEvmChain();
  const account = privateKeyToAccount(relayerPrivateKey!);
  const transport = http(rpcUrl!);

  // Vercel may install a nested viem copy under @p2pdotme/sdk, which makes
  // structurally compatible clients fail TypeScript checks across package boundaries.
  const publicClient = createPublicClient({ chain, transport }) as any;

  // Connect (or re-use cached) thirdweb smart account. Placing orders from
  // the smart account is REQUIRED — merchants reject orders placed by raw
  // EOAs (verified by querying 20 recent completed PAY-ARS orders, all
  // smart-account-placed with the same factory). Previously this backend
  // signed txs with the EOA directly via viem walletClient, which produced
  // orders that accept then auto-cancel with encMerchantUpi="" because the
  // merchant doesn't trust the placer.
  if (!cachedSmartAccount) {
    cachedSmartAccount = await connectSmartAccount(relayerPrivateKey!, chain.id);
  }
  const { tw, twChain, smartAccount } = cachedSmartAccount;

  const orders = createOrders({
    publicClient,
    diamondAddress: diamondAddress!,
    usdcAddress: usdcAddress!,
    subgraphUrl: subgraphUrl!,
  });

  const profile = createProfile({
    publicClient,
    diamondAddress: diamondAddress!,
    usdcAddress: usdcAddress!,
  });

  const prices = createPrices({
    publicClient,
    diamondAddress: diamondAddress!,
  });

  // Helper: take an SDK .prepare() result and submit it via the smart
  // account (sponsored gas). Returns the tx hash + the on-chain receipt
  // so callers can parse event logs (e.g. extract `orderId` from
  // OrderPlaced) without a subgraph round-trip.
  async function submitFromSmartAccount(prepared: {
    to: `0x${string}`;
    data: `0x${string}` | string;
  }): Promise<{ hash: Hex; receipt: any }> {
    const tx = twPrepareTransaction({
      client: tw,
      chain: twChain,
      to: prepared.to,
      data: prepared.data as `0x${string}`,
      value: 0n,
    });
    const sent = await twSendTransaction({ account: smartAccount, transaction: tx });
    const receipt = await twWaitForReceipt({
      client: tw,
      chain: twChain,
      transactionHash: sent.transactionHash,
    });
    return { hash: sent.transactionHash as Hex, receipt };
  }

  return {
    chain,
    account,
    smartAccount,
    orders,
    profile,
    prices,
    submitFromSmartAccount,
  };
}

function normalizeRequestedCurrency(value: string): "ARS" | "USD" | "USDC" {
  const normalized = value.trim().toUpperCase();
  if (normalized === "ARS" || normalized === "USD" || normalized === "USDC") {
    return normalized;
  }
  throw new P2PApiError(400, "INVALID_CURRENCY", `Unsupported currency: ${value}. Use ARS, USD, or USDC.`);
}

function serializeOrder(order: Order) {
  return {
    orderId: order.orderId.toString(),
    type: order.type,
    status: order.status,
    currency: order.currency,
    user: order.user,
    recipient: order.recipient,
    acceptedMerchant: order.acceptedMerchant,
    amounts: {
      usdc: formatAmount6(order.usdcAmount),
      fiat: formatAmount6(order.fiatAmount),
      actualUsdc: formatAmount6(order.actualUsdcAmount),
      actualFiat: formatAmount6(order.actualFiatAmount),
    },
    timestamps: {
      placedAt: order.placedAt.toString(),
      acceptedAt: order.acceptedAt.toString(),
      paidAt: order.paidAt.toString(),
      completedAt: order.completedAt.toString(),
    },
    circleId: order.circleId.toString(),
    pubkey: order.pubkey,
    canSetPaymentAddress: order.status === "accepted" && isMerchantPublicKeyReady(order.pubkey),
  };
}

async function runBridgeSimulation(params: {
  userId: string;
  solanaTxSignature: string;
  amountUsdc: bigint;
}) {
  const rpcUrl = getSolanaRpcUrl();
  const connection = new Connection(rpcUrl, "confirmed");

  const signature = params.solanaTxSignature.trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,88}$/.test(signature)) {
    throw new P2PApiError(400, "INVALID_SOLANA_SIGNATURE", "solanaTxSignature does not look like a valid Solana signature.");
  }

  const statusResponse = await connection.getSignatureStatuses([signature], {
    searchTransactionHistory: true,
  });
  const status = statusResponse.value[0];

  if (!status) {
    throw new P2PApiError(404, "SOLANA_TX_NOT_FOUND", "Solana transaction not found on the configured RPC.", {
      solanaTxSignature: signature,
      rpcUrl,
    });
  }

  if (status.err) {
    throw new P2PApiError(409, "SOLANA_TX_FAILED", "Solana transaction is not successful.", {
      solanaTxSignature: signature,
      rpcUrl,
      err: status.err as unknown as JsonRecord,
    });
  }

  const feeBps = getBridgeFeeBps();
  const bridgedAmountUsdc = (params.amountUsdc * BigInt(10_000 - feeBps)) / 10_000n;
  const bridgeId = `bridge_${hashSuffix(`${params.userId}:${signature}`, 24)}`;
  const simulatedTargetTxHash = `0x${hashSuffix(`simulated:${signature}`, 64)}`;

  return {
    bridgeId,
    mode: "simulated-devnet",
    status: "BRIDGED_OR_SIMULATED",
    sourceChain: "solana:devnet",
    targetChain: `eip155:${resolveEvmChain().id}`,
    sourceTxSignature: signature,
    sourceAmountUsdc: formatAmount6(params.amountUsdc),
    bridgedAmountUsdc: formatAmount6(bridgedAmountUsdc),
    bridgeFeeBps: feeBps,
    simulatedTargetTxHash,
    slot: status.slot,
    confirmationStatus: status.confirmationStatus ?? "processed",
    confirmations: status.confirmations,
  };
}

export async function handleBridgeSolana(body: unknown) {
  const payload = asRecord(body);
  const userId = ensureString(payload, "userId");
  const solanaTxSignature = ensureString(payload, "solanaTxSignature");
  const amountUsdcRaw = ensureString(payload, "amountUsdc");
  const amountUsdc = parseAmount6(amountUsdcRaw, "amountUsdc");

  const bridge = await runBridgeSimulation({
    userId,
    solanaTxSignature,
    amountUsdc,
  });

  return {
    ok: true,
    userId,
    bridge,
  };
}

export async function handleCreateP2PArsOrder(body: unknown) {
  const payload = asRecord(body);

  const userId = ensureString(payload, "userId");
  const requestedAmountRaw = ensureString(payload, "amount");
  const requestedCurrency = normalizeRequestedCurrency(ensureString(payload, "currency"));
  // paymentAddress is OPTIONAL — supports the split flow where the user scans
  // the vendor's QR AFTER the merchant accepts (matches p2p.me official UX,
  // avoids dynamic QR expiry races). If not provided here, the order is placed
  // and the mobile must call /api/p2p/order-set-payment-address once the user
  // scans the fresh QR.
  const paymentAddress = ensureString(payload, "paymentAddress", { required: false });
  const method = ensureString(payload, "method", { required: false }) || "bank";
  const solanaTxSignature = ensureString(payload, "solanaTxSignature", { required: false });
  const sourceAmountUsdcRaw = ensureString(payload, "sourceAmountUsdc", { required: false });
  const fiatAmountLimitRaw = ensureString(payload, "fiatAmountLimit", { required: false });

  if (paymentAddress) {
    // The SDK's validateArgentinePaymentId only accepts alias/CBU/CVU plaintext.
    // But the p2p.me protocol REQUIRES the full EMV QR string here — verified
    // by comparing on-chain order 539487 (worked end-to-end, completed in 50s
    // with full EMV QR) vs our older orders 539401/539417/539449 (cancelled,
    // used CVU/alias plaintext, merchant could never decrypt the encUpi and
    // never delivered fiat). user-app-client/src/pages/order/pay/accepted.tsx
    // also passes the raw qrString, not the parsed alias.
    const looksLikeEmvQr = /^0002\d{2}/.test(paymentAddress);
    if (!looksLikeEmvQr && !validateArgentinePaymentId(paymentAddress)) {
      throw new P2PApiError(
        400,
        "INVALID_PAYMENT_ADDRESS",
        "paymentAddress must be a valid EMV QR string (preferred) or Alias/CBU/CVU."
      );
    }
  }

  const { chain, account, smartAccount, orders, profile, prices, submitFromSmartAccount } =
    await getP2PClients();

  const priceConfig = ensureSdkOk<{ sellPrice: bigint }>(
    "prices.getPriceConfig",
    await prices.getPriceConfig({ currency: "ARS" })
  );

  const sellPrice = priceConfig.sellPrice;
  if (sellPrice <= 0n) {
    throw new P2PApiError(500, "INVALID_PRICE", "sellPrice for ARS must be greater than zero.");
  }

  const requestedAmount6 = parseAmount6(requestedAmountRaw, "amount");

  let fiatAmount: bigint;
  let usdcAmount: bigint;

  if (requestedCurrency === "ARS") {
    fiatAmount = requestedAmount6;
    usdcAmount = divideRoundedUp(fiatAmount * SCALE_6, sellPrice);
  } else {
    usdcAmount = requestedAmount6;
    fiatAmount = (usdcAmount * sellPrice) / SCALE_6;
  }

  const fiatAmountLimit = fiatAmountLimitRaw
    ? parseOptionalAmount6(fiatAmountLimitRaw, "fiatAmountLimit")
    : 0n;

  const bridge = solanaTxSignature
    ? await runBridgeSimulation({
        userId,
        solanaTxSignature,
        amountUsdc: sourceAmountUsdcRaw
          ? parseAmount6(sourceAmountUsdcRaw, "sourceAmountUsdc")
          : usdcAmount,
      })
    : {
        status: "SKIPPED",
        mode: "internal-balance",
        reason: "No solanaTxSignature was provided in this request.",
      };

  // Check allowance from the SMART ACCOUNT (which is what places orders),
  // not the EOA. Previously this checked the EOA's allowance — and even
  // when the EOA had MAX allowance, the smart account didn't, so every
  // placeOrder tried to pull USDC from an unapproved smart account.
  const allowance = ensureSdkOk<bigint>(
    "profile.getUsdcAllowance",
    await profile.getUsdcAllowance({ owner: smartAccount.address as Address })
  );

  let approvalTxHash: string | null = null;
  if (allowance < usdcAmount) {
    // Approve MAX_UINT256 once — matches user-app-client pattern, avoids
    // re-approving on every order.
    const MAX = 2n ** 256n - 1n;
    const approvalPrep = ensureSdkOk<{ to: Address; data: Hex | string }>(
      "orders.approveUsdc.prepare",
      await orders.approveUsdc.prepare({ amount: MAX })
    );
    const { hash } = await submitFromSmartAccount(approvalPrep);
    approvalTxHash = hash;
  }

  const placePrep = ensureSdkOk<{ to: Address; data: Hex | string }>(
    "orders.placeOrder.prepare",
    await orders.placeOrder.prepare({
      // orderType 2 = PAY. recipientAddr 0x0 for PAY (verified by 539487
      // vs 535977/539449). user = smart account (merchants filter EOA
      // placers; 20/20 recent completed PAY-ARS had smart-account buyers).
      orderType: 2,
      currency: "ARS",
      user: smartAccount.address as `0x${string}`,
      recipientAddr: "0x0000000000000000000000000000000000000000",
      amount: usdcAmount,
      fiatAmount,
      fiatAmountLimit,
    })
  );
  const { hash: placeOrderTxHash, receipt: placeReceipt } =
    await submitFromSmartAccount(placePrep);

  // Extract orderId from the OrderPlaced event in the tx receipt.
  // SDK 1.1.6's `.prepare()` path doesn't return orderId metadata (only
  // `.execute()` did via its internal `enrichWithOrderId` helper). Parse
  // the event ourselves — instant, no subgraph polling needed.
  let orderId: bigint | null = null;
  try {
    const parsed = parseEventLogs({
      abi: [
        parseAbiItem(
          "event OrderPlaced(uint256 indexed orderId, address indexed user, address indexed merchant, uint256 amount, uint8 orderType, uint256 placedTimestamp)"
        ),
      ],
      logs: (placeReceipt?.logs ?? []) as any,
      eventName: "OrderPlaced",
    });
    const smartLower = String(smartAccount.address).toLowerCase();
    const mine = parsed.find(
      (e: any) => String(e.args?.user ?? "").toLowerCase() === smartLower
    );
    const chosen = mine ?? parsed[0];
    if (chosen && chosen.args?.orderId !== undefined) {
      orderId = chosen.args.orderId as bigint;
    }
  } catch (e) {
    // Best-effort; fall through, mobile can also poll order-status by
    // user address if it has to.
  }
  const placeOrderResult = {
    hash: placeOrderTxHash as Hex,
    meta: { orderId: orderId ?? undefined },
  };

  let orderStatus: string = "placed";
  let setPaymentAddressTxHash: string | null = null;
  let nextAction = "POLL_ORDER_STATUS";

  if (orderId !== null) {
    // The order is already placed on-chain (placeOrder.execute returned a tx
    // hash and orderId). The subgraph may still be catching up — tolerate
    // that and let the mobile poll order-status afterward.
    const orderResult = await orders.getOrder({ orderId });

    if (orderResult && typeof orderResult.isOk === "function" && orderResult.isOk()) {
      const order = orderResult.value as Order;
      orderStatus = order.status;

      if (
        paymentAddress &&
        order.status === "accepted" &&
        isMerchantPublicKeyReady(order.pubkey)
      ) {
        // Legacy single-shot path: caller provided paymentAddress upfront AND
        // merchant has already accepted by the time we get here. Submit via
        // the smart account (4337) — same identity that placed the order.
        const setPrep = ensureSdkOk<{ to: Address; data: Hex | string }>(
          "orders.setSellOrderUpi.prepare",
          await orders.setSellOrderUpi.prepare({
            orderId,
            paymentAddress,
            merchantPublicKey: order.pubkey,
            updatedAmount: 0n,
          })
        );
        const { hash: setHash } = await submitFromSmartAccount(setPrep);
        setPaymentAddressTxHash = setHash;
        nextAction = "NONE";
      } else if (!paymentAddress) {
        // Split flow — user will scan the vendor QR AFTER merchant accepts and
        // then call /api/p2p/order-set-payment-address. Mobile must poll
        // order-status, surface a scanner when status === "accepted", and
        // submit the freshly-scanned address to the dedicated endpoint.
        nextAction = "SCAN_QR_AND_SET_PAYMENT";
      } else {
        // Legacy single-shot path, but merchant hasn't accepted yet — mobile
        // polls until acceptance, then we call setSellOrderUpi via the
        // dedicated endpoint with the (already-provided) paymentAddress.
        nextAction = "SET_PAYMENT_ADDRESS_WHEN_ACCEPTED";
      }
    } else {
      // getOrder failed — likely subgraph indexing lag (the placeOrder tx is
      // already confirmed but the subgraph hasn't indexed it yet). Don't fail
      // the whole order: the order is on-chain, status defaults to "placed",
      // and the mobile will poll order-status to pick up the merchant once the
      // subgraph catches up.
      const sdkError =
        orderResult && typeof orderResult.isErr === "function" && orderResult.isErr()
          ? orderResult.error
          : null;
      console.warn(
        "[p2p/order-create] getOrder failed after placeOrder; returning placed order anyway",
        {
          orderId: orderId.toString(),
          code: sdkError?.code,
          message: sdkError?.message,
        }
      );
      nextAction = "POLL_ORDER_STATUS";
    }
  }

  return {
    ok: true,
    userId,
    method,
    chainId: chain.id,
    orderId: orderId !== null ? orderId.toString() : null,
    orderStatus,
    nextAction,
    placeOrderTxHash: placeOrderResult.hash,
    approvalTxHash,
    setPaymentAddressTxHash,
    resolvedAmounts: {
      requested: {
        amount: requestedAmountRaw,
        currency: requestedCurrency,
      },
      usdc: formatAmount6(usdcAmount),
      ars: formatAmount6(fiatAmount),
      sellPriceArsPerUsdc: formatAmount6(sellPrice),
      fiatAmountLimit: formatAmount6(fiatAmountLimit),
    },
    bridge,
  };
}

export async function handleGetP2POrderStatus(body: unknown) {
  const payload = asRecord(body);
  const orderId = parseOrderId(payload.orderId);

  const { orders } = await getP2PClients();
  const order = ensureSdkOk<Order>("orders.getOrder", await orders.getOrder({ orderId }));

  return {
    ok: true,
    order: serializeOrder(order),
  };
}

export async function handleSetP2POrderPaymentAddress(body: unknown) {
  const payload = asRecord(body);
  const orderId = parseOrderId(payload.orderId);
  const paymentAddress = ensureString(payload, "paymentAddress");

  // Accept EMV QR strings (the protocol requires this for merchant decryption
  // to work; see comment above on /order-create endpoint).
  const looksLikeEmvQr = /^0002\d{2}/.test(paymentAddress);
  if (!looksLikeEmvQr && !validateArgentinePaymentId(paymentAddress)) {
    throw new P2PApiError(
      400,
      "INVALID_PAYMENT_ADDRESS",
      "paymentAddress must be a valid EMV QR string (preferred) or Alias/CBU/CVU."
    );
  }

  const { orders, submitFromSmartAccount } = await getP2PClients();
  const order = ensureSdkOk<Order>("orders.getOrder", await orders.getOrder({ orderId }));

  if (order.status !== "accepted") {
    throw new P2PApiError(
      409,
      "ORDER_NOT_ACCEPTED",
      "Cannot set payment address until the order is accepted by a merchant.",
      { currentStatus: order.status }
    );
  }

  if (!isMerchantPublicKeyReady(order.pubkey)) {
    throw new P2PApiError(
      409,
      "MERCHANT_PUBLIC_KEY_NOT_READY",
      "Merchant public key is not ready yet for encryption."
    );
  }

  const setPrep = ensureSdkOk<{ to: Address; data: Hex | string }>(
    "orders.setSellOrderUpi.prepare",
    await orders.setSellOrderUpi.prepare({
      orderId,
      paymentAddress,
      merchantPublicKey: order.pubkey,
      updatedAmount: 0n,
    })
  );
  const { hash: txHash } = await submitFromSmartAccount(setPrep);

  return {
    ok: true,
    orderId: orderId.toString(),
    status: order.status,
    txHash,
  };
}

export function toApiErrorPayload(error: unknown): {
  status: number;
  payload: JsonRecord;
} {
  if (error instanceof P2PApiError) {
    return {
      status: error.status,
      payload: {
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      },
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      payload: {
        error: error.message,
        code: "INTERNAL_ERROR",
      },
    };
  }

  return {
    status: 500,
    payload: {
      error: "Unknown error",
      code: "INTERNAL_ERROR",
    },
  };
}
