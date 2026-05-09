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

function resolveQrPaymentUrl(): string {
  const explicitUrl = (process.env.MANTECA_QR_PAYMENT_URL ?? "").trim();
  if (explicitUrl) return explicitUrl;

  const baseUrl = requireEnv("MANTECA_API_BASE_URL").replace(/\/+$/, "");
  const path = (process.env.MANTECA_QR_PAYMENT_PATH ?? "/v2/synthetics/qr-payment").trim();
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function readJson(response: Response): Promise<JsonRecord> {
  const payload = await response.json().catch(() => ({}));
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as JsonRecord)
    : {};
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
