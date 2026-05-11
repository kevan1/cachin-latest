import { parseQR } from '@p2pdotme/sdk/qr-parsers';
import { extractEmvAmount } from '@/utils/emvQr';
import { fetchArsPrice } from '@/utils/priceService';

export interface ParsedArsQr {
  paymentAddress: string;
  amountFiat?: number;
  amountUsdc?: number;
  rateArsPerUsdc?: number;
}

const FALLBACK_SELL_PRICE = 1;

export async function parseArgentineQr(raw: string): Promise<ParsedArsQr | null> {
  const qrData = raw.trim();
  if (!qrData) return null;

  try {
    const liveSellPrice = await fetchArsPrice();
    const sellPrice =
      Number.isFinite(liveSellPrice) && liveSellPrice > 0
        ? liveSellPrice
        : FALLBACK_SELL_PRICE;

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
