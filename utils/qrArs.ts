import { parseQR } from '@p2pdotme/sdk/qr-parsers';
import { extractEmvAmount } from '@/utils/emvQr';
import { fetchArsPrice } from '@/utils/priceService';

export interface ParsedArsQr {
  paymentAddress: string;
  amountFiat?: number;
  amountUsdc?: number;
  rateArsPerUsdc?: number;
}

// IMPORTANT: do NOT add a hardcoded fallback ARS/USDC rate here.
// If the live FX feed is unavailable, the QR parser MUST refuse to parse
// rather than silently using a wrong rate. Showing a stale or fake rate
// to a user about to pay is a trust-breaking failure mode.
// See: docs/proof/providers/rails-proof.md and the "No hidden FX" claim
// on the Cachin landing page.

export async function parseArgentineQr(raw: string): Promise<ParsedArsQr | null> {
  const qrData = raw.trim();
  if (!qrData) return null;

  try {
    const liveSellPrice = await fetchArsPrice();
    if (!Number.isFinite(liveSellPrice) || liveSellPrice <= 0) {
      // Live FX unavailable. Refuse to parse so the UI can prompt the user
      // to retry instead of presenting an incorrect rate.
      return null;
    }
    const sellPrice = liveSellPrice;

    const result = await parseQR({
      qrData,
      currency: 'ARS',
      sellPrice,
    });

    if (result.isErr()) return null;

    const paymentAddress = result.value.paymentAddress?.trim();
    if (!paymentAddress) return null;

    const fixedQrAmount = extractEmvAmount(qrData);
    const amountFiat = result.value.amount?.fiat ?? fixedQrAmount ?? undefined;
    const amountUsdc =
      result.value.amount?.usdc ??
      (typeof fixedQrAmount === 'number' && sellPrice > 0 ? fixedQrAmount / sellPrice : undefined);

    return {
      paymentAddress,
      amountFiat,
      amountUsdc,
      rateArsPerUsdc: sellPrice,
    };
  } catch {
    return null;
  }
}
