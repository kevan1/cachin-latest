export const DEFAULT_ARS_RATE = 1500;

export type PaymentConfirmationCurrency = "ARS" | "USD" | "USDC";

export type PrePaymentConfirmationInput = {
  amount: string | number;
  currency: PaymentConfirmationCurrency;
  destination: string;
  arsRate: number;
  feeArs?: string | number;
  discountArs?: string | number;
  amountUsdc?: string | number;
};

export type PrePaymentConfirmation = {
  destination: string;
  amountArs: number;
  amountUsdc: number;
  arsRate: number;
  feeArs: number;
  discountArs: number;
  finalTotalArs: number;
  finalTotalUsdc: number;
  display: {
    amount: string;
    amountSecondary: string;
    rate: string;
    fee: string;
    discount: string;
    finalTotal: string;
    finalTotalSecondary: string;
  };
};

function parsePositiveNumber(value: string | number | undefined): number {
  if (value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value.trim().replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function resolveRate(rate: number): number {
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_ARS_RATE;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatArs(value: number): string {
  return `ARS$${roundMoney(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatUsdc(value: number): string {
  return `$${roundMoney(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDC`;
}

export function buildPrePaymentConfirmation(
  input: PrePaymentConfirmationInput
): PrePaymentConfirmation {
  const arsRate = resolveRate(input.arsRate);
  const amount = parsePositiveNumber(input.amount);
  const scannedUsdcAmount = parsePositiveNumber(input.amountUsdc);
  const amountUsdc =
    scannedUsdcAmount > 0
      ? scannedUsdcAmount
      : input.currency === "ARS"
        ? amount / arsRate
        : amount;
  const amountArs = input.currency === "ARS" ? amount : amountUsdc * arsRate;
  const feeArs = parsePositiveNumber(input.feeArs);
  const discountArs = parsePositiveNumber(input.discountArs);
  const finalTotalArs = Math.max(0, amountArs + feeArs - discountArs);
  const finalTotalUsdc = finalTotalArs / arsRate;

  return {
    destination: input.destination.trim() || "Scanned QR merchant",
    amountArs,
    amountUsdc,
    arsRate,
    feeArs,
    discountArs,
    finalTotalArs,
    finalTotalUsdc,
    display: {
      amount: formatArs(amountArs),
      amountSecondary: formatUsdc(amountUsdc),
      rate: `1 USDC = ${formatArs(arsRate)}`,
      fee: formatArs(feeArs),
      discount: discountArs > 0 ? `-${formatArs(discountArs)}` : "None",
      finalTotal: formatArs(finalTotalArs),
      finalTotalSecondary: formatUsdc(finalTotalUsdc),
    },
  };
}
