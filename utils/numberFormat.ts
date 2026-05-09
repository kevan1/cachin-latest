export type NumberFormatType =
  | "fiat_value"
  | "stable_value"
  | "token_amount"
  | "token_price"
  | "percent"
  | "ratio";

export type NumberFormatContext = "compact" | "detailed";
export type NumberSignMode = "auto" | "always" | "never";

export type NumberFormatOptions = {
  type: NumberFormatType;
  context?: NumberFormatContext;
  tokenPriceUsd?: number;
  tokenDecimals?: number;
  sign?: NumberSignMode;
  currencyPrefix?: string;
};

export type NumberFormatResult = {
  display: string;
  raw: string;
  ariaLabel: string;
  isTiny: boolean;
  isSubscript: boolean;
};

type NumericInput = number | string | bigint | null | undefined;

const PLACEHOLDER = "--";
const SUBSCRIPT_DIGITS: Record<string, string> = {
  "0": "\u2080",
  "1": "\u2081",
  "2": "\u2082",
  "3": "\u2083",
  "4": "\u2084",
  "5": "\u2085",
  "6": "\u2086",
  "7": "\u2087",
  "8": "\u2088",
  "9": "\u2089",
};
const SUFFIXES = [
  { threshold: 1e12, suffix: "T" },
  { threshold: 1e9, suffix: "B" },
  { threshold: 1e6, suffix: "M" },
  { threshold: 1e3, suffix: "K" },
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function parseNumericInput(value: NumericInput): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function expandExponential(value: string): string {
  if (!/[eE]/.test(value)) return value;

  const [mantissaRaw, exponentRaw] = value.toLowerCase().split("e");
  const exponent = Number.parseInt(exponentRaw ?? "0", 10);
  if (!Number.isFinite(exponent)) return value;

  const negative = mantissaRaw.startsWith("-");
  const mantissa = negative ? mantissaRaw.slice(1) : mantissaRaw;
  const [integer = "0", fraction = ""] = mantissa.split(".");
  const digits = `${integer}${fraction}`;
  const decimalIndex = integer.length + exponent;

  if (decimalIndex <= 0) {
    return `${negative ? "-" : ""}0.${"0".repeat(Math.abs(decimalIndex))}${digits}`
      .replace(/\.?0+$/, "")
      .replace(/\.$/, "");
  }

  if (decimalIndex >= digits.length) {
    return `${negative ? "-" : ""}${digits}${"0".repeat(decimalIndex - digits.length)}`;
  }

  return `${negative ? "-" : ""}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`
    .replace(/\.?0+$/, "")
    .replace(/\.$/, "");
}

export function toDecimalString(value: NumericInput): string {
  const parsed = parseNumericInput(value);
  if (parsed === null) return "";
  if (Object.is(parsed, -0) || parsed === 0) return "0";

  return expandExponential(parsed.toString());
}

function formatFixed(abs: number, fractionDigits: number): string {
  return abs.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function trimFixed(abs: number, fractionDigits: number): string {
  const fixed = formatFixed(abs, fractionDigits);
  if (!fixed.includes(".")) return fixed;
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function abbreviate(abs: number, context: NumberFormatContext): string | null {
  for (const { threshold, suffix } of SUFFIXES) {
    if (abs >= threshold) {
      const decimals = context === "compact" ? 1 : 2;
      const formatted = trimFixed(abs / threshold, decimals);
      return `${formatted}${suffix}`;
    }
  }

  return null;
}

function countLeadingZeros(abs: number): number {
  if (abs >= 1 || abs <= 0) return 0;

  const decimal = expandExponential(abs.toString());
  const afterDot = decimal.split(".")[1] ?? "";
  let count = 0;

  for (const char of afterDot) {
    if (char !== "0") break;
    count += 1;
  }

  return count;
}

function formatWithSubscript(abs: number, negative: boolean, sigDigits: number) {
  const leadingZeros = countLeadingZeros(abs);
  const totalDecimals = leadingZeros + sigDigits;
  const rounded = Number(abs.toFixed(totalDecimals));
  const fixed = rounded.toFixed(totalDecimals);
  const afterDot = fixed.split(".")[1] ?? "";
  const sigStr = afterDot.slice(leadingZeros, leadingZeros + sigDigits);
  const subscript = String(leadingZeros)
    .split("")
    .map((digit) => SUBSCRIPT_DIGITS[digit] ?? digit)
    .join("");
  const sign = negative ? "-" : "";

  return {
    display: `${sign}0.0${subscript}${sigStr}`,
    ariaLabel: `${sign}${fixed}`,
  };
}

function applySign(body: string, negative: boolean, signMode: NumberSignMode = "auto") {
  if (signMode === "never") return body;
  if (negative) return `-${body}`;
  if (signMode === "always") return `+${body}`;
  return body;
}

function formatZero(options: Required<Pick<NumberFormatOptions, "type">> & NumberFormatOptions): NumberFormatResult {
  const prefix = options.currencyPrefix ?? "$";
  const zeroMap: Record<NumberFormatType, string> = {
    fiat_value: `${prefix}0.00`,
    stable_value: `${prefix}0.00`,
    token_amount: "0",
    token_price: `${prefix}0.00`,
    percent: "0.00%",
    ratio: "0x",
  };
  const display = zeroMap[options.type];

  return {
    display,
    raw: "0",
    ariaLabel: display,
    isTiny: false,
    isSubscript: false,
  };
}

function invalidResult(): NumberFormatResult {
  return {
    display: PLACEHOLDER,
    raw: "",
    ariaLabel: "no data",
    isTiny: false,
    isSubscript: false,
  };
}

function tinyResult(
  body: string,
  negative: boolean,
  options: NumberFormatOptions,
  raw: string
): NumberFormatResult {
  const display = applySign(body, negative, options.sign);
  return {
    display,
    raw,
    ariaLabel: display,
    isTiny: true,
    isSubscript: false,
  };
}

function formatFiat(
  abs: number,
  negative: boolean,
  options: NumberFormatOptions,
  raw: string
): NumberFormatResult {
  const context = options.context ?? "compact";
  const prefix = options.currencyPrefix ?? "$";

  if (abs < 0.01) {
    return tinyResult(`<${prefix}0.01`, negative, options, raw);
  }

  const abbreviated = context === "compact" ? abbreviate(abs, context) : null;
  const body = `${prefix}${abbreviated ?? formatFixed(abs, 2)}`;
  const display = applySign(body, negative, options.sign);

  return {
    display,
    raw,
    ariaLabel: display,
    isTiny: false,
    isSubscript: false,
  };
}

function getTokenAmountDecimals(options: NumberFormatOptions): number {
  const context = options.context ?? "compact";
  const fallback = 4;
  const price = options.tokenPriceUsd;
  const maxByContext = context === "compact" ? 6 : 12;
  const maxDecimals =
    typeof options.tokenDecimals === "number"
      ? clamp(Math.trunc(options.tokenDecimals), 0, maxByContext)
      : maxByContext;

  if (!Number.isFinite(price) || !price || price <= 0) {
    return clamp(fallback, 0, maxDecimals);
  }

  const threshold = context === "compact" ? 0.01 : 0.0001;
  const decimals = Math.ceil(-Math.log10(threshold / price));
  return clamp(decimals, 0, maxDecimals);
}

function formatTokenAmount(
  abs: number,
  negative: boolean,
  options: NumberFormatOptions,
  raw: string
): NumberFormatResult {
  const context = options.context ?? "compact";
  const decimals = getTokenAmountDecimals(options);
  const rounded = Number(abs.toFixed(decimals));

  if (rounded === 0) {
    const minDisplay =
      context === "compact" ? "<0.001" : `<${(1 / 10 ** decimals).toFixed(decimals)}`;
    return tinyResult(minDisplay, negative, options, raw);
  }

  const leadingZeros = countLeadingZeros(abs);

  if (leadingZeros >= 3) {
    const formatted = formatWithSubscript(abs, negative, context === "compact" ? 2 : 4);
    return {
      display:
        options.sign === "never" && formatted.display.startsWith("-")
          ? formatted.display.slice(1)
          : options.sign === "always" && !negative
            ? `+${formatted.display}`
            : formatted.display,
      raw,
      ariaLabel: formatted.ariaLabel,
      isTiny: false,
      isSubscript: true,
    };
  }

  const abbreviated =
    context === "compact" && abs >= 1000 ? abbreviate(abs, context) : null;
  if (abbreviated) {
    const display = applySign(abbreviated, negative, options.sign);
    return {
      display,
      raw,
      ariaLabel: display,
      isTiny: false,
      isSubscript: false,
    };
  }

  const body = trimFixed(rounded, decimals);
  const display = applySign(body, negative, options.sign);

  return {
    display,
    raw,
    ariaLabel: display,
    isTiny: false,
    isSubscript: false,
  };
}

function formatTokenPrice(
  abs: number,
  negative: boolean,
  options: NumberFormatOptions,
  raw: string
): NumberFormatResult {
  const context = options.context ?? "compact";
  const prefix = options.currencyPrefix ?? "$";
  const leadingZeros = countLeadingZeros(abs);

  if (abs < 0.01 && leadingZeros < 3) {
    return tinyResult(`<${prefix}0.01`, negative, options, raw);
  }

  if (leadingZeros >= 3) {
    const formatted = formatWithSubscript(abs, negative, context === "compact" ? 2 : 4);
    const body = `${prefix}${formatted.display.replace(/^-/, "")}`;
    const display = applySign(body, negative, options.sign);
    return {
      display,
      raw,
      ariaLabel: `${prefix}${formatted.ariaLabel.replace(/^-/, "")}`,
      isTiny: false,
      isSubscript: true,
    };
  }

  let body: string;
  if (abs >= 1000) {
    body = `${prefix}${formatFixed(abs, 2)}`;
  } else if (abs >= 100) {
    body = `${prefix}${context === "compact" ? formatFixed(abs, 0) : formatFixed(abs, 2)}`;
  } else if (abs >= 1) {
    body = `${prefix}${context === "compact" ? trimFixed(abs, 1) : trimFixed(abs, 3)}`;
  } else {
    body = `${prefix}${context === "compact" ? trimFixed(abs, 8) : formatFixed(abs, 5)}`;
  }

  const display = applySign(body, negative, options.sign);
  return {
    display,
    raw,
    ariaLabel: display,
    isTiny: false,
    isSubscript: false,
  };
}

function formatPercent(
  abs: number,
  negative: boolean,
  options: NumberFormatOptions,
  raw: string
): NumberFormatResult {
  if (abs < 0.01) {
    return tinyResult("<0.01%", negative, options, raw);
  }

  const decimals = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  const body = `${formatFixed(abs, decimals)}%`;
  const display = applySign(body, negative, options.sign);

  return {
    display,
    raw,
    ariaLabel: display,
    isTiny: false,
    isSubscript: false,
  };
}

function formatRatio(
  abs: number,
  negative: boolean,
  options: NumberFormatOptions,
  raw: string
): NumberFormatResult {
  if (abs < 0.01) {
    return tinyResult("<0.01x", negative, options, raw);
  }

  const body = `${trimFixed(abs, 2)}x`;
  const display = applySign(body, negative, options.sign);

  return {
    display,
    raw,
    ariaLabel: display,
    isTiny: false,
    isSubscript: false,
  };
}

export function formatNumber(
  value: NumericInput,
  options: NumberFormatOptions
): NumberFormatResult {
  const parsed = parseNumericInput(value);
  if (parsed === null) return invalidResult();

  const valueWithoutSignedZero = Object.is(parsed, -0) ? 0 : parsed;
  const raw = toDecimalString(valueWithoutSignedZero);
  const abs = Math.abs(valueWithoutSignedZero);
  const negative = valueWithoutSignedZero < 0;

  if (abs === 0) {
    return formatZero({ ...options, type: options.type });
  }

  switch (options.type) {
    case "fiat_value":
    case "stable_value":
      return formatFiat(abs, negative, options, raw);
    case "token_amount":
      return formatTokenAmount(abs, negative, options, raw);
    case "token_price":
      return formatTokenPrice(abs, negative, options, raw);
    case "percent":
      return formatPercent(abs, negative, options, raw);
    case "ratio":
      return formatRatio(abs, negative, options, raw);
  }
}

export function formatFiatValue(
  value: NumericInput,
  options?: {
    context?: NumberFormatContext;
    currencyPrefix?: string;
    sign?: NumberSignMode;
  }
) {
  return formatNumber(value, {
    type: "fiat_value",
    context: options?.context ?? "compact",
    currencyPrefix: options?.currencyPrefix ?? "$",
    sign: options?.sign,
  }).display;
}

export function formatStableValue(
  value: NumericInput,
  options?: {
    context?: NumberFormatContext;
    currencyPrefix?: string;
    sign?: NumberSignMode;
  }
) {
  return formatNumber(value, {
    type: "stable_value",
    context: options?.context ?? "compact",
    currencyPrefix: options?.currencyPrefix ?? "$",
    sign: options?.sign,
  }).display;
}

export function formatTokenAmountDisplay(
  value: NumericInput,
  options?: {
    context?: NumberFormatContext;
    tokenPriceUsd?: number;
    tokenDecimals?: number;
    sign?: NumberSignMode;
  }
) {
  return formatNumber(value, {
    type: "token_amount",
    context: options?.context ?? "detailed",
    tokenPriceUsd: options?.tokenPriceUsd,
    tokenDecimals: options?.tokenDecimals,
    sign: options?.sign,
  }).display;
}

export function formatTokenUnitsForDisplay(
  units: bigint,
  decimals: number,
  options?: {
    context?: NumberFormatContext;
    tokenPriceUsd?: number;
    sign?: NumberSignMode;
  }
) {
  const negative = units < 0n;
  const absUnits = negative ? -units : units;
  const base = 10n ** BigInt(decimals);
  const integerPart = absUnits / base;
  const fractionalPart = (absUnits % base).toString().padStart(decimals, "0");
  const raw =
    decimals === 0
      ? integerPart.toString()
      : `${integerPart.toString()}.${fractionalPart}`.replace(/\.?0+$/, "");

  return formatTokenAmountDisplay(`${negative ? "-" : ""}${raw}`, {
    context: options?.context ?? "detailed",
    tokenPriceUsd: options?.tokenPriceUsd,
    tokenDecimals: decimals,
    sign: options?.sign,
  });
}

export function formatDecimalForInput(value: number, maxFractionDigits: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";

  const fixed = value.toFixed(Math.max(0, maxFractionDigits));
  return fixed.replace(/\.?0+$/, "");
}
