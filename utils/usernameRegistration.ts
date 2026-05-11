import {
  getUserFromFirestore,
  updateUsernameInFirestore,
  type UserData,
} from '@/services/firestoreService';
import {
  clearPendingUsernameSave,
  savePendingUsername,
  saveUsername,
} from '@/utils/userStorage';
import { getSolanaProviderAddress } from '@/utils/privySolanaWallet';
import { saveProfileSnapshot } from '@/utils/uiSnapshotCache';

type CreateSolanaWalletForRegistration = (
  args?: { recoveryMethod: 'privy' }
) => Promise<unknown>;

type EnsureRegistrationSolanaAddressesInput = {
  knownAddresses: (string | null | undefined)[];
  createSolanaWallet?: CreateSolanaWalletForRegistration;
  walletStatus?: string;
  walletCreationMode?: 'allow-embedded' | 'existing-only';
};

type PersistRegisteredUsernameInput = {
  username: string;
  solanaAddresses: (string | null | undefined)[];
  userId?: string | null;
  email?: string | null;
  sponsoredWalletAddress?: string | null;
};

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function dedupeAddresses(addresses: (string | null | undefined)[]) {
  const uniqueAddresses = new Set<string>();

  for (const address of addresses) {
    const normalizedAddress = address?.trim();
    if (!normalizedAddress) continue;
    uniqueAddresses.add(normalizedAddress);
  }

  return Array.from(uniqueAddresses);
}

function isWalletPreparing(status?: string) {
  return status === 'creating' || status === 'connecting' || status === 'reconnecting';
}

export async function ensureRegistrationSolanaAddresses({
  knownAddresses,
  createSolanaWallet,
  walletStatus,
  walletCreationMode = 'allow-embedded',
}: EnsureRegistrationSolanaAddressesInput): Promise<string[]> {
  const addresses = dedupeAddresses(knownAddresses);
  if (addresses.length > 0) return addresses;

  if (walletCreationMode === 'existing-only') {
    return addresses;
  }

  if (isWalletPreparing(walletStatus)) {
    throw new Error('Solana wallet is still being prepared.');
  }

  if (typeof createSolanaWallet !== 'function') {
    return addresses;
  }

  const provider = await createSolanaWallet({ recoveryMethod: 'privy' });
  return dedupeAddresses([...addresses, getSolanaProviderAddress(provider)]);
}

export async function persistRegisteredUsername({
  username,
  solanaAddresses,
  userId,
  email,
  sponsoredWalletAddress,
}: PersistRegisteredUsernameInput): Promise<{
  username: string;
  primaryAddress: string;
  firestoreUser: UserData;
}> {
  const normalizedUsername = normalizeUsername(username);
  const addresses = dedupeAddresses(solanaAddresses);

  if (!normalizedUsername) {
    throw new Error('Username is empty.');
  }

  if (addresses.length === 0) {
    await savePendingUsername(normalizedUsername);
    throw new Error('No Solana wallet address is available for username registration.');
  }

  let verificationResults: (UserData | null)[];

  try {
    await Promise.all(
      addresses.map((address) => updateUsernameInFirestore(address, normalizedUsername))
    );

    verificationResults = await Promise.all(
      addresses.map((address) => getUserFromFirestore(address))
    );
  } catch (error) {
    await savePendingUsername(normalizedUsername);
    throw error;
  }
  const firestoreUser =
    verificationResults.find(
      (record): record is UserData =>
        record?.username?.trim().toLowerCase() === normalizedUsername
    ) ?? null;

  if (!firestoreUser) {
    await savePendingUsername(normalizedUsername);
    throw new Error('Username write could not be verified in Firestore.');
  }

  const primaryAddress = addresses[0];
  await saveUsername(normalizedUsername, primaryAddress);
  await clearPendingUsernameSave();

  await saveProfileSnapshot(
    {
      userId: userId ?? null,
      address: primaryAddress,
    },
    {
      userId: userId ?? null,
      username: normalizedUsername,
      email: email ?? null,
      primarySolanaAddress: primaryAddress,
      solanaAddresses: addresses,
      sponsoredWalletAddress: sponsoredWalletAddress ?? null,
      firestoreUser: {
        username: firestoreUser.username,
        solanaAddress: firestoreUser.solanaAddress,
        identityVerification: firestoreUser.identityVerification,
        settings: firestoreUser.settings,
      },
      identityVerification: firestoreUser.identityVerification ?? null,
      updatedAt: Date.now(),
    }
  );

  return {
    username: normalizedUsername,
    primaryAddress,
    firestoreUser,
  };
}
