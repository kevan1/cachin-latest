/**
 * Chain types supported in the app
 */
export enum ChainType {
  SOLANA = 'solana',
  AVALANCHE = 'avalanche',
}

/**
 * Chain metadata interface
 */
export interface ChainMetadata {
  id: string;
  name: string;
  type: ChainType;
  chainId?: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrl: string;
  blockExplorer: string;
  testnet?: boolean;
}

/**
 * All supported chains metadata
 */
export const SUPPORTED_CHAINS: Record<ChainType, ChainMetadata> = {
  [ChainType.SOLANA]: {
    id: 'solana-mainnet',
    name: 'Solana',
    type: ChainType.SOLANA,
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9,
    },
    rpcUrl: 'https://solxar.mainnet.rpcpool.com/efba4db1-e231-40f6-a16f-6e24e8f72b5c',
    blockExplorer: 'https://explorer.solana.com',
  },
  [ChainType.AVALANCHE]: {
    id: 'avalanche-c-chain',
    name: 'Avalanche',
    type: ChainType.AVALANCHE,
    chainId: 43114,
    nativeCurrency: {
      name: 'Avalanche',
      symbol: 'AVAX',
      decimals: 18,
    },
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    blockExplorer: 'https://snowtrace.io',
  },
};

/**
 * Get chain metadata by type
 */
export function getChainMetadata(chainType: ChainType): ChainMetadata {
  return SUPPORTED_CHAINS[chainType];
}

/**
 * Get chain name by type
 */
export function getChainName(chainType: ChainType): string {
  return SUPPORTED_CHAINS[chainType].name;
}

/**
 * Get chain symbol by type
 */
export function getChainSymbol(chainType: ChainType): string {
  return SUPPORTED_CHAINS[chainType].nativeCurrency.symbol;
}

/**
 * Get block explorer URL for a transaction
 */
export function getExplorerUrl(chainType: ChainType, txHash: string): string {
  const chain = SUPPORTED_CHAINS[chainType];
  return `${chain.blockExplorer}/tx/${txHash}`;
}

/**
 * Get block explorer URL for an address
 */
export function getExplorerAddressUrl(chainType: ChainType, address: string): string {
  const chain = SUPPORTED_CHAINS[chainType];
  return `${chain.blockExplorer}/address/${address}`;
}

/**
 * Check if an address is valid for a given chain type
 */
export function isValidAddress(chainType: ChainType, address: string): boolean {
  if (chainType === ChainType.SOLANA) {
    // Solana addresses are base58 encoded and typically 32-44 characters.
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  if (chainType === ChainType.AVALANCHE) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  return false;
}
