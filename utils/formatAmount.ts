export function formatAmount(
  value: number,
  options?: {
    minFractionDigits?: number;
    maxFractionDigits?: number;
  }
): string {
  if (!Number.isFinite(value)) return "--";

  const minFractionDigits = Math.max(0, options?.minFractionDigits ?? 0);
  const maxFractionDigits = Math.max(
    minFractionDigits,
    options?.maxFractionDigits ?? 6
  );
  const normalizedValue = Object.is(value, -0) ? 0 : value;

  if (maxFractionDigits === 0) {
    const result = normalizedValue.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return result === "-0" ? "0" : result;
  }

  const fixed = normalizedValue.toLocaleString("en-US", {
    minimumFractionDigits: maxFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  });
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

  const result = fractional.length > 0 ? `${integerPart}.${fractional}` : integerPart;
  return /^-0(?:\.0+)?$/.test(result) ? result.slice(1) : result;
}
