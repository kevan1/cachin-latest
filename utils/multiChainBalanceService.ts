/**
 * Service for aggregating balances across supported chains (Solana)
 */

import { ChainType } from '@/constants/chains';
import { fetchAllTokenBalances } from './balanceService';
import { fetchAvalancheBalances } from './evmBalanceService';
import { fetchTokenPrices } from './priceService';

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
  avalanche: ChainBalance | null;
  totalUsd: number;
}

/**
 * Fetch and aggregate balances from supported chains
 * Returns balances per chain and total USD value
 */
export async function fetchMultiChainBalances(
  solanaAddress: string | null,
  avalancheAddress: string | null,
  forceFresh: boolean = false
): Promise<MultiChainBalances> {
  // Fetch prices first
  const prices = await fetchTokenPrices(forceFresh);

  const solanaBalances = solanaAddress
    ? await fetchAllTokenBalances(solanaAddress, forceFresh)
    : null;
  const avalancheBalances = avalancheAddress
    ? await fetchAvalancheBalances(avalancheAddress, forceFresh)
    : null;

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

  let avalancheChainBalance: ChainBalance | null = null;
  if (avalancheBalances) {
    avalancheChainBalance = {
      chain: ChainType.AVALANCHE,
      nativeBalance: avalancheBalances.native,
      nativeSymbol: 'AVAX',
      usdcBalance: avalancheBalances.usdc,
      usdtBalance: 0,
      totalUsd: avalancheBalances.native * prices.avax + avalancheBalances.usdc * prices.usdc,
    };
  }

  const totalUsd =
    (solanaChainBalance?.totalUsd || 0) +
    (avalancheChainBalance?.totalUsd || 0);

  return {
    solana: solanaChainBalance,
    avalanche: avalancheChainBalance,
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
  }

  if (chainType === ChainType.AVALANCHE) {
    const avalancheBalances = await fetchAvalancheBalances(address, forceFresh);
    return {
      chain: ChainType.AVALANCHE,
      nativeBalance: avalancheBalances.native,
      nativeSymbol: 'AVAX',
      usdcBalance: avalancheBalances.usdc,
      usdtBalance: 0,
      totalUsd: avalancheBalances.native * prices.avax + avalancheBalances.usdc * prices.usdc,
    };
  }

  return null;
}
