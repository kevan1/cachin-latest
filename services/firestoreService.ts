import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

// Collection name
const USERS_COLLECTION = 'users';

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function normalizeSolanaAddress(solanaAddress: string): string {
  return solanaAddress.trim();
}

// User data interface
export interface UserData {
  username: string;
  solanaAddress: string;
  createdAt?: any;
  updatedAt?: any;
  identityVerification?: {
    status?: 'verified' | 'pending' | 'unverified';
    provider?: string;
    verifiedAt?: number;
    lastEventAt?: number;
    isSandbox?: boolean;
  };
  settings?: {
    showFullName?: boolean;
    notifications?: boolean;
  };
}

async function findUserDocumentBySolanaAddress(solanaAddress: string): Promise<{
  ref: ReturnType<typeof doc>;
  data: UserData | null;
  exists: boolean;
}> {
  const normalizedAddress = normalizeSolanaAddress(solanaAddress);
  const directRef = doc(db, USERS_COLLECTION, normalizedAddress);
  const directSnap = await getDoc(directRef);

  if (directSnap.exists()) {
    return {
      ref: directRef,
      data: directSnap.data() as UserData,
      exists: true,
    };
  }

  const usersRef = collection(db, USERS_COLLECTION);
  const fallbackQuery = query(
    usersRef,
    where('solanaAddress', '==', normalizedAddress),
    limit(1)
  );
  const fallbackSnapshot = await getDocs(fallbackQuery);

  if (!fallbackSnapshot.empty) {
    const legacyDoc = fallbackSnapshot.docs[0];
    return {
      ref: legacyDoc.ref,
      data: legacyDoc.data() as UserData,
      exists: true,
    };
  }

  return {
    ref: directRef,
    data: null,
    exists: false,
  };
}

/**
 * Save or update user data in Firestore
 * Uses Solana address as the document ID
 */
