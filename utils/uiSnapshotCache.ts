import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserData } from '@/services/firestoreService';
import type { Transaction } from '@/types/types';

const HOME_RECENT_SNAPSHOT_PREFIX = 'ui_snapshot_home_recent_v1:';
const PROFILE_SNAPSHOT_PREFIX = 'ui_snapshot_profile_v1:';

type SnapshotSubject = {
  userId?: string | null;
  address?: string | null;
};

export type HomeRecentSnapshot = {
  address: string;
  transactions: Transaction[];
  addressToUsername: Record<string, string>;
  updatedAt: number;
};

export type ProfileSnapshot = {
  userId?: string | null;
  username: string;
  email?: string | null;
  primarySolanaAddress?: string | null;
  solanaAddresses: string[];
  sponsoredWalletAddress?: string | null;
  firestoreUser: Pick<UserData, 'username' | 'solanaAddress' | 'identityVerification' | 'settings'> | null;
  identityVerification: UserData['identityVerification'] | null;
  updatedAt: number;
};

const homeRecentMemory = new Map<string, HomeRecentSnapshot>();
const profileMemory = new Map<string, ProfileSnapshot>();

function normalizeSubject(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function getSubjects({ userId, address }: SnapshotSubject) {
  const subjects: string[] = [];
  const normalizedUserId = normalizeSubject(userId);
  const normalizedAddress = normalizeSubject(address);

  if (normalizedUserId) subjects.push(`user:${normalizedUserId}`);
  if (normalizedAddress) subjects.push(`address:${normalizedAddress}`);

  return subjects;
}

function homeRecentKey(subject: string) {
  return `${HOME_RECENT_SNAPSHOT_PREFIX}${subject}`;
}

function profileKey(subject: string) {
  return `${PROFILE_SNAPSHOT_PREFIX}${subject}`;
}

function isHomeRecentSnapshotForAddress(
  snapshot: HomeRecentSnapshot | null,
  address?: string | null
) {
  if (!snapshot) return false;
  const normalizedAddress = normalizeSubject(address);
  if (!normalizedAddress) return true;
  return snapshot.address.trim() === normalizedAddress;
}

function isProfileSnapshotForAddress(
  snapshot: ProfileSnapshot | null,
  address?: string | null
) {
  if (!snapshot) return false;
  const normalizedAddress = normalizeSubject(address);
  if (!normalizedAddress) return true;

  return (
    snapshot.primarySolanaAddress?.trim() === normalizedAddress ||
    snapshot.solanaAddresses.some((item) => item.trim() === normalizedAddress)
  );
}

function parseHomeRecentSnapshot(value: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as HomeRecentSnapshot;
    if (!parsed?.address || !Array.isArray(parsed.transactions)) return null;
    return {
      ...parsed,
      addressToUsername: parsed.addressToUsername ?? {},
    };
  } catch {
    return null;
  }
}

function parseProfileSnapshot(value: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as ProfileSnapshot;
    if (!parsed?.username || !Array.isArray(parsed.solanaAddresses)) return null;
    return {
      ...parsed,
      firestoreUser: parsed.firestoreUser ?? null,
      identityVerification: parsed.identityVerification ?? null,
    };
  } catch {
    return null;
  }
}

export function getHomeRecentSnapshotSync(subject: SnapshotSubject) {
  for (const cacheSubject of getSubjects(subject)) {
    const snapshot = homeRecentMemory.get(cacheSubject) ?? null;
    if (isHomeRecentSnapshotForAddress(snapshot, subject.address)) {
      return snapshot;
    }
  }

  return null;
}

export async function getHomeRecentSnapshot(subject: SnapshotSubject) {
  const memorySnapshot = getHomeRecentSnapshotSync(subject);
  if (memorySnapshot) return memorySnapshot;

  for (const cacheSubject of getSubjects(subject)) {
    const snapshot = parseHomeRecentSnapshot(
      await AsyncStorage.getItem(homeRecentKey(cacheSubject))
    );

    if (!snapshot || !isHomeRecentSnapshotForAddress(snapshot, subject.address)) continue;

    homeRecentMemory.set(cacheSubject, snapshot);
    return snapshot;
  }

  return null;
}

export async function saveHomeRecentSnapshot(
  subject: SnapshotSubject,
  snapshot: HomeRecentSnapshot
) {
  const subjects = getSubjects(subject);
  if (subjects.length === 0) return;

  const value = JSON.stringify(snapshot);
  await Promise.all(
    subjects.map(async (cacheSubject) => {
      homeRecentMemory.set(cacheSubject, snapshot);
      await AsyncStorage.setItem(homeRecentKey(cacheSubject), value);
    })
  );
}

export function getProfileSnapshotSync(subject: SnapshotSubject) {
  for (const cacheSubject of getSubjects(subject)) {
    const snapshot = profileMemory.get(cacheSubject) ?? null;
    if (isProfileSnapshotForAddress(snapshot, subject.address)) {
      return snapshot;
    }
  }

  return null;
}

export async function getProfileSnapshot(subject: SnapshotSubject) {
  const memorySnapshot = getProfileSnapshotSync(subject);
  if (memorySnapshot) return memorySnapshot;

  for (const cacheSubject of getSubjects(subject)) {
    const snapshot = parseProfileSnapshot(await AsyncStorage.getItem(profileKey(cacheSubject)));

    if (!snapshot || !isProfileSnapshotForAddress(snapshot, subject.address)) continue;

    profileMemory.set(cacheSubject, snapshot);
    return snapshot;
  }

  return null;
}

export async function saveProfileSnapshot(subject: SnapshotSubject, snapshot: ProfileSnapshot) {
  const subjects = getSubjects(subject);
  if (subjects.length === 0) return;

  const value = JSON.stringify(snapshot);
  await Promise.all(
    subjects.map(async (cacheSubject) => {
      profileMemory.set(cacheSubject, snapshot);
      await AsyncStorage.setItem(profileKey(cacheSubject), value);
    })
  );
}
