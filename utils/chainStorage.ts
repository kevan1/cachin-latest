/**
 * Service for persisting chain selection preferences
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChainType } from '@/constants/chains';

const SELECTED_CHAIN_KEY = 'selected_chain';

export type ChainFilter = ChainType | 'all';

/**
 * Save the user's selected chain preference
 */
export async function saveSelectedChain(chain: ChainFilter): Promise<void> {
  try {
    await AsyncStorage.setItem(SELECTED_CHAIN_KEY, chain);
    console.log('[ChainStorage] Saved selected chain:', chain);
  } catch (error) {
    console.error('[ChainStorage] Error saving selected chain:', error);
  }
}

/**
 * Load the user's selected chain preference
 * Returns 'all' by default if no preference is saved
 */
export async function loadSelectedChain(): Promise<ChainFilter> {
  try {
    const chain = await AsyncStorage.getItem(SELECTED_CHAIN_KEY);
    if (chain === ChainType.SOLANA || chain === ChainType.MONAD || chain === 'all') {
      console.log('[ChainStorage] Loaded selected chain:', chain);
      return chain;
    }
    return 'all';
  } catch (error) {
    console.error('[ChainStorage] Error loading selected chain:', error);
    return 'all';
  }
}

/**
 * Clear the chain selection preference
 */
export async function clearSelectedChain(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SELECTED_CHAIN_KEY);
    console.log('[ChainStorage] Cleared selected chain');
  } catch (error) {
    console.error('[ChainStorage] Error clearing selected chain:', error);
  }
}
