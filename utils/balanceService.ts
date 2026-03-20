/**
 * Service for fetching token balances
 */

import { Connection, PublicKey } from '@solana/web3.js';

// Simple retry helper with exponential backoff and jitter
// On 429 errors, fail immediately instead of retrying
async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelayMs = 500): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e: any) {
      const msg = String(e?.message || e);
      const is429 = msg.includes('429') || msg.includes('Too many requests');
      // On 429, fail immediately - don't retry
      if (is429) {
        console.warn('Rate limited (429), failing fast to use cached data');
        throw e;
      }
      // For other errors, retry up to limit
      if (attempt >= retries) {
        throw e;
      }
      const delayMs = baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 150);
      await new Promise(r => setTimeout(r, delayMs));
      attempt++;
    }
  }
}

const SOLANA_MAINNET_RPC = 'https://solxar.mainnet.rpcpool.com/efba4db1-e231-40f6-a16f-6e24e8f72b5c';

// Mainnet SPL token mint addresses
const USDC_MINTS_MAINNET = [
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Official USDC Mainnet
];
const USDT_MINTS_MAINNET = [
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // Official USDT Mainnet
];

export interface TokenBalances {
  sol: number;
  usdc: number;
  usdt: number;
}

// Balance cache to reduce RPC calls
let cachedBalances: { [address: string]: { balances: TokenBalances; timestamp: number } } = {};
const BALANCE_CACHE_DURATION = 30 * 1000; // 30 seconds

/**
 * Fetch SOL balance for an address
 */
async function fetchSolBalance(connection: Connection, address: string): Promise<number> {
  try {
    const publicKey = new PublicKey(address);
    const balance = await withRetry(() => connection.getBalance(publicKey));
    return balance / 1000000000; // Convert lamports to SOL
  } catch (error) {
    console.error('Error fetching SOL balance:', error);
    return 0;
  }
}

/**
 * Fetch SPL token balance for an address
 */
async function fetchSplTokenBalance(
  connection: Connection,
  walletAddress: string,
  mintAddress: string
): Promise<number> {
  try {
    const walletPublicKey = new PublicKey(walletAddress);
    const mintPublicKey = new PublicKey(mintAddress);
    
    // Get token accounts for this wallet and mint
    const tokenAccounts = await withRetry(() => connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { mint: mintPublicKey }
    ));
    
    if (tokenAccounts.value.length === 0) {
      return 0;
    }
    
    // Sum up all token accounts (usually just one)
    let totalBalance = 0;
    for (const account of tokenAccounts.value) {
      const parsedInfo = account.account.data.parsed.info;
      const balance = parsedInfo.tokenAmount.uiAmount;
      totalBalance += balance || 0;
    }
    
    return totalBalance;
  } catch (error) {
    console.error('Error fetching SPL token balance:', error);
    return 0;
  }
}

async function fetchMultipleMintBalances(
  connection: Connection,
  walletAddress: string,
  mintAddresses: string[]
): Promise<number> {
  let total = 0;
  for (const mint of mintAddresses) {
    const bal = await fetchSplTokenBalance(connection, walletAddress, mint);
    total += bal;
  }
  return total;
}

/**
 * Fetch all token balances (SOL, USDC, USDT) for an address
 * Balances are cached for 30 seconds to avoid rate limiting
 */
export async function fetchAllTokenBalances(address: string, forceFresh: boolean = false): Promise<TokenBalances> {
  // Check cache first
  const now = Date.now();
  const cached = cachedBalances[address];
  
  if (!forceFresh && cached && (now - cached.timestamp) < BALANCE_CACHE_DURATION) {
    console.log('Using cached balances for', address);
    return cached.balances;
  }
  
  try {
    const connection = new Connection(SOLANA_MAINNET_RPC, 'confirmed');
    
    const [sol, usdc, usdt] = await Promise.all([
      fetchSolBalance(connection, address),
      fetchMultipleMintBalances(connection, address, USDC_MINTS_MAINNET),
      fetchMultipleMintBalances(connection, address, USDT_MINTS_MAINNET),
    ]);
    
    const balances = { sol, usdc, usdt };
    
    // Update cache
    cachedBalances[address] = {
      balances,
      timestamp: now,
    };
    
    console.log('Fetched fresh balances for', address, balances);
    return balances;
  } catch (error: any) {
    console.error('Error fetching token balances:', error);
    
    // On rate limit, return cached data if available
    if (error?.message?.includes('429') && cached) {
      console.log('Rate limited, using cached balances');
      return cached.balances;
    }
    
    // Return cached data if available, otherwise zeros
    if (cached) {
      console.log('Returning stale cached balances due to error');
      return cached.balances;
    }
    
    return { sol: 0, usdc: 0, usdt: 0 };
  }
}
