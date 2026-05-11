import AsyncStorage from "@react-native-async-storage/async-storage";

export type SolanaWalletSource =
  | "native-mwa"
  | "sponsored-privy"
  | "embedded-privy"
  | null;

export type NativeSolanaWalletSession = {
  address: string;
  source: "native-mwa";
  connectorType: "mobile-wallet-adapter";
  walletClientType: "seeker-wallet";
  updatedAt: number;
};

export type ActiveSolanaWallet = {
  source: SolanaWalletSource;
  address: string | null;
};

const NATIVE_SOLANA_WALLET_SESSION_KEY = "native_solana_wallet_session_v1";

function normalizeUserId(userId?: string | null): string | null {
  if (typeof userId !== "string") return null;
  const normalized = userId.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeAddress(address?: string | null): string | null {
  if (typeof address !== "string") return null;
  const normalized = address.trim();
  return normalized.length > 0 ? normalized : null;
}

function scopedKey(userId: string): string {
  return `${NATIVE_SOLANA_WALLET_SESSION_KEY}:${userId}`;
}

export async function getNativeSolanaWalletSession(
  userId?: string | null
): Promise<NativeSolanaWalletSession | null> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return null;

  const value = await AsyncStorage.getItem(scopedKey(normalizedUserId));
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<NativeSolanaWalletSession>;
    const address = normalizeAddress(parsed.address);
    if (!address || parsed.source !== "native-mwa") return null;

    return {
      address,
      source: "native-mwa",
      connectorType: "mobile-wallet-adapter",
      walletClientType: "seeker-wallet",
      updatedAt:
        typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
          ? parsed.updatedAt
          : Date.now(),
    };
  } catch {
    return null;
  }
}

export async function setNativeSolanaWalletSession(
  userId: string | null | undefined,
  address: string
): Promise<void> {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedUserId || !normalizedAddress) return;

  const session: NativeSolanaWalletSession = {
    address: normalizedAddress,
    source: "native-mwa",
    connectorType: "mobile-wallet-adapter",
    walletClientType: "seeker-wallet",
    updatedAt: Date.now(),
  };

  await AsyncStorage.setItem(scopedKey(normalizedUserId), JSON.stringify(session));
}

export async function clearNativeSolanaWalletSession(
  userId?: string | null
): Promise<void> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return;

  await AsyncStorage.removeItem(scopedKey(normalizedUserId));
}

export function resolveActiveSolanaWallet({
  nativeWalletAddress,
  sponsoredWalletAddress,
  embeddedWalletAddress,
}: {
  nativeWalletAddress?: string | null;
  sponsoredWalletAddress?: string | null;
  embeddedWalletAddress?: string | null;
}): ActiveSolanaWallet {
  const nativeAddress = normalizeAddress(nativeWalletAddress);
  if (nativeAddress) {
    return { source: "native-mwa", address: nativeAddress };
  }

  const sponsoredAddress = normalizeAddress(sponsoredWalletAddress);
  if (sponsoredAddress) {
    return { source: "sponsored-privy", address: sponsoredAddress };
  }

  const embeddedAddress = normalizeAddress(embeddedWalletAddress);
  if (embeddedAddress) {
    return { source: "embedded-privy", address: embeddedAddress };
  }

  return { source: null, address: null };
}
