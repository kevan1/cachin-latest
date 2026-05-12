import { Connection, PublicKey, ParsedTransactionWithMeta, ConfirmedSignatureInfo } from '@solana/web3.js';
import { Transaction } from '@/types/types';
import { ChainType } from '@/constants/chains';
import { saveTransaction, transactionExists, getTransactions } from './transactionStorage';

const SOLANA_MAINNET_RPC = 'https://solxar.mainnet.rpcpool.com/efba4db1-e231-40f6-a16f-6e24e8f72b5c';

// Helper to delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch transactions for a wallet address from Solana blockchain
 */
export async function fetchTransactionsFromBlockchain(
  address: string,
  limit: number = 5 // Reduced to 5 to avoid rate limits
): Promise<Transaction[]> {
  try {
    const connection = new Connection(SOLANA_MAINNET_RPC, 'confirmed');
    const publicKey = new PublicKey(address);

    // Get transaction signatures
    const signatures: ConfirmedSignatureInfo[] = await connection.getSignaturesForAddress(
      publicKey,
      { limit }
    );

    console.log(`Found ${signatures.length} transaction signatures for ${address}`);

    const transactions: Transaction[] = [];

    // Fetch transaction details for each signature with rate limiting
    for (let i = 0; i < signatures.length; i++) {
      const sigInfo = signatures[i];
      
      try {
        // Check if already exists to avoid unnecessary API calls
        const exists = await transactionExists(sigInfo.signature);
        if (exists) {
          // Get from local storage instead of fetching
          const localTxs = await getTransactions();
          const localTx = localTxs.find(tx => tx.signature === sigInfo.signature);
          const hasResolvedCounterparty = Boolean(localTx?.address?.trim());
          if (localTx && hasResolvedCounterparty) {
            transactions.push(localTx);
            continue;
          }
          // Local cache exists but missing counterparty; continue and refetch chain data.
        }

        // Add delay between requests to avoid rate limiting (500ms)
        if (i > 0) {
          await delay(500);
        }

        const tx = await connection.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx || !tx.meta) {
          continue;
        }

        // Parse the transaction
        const parsedTx = parseTransaction(tx, address, sigInfo.signature);
        if (parsedTx) {
          transactions.push(parsedTx);
          await saveTransaction(parsedTx);
        }
      } catch (error: any) {
        // Handle rate limiting gracefully
        if (error?.message?.includes('429') || error?.message?.includes('Too many requests')) {
          console.warn(`Rate limit hit, waiting 2s before continuing...`);
          await delay(2000); // Wait 2s before continuing
          // Try to fetch from cache instead
          const localTxs = await getTransactions();
          const localTx = localTxs.find(tx => tx.signature === sigInfo.signature);
          if (localTx) {
            transactions.push(localTx);
          }
          continue;
        }
        console.error(`Error parsing transaction ${sigInfo.signature}:`, error);
      }
    }

    return transactions;
  } catch (error) {
    console.error('Error fetching transactions from blockchain:', error);
    return [];
  }
}

// USDC Token Mint Address on Solana Mainnet
const USDC_MINTS = [
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Official USDC Mainnet
];

/**
 * Parse a Solana transaction into our Transaction format
 */
