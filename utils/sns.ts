import { Connection } from '@solana/web3.js';
import { resolve } from '@bonfida/spl-name-service';
import { getSolanaRpcUrl } from '@/utils/solanaRpc';

const SOL_TLD = '.sol';
const FALLBACK_RPC_URL = 'https://api.mainnet-beta.solana.com';

const getRpcCandidates = () => {
  const primary = getSolanaRpcUrl();
  if (primary === FALLBACK_RPC_URL) return [primary];
  return [primary, FALLBACK_RPC_URL];
};

export async function resolveSolanaDomain(domain: string): Promise<string | null> {
  const trimmed = domain.trim();
  if (!trimmed) return null;

  const normalized = trimmed.toLowerCase();
  if (!normalized.endsWith(SOL_TLD)) return null;

  let lastError: unknown = null;

  for (const rpcUrl of getRpcCandidates()) {
    try {
      const connection = new Connection(rpcUrl, 'confirmed');
      const pubkey = await resolve(connection, normalized);
      return pubkey?.toBase58() ?? null;
    } catch (error) {
      lastError = error;
    }
  }

  console.warn('[sns] Failed to resolve domain', normalized, lastError);
  return null;
}
