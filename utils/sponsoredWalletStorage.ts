import AsyncStorage from "@react-native-async-storage/async-storage";

const SPONSORED_SOLANA_WALLET_ID_KEY = "sponsored_solana_wallet_id_v3";
const SPONSORED_SOLANA_WALLET_ADDRESS_KEY = "sponsored_solana_wallet_address_v3";
const LEGACY_SPONSORED_SOLANA_WALLET_ID_KEY = "sponsored_solana_wallet_id_v2";
const LEGACY_SPONSORED_SOLANA_WALLET_ADDRESS_KEY = "sponsored_solana_wallet_address_v2";

type SponsoredWallet = {
  id: string | null;
  address: string | null;
};

function normalizeUserId(userId?: string | null): string | null {
  if (typeof userId !== "string") return null;
  const normalized = userId.trim();
  return normalized.length > 0 ? normalized : null;
}

function scopedKey(baseKey: string, userId: string): string {
  return `${baseKey}:${userId}`;
}

export async function getSponsoredSolanaWallet(
  userId?: string | null
): Promise<SponsoredWallet> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return { id: null, address: null };
  }

  const idKey = scopedKey(SPONSORED_SOLANA_WALLET_ID_KEY, normalizedUserId);
  const addressKey = scopedKey(
    SPONSORED_SOLANA_WALLET_ADDRESS_KEY,
    normalizedUserId
  );

  const [id, address] = await Promise.all([
    AsyncStorage.getItem(idKey),
    AsyncStorage.getItem(addressKey),
  ]);

  return { id, address };
}

export async function setSponsoredSolanaWallet(
  wallet: SponsoredWallet,
  userId?: string | null
) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return;

  const idKey = scopedKey(SPONSORED_SOLANA_WALLET_ID_KEY, normalizedUserId);
  const addressKey = scopedKey(
    SPONSORED_SOLANA_WALLET_ADDRESS_KEY,
    normalizedUserId
  );
  const ops: Promise<void>[] = [];

  if (wallet.id) {
    ops.push(AsyncStorage.setItem(idKey, wallet.id));
  } else {
    ops.push(AsyncStorage.removeItem(idKey));
  }

  if (wallet.address) {
    ops.push(AsyncStorage.setItem(addressKey, wallet.address));
  } else {
    ops.push(AsyncStorage.removeItem(addressKey));
  }

  // One-way cleanup from legacy global keys to avoid cross-account stale data.
  ops.push(AsyncStorage.removeItem(LEGACY_SPONSORED_SOLANA_WALLET_ID_KEY));
  ops.push(AsyncStorage.removeItem(LEGACY_SPONSORED_SOLANA_WALLET_ADDRESS_KEY));

  await Promise.all(ops);
}

export async function clearSponsoredSolanaWallet(
  userId?: string | null
): Promise<void> {
  const keys = [
    LEGACY_SPONSORED_SOLANA_WALLET_ID_KEY,
    LEGACY_SPONSORED_SOLANA_WALLET_ADDRESS_KEY,
  ];
  const normalizedUserId = normalizeUserId(userId);
  if (normalizedUserId) {
    keys.push(scopedKey(SPONSORED_SOLANA_WALLET_ID_KEY, normalizedUserId));
    keys.push(scopedKey(SPONSORED_SOLANA_WALLET_ADDRESS_KEY, normalizedUserId));
  }
  await AsyncStorage.multiRemove(keys);
}
