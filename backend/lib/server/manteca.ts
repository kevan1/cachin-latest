type JsonRecord = Record<string, unknown>;

export class MantecaApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: JsonRecord;

  constructor(status: number, code: string, message: string, details?: JsonRecord) {
    super(message);
    this.name = "MantecaApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function asRecord(input: unknown): JsonRecord {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new MantecaApiError(400, "INVALID_BODY", "Request body must be a JSON object.");
  }
  return input as JsonRecord;
}

function optionalString(record: JsonRecord, key: string): string {
  const value = record[key];
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new MantecaApiError(400, "INVALID_FIELD", `Field ${key} must be a string.`);
  }
  return value.trim();
}

function requiredString(record: JsonRecord, key: string): string {
  const value = optionalString(record, key);
  if (!value) {
    throw new MantecaApiError(400, "MISSING_FIELD", `Missing required field: ${key}`);
  }
  return value;
}

function requireEnv(name: string): string {
  const value = (process.env[name] ?? "").trim();
  if (!value) {
    throw new MantecaApiError(503, "MANTECA_NOT_CONFIGURED", `Missing ${name}.`);
  }
  return value;
}

function optionalEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

function resolveQrPaymentUrl(): string {
  const explicitUrl = optionalEnv("MANTECA_QR_PAYMENT_URL");
  if (explicitUrl) return explicitUrl;

  const baseUrl = requireEnv("MANTECA_API_BASE_URL").replace(/\/+$/, "");
  const path = optionalEnv("MANTECA_QR_PAYMENT_PATH") || "/v2/synthetics/qr-payment";
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function resolveQrQuoteUrl(): string | null {
  const explicitUrl = optionalEnv("MANTECA_QR_QUOTE_URL");
  if (explicitUrl) return explicitUrl;

  const path = optionalEnv("MANTECA_QR_QUOTE_PATH");
  if (!path) return null;

  const baseUrl = requireEnv("MANTECA_API_BASE_URL").replace(/\/+$/, "");
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function readJson(response: Response): Promise<JsonRecord> {
  const payload = await response.json().catch(() => ({}));
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as JsonRecord)
    : {};
}

function readNested(record: JsonRecord, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as JsonRecord)[key];
  }, record);
}

