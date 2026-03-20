import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  saveUserToFirestore, 
  getUserFromFirestore, 
  updateUsernameInFirestore 
} from '@/services/firestoreService';

const USERNAME_KEY = 'user_username';
const SOLANA_ADDRESS_KEY = 'user_solana_address';
const CURRENCY_KEY = 'user_currency';

export type Currency = 'USD' | 'ARS' | 'EUR';

/**
 * Save selected currency
 */
export async function saveSelectedCurrency(currency: Currency): Promise<void> {
  try {
    await AsyncStorage.setItem(CURRENCY_KEY, currency);
    console.log('[UserStorage] Currency saved:', currency);
  } catch (error) {
    console.error('[UserStorage] Error saving currency:', error);
  }
}

/**
 * Get selected currency (default: USD)
 */
export async function getSelectedCurrency(): Promise<Currency> {
  try {
    const currency = await AsyncStorage.getItem(CURRENCY_KEY);
    if (currency === 'USD' || currency === 'ARS' || currency === 'EUR') {
      return currency as Currency;
    }
    return 'USD';
  } catch (error) {
    console.error('[UserStorage] Error getting currency:', error);
    return 'USD';
  }
}

/**
 * Save username to both AsyncStorage (cache) and Firestore (cloud)
 */
export async function saveUsername(
  username: string, 
  solanaAddress?: string
): Promise<void> {
  try {
    // Save to AsyncStorage for quick local access
    await AsyncStorage.setItem(USERNAME_KEY, username);
    console.log('[UserStorage] Username saved to AsyncStorage:', username);
    
    // If we have a Solana address, also save to Firestore
    if (solanaAddress) {
      await AsyncStorage.setItem(SOLANA_ADDRESS_KEY, solanaAddress);
      await updateUsernameInFirestore(solanaAddress, username);
      console.log('[UserStorage] Username saved to Firestore for address:', solanaAddress);
    } else {
      console.log('[UserStorage] No Solana address provided, skipping Firestore sync');
    }
  } catch (error) {
    console.error('[UserStorage] Error saving username:', error);
    // Don't throw - we still want to continue even if Firestore fails
  }
}

/**
 * Get username from AsyncStorage first, fallback to Firestore
 */
export async function getUsername(solanaAddress?: string): Promise<string | null> {
  try {
    // Try AsyncStorage first (fastest)
    let username = await AsyncStorage.getItem(USERNAME_KEY);
    
    if (username) {
      console.log('[UserStorage] Username found in AsyncStorage:', username);
      return username;
    }
    
    // If not in AsyncStorage, try Firestore
    if (solanaAddress) {
      console.log('[UserStorage] Username not in cache, checking Firestore...');
      const userData = await getUserFromFirestore(solanaAddress);
      
      if (userData && userData.username) {
        // Cache it locally for next time
        await AsyncStorage.setItem(USERNAME_KEY, userData.username);
        await AsyncStorage.setItem(SOLANA_ADDRESS_KEY, solanaAddress);
        console.log('[UserStorage] Username retrieved from Firestore:', userData.username);
        return userData.username;
      }
    }
    
    console.log('[UserStorage] No username found');
    return null;
  } catch (error) {
    console.error('[UserStorage] Error getting username:', error);
    return null;
  }
}

/**
 * Get the stored Solana address
 */
export async function getSolanaAddress(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SOLANA_ADDRESS_KEY);
  } catch (error) {
    console.error('[UserStorage] Error getting Solana address:', error);
    return null;
  }
}

/**
 * Clear username from both AsyncStorage and cache
 */
export async function clearUsername(): Promise<void> {
  try {
    await AsyncStorage.removeItem(USERNAME_KEY);
    await AsyncStorage.removeItem(SOLANA_ADDRESS_KEY);
    console.log('[UserStorage] Username cleared from local storage');
  } catch (error) {
    console.error('[UserStorage] Error clearing username:', error);
    throw error;
  }
}