function parseTransaction(
  tx: ParsedTransactionWithMeta,
  walletAddress: string,
  signature: string
): Transaction | null {
  try {
    const { meta, blockTime, transaction } = tx;

    if (!meta || !transaction || !transaction.message) {
      return null;
    }

    const accountKeys = transaction.message.accountKeys;
    const preBalances = meta.preBalances;
    const postBalances = meta.postBalances;
    
    // Check for SPL Token transfers (USDC)
    const preTokenBalances = meta.preTokenBalances || [];
    const postTokenBalances = meta.postTokenBalances || [];
    
    // Try to parse as token transfer first
    const tokenTransfer = parseTokenTransfer(
      tx,
      walletAddress,
      signature,
      preTokenBalances,
      postTokenBalances
    );
    
    if (tokenTransfer) {
      return tokenTransfer;
    }

    // Find the wallet's index in account keys
    const walletIndex = accountKeys.findIndex(
      (key) => key.pubkey.toString() === walletAddress
    );

    if (walletIndex === -1) {
      return null;
    }

    // Calculate balance change
    const preBalance = preBalances[walletIndex];
    const postBalance = postBalances[walletIndex];
    const balanceChange = postBalance - preBalance;

    // Determine transaction type
    const type: 'send' | 'receive' = balanceChange < 0 ? 'send' : 'receive';

    // Find the other party (sender or recipient)
    let otherPartyAddress = '';
    if (type === 'send') {
      // Find the recipient (account with positive balance change that's not the wallet)
      const recipientIndex = postBalances.findIndex((balance, index) => {
        return index !== walletIndex && balance > preBalances[index];
      });
      if (recipientIndex !== -1) {
        otherPartyAddress = accountKeys[recipientIndex].pubkey.toString();
      }
    } else {
      // Find the sender (account with negative balance change that's not the wallet)
      const senderIndex = postBalances.findIndex((balance, index) => {
        return index !== walletIndex && balance < preBalances[index];
      });
      if (senderIndex !== -1) {
        otherPartyAddress = accountKeys[senderIndex].pubkey.toString();
      }
    }

    return {
      id: signature,
      signature,
      type,
      currency: 'SOL',
      chain: ChainType.SOLANA,
      amount: Math.abs(balanceChange) / 1000000000, // Convert lamports to SOL
      address: otherPartyAddress,
      sender: type === 'receive' ? otherPartyAddress : undefined,
      recipient: type === 'send' ? otherPartyAddress : undefined,
      timestamp: blockTime ? blockTime * 1000 : Date.now(),
      blockTime: blockTime || undefined,
      status: 'confirmed',
      fee: meta.fee,
    };
  } catch (error) {
    console.error('Error parsing transaction:', error);
    return null;
  }
}

/**
 * Parse SPL Token (USDC) transfers
 */
