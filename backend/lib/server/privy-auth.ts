import { Buffer } from "buffer";
import { importSPKI, jwtVerify } from "jose";

const PRIVY_API_URL = "https://api.privy.io";

type PrivyAuthClaims = {
  userId: string;
  appId: string;
};

type LinkedAccountLike = {
  type?: string;
  chainType?: string;
  chain_type?: string;
  address?: string | null;
  public_key?: string | null;
};

type PrivyWalletLike = {
  address?: string | null;
  public_key?: string | null;
};

let cachedVerificationKey: Promise<CryptoKey> | null = null;

function normalizeEnvValue(value?: string): string | null {
  const normalized = value?.trim().replace(/^['"]|['"]$/g, "");
  return normalized ? normalized : null;
}

function getAuthorizationHeader(req: any): string | null {
  const header = req?.headers?.authorization ?? req?.headers?.Authorization;
  return typeof header === "string" ? header : null;
}

function getBearerToken(req: any): string | null {
  const authorization = getAuthorizationHeader(req);
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function getVerificationKey(): Promise<CryptoKey> {
  if (!cachedVerificationKey) {
    const verificationKey = normalizeEnvValue(process.env.PRIVY_JWT_VERIFICATION_KEY);
    if (!verificationKey) {
      throw new Error("PRIVY_JWT_VERIFICATION_KEY is not set.");
    }

    cachedVerificationKey = importSPKI(verificationKey.replace(/\\n/g, "\n"), "ES256");
  }

  return cachedVerificationKey;
}

export async function verifyPrivyAccessToken(req: any): Promise<PrivyAuthClaims> {
  const appId = normalizeEnvValue(process.env.PRIVY_APP_ID);
  if (!appId) {
    throw new Error("PRIVY_APP_ID is not set.");
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) {
    throw new Error("Missing Privy bearer token.");
  }

  const { payload } = await jwtVerify(accessToken, await getVerificationKey(), {
    issuer: "privy.io",
    audience: appId,
  });

  if (typeof payload.sub !== "string" || !payload.sub.trim()) {
    throw new Error("Privy access token is missing sub.");
  }

  return {
    userId: payload.sub,
    appId,
  };
}

function toBasicAuth(appId: string, appSecret: string): string {
  return Buffer.from(`${appId}:${appSecret}`).toString("base64");
}

function getPrivyHeaders(): HeadersInit {
  const appId = normalizeEnvValue(process.env.PRIVY_APP_ID);
  const appSecret = normalizeEnvValue(process.env.PRIVY_APP_SECRET);

  if (!appId || !appSecret) {
    throw new Error("PRIVY_APP_ID or PRIVY_APP_SECRET is not set.");
  }

  return {
    "Content-Type": "application/json",
    "privy-app-id": appId,
    Authorization: `Basic ${toBasicAuth(appId, appSecret)}`,
  };
}

function addAddress(addresses: Set<string>, value: unknown) {
  if (typeof value !== "string") return;
  const normalized = value.trim();
  if (normalized) {
    addresses.add(normalized);
  }
}

function collectLinkedSolanaAddresses(payload: unknown, addresses: Set<string>) {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const linkedAccounts = record.linked_accounts ?? record.linkedAccounts;

  if (!Array.isArray(linkedAccounts)) return;

  for (const account of linkedAccounts as LinkedAccountLike[]) {
    const isSolanaWallet =
      account?.type === "wallet" &&
      (account.chainType === "solana" || account.chain_type === "solana");
    if (!isSolanaWallet) continue;

    addAddress(addresses, account.address);
    addAddress(addresses, account.public_key);
  }
}

async function collectPrivyUserAddresses(userId: string, addresses: Set<string>): Promise<void> {
  const response = await fetch(`${PRIVY_API_URL}/v1/users/${encodeURIComponent(userId)}`, {
    headers: getPrivyHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Privy user lookup failed with HTTP ${response.status}.`);
  }

  collectLinkedSolanaAddresses(await response.json().catch(() => ({})), addresses);
}

async function collectPrivyWalletAddresses(userId: string, addresses: Set<string>): Promise<void> {
  const url = new URL(`${PRIVY_API_URL}/v1/wallets`);
  url.searchParams.set("user_id", userId);
  url.searchParams.set("chain_type", "solana");
  url.searchParams.set("limit", "100");

  const response = await fetch(url.toString(), {
    headers: getPrivyHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Privy wallet lookup failed with HTTP ${response.status}.`);
  }

  const payload = await response.json().catch(() => ({}));
  const wallets = Array.isArray(payload?.data) ? (payload.data as PrivyWalletLike[]) : [];

  for (const wallet of wallets) {
    addAddress(addresses, wallet.address);
    addAddress(addresses, wallet.public_key);
  }
}

export async function getPrivySolanaAddresses(userId: string): Promise<string[]> {
  const addresses = new Set<string>();
  const lookups = await Promise.allSettled([
    collectPrivyUserAddresses(userId, addresses),
    collectPrivyWalletAddresses(userId, addresses),
  ]);
  const failedLookups = lookups.filter((result) => result.status === "rejected");

  if (addresses.size === 0 && failedLookups.length === lookups.length) {
    const firstError = failedLookups[0] as PromiseRejectedResult | undefined;
    throw firstError?.reason instanceof Error
      ? firstError.reason
      : new Error("Failed to verify Privy Solana addresses.");
  }

  return Array.from(addresses);
}
