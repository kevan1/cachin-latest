import { PublicKey } from '@solana/web3.js';

export type QrScanResult =
  | { kind: 'cachinUser'; username: string; url: string }
  | { kind: 'solanaAddress'; address: string }
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
    // PublicKey ctor validates base58 and length.
    // eslint-disable-next-line no-new
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

export function parseQrScanData(raw: string): QrScanResult {
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

  const solanaAddress = tryParseSolanaAddress(text);
  if (solanaAddress) return { kind: 'solanaAddress', address: solanaAddress };

  return { kind: 'unknown', raw: text, reason: 'not_supported' };
}