export async function saveUserToFirestore(
  solanaAddress: string,
  userData: Partial<UserData>
): Promise<void> {
  try {
    const normalizedAddress = normalizeSolanaAddress(solanaAddress);
    const normalizedUserData = userData.username
      ? { ...userData, username: normalizeUsername(userData.username) }
      : userData;
    const { ref: userRef, exists } = await findUserDocumentBySolanaAddress(
      normalizedAddress
    );

    if (exists) {
      // Update existing user
      await updateDoc(userRef, {
        ...normalizedUserData,
        solanaAddress: normalizedAddress,
        updatedAt: serverTimestamp(),
      });
      console.log('[Firestore] User updated:', normalizedAddress);
    } else {
      // Create new user
      await setDoc(userRef, {
        ...normalizedUserData,
        solanaAddress: normalizedAddress,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('[Firestore] User created:', normalizedAddress);
    }
  } catch (error) {
    console.error('[Firestore] Error saving user:', error);
    throw error;
  }
}

/**
 * Get user data from Firestore by Solana address
 */
export async function getUserFromFirestore(
  solanaAddress: string
): Promise<UserData | null> {
  try {
    // Validate address before querying
    if (!solanaAddress || solanaAddress.trim() === '') {
      console.log('[Firestore] Empty address provided');
      return null;
    }

    const normalizedAddress = normalizeSolanaAddress(solanaAddress);
    const { data, exists } = await findUserDocumentBySolanaAddress(normalizedAddress);

    if (exists && data) {
      console.log('[Firestore] User found:', normalizedAddress);
      return data;
    } else {
      console.log('[Firestore] User not found:', normalizedAddress);
      return null;
    }
  } catch (error) {
    console.error('[Firestore] Error getting user:', error);
    return null;
  }
}

/**
 * Update username in Firestore
 */
export async function updateUsernameInFirestore(
  solanaAddress: string,
  username: string
): Promise<void> {
  try {
    const normalizedUsername = normalizeUsername(username);
    await saveUserToFirestore(solanaAddress, { username: normalizedUsername });
    console.log('[Firestore] Username updated for:', solanaAddress);
  } catch (error) {
    console.error('[Firestore] Error updating username:', error);
    throw error;
  }
}

/**
 * Update user settings in Firestore
 */
export async function updateUserSettingsInFirestore(
  solanaAddress: string,
  settings: UserData['settings']
): Promise<void> {
  try {
    await saveUserToFirestore(solanaAddress, { settings });
    console.log('[Firestore] Settings updated for:', solanaAddress);
  } catch (error) {
    console.error('[Firestore] Error updating settings:', error);
    throw error;
  }
}

/**
 * Update identity verification status in Firestore.
 */
export async function updateIdentityVerificationInFirestore(
  solanaAddress: string,
  identityVerification: UserData['identityVerification']
): Promise<void> {
  try {
    await saveUserToFirestore(solanaAddress, { identityVerification });
    console.log('[Firestore] Identity verification updated for:', solanaAddress);
  } catch (error) {
    console.error('[Firestore] Error updating identity verification:', error);
    throw error;
  }
}

/**
 * Search users by username (case-insensitive partial match)
 */
export async function searchUsersByUsername(
  searchTerm: string
): Promise<UserData[]> {
  try {
    if (!searchTerm || searchTerm.length < 3) {
      return [];
    }

    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(
      usersRef,
      where('username', '>=', searchTerm.toLowerCase()),
      where('username', '<=', searchTerm.toLowerCase() + '\uf8ff')
    );

    const querySnapshot = await getDocs(q);
    const results: UserData[] = [];

    querySnapshot.forEach((doc) => {
      results.push(doc.data() as UserData);
    });

    console.log(`[Firestore] Found ${results.length} users matching "${searchTerm}"`);
    return results;
  } catch (error) {
    console.error('[Firestore] Error searching users:', error);
    throw error;
  }
}

/**
 * Get all users from Firestore for username discovery.
 */
export async function getAllUsersFromFirestore(): Promise<UserData[]> {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, orderBy('username', 'asc'));
    const querySnapshot = await getDocs(q);
    const results: UserData[] = [];

    querySnapshot.forEach((userDoc) => {
      const data = userDoc.data() as Partial<UserData>;
      const username = typeof data.username === 'string' ? data.username.trim() : '';
      const solanaAddress =
        typeof data.solanaAddress === 'string' && data.solanaAddress.trim()
          ? data.solanaAddress
          : userDoc.id;

      if (username && solanaAddress) {
        results.push({
          ...(data as UserData),
          username,
          solanaAddress,
        });
      }
    });

    console.log(`[Firestore] Loaded ${results.length} users`);
    return results;
  } catch (error) {
    console.error('[Firestore] Error loading all users:', error);
    throw error;
  }
}

/**
 * Get username by Solana address (for display purposes)
 */
export async function getUsernameByAddress(
  solanaAddress: string
): Promise<string | null> {
  try {
    // Validate address before querying
    if (!solanaAddress || solanaAddress.trim() === '') {
      return null;
    }
    
    const userData = await getUserFromFirestore(solanaAddress);
    return userData?.username || null;
  } catch (error) {
    console.error('[Firestore] Error getting username by address:', error);
    return null;
  }
}

/**
 * Get user data by username (exact match)
 */
export async function getUserByUsername(
  username: string
): Promise<UserData | null> {
  try {
    if (!username || username.trim() === '') {
      console.log('[Firestore] Empty username provided');
      return null;
    }
    const normalizedUsername = normalizeUsername(username);

    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(
      usersRef,
      where('username', '==', normalizedUsername)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('[Firestore] User not found with username:', username);
      return null;
    }

    // Return first match (usernames should be unique)
    const userData = querySnapshot.docs[0].data() as UserData;
    console.log('[Firestore] User found:', userData.solanaAddress);
    return userData;
  } catch (error) {
    console.error('[Firestore] Error getting user by username:', error);
    return null;
  }
}
