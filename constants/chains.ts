import { defineChain } from 'viem';

/**
 * Chain types supported in the app
 */
export enum ChainType {
  SOLANA = 'solana',
  MONAD = 'monad',
}

/**
 * Chain metadata interface
 */
export interface ChainMetadata {
  id: string;
  name: string;
  type: ChainType;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrl: string;
  blockExplorer: string;
  chainId?: number; // For EVM chains
  testnet?: boolean;
}

/**
 * Monad Testnet Chain Configuration
 * Using viem's defineChain for EVM compatibility
 */
export const monadTestnet = defineChain({
  id: 41454,
  name: 'Monad Testnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://testnet.monad.xyz'],
    },
    public: {
      http: ['https://testnet.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://explorer.testnet.monad.xyz',
    },
  },
  testnet: true,
});

/**
 * Monad Mainnet Chain Configuration (placeholder for when mainnet launches)
 */
export const monadMainnet = defineChain({
  id: 10001, // Placeholder - update when mainnet launches
  name: 'Monad',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://mainnet.monad.xyz'], // Placeholder
    },
    public: {
      http: ['https://mainnet.monad.xyz'], // Placeholder
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://explorer.monad.xyz',
    },
  },
  testnet: false,
});

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
  [ChainType.MONAD]: {
    id: 'monad-testnet',
    name: 'Monad Testnet',
    type: ChainType.MONAD,
    nativeCurrency: {
      name: 'Monad',
      symbol: 'MON',
      decimals: 18,
    },
    rpcUrl: 'https://testnet.monad.xyz',
    blockExplorer: 'https://explorer.testnet.monad.xyz',
    chainId: 41454,
    testnet: true,
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
  if (chainType === ChainType.SOLANA) {
    return `${chain.blockExplorer}/tx/${txHash}`;
  } else {
    return `${chain.blockExplorer}/tx/${txHash}`;
  }
}

/**
 * Get block explorer URL for an address
 */
export function getExplorerAddressUrl(chainType: ChainType, address: string): string {
  const chain = SUPPORTED_CHAINS[chainType];
  if (chainType === ChainType.SOLANA) {
    return `${chain.blockExplorer}/address/${address}`;
  } else {
    return `${chain.blockExplorer}/address/${address}`;
  }
}

/**
 * Check if an address is valid for a given chain type
 */
export function isValidAddress(chainType: ChainType, address: string): boolean {
  if (chainType === ChainType.SOLANA) {
    // Solana addresses are base58 encoded and typically 32-44 characters
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  } else {
    // EVM addresses are 0x followed by 40 hex characters
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}