function parseTokenTransfer(
  tx: ParsedTransactionWithMeta,
  walletAddress: string,
  signature: string,
  preTokenBalances: any[],
  postTokenBalances: any[]
): Transaction | null {
  try {
    const { meta, blockTime } = tx;
    
    console.log('Parsing token transfer:', signature);
    console.log('Pre token balances:', preTokenBalances.length);
    console.log('Post token balances:', postTokenBalances.length);
    
    if (!meta || preTokenBalances.length === 0 || postTokenBalances.length === 0) {
      console.log('No token balances found');
      return null;
    }

    // Find USDC token balance changes
    for (let i = 0; i < postTokenBalances.length; i++) {
      const postBalance = postTokenBalances[i];
      const preBalance = preTokenBalances.find(
        (pb) => pb.accountIndex === postBalance.accountIndex
      );

      // Check if it's a USDC token (6 decimals is standard for USDC)
      if (!postBalance.uiTokenAmount) {
        continue;
      }

      // Parse only the token account owned by the current wallet.
      const owner = postBalance.owner?.trim();
      if (!owner || owner !== walletAddress) {
        continue;
      }
      
      console.log('Token found:', postBalance.mint, 'decimals:', postBalance.uiTokenAmount.decimals);
      
      const isUSDC = USDC_MINTS.includes(postBalance.mint) || 
                     postBalance.uiTokenAmount.decimals === 6;
      
      console.log('Is USDC?', isUSDC);
      
      if (!isUSDC) {
        continue;
      }

      const postAmount = postBalance.uiTokenAmount.uiAmount || 0;
      const preAmount = preBalance?.uiTokenAmount?.uiAmount || 0;
      const amountChange = postAmount - preAmount;
      
      console.log('Amount change:', amountChange, 'from', preAmount, 'to', postAmount);

      if (amountChange === 0) {
        console.log('No amount change, skipping');
        continue;
      }

      const type: 'send' | 'receive' = amountChange < 0 ? 'send' : 'receive';

      // Find the other party
      let otherPartyAddress = '';
      if (type === 'send') {
        // Find account with positive change
        const recipientBalance = postTokenBalances.find((pb, idx) => {
          const correspondingPre = preTokenBalances.find(
            (pre) => pre.accountIndex === pb.accountIndex
          );
          if (!pb.uiTokenAmount) return false;
          const postUiAmount = pb.uiTokenAmount.uiAmount || 0;
          const preUiAmount = correspondingPre?.uiTokenAmount?.uiAmount || 0;
          const change = postUiAmount - preUiAmount;
          const recipientIsUSDC = USDC_MINTS.includes(pb.mint) || pb.uiTokenAmount.decimals === 6;
          return change > 0 && recipientIsUSDC && idx !== i;
        });
        const recipientOwner = recipientBalance?.owner?.trim();
        otherPartyAddress =
          recipientOwner && recipientOwner !== walletAddress ? recipientOwner : '';
      } else {
        // Find account with negative change
        const senderBalance = postTokenBalances.find((pb, idx) => {
          const correspondingPre = preTokenBalances.find(
            (pre) => pre.accountIndex === pb.accountIndex
          );
          if (!pb.uiTokenAmount) return false;
          const postUiAmount = pb.uiTokenAmount.uiAmount || 0;
          const preUiAmount = correspondingPre?.uiTokenAmount?.uiAmount || 0;
          const change = postUiAmount - preUiAmount;
          const senderIsUSDC = USDC_MINTS.includes(pb.mint) || pb.uiTokenAmount.decimals === 6;
          const senderOwner = pb.owner?.trim();
          return change < 0 && senderIsUSDC && idx !== i && senderOwner !== walletAddress;
        });
        otherPartyAddress = senderBalance?.owner?.trim() || '';
        
        // Fallback: try to get authority/signer from transaction instructions
        if (!otherPartyAddress && tx.transaction?.message) {
          const instructions = tx.transaction.message.instructions;
          for (const instruction of instructions) {
            if (
              'parsed' in instruction &&
              (instruction.parsed?.type === 'transfer' ||
                instruction.parsed?.type === 'transferChecked')
            ) {
              const authority = instruction.parsed.info?.authority?.trim();
              if (authority && authority !== walletAddress) {
                otherPartyAddress = authority;
                break;
              }
            }
          }
        }
      }

      const usdcTx = {
        id: signature,
        signature,
        type,
        currency: 'USDC' as const,
        chain: ChainType.SOLANA,
        amount: Math.abs(amountChange),
        address: otherPartyAddress,
        sender: type === 'receive' ? otherPartyAddress : undefined,
        recipient: type === 'send' ? otherPartyAddress : undefined,
        timestamp: blockTime ? blockTime * 1000 : Date.now(),
        blockTime: blockTime || undefined,
        status: 'confirmed' as const,
        fee: meta.fee,
      };
      
      console.log('USDC transaction parsed:', usdcTx);
      return usdcTx;
    }

    return null;
  } catch (error) {
    console.error('Error parsing token transfer:', error);
    return null;
  }
}

/**
 * Start polling for new transactions
 * Returns a cleanup function to stop polling
 */
