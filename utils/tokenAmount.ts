export function normalizeDecimalInput(value: string, maxDecimals: number): string {
  const cleaned = value.trim().replace(/,/g, '.').replace(/[^\d.]/g, '');
  if (!cleaned) return '';

  const dotIndex = cleaned.indexOf('.');
  if (dotIndex === -1) return cleaned;

  const integerRaw = cleaned.slice(0, dotIndex);
  const fractionalRaw = cleaned.slice(dotIndex + 1).replace(/\./g, '');
  const integerPart = integerRaw === '' ? '0' : integerRaw;
  const fractionalPart = fractionalRaw.slice(0, Math.max(0, maxDecimals));

  return fractionalPart.length > 0 ? `${integerPart}.${fractionalPart}` : `${integerPart}.`;
}

export function parseDecimalToUnits(value: string, decimals: number): bigint | null {
  const normalized = value.trim().replace(/,/g, '.');
  if (!normalized) return null;

  const match = normalized.match(/^(\d+)?(?:\.(\d*)?)?$/);
  if (!match) return null;

  const integerPart = match[1] ?? '0';
  const fractionalPart = match[2] ?? '';

  if (fractionalPart.length > decimals) return null;

  const base = 10n ** BigInt(decimals);
  const integerUnits = BigInt(integerPart) * base;
  const fractionalUnits =
    fractionalPart.length === 0 ? 0n : BigInt(fractionalPart.padEnd(decimals, '0'));

  return integerUnits + fractionalUnits;
}

export function formatTokenUnits(
  units: bigint,
  decimals: number,
  options?: {
    minFractionDigits?: number;
    maxFractionDigits?: number;
    trimTrailingZeros?: boolean;
  }
): string {
  const minFractionDigits = Math.max(0, options?.minFractionDigits ?? 0);
  const maxFractionDigits = Math.max(minFractionDigits, options?.maxFractionDigits ?? decimals);
  const trimTrailingZeros = options?.trimTrailingZeros ?? false;

  const negative = units < 0n;
  const absUnits = negative ? -units : units;

  const base = 10n ** BigInt(decimals);
  const integerPart = absUnits / base;
  const fractionalFull = (absUnits % base).toString().padStart(decimals, '0');

  let fractional = maxFractionDigits === 0 ? '' : fractionalFull.slice(0, maxFractionDigits);
  if (fractional.length < minFractionDigits) {
    fractional = fractional.padEnd(minFractionDigits, '0');
  }

  if (trimTrailingZeros && fractional.length > minFractionDigits) {
    fractional = fractional.replace(/0+$/, '');
    if (fractional.length < minFractionDigits) {
      fractional = fractional.padEnd(minFractionDigits, '0');
    }
  }

  const result = fractional.length > 0 ? `${integerPart.toString()}.${fractional}` : integerPart.toString();
  return negative ? `-${result}` : result;
}

