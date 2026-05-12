import { ChainType, getChainMetadata } from '@/constants/chains';
import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
  type Address,
} from 'viem';
import { avalancheFuji } from 'viem/chains';

const BALANCE_CACHE_DURATION = 30 * 1000;

const cachedTokenBalances: Record<string, { balance: number; timestamp: number }> = {};

const erc20BalanceAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;

function getAvalancheRpcUrl(): string {
  return (
    process.env.EXPO_PUBLIC_AVALANCHE_RPC ||
    getChainMetadata(ChainType.AVALANCHE).rpcUrl
  );
}

function getClient(chainType: ChainType) {
  if (chainType === ChainType.AVALANCHE) {
    return createPublicClient({
      chain: avalancheFuji,
      transport: http(getAvalancheRpcUrl()),
    });
  }

  throw new Error(`Unsupported EVM chain: ${chainType}`);
}

export async function fetchErc20EvmBalance(
  chainType: ChainType,
  walletAddress: string,
  tokenAddress: string,
  decimals: number,
  forceFresh: boolean = false
): Promise<number> {
  const normalizedWallet = walletAddress.trim();
  const normalizedToken = tokenAddress.trim();

  if (!isAddress(normalizedWallet) || !isAddress(normalizedToken)) {
    return 0;
  }

  const wallet = getAddress(normalizedWallet);
  const token = getAddress(normalizedToken);
  const cacheKey = `${chainType}:${token}:${wallet}`;
  const cached = cachedTokenBalances[cacheKey];
  const now = Date.now();

  if (!forceFresh && cached && now - cached.timestamp < BALANCE_CACHE_DURATION) {
    return cached.balance;
  }

  try {
    const client = getClient(chainType);
    const balance = await client.readContract({
      address: token as Address,
      abi: erc20BalanceAbi,
      functionName: 'balanceOf',
      args: [wallet as Address],
    });
    const formattedBalance = Number(formatUnits(balance, decimals));

    cachedTokenBalances[cacheKey] = {
      balance: formattedBalance,
      timestamp: now,
    };

    return formattedBalance;
  } catch (error) {
    console.error(`[EvmBalance] Failed to fetch ${chainType} token balance`, error);

    if (cached) {
      return cached.balance;
    }

    return 0;
  }
}
