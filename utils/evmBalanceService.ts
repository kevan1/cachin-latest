/**
 * Service for fetching EVM token balances (Monad)
 */

import { createPublicClient, http, formatUnits, type Address } from 'viem';
import { monadTestnet } from '@/constants/chains';

// ERC-20 ABI for balanceOf
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Monad testnet token addresses (placeholders - update when actual addresses are known)
// These will be updated when Monad testnet has official USDC/USDT deployments
const MONAD_TOKENS = {
  // USDC and USDT addresses will be added when available on Monad testnet
  // usdc: '0x...' as Address,
  // usdt: '0x...' as Address,
};

export interface EvmTokenBalances {
  mon: number;
  usdc: number;
  usdt: number;
}

// Balance cache to reduce RPC calls
let cachedEvmBalances: { [address: string]: { balances: EvmTokenBalances; timestamp: number } } = {};
const EVM_BALANCE_CACHE_DURATION = 30 * 1000; // 30 seconds

// Create public client for Monad
const monadClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

/**
 * Fetch native MON balance for an address
 */
async function fetchMonBalance(address: Address): Promise<number> {
  try {
    const balance = await monadClient.getBalance({ address });
    return Number(formatUnits(balance, 18)); // MON has 18 decimals
  } catch (error) {
    console.error('Error fetching MON balance:', error);
    return 0;
  }
}

/**
 * Fetch ERC-20 token balance for an address
 */
async function fetchErc20Balance(
  walletAddress: Address,
  tokenAddress: Address,
  decimals: number = 6
): Promise<number> {
  try {
    const balance = await monadClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [walletAddress],
    });
    return Number(formatUnits(balance, decimals));
  } catch (error) {
    console.error('Error fetching ERC-20 balance:', error);
    return 0;
  }
}

/**
 * Fetch all EVM token balances (MON, USDC, USDT) for an address
 * Balances are cached for 30 seconds to avoid rate limiting
 */
export async function fetchEvmTokenBalances(
  address: string,
  forceFresh: boolean = false
): Promise<EvmTokenBalances> {
  // Validate EVM address format
  if (!address.startsWith('0x') || address.length !== 42) {
    console.error('Invalid EVM address format:', address);
    return { mon: 0, usdc: 0, usdt: 0 };
  }

  const evmAddress = address as Address;

  // Check cache first
  const now = Date.now();
  const cached = cachedEvmBalances[address];

  if (!forceFresh && cached && now - cached.timestamp < EVM_BALANCE_CACHE_DURATION) {
    console.log('Using cached EVM balances for', address);
    return cached.balances;
  }

  try {
    // Fetch MON balance
    const mon = await fetchMonBalance(evmAddress);

    // USDC and USDT are not yet deployed on Monad testnet
    // When they are, uncomment and update the addresses:
    // const [usdc, usdt] = await Promise.all([
    //   fetchErc20Balance(evmAddress, MONAD_TOKENS.usdc, 6),
    //   fetchErc20Balance(evmAddress, MONAD_TOKENS.usdt, 6),
    // ]);

    const balances: EvmTokenBalances = {
      mon,
      usdc: 0, // Will be updated when tokens are available
      usdt: 0, // Will be updated when tokens are available
    };

    // Update cache
    cachedEvmBalances[address] = {
      balances,
      timestamp: now,
    };

    console.log('Fetched fresh EVM balances for', address, balances);
    return balances;
  } catch (error: any) {
    console.error('Error fetching EVM token balances:', error);

    // On rate limit, return cached data if available
    if (error?.message?.includes('429') && cached) {
      console.log('Rate limited, using cached EVM balances');
      return cached.balances;
    }

    // Return cached data if available, otherwise zeros
    if (cached) {
      console.log('Returning stale cached EVM balances due to error');
      return cached.balances;
    }

    return { mon: 0, usdc: 0, usdt: 0 };
  }
}

/**
 * Clear the EVM balance cache
 */
export function clearEvmBalanceCache(): void {
  cachedEvmBalances = {};
}
