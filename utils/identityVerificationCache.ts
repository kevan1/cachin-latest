import AsyncStorage from '@react-native-async-storage/async-storage';

type IdentityVerificationRecord = {
  status?: 'verified' | 'pending' | 'unverified';
  provider?: string;
  verifiedAt?: number;
  lastEventAt?: number;
  isSandbox?: boolean;
};

const USER_KEY_PREFIX = 'identity_verification_user_v1';
const ADDRESS_KEY_PREFIX = 'identity_verification_address_v1';

function normalizeAddress(address: string | null | undefined): string | null {
  const normalized = address?.trim();
  return normalized ? normalized : null;
}

function normalizeUserId(userId: string | null | undefined): string | null {
  const normalized = userId?.trim();
  return normalized ? normalized : null;
}

function getStatusRank(status: IdentityVerificationRecord['status']): number {
  if (status === 'verified') return 3;
  if (status === 'pending') return 2;
  if (status === 'unverified') return 1;
  return 0;
}

function getBestRecord(
  records: (IdentityVerificationRecord | null | undefined)[]
): IdentityVerificationRecord | null {
  let bestRecord: IdentityVerificationRecord | null = null;
  let bestRank = 0;

  for (const record of records) {
    if (!record) continue;
    const nextRank = getStatusRank(record.status);
    if (nextRank > bestRank) {
      bestRank = nextRank;
      bestRecord = record;
    }
  }

  return bestRecord;
}

function getUserKey(userId: string) {
  return `${USER_KEY_PREFIX}:${userId}`;
}

function getAddressKey(address: string) {
  return `${ADDRESS_KEY_PREFIX}:${address}`;
}

async function readRecord(key: string): Promise<IdentityVerificationRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as IdentityVerificationRecord)
      : null;
  } catch (error) {
    console.warn('[IdentityVerificationCache] Failed to read record', error);
    return null;
  }
}

export async function saveIdentityVerificationCache(input: {
  userId?: string | null;
  addresses?: (string | null | undefined)[];
  identityVerification: IdentityVerificationRecord;
}) {
  const operations: [string, string][] = [];
  const normalizedUserId = normalizeUserId(input.userId);
  const normalizedAddresses = Array.from(
    new Set((input.addresses ?? []).map(normalizeAddress).filter(Boolean) as string[])
  );
  const serialized = JSON.stringify(input.identityVerification);

  if (normalizedUserId) {
    operations.push([getUserKey(normalizedUserId), serialized]);
  }

  for (const address of normalizedAddresses) {
    operations.push([getAddressKey(address), serialized]);
  }

  if (operations.length === 0) {
    return;
  }

  try {
    await AsyncStorage.multiSet(operations);
  } catch (error) {
    console.warn('[IdentityVerificationCache] Failed to save record', error);
  }
}

export async function getIdentityVerificationCache(input: {
  userId?: string | null;
  addresses?: (string | null | undefined)[];
}): Promise<IdentityVerificationRecord | null> {
  const keys: string[] = [];
  const normalizedUserId = normalizeUserId(input.userId);
  const normalizedAddresses = Array.from(
    new Set((input.addresses ?? []).map(normalizeAddress).filter(Boolean) as string[])
  );

  if (normalizedUserId) {
    keys.push(getUserKey(normalizedUserId));
  }

  for (const address of normalizedAddresses) {
    keys.push(getAddressKey(address));
  }

  if (keys.length === 0) {
    return null;
  }

  const records = await Promise.all(keys.map((key) => readRecord(key)));
  return getBestRecord(records);
}
