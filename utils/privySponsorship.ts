import Constants from "expo-constants";

const DEFAULT_SOLANA_CAIP2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

function getExtraConfig(): Record<string, any> {
  return (Constants.expoConfig?.extra as Record<string, any> | undefined) ?? {};
}

function normalizeHostUri(value: string): string {
  return value.replace(/^https?:\/\//, "").replace(/^exp:\/\//, "");
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function getHostDerivedApiBaseUrl(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    "";
  if (!hostUri) return "";
  return `http://${normalizeHostUri(hostUri)}`;
}

function toLocalhostVariant(url: string): string | null {
  if (!/^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(url)) return null;
  return url.replace("127.0.0.1", "localhost");
}

function toLoopbackVariant(url: string): string | null {
  if (!/^https?:\/\/localhost(?::\d+)?$/i.test(url)) return null;
  return url.replace("localhost", "127.0.0.1");
}

function getApiBaseUrls(): string[] {
  const extra = getExtraConfig();
  const envUrl = process.env.EXPO_PUBLIC_API_URL || extra.apiUrl;
  const urls: string[] = [];
  const addUrl = (value?: string | null) => {
    if (!value) return;
    const normalized = trimTrailingSlash(value);
    if (!normalized) return;
    if (!urls.includes(normalized)) {
      urls.push(normalized);
    }
  };

  addUrl(envUrl);
  if (envUrl) {
    addUrl(toLocalhostVariant(trimTrailingSlash(envUrl)));
    addUrl(toLoopbackVariant(trimTrailingSlash(envUrl)));
  }
  addUrl(getHostDerivedApiBaseUrl());

  return urls;
}

export function getApiBaseUrl(): string {
  return getApiBaseUrls()[0] ?? "";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim().length > 0) return error;
  return "Unknown network error";
}

async function postPrivyApi(path: string, body: Record<string, unknown>) {
  const baseUrls = getApiBaseUrls();
  if (baseUrls.length === 0) {
    throw new Error("Missing EXPO_PUBLIC_API_URL (or app.json extra.apiUrl).");
  }

  let lastError: unknown = null;
  for (const baseUrl of baseUrls) {
    try {
      return await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (error) {
      lastError = error;
    }
  }

  const tried = baseUrls.join(", ");
  throw new Error(
    `Network request failed while calling ${path}. Tried: ${tried}. Last error: ${getErrorMessage(
      lastError
    )}`
  );
}

export function getSolanaCaip2(): string {
  const extra = getExtraConfig();
  return (
    process.env.EXPO_PUBLIC_SOLANA_CAIP2 ||
    extra.solanaCaip2 ||
    DEFAULT_SOLANA_CAIP2
  );
}

type SponsoredSolanaSendInput = {
  userId: string;
  walletId?: string;
  walletAddress?: string;
  transactionBase64: string;
  caip2?: string;
};

export async function sendSponsoredSolanaTransaction({
  userId,
  walletId,
  walletAddress,
  transactionBase64,
  caip2,
}: SponsoredSolanaSendInput): Promise<{ signature: string }> {
  const response = await postPrivyApi("/api/privy-solana-sponsor", {
    userId,
    walletId,
    walletAddress,
    transaction: transactionBase64,
    caip2,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const debug =
      error && typeof error === "object" && "debug" in error
        ? ` Debug: ${JSON.stringify(error.debug)}`
        : "";
    throw new Error((error.error || `HTTP ${response.status}`) + debug);
  }

  return response.json();
}

type SponsoredSolanaWalletInput = {
  userId: string;
  walletId?: string;
  walletAddress?: string;
};

type SponsoredSolanaWalletResponse = {
  walletId: string | null;
  address: string | null;
  publicKey?: string | null;
};

export async function ensureSponsoredSolanaWallet({
  userId,
  walletId,
  walletAddress,
}: SponsoredSolanaWalletInput): Promise<SponsoredSolanaWalletResponse> {
  const response = await postPrivyApi("/api/privy-solana-wallet", {
    userId,
    walletId,
    walletAddress,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const debug =
      error && typeof error === "object" && "debug" in error
        ? ` Debug: ${JSON.stringify(error.debug)}`
        : "";
    throw new Error((error.error || `HTTP ${response.status}`) + debug);
  }

  return response.json();
}
