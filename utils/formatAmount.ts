export function formatAmount(
  value: number,
  options?: {
    minFractionDigits?: number;
    maxFractionDigits?: number;
  }
): string {
  if (!Number.isFinite(value)) return "0";

  const minFractionDigits = Math.max(0, options?.minFractionDigits ?? 0);
  const maxFractionDigits = Math.max(
    minFractionDigits,
    options?.maxFractionDigits ?? 6
  );

  if (maxFractionDigits === 0) {
    return value.toFixed(0);
  }

  const fixed = value.toFixed(maxFractionDigits);
  const [integerPart, fractionalRaw = ""] = fixed.split(".");

  let fractional = fractionalRaw;
  if (fractional.length > 0) {
    if (minFractionDigits === 0) {
      fractional = fractional.replace(/0+$/, "");
    } else {
      const trimmed = fractional.replace(/0+$/, "");
      fractional =
        trimmed.length < minFractionDigits
          ? trimmed.padEnd(minFractionDigits, "0")
          : trimmed;
    }
  }

  return fractional.length > 0 ? `${integerPart}.${fractional}` : integerPart;
}
