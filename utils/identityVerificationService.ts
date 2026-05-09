import { getApiBaseUrl } from "@/utils/privySponsorship";

export type IdentityVerificationLinkResponse = {
  ok: boolean;
  provider: "sumsub";
  url: string;
  ttlInSecs: number;
  levelName: string;
  isSandbox: boolean;
};

type CreateIdentityVerificationLinkInput = {
  userId: string;
};

export async function createIdentityVerificationLink({
  userId,
}: CreateIdentityVerificationLinkInput): Promise<IdentityVerificationLinkResponse> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Missing EXPO_PUBLIC_API_URL (or app.json extra.apiUrl).");
  }

  const response = await fetch(`${baseUrl}/api/identity-verification-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
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

  return payload as IdentityVerificationLinkResponse;
}
