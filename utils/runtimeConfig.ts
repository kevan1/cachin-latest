import Constants from "expo-constants";

type ExtraConfig = Record<string, unknown>;
type ManifestLike = { extra?: ExtraConfig | null } | null | undefined;
type ConstantsWithLegacyManifests = typeof Constants & {
  manifest?: ManifestLike;
  manifest2?: ManifestLike;
};

const constantsWithLegacyManifests = Constants as ConstantsWithLegacyManifests;
const DEFAULT_PRIVY_EXPORT_PAGE_URL = "https://export.cachin.app";

function asRecord(value: unknown): ExtraConfig {
  if (value && typeof value === "object") {
    return value as ExtraConfig;
  }
  return {};
}

function normalizeValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/^['"]|['"]$/g, "");
  return normalized.length > 0 ? normalized : null;
}

function pickFirstNonEmpty(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = normalizeValue(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function getRuntimeExtras() {
  const expoExtra = asRecord(Constants.expoConfig?.extra);
  const manifestExtra = asRecord(constantsWithLegacyManifests.manifest?.extra);
  const manifest2Extra = asRecord(constantsWithLegacyManifests.manifest2?.extra);
  const manifest2ExpoClientExtra = asRecord(asRecord(manifest2Extra.expoClient).extra);

  return {
    expoExtra,
    manifestExtra,
    manifest2Extra,
    manifest2ExpoClientExtra,
  };
}

function normalizeOrigin(input: string): string | null {
  try {
    const url = new URL(input);
    return url.origin;
  } catch {
    return null;
  }
}

function normalizeOriginFromDomainOrUrl(input: string): string | null {
  const direct = normalizeOrigin(input);
  if (direct) {
    return direct;
  }

  const guessed = normalizeOrigin(`https://${input}`);
  if (guessed) {
    return guessed;
  }

  return null;
}

function normalizeUrlWithPath(input: string): string | null {
  try {
    const url = new URL(input);
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeUrlWithOptionalScheme(input: string): string | null {
  return normalizeUrlWithPath(input) ?? normalizeUrlWithPath(`https://${input}`);
}

export function getPrivyAppId(): string | null {
  const { expoExtra, manifestExtra, manifest2Extra, manifest2ExpoClientExtra } =
    getRuntimeExtras();

  return pickFirstNonEmpty(
    process.env.EXPO_PUBLIC_PRIVY_APP_ID,
    process.env.PRIVY_APP_ID,
    expoExtra.privyAppId,
    manifestExtra.privyAppId,
    manifest2Extra.privyAppId,
    manifest2ExpoClientExtra.privyAppId
  );
}

export function getPrivyClientId(): string | null {
  const { expoExtra, manifestExtra, manifest2Extra, manifest2ExpoClientExtra } =
    getRuntimeExtras();

  return pickFirstNonEmpty(
    process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID,
    expoExtra.privyClientId,
    manifestExtra.privyClientId,
    manifest2Extra.privyClientId,
    manifest2ExpoClientExtra.privyClientId
  );
}

export function getPrivyExportClientId(): string | null {
  const { expoExtra, manifestExtra, manifest2Extra, manifest2ExpoClientExtra } =
    getRuntimeExtras();

  return pickFirstNonEmpty(
    process.env.EXPO_PUBLIC_PRIVY_EXPORT_CLIENT_ID,
    process.env.PRIVY_EXPORT_CLIENT_ID,
    expoExtra.privyExportClientId,
    manifestExtra.privyExportClientId,
    manifest2Extra.privyExportClientId,
    manifest2ExpoClientExtra.privyExportClientId
  );
}

export function getPasskeyRelyingPartyOrigin(): string | null {
  const { expoExtra, manifestExtra, manifest2Extra, manifest2ExpoClientExtra } =
    getRuntimeExtras();

  const configured = pickFirstNonEmpty(
    process.env.EXPO_PUBLIC_PASSKEY_ASSOCIATED_DOMAIN,
    process.env.PASSKEY_ASSOCIATED_DOMAIN,
    expoExtra.passkeyAssociatedDomain,
    manifestExtra.passkeyAssociatedDomain,
    manifest2Extra.passkeyAssociatedDomain,
    manifest2ExpoClientExtra.passkeyAssociatedDomain
  );

  if (!configured) {
    return null;
  }

  return normalizeOriginFromDomainOrUrl(configured);
}

export function getPasskeyRelyingPartyId(): string | null {
  const origin = getPasskeyRelyingPartyOrigin();
  if (!origin) {
    return null;
  }

  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

export function getPrivyExportPageUrl(params?: {
  address?: string | null;
  chain?: "solana" | null;
}): string | null {
  const { expoExtra, manifestExtra, manifest2Extra, manifest2ExpoClientExtra } =
    getRuntimeExtras();

  const explicit = pickFirstNonEmpty(
    process.env.EXPO_PUBLIC_PRIVY_EXPORT_PAGE_URL,
    process.env.PRIVY_EXPORT_PAGE_URL,
    expoExtra.privyExportPageUrl,
    manifestExtra.privyExportPageUrl,
    manifest2Extra.privyExportPageUrl,
    manifest2ExpoClientExtra.privyExportPageUrl
  );

  const passkeyOrigin = getPasskeyRelyingPartyOrigin();
  const fallback = passkeyOrigin ? `${passkeyOrigin}/export` : null;
  const base = explicit ?? DEFAULT_PRIVY_EXPORT_PAGE_URL;
  const normalizedBase =
    normalizeUrlWithPath(base) ??
    (fallback ? normalizeUrlWithPath(fallback) : null);
  if (!normalizedBase) {
    return null;
  }

  const url = new URL(normalizedBase);
  const appId = getPrivyAppId();
  const clientId = getPrivyExportClientId();
  const address = normalizeValue(params?.address);
  const chain = normalizeValue(params?.chain);

  if (appId) {
    url.searchParams.set("appId", appId);
  }
  if (clientId) {
    url.searchParams.set("clientId", clientId);
  }
  if (address) {
    url.searchParams.set("address", address);
  }
  if (chain) {
    url.searchParams.set("chain", chain);
  }

  return url.toString();
}

export function getIdentityVerificationUrl(params?: {
  userId?: string | null;
  address?: string | null;
}): string | null {
  const { expoExtra, manifestExtra, manifest2Extra, manifest2ExpoClientExtra } =
    getRuntimeExtras();

  const explicit = pickFirstNonEmpty(
    process.env.EXPO_PUBLIC_SUMSUB_VERIFICATION_URL,
    process.env.SUMSUB_VERIFICATION_URL,
    process.env.EXPO_PUBLIC_KYC_VERIFICATION_URL,
    process.env.KYC_VERIFICATION_URL,
    expoExtra.sumsubVerificationUrl,
    expoExtra.kycVerificationUrl,
    manifestExtra.sumsubVerificationUrl,
    manifestExtra.kycVerificationUrl,
    manifest2Extra.sumsubVerificationUrl,
    manifest2Extra.kycVerificationUrl,
    manifest2ExpoClientExtra.sumsubVerificationUrl,
    manifest2ExpoClientExtra.kycVerificationUrl
  );

  if (!explicit) {
    return null;
  }

  const normalizedBase = normalizeUrlWithOptionalScheme(explicit);
  if (!normalizedBase) {
    return null;
  }

  const url = new URL(normalizedBase);
  const userId = normalizeValue(params?.userId);
  const address = normalizeValue(params?.address);

  if (userId) {
    url.searchParams.set("userId", userId);
  }

  if (address) {
    url.searchParams.set("address", address);
  }

  return url.toString();
}
