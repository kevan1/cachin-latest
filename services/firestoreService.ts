import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

// Collection name
const USERS_COLLECTION = 'users';

// User data interface
export interface UserData {
  username: string;
  solanaAddress: string;
  createdAt?: any;
  updatedAt?: any;
  settings?: {
    showFullName?: boolean;
    notifications?: boolean;
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
    const userRef = doc(db, USERS_COLLECTION, solanaAddress);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      // Update existing user
      await updateDoc(userRef, {
        ...userData,
        updatedAt: serverTimestamp(),
      });
      console.log('[Firestore] User updated:', solanaAddress);
    } else {
      // Create new user
      await setDoc(userRef, {
        ...userData,
        solanaAddress,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('[Firestore] User created:', solanaAddress);
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

    const userRef = doc(db, USERS_COLLECTION, solanaAddress);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      console.log('[Firestore] User found:', solanaAddress);
      return docSnap.data() as UserData;
    } else {
      console.log('[Firestore] User not found:', solanaAddress);
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
    await saveUserToFirestore(solanaAddress, { username });
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

    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(
      usersRef,
      where('username', '==', username.toLowerCase())
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
