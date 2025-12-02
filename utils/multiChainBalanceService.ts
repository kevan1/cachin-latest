/**
 * Service for aggregating balances across multiple chains (Solana and Monad)
 */

import { ChainType } from '@/constants/chains';
import { fetchAllTokenBalances, TokenBalances } from './balanceService';
import { fetchEvmTokenBalances, EvmTokenBalances } from './evmBalanceService';
import { fetchTokenPrices, TokenPrices } from './priceService';

export interface ChainBalance {
  chain: ChainType;
  nativeBalance: number;
  nativeSymbol: string;
  usdcBalance: number;
  usdtBalance: number;
  totalUsd: number;
}

export interface MultiChainBalances {
  solana: ChainBalance | null;
  monad: ChainBalance | null;
  totalUsd: number;
}

/**
 * Fetch and aggregate balances from both Solana and Monad
 * Returns balances per chain and total USD value
 */
export async function fetchMultiChainBalances(
  solanaAddress: string | null,
  evmAddress: string | null,
  forceFresh: boolean = false
): Promise<MultiChainBalances> {
  // Fetch prices first (shared between chains)
  const prices = await fetchTokenPrices(forceFresh);

  // Fetch balances in parallel
  const [solanaBalances, evmBalances] = await Promise.all([
    solanaAddress ? fetchAllTokenBalances(solanaAddress, forceFresh) : null,
    evmAddress ? fetchEvmTokenBalances(evmAddress, forceFresh) : null,
  ]);

  // Calculate Solana chain balance
  let solanaChainBalance: ChainBalance | null = null;
  if (solanaBalances) {
    const solanaUsd =
      solanaBalances.sol * prices.sol +
      solanaBalances.usdc * prices.usdc +
      solanaBalances.usdt * prices.usdt;

    solanaChainBalance = {
      chain: ChainType.SOLANA,
      nativeBalance: solanaBalances.sol,
      nativeSymbol: 'SOL',
      usdcBalance: solanaBalances.usdc,
      usdtBalance: solanaBalances.usdt,
      totalUsd: solanaUsd,
    };
  }

  // Calculate Monad chain balance
  let monadChainBalance: ChainBalance | null = null;
  if (evmBalances) {
    // For MON price, we'll use a placeholder until it's on CoinGecko
    // TODO: Add MON price fetching when available
    const monPrice = prices.mon || 0;
    const monadUsd =
      evmBalances.mon * monPrice +
      evmBalances.usdc * prices.usdc +
      evmBalances.usdt * prices.usdt;

    monadChainBalance = {
      chain: ChainType.MONAD,
      nativeBalance: evmBalances.mon,
      nativeSymbol: 'MON',
      usdcBalance: evmBalances.usdc,
      usdtBalance: evmBalances.usdt,
      totalUsd: monadUsd,
    };
  }

  // Calculate total USD across all chains
  const totalUsd =
    (solanaChainBalance?.totalUsd || 0) + (monadChainBalance?.totalUsd || 0);

  return {
    solana: solanaChainBalance,
    monad: monadChainBalance,
    totalUsd,
  };
}

/**
 * Get balance for a specific chain
 */
export async function fetchChainBalance(
  chainType: ChainType,
  address: string,
  forceFresh: boolean = false
): Promise<ChainBalance | null> {
  const prices = await fetchTokenPrices(forceFresh);

  if (chainType === ChainType.SOLANA) {
    const balances = await fetchAllTokenBalances(address, forceFresh);
    const totalUsd =
      balances.sol * prices.sol +
      balances.usdc * prices.usdc +
      balances.usdt * prices.usdt;

    return {
      chain: ChainType.SOLANA,
      nativeBalance: balances.sol,
      nativeSymbol: 'SOL',
      usdcBalance: balances.usdc,
      usdtBalance: balances.usdt,
      totalUsd,
    };
  } else if (chainType === ChainType.MONAD) {
    const balances = await fetchEvmTokenBalances(address, forceFresh);
    const monPrice = prices.mon || 0;
    const totalUsd =
      balances.mon * monPrice +
      balances.usdc * prices.usdc +
      balances.usdt * prices.usdt;

    return {
      chain: ChainType.MONAD,
      nativeBalance: balances.mon,
      nativeSymbol: 'MON',
      usdcBalance: balances.usdc,
      usdtBalance: balances.usdt,
      totalUsd,
    };
  }

  return null;
}
