import { Keypair, PublicKey } from '@solana/web3.js';

export const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

type SolanaPayKey = string | PublicKey;

type SolanaPayParams = {
  recipient: SolanaPayKey;
  amount?: string | number;
  splToken?: SolanaPayKey;
  references?: SolanaPayKey[];
  label?: string;
  message?: string;
  memo?: string;
};

export function createSolanaPayReferences(count: number = 1): PublicKey[] {
  const total = Math.max(1, Math.floor(count));
  return Array.from({ length: total }, () => Keypair.generate().publicKey);
}

export function buildSolanaPayUri({
  recipient,
  amount,
  splToken,
  references = [],
  label,
  message,
  memo,
}: SolanaPayParams): string {
  const recipientKey = typeof recipient === 'string' ? recipient : recipient.toBase58();
  const params = new URLSearchParams();

  if (amount !== undefined && amount !== null) {
    const amountString = String(amount).trim();
    if (amountString) {
      params.set('amount', amountString);
    }
  }

  if (splToken) {
    const tokenKey = typeof splToken === 'string' ? splToken : splToken.toBase58();
    params.set('spl-token', tokenKey);
  }

  references.forEach((reference) => {
    const referenceKey = typeof reference === 'string' ? reference : reference.toBase58();
    params.append('reference', referenceKey);
  });

  if (label) params.set('label', label);
  if (message) params.set('message', message);
  if (memo) params.set('memo', memo);

  const query = params.toString();
  return query ? `solana:${recipientKey}?${query}` : `solana:${recipientKey}`;
}
