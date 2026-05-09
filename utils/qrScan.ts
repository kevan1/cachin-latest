import { PublicKey } from '@solana/web3.js';
import { parseArgentineQr } from '@/utils/qrArs';

export type QrScanResult =
  | { kind: 'cachinUser'; username: string; url: string }
  | {
      kind: 'solanaPay';
      address: string;
      amount?: string;
      splToken?: string;
      label?: string;
      message?: string;
      memo?: string;
    }
  | { kind: 'solanaAddress'; address: string }
  | {
      kind: 'arsMercadoPago';
      paymentAddress: string;
      amountFiat?: number;
      amountUsdc?: number;
    }
  | { kind: 'unknown'; raw: string; reason: 'empty' | 'not_supported' };

const CACHIN_HOST = 'cachin.app';
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function normalizeHost(host: string) {
  return host.toLowerCase().replace(/^www\./, '');
}

function normalizeUsername(candidate: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return null;
  }
  decoded = decoded.trim().replace(/^@/, '').toLowerCase();
  if (!USERNAME_RE.test(decoded)) return null;
  return decoded;
}

function tryParseCachinUsername(raw: string) {
  const text = raw.trim();
  if (!text) return null;

  const candidates: string[] = [text];
  if (!text.includes('://') && (text.toLowerCase().startsWith('cachin.app/') || text.toLowerCase().startsWith('www.cachin.app/'))) {
    candidates.push(`https://${text}`);
  }

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (normalizeHost(url.host) !== CACHIN_HOST) continue;

      const pathname = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
      if (!pathname || pathname.includes('/')) continue;

      return normalizeUsername(pathname);
    } catch {
      // ignore
    }
  }

  return null;
}

function isValidSolanaAddress(address: string) {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

function tryParseSolanaAddress(raw: string) {
  const text = raw.trim();
  if (!text) return null;

  // Solana Pay-style: solana:<address>[?...]
  if (text.toLowerCase().startsWith('solana:')) {
    const withoutScheme = text.slice('solana:'.length).replace(/^\/+/, '');
    const address = withoutScheme.split('?')[0]?.trim() ?? '';
    return isValidSolanaAddress(address) ? address : null;
  }

  return isValidSolanaAddress(text) ? text : null;
}

function tryParseSolanaPay(raw: string) {
  const text = raw.trim();
  if (!text) return null;
  if (!text.toLowerCase().startsWith('solana:')) return null;

  const withoutScheme = text.slice('solana:'.length).replace(/^\/+/, '');
  const [addressPart, queryPartRaw] = withoutScheme.split('?', 2);
  const address = (addressPart ?? '').trim();
  if (!isValidSolanaAddress(address)) return null;

  const queryPart = (queryPartRaw ?? '').trim();
  if (!queryPart) return null;

  const params = new URLSearchParams(queryPart);
  const amount = params.get('amount')?.trim() || undefined;
  const splToken = params.get('spl-token')?.trim() || undefined;
  const label = params.get('label')?.trim() || undefined;
  const message = params.get('message')?.trim() || undefined;
  const memo = params.get('memo')?.trim() || undefined;

  // If it doesn't look like a Solana Pay request, don't treat it as one.
  if (!amount && !splToken && !label && !message && !memo) return null;

  return { address, amount, splToken, label, message, memo };
}

export async function parseQrScanData(raw: string): Promise<QrScanResult> {
  const text = raw.trim();
  if (!text) return { kind: 'unknown', raw, reason: 'empty' };

  const cachinUsername = tryParseCachinUsername(text);
  if (cachinUsername) {
    return {
      kind: 'cachinUser',
      username: cachinUsername,
      url: `https://${CACHIN_HOST}/${cachinUsername}`,
    };
  }

  const solanaPay = tryParseSolanaPay(text);
  if (solanaPay) return { kind: 'solanaPay', ...solanaPay };

  const solanaAddress = tryParseSolanaAddress(text);
  if (solanaAddress) return { kind: 'solanaAddress', address: solanaAddress };

  const arsQr = await parseArgentineQr(text);
  if (arsQr) {
    return {
      kind: 'arsMercadoPago',
      paymentAddress: arsQr.paymentAddress,
      amountFiat: arsQr.amountFiat,
      amountUsdc: arsQr.amountUsdc,
    };
  }

  return { kind: 'unknown', raw: text, reason: 'not_supported' };
}
