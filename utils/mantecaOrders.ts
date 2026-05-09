import { getApiBaseUrl } from "@/utils/privySponsorship";

export type CreateMantecaQrPaymentInput = {
  userId: string;
  qrData?: string;
  paymentAddress: string;
  amount: string;
  currency: "ARS" | "USD" | "USDC";
  method?: string;
};

export type CreateMantecaQrPaymentResponse = {
  ok: boolean;
  provider: "manteca";
  status: string;
  externalId?: string | null;
  nextAction: string;
  payload?: Record<string, unknown>;
};

function getRequiredApiBaseUrl(): string {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Missing EXPO_PUBLIC_API_URL (or app.json extra.apiUrl).");
  }
  return baseUrl;
}

export async function createMantecaQrPayment(
  input: CreateMantecaQrPaymentInput
): Promise<CreateMantecaQrPaymentResponse> {
  const baseUrl = getRequiredApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/manteca/qr-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : `HTTP ${response.status}`;
    const code =
      payload && typeof payload.code === "string" ? payload.code : "API_ERROR";
    throw new Error(`${message} [${code}]`);
  }

  return payload as CreateMantecaQrPaymentResponse;
}
