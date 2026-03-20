import { ChainType, getChainMetadata } from '@/constants/chains';
import { createPublicClient, formatEther, getAddress, http, isAddress, type Address } from 'viem';
import { avalanche } from 'viem/chains';

const BALANCE_CACHE_DURATION = 30 * 1000;

const cachedBalances: Record<string, { balance: number; timestamp: number }> = {};

function getAvalancheRpcUrl(): string {
  return (
    process.env.EXPO_PUBLIC_AVALANCHE_RPC ||
    getChainMetadata(ChainType.AVALANCHE).rpcUrl
  );
}

function getClient(chainType: ChainType) {
  if (chainType === ChainType.AVALANCHE) {
    return createPublicClient({
      chain: avalanche,
      transport: http(getAvalancheRpcUrl()),
    });
  }

  throw new Error(`Unsupported EVM chain: ${chainType}`);
}

export async function fetchNativeEvmBalance(
  chainType: ChainType,
  address: string,
  forceFresh: boolean = false
): Promise<number> {
  const normalizedInput = address.trim();
  if (!isAddress(normalizedInput)) {
    return 0;
  }

  const normalizedAddress = getAddress(normalizedInput);
  const cacheKey = `${chainType}:${normalizedAddress}`;
  const cached = cachedBalances[cacheKey];
  const now = Date.now();

  if (!forceFresh && cached && now - cached.timestamp < BALANCE_CACHE_DURATION) {
    return cached.balance;
  }

  try {
    const client = getClient(chainType);
    const balance = await client.getBalance({
      address: normalizedAddress as Address,
    });
    const formattedBalance = Number(formatEther(balance));

    cachedBalances[cacheKey] = {
      balance: formattedBalance,
      timestamp: now,
    };

    return formattedBalance;
  } catch (error) {
    console.error(`[EvmBalance] Failed to fetch ${chainType} balance`, error);

    if (cached) {
      return cached.balance;
    }

    return 0;
  }
}
