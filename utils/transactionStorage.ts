import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction } from '@/types/types';

const TRANSACTIONS_KEY = 'wallet_transactions';

/**
 * Save a transaction to local storage
 */
export async function saveTransaction(transaction: Transaction): Promise<void> {
  try {
    const existingTransactions = await getTransactions();
    const updatedTransactions = [transaction, ...existingTransactions];
    await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updatedTransactions));
    console.log('Transaction saved:', transaction.id);
  } catch (error) {
    console.error('Error saving transaction:', error);
    throw error;
  }
}

/**
 * Get all transactions from local storage
 */
export async function getTransactions(): Promise<Transaction[]> {
  try {
    const transactionsJson = await AsyncStorage.getItem(TRANSACTIONS_KEY);
    if (!transactionsJson) {
      return [];
    }
    return JSON.parse(transactionsJson);
  } catch (error) {
    console.error('Error getting transactions:', error);
    return [];
  }
}

/**
 * Get transactions for a specific wallet address
 */
export async function getTransactionsForAddress(address: string): Promise<Transaction[]> {
  try {
    const allTransactions = await getTransactions();
    return allTransactions.filter(
      tx => tx.address === address || 
           (tx.type === 'send' && tx.address === address) ||
           (tx.type === 'receive' && tx.sender === address)
    );
  } catch (error) {
    console.error('Error getting transactions for address:', error);
    return [];
  }
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  signature: string, 
  status: 'pending' | 'confirmed' | 'failed',
  blockTime?: number
): Promise<void> {
  try {
    const transactions = await getTransactions();
    const updatedTransactions = transactions.map(tx => {
      if (tx.signature === signature) {
        return {
          ...tx,
          status,
          blockTime: blockTime || tx.blockTime,
        };
      }
      return tx;
    });
    await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updatedTransactions));
    console.log('Transaction status updated:', signature, status);
  } catch (error) {
    console.error('Error updating transaction status:', error);
    throw error;
  }
}

/**
 * Clear all transactions (useful for testing or logout)
 */
export async function clearTransactions(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TRANSACTIONS_KEY);
    console.log('All transactions cleared');
  } catch (error) {
    console.error('Error clearing transactions:', error);
    throw error;
  }
}

/**
 * Check if a transaction already exists by signature
 */
export async function transactionExists(signature: string): Promise<boolean> {
  try {
    const transactions = await getTransactions();
    return transactions.some(tx => tx.signature === signature);
  } catch (error) {
    console.error('Error checking transaction existence:', error);
    return false;
  }
}