function numberCandidate(record: JsonRecord, paths: string[]): number | null {
  for (const path of paths) {
    const value = readNested(record, path);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.trim().replace(/,/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function stringCandidate(record: JsonRecord, paths: string[]): string | null {
  for (const path of paths) {
    const value = readNested(record, path);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function getExternalId(payload: JsonRecord): string | null {
  const candidates = [
    payload.id,
    payload.externalId,
    payload.syntheticId,
    payload.orderId,
    payload.uuid,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number" && Number.isFinite(candidate)) return String(candidate);
  }
  return null;
}

export function extractMantecaQrQuote(payload: JsonRecord) {
  return {
    amountFiat: numberCandidate(payload, [
      "amountFiat",
      "fiatAmount",
      "amountArs",
      "arsAmount",
      "amount.fiat",
      "amount.ars",
      "qr.amount",
      "quote.amountFiat",
      "quote.fiatAmount",
      "quote.amount.fiat",
      "total.amountFiat",
    ]),
    amountUsdc: numberCandidate(payload, [
      "amountUsdc",
      "usdcAmount",
      "amount.usdc",
      "quote.amountUsdc",
      "quote.usdcAmount",
      "quote.amount.usdc",
      "total.amountUsdc",
    ]),
    paymentAddress: stringCandidate(payload, [
      "paymentAddress",
      "merchantName",
      "merchant",
      "destination",
      "qr.paymentAddress",
      "qr.merchantName",
      "quote.paymentAddress",
      "quote.merchantName",
    ]),
    rateArsPerUsdc: numberCandidate(payload, [
      "rateArsPerUsdc",
      "arsRate",
      "fxRate",
      "exchangeRate",
      "rate",
      "quote.rateArsPerUsdc",
      "quote.arsRate",
      "quote.fxRate",
      "quote.exchangeRate",
    ]),
    feeArs: numberCandidate(payload, [
      "feeArs",
      "fee",
      "fees.ars",
      "quote.feeArs",
      "quote.fee",
      "quote.fees.ars",
    ]),
    discountArs: numberCandidate(payload, [
      "discountArs",
      "discount",
      "discounts.ars",
      "quote.discountArs",
      "quote.discount",
      "quote.discounts.ars",
    ]),
  };
}

export async function handleResolveMantecaQrQuote(input: unknown) {
  const body = asRecord(input);
  const qrData = requiredString(body, "qrData");
  const paymentAddress = optionalString(body, "paymentAddress");
  const method = optionalString(body, "method") || "mercadopago";
  const currency = optionalString(body, "currency").toUpperCase() || "ARS";

  if (!["ARS", "USD", "USDC"].includes(currency)) {
    throw new MantecaApiError(400, "INVALID_CURRENCY", "currency must be ARS, USD, or USDC.");
  }

  const endpoint = resolveQrQuoteUrl();
  if (!endpoint) {
    return {
      ok: true,
      provider: "manteca" as const,
      status: "requires_amount",
      nextAction: "ENTER_AMOUNT",
      amountFiat: null,
      amountUsdc: null,
      paymentAddress: paymentAddress || null,
      rateArsPerUsdc: null,
      feeArs: null,
      discountArs: null,
      reason: "MANTECA_QR_QUOTE_NOT_CONFIGURED",
    };
  }

  const apiKey = requireEnv("MANTECA_API_KEY");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      qrData,
      paymentAddress: paymentAddress || undefined,
      currency,
      method,
      metadata: {
        source: "cachin-qr-3",
        rail: "manteca",
        purpose: "quote",
      },
    }),
  });
  const payload = await readJson(response);

  if (!response.ok) {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.error === "string"
          ? payload.error
          : `Manteca quote request failed with HTTP ${response.status}.`;
    throw new MantecaApiError(response.status, "MANTECA_QUOTE_REQUEST_FAILED", message, payload);
  }

  const quote = extractMantecaQrQuote(payload);
  const resolvedAmountFiat = quote.amountFiat;

  return {
    ok: true,
    provider: "manteca" as const,
    status: resolvedAmountFiat ? "quoted" : "requires_amount",
    nextAction: resolvedAmountFiat ? "CONFIRM_PAYMENT" : "ENTER_AMOUNT",
    amountFiat: quote.amountFiat,
    amountUsdc: quote.amountUsdc,
    paymentAddress: quote.paymentAddress ?? (paymentAddress || null),
    rateArsPerUsdc: quote.rateArsPerUsdc,
    feeArs: quote.feeArs,
    discountArs: quote.discountArs,
    payload,
  };
}

export async function handleCreateMantecaQrPayment(input: unknown) {
  const body = asRecord(input);
  const userId = requiredString(body, "userId");
  const paymentAddress = requiredString(body, "paymentAddress");
  const amount = requiredString(body, "amount");
  const currency = requiredString(body, "currency").toUpperCase();
  const qrData = optionalString(body, "qrData");
  const method = optionalString(body, "method") || "mercadopago";

  if (!["ARS", "USD", "USDC"].includes(currency)) {
    throw new MantecaApiError(400, "INVALID_CURRENCY", "currency must be ARS, USD, or USDC.");
  }

  const apiKey = requireEnv("MANTECA_API_KEY");
  const endpoint = resolveQrPaymentUrl();
  const requestBody = {
    externalUserId: userId,
    qrData: qrData || undefined,
    paymentAddress,
    amount,
    currency,
    method,
    metadata: {
      source: "cachin-qr-3",
      rail: "manteca",
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "x-api-key": apiKey,
    },
    body: JSON.stringify(requestBody),
  });
  const payload = await readJson(response);

  if (!response.ok) {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.error === "string"
          ? payload.error
          : `Manteca request failed with HTTP ${response.status}.`;
    throw new MantecaApiError(response.status, "MANTECA_REQUEST_FAILED", message, payload);
  }

  return {
    ok: true,
    provider: "manteca" as const,
    status: typeof payload.status === "string" ? payload.status : "submitted",
    externalId: getExternalId(payload),
    nextAction: "POLL_MANTECA_STATUS_OR_CONFIRM_IN_DASHBOARD",
    payload,
  };
}

export function toMantecaApiErrorPayload(error: unknown): {
  status: number;
  payload: JsonRecord;
} {
  if (error instanceof MantecaApiError) {
    return {
      status: error.status,
      payload: {
        error: error.message,
        code: error.code,
        details: error.details,
      },
    };
  }

  return {
    status: 500,
    payload: {
      error: error instanceof Error ? error.message : "Unknown Manteca API error.",
      code: "MANTECA_API_ERROR",
    },
  };
}