export function startTransactionPolling(
  address: string,
  intervalMs: number = 120000, // Increased to 2 minutes to reduce API calls
  onNewTransaction?: (transaction: Transaction) => void
): () => void {
  console.log(`Starting transaction polling for ${address}`);
  
  let lastSignature: string | undefined;

  const poll = async () => {
    try {
      const connection = new Connection(SOLANA_MAINNET_RPC, 'confirmed');
      const publicKey = new PublicKey(address);

      // Get latest transactions (reduced limit)
      const signatures = await connection.getSignaturesForAddress(publicKey, {
        limit: 2, // Reduced to 2 to minimize rate limiting
        before: lastSignature,
      });

      if (signatures.length === 0) {
        return;
      }

      // Update last signature
      if (!lastSignature) {
        lastSignature = signatures[0].signature;
        return;
      }

      // Check for new transactions
      const newSignatures = signatures.filter(
        (sig) => sig.signature !== lastSignature
      );

      for (let i = 0; i < newSignatures.length; i++) {
        const sigInfo = newSignatures[i];
        
        try {
          const exists = await transactionExists(sigInfo.signature);
          if (!exists) {
            // Add delay between requests
            if (i > 0) {
              await delay(600);
            }

            const tx = await connection.getParsedTransaction(sigInfo.signature, {
              maxSupportedTransactionVersion: 0,
            });

            if (tx && tx.meta) {
              const parsedTx = parseTransaction(tx, address, sigInfo.signature);
              if (parsedTx) {
                await saveTransaction(parsedTx);
                console.log('New transaction detected:', parsedTx.signature);
                onNewTransaction?.(parsedTx);
              }
            }
          }
        } catch (txError: any) {
          if (txError?.message?.includes('429')) {
            console.warn('Rate limit hit during polling, will retry on next interval');
            break; // Stop processing for this poll cycle
          }
          console.error(`Error fetching new transaction ${sigInfo.signature}:`, txError);
        }
      }

      lastSignature = signatures[0].signature;
    } catch (error) {
      console.error('Error polling for transactions:', error);
    }
  };

  // Initial poll
  poll();

  // Set up interval
  const intervalId = setInterval(poll, intervalMs);

  // Return cleanup function
  return () => {
    console.log('Stopping transaction polling');
    clearInterval(intervalId);
  };
}

/**
 * Get merged transactions from local storage and blockchain
 */
export async function getMergedTransactions(address: string): Promise<Transaction[]> {
  try {
    // Keep local history scoped to Solana activity.
    const localTransactions = (await getTransactions()).filter(
      (tx) => tx.chain === ChainType.SOLANA
    );

    // Fetch blockchain transactions (reduced limit to avoid rate limiting)
    const blockchainTransactions = await fetchTransactionsFromBlockchain(address, 5);

    // Merge and deduplicate by signature
    const mergedMap = new Map<string, Transaction>();

    // Add local transactions first
    localTransactions.forEach(tx => {
      mergedMap.set(tx.signature, tx);
    });

    // Add/update with blockchain transactions, but keep local counterparty
    // when parser cannot resolve address fields from chain data.
    blockchainTransactions.forEach(tx => {
      const existing = mergedMap.get(tx.signature);

      if (!existing) {
        mergedMap.set(tx.signature, tx);
        return;
      }

      const normalizedChainAddress = tx.address?.trim() ?? '';
      const normalizedExistingAddress = existing.address?.trim() ?? '';
      const normalizedChainSender = tx.sender?.trim() ?? '';
      const normalizedExistingSender = existing.sender?.trim() ?? '';
      const normalizedChainRecipient = tx.recipient?.trim() ?? '';
      const normalizedExistingRecipient = existing.recipient?.trim() ?? '';

      mergedMap.set(tx.signature, {
        ...existing,
        ...tx,
        address: normalizedChainAddress || normalizedExistingAddress,
        sender: normalizedChainSender || normalizedExistingSender,
        recipient: normalizedChainRecipient || normalizedExistingRecipient,
      });
    });

    // Convert back to array and sort by timestamp (newest first)
    const merged = Array.from(mergedMap.values()).sort(
      (a, b) => b.timestamp - a.timestamp
    );

    return merged;
  } catch (error) {
    console.error('Error merging transactions:', error);
    // Fall back to local transactions
    return getTransactions();
  }
}
