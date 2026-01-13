import { ChainType, getChainMetadata } from '@/constants/chains';

export function getSolanaRpcUrl(): string {
  return (
    process.env.EXPO_PUBLIC_SOLANA_RPC ||
    getChainMetadata(ChainType.SOLANA).rpcUrl
  );
}

