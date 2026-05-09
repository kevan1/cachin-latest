import crypto from "crypto";

type JsonRecord = Record<string, unknown>;

const SUMSUB_API_BASE_URL = "https://api.sumsub.com";
const DEFAULT_CALLBACK_URL = "https://cachin.app/verification-result";
const DEFAULT_LINK_TTL_SECONDS = 30 * 60;

export class SumsubApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: JsonRecord;

  constructor(status: number, code: string, message: string, details?: JsonRecord) {
    super(message);
    this.name = "SumsubApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function asRecord(input: unknown): JsonRecord {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new SumsubApiError(400, "INVALID_BODY", "Request body must be a JSON object.");
  }
  return input as JsonRecord;
}

function optionalString(record: JsonRecord, key: string): string {
  const value = record[key];
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new SumsubApiError(400, "INVALID_FIELD", `Field ${key} must be a string.`);
  }
  return value.trim();
}

function requiredString(record: JsonRecord, key: string): string {
  const value = optionalString(record, key);
  if (!value) {
    throw new SumsubApiError(400, "MISSING_FIELD", `Missing required field: ${key}`);
  }
  return value;
}

function requireEnv(name: string): string {
  const value = (process.env[name] ?? "").trim();
  if (!value) {
    throw new SumsubApiError(
      503,
      "SUMSUB_NOT_CONFIGURED",
      `Missing required environment variable: ${name}.`
    );
  }
  return value;
}

function normalizeLinkTtl(raw: string): number {
  if (!raw) return DEFAULT_LINK_TTL_SECONDS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new SumsubApiError(
      503,
      "SUMSUB_NOT_CONFIGURED",
      "SUMSUB_WEBSDK_TTL must be a positive integer."
    );
  }
  return parsed;
}

function getCallbackBaseUrl(): URL {
  const explicit =
    (process.env.SUMSUB_CALLBACK_URL ?? process.env.EXPO_PUBLIC_SUMSUB_CALLBACK_URL ?? "").trim() ||
    DEFAULT_CALLBACK_URL;

  try {
    return new URL(explicit);
  } catch {
    throw new SumsubApiError(
      503,
      "SUMSUB_NOT_CONFIGURED",
      "SUMSUB_CALLBACK_URL must be a valid absolute URL."
    );
  }
}

function buildRedirectUrl(baseUrl: URL, status: "approved" | "error"): string {
  const url = new URL(baseUrl.toString());
  url.searchParams.set("status", status);
  return url.toString();
}

function signRequest(timestamp: string, method: string, pathWithQuery: string, body: string) {
  const secretKey = requireEnv("SUMSUB_SECRET_KEY");
  return crypto
    .createHmac("sha256", secretKey)
    .update(`${timestamp}${method}${pathWithQuery}${body}`)
    .digest("hex");
}

async function readJson(response: Response): Promise<JsonRecord> {
  const payload = await response.json().catch(() => ({}));
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as JsonRecord)
    : {};
}

function getErrorMessage(payload: JsonRecord, status: number): string {
  const candidates = [payload.description, payload.message, payload.errorName, payload.error];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return `Sumsub request failed with HTTP ${status}.`;
}

export async function createSumsubVerificationLink(input: unknown) {
  const body = asRecord(input);
  const userId = requiredString(body, "userId");

  const appToken = requireEnv("SUMSUB_APP_TOKEN");
  const levelName = requireEnv("SUMSUB_LEVEL_NAME");
  const ttlInSecs = normalizeLinkTtl((process.env.SUMSUB_WEBSDK_TTL ?? "").trim());
  const callbackBaseUrl = getCallbackBaseUrl();

  const requestBody = JSON.stringify({
    levelName,
    userId,
    ttlInSecs,
    redirect: {
      successUrl: buildRedirectUrl(callbackBaseUrl, "approved"),
      rejectUrl: buildRedirectUrl(callbackBaseUrl, "error"),
    },
  });

  const endpoint = new URL("/resources/sdkIntegrations/levels/-/websdkLink", SUMSUB_API_BASE_URL);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signRequest(timestamp, "POST", `${endpoint.pathname}${endpoint.search}`, requestBody);

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-App-Token": appToken,
      "X-App-Access-Ts": timestamp,
      "X-App-Access-Sig": signature,
    },
    body: requestBody,
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new SumsubApiError(
      response.status,
      "SUMSUB_REQUEST_FAILED",
      getErrorMessage(payload, response.status),
      payload
    );
  }

  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  if (!url) {
    throw new SumsubApiError(
      502,
      "SUMSUB_BAD_RESPONSE",
      "Sumsub did not return a verification URL.",
      payload
    );
  }

  return {
    ok: true,
    provider: "sumsub" as const,
    url,
    ttlInSecs,
    levelName,
    isSandbox: appToken.startsWith("sbx:"),
  };
}

export function toSumsubApiErrorPayload(error: unknown): {
  status: number;
  payload: JsonRecord;
} {
  if (error instanceof SumsubApiError) {
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
      error: error instanceof Error ? error.message : "Unknown Sumsub API error.",
      code: "SUMSUB_API_ERROR",
    },
  };
}
