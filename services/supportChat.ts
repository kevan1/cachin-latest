import Constants from "expo-constants";
import {
  configure,
  resetSession,
  setTokenId,
  setUserEmail,
  setUserNickname,
  setUserPhone,
  show,
} from "crisp-sdk-react-native";

type ExtraConfig = Record<string, unknown>;
type ManifestLike = { extra?: ExtraConfig | null } | null | undefined;
type ConstantsWithLegacyManifests = typeof Constants & {
  manifest?: ManifestLike;
  manifest2?: ManifestLike;
};

const constantsWithLegacyManifests = Constants as ConstantsWithLegacyManifests;

function normalizeConfigValue(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function asRecord(value: unknown): ExtraConfig {
  if (value && typeof value === "object") {
    return value as ExtraConfig;
  }
  return {};
}

function pickFirstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const normalized = normalizeConfigValue(value);
    if (normalized) return normalized;
  }
  return "";
}

const expoExtra = asRecord(Constants.expoConfig?.extra);
const manifestExtra = asRecord(constantsWithLegacyManifests.manifest?.extra);
const manifest2Extra = asRecord(constantsWithLegacyManifests.manifest2?.extra);
const manifest2ExpoClientExtra = asRecord(asRecord(manifest2Extra.expoClient).extra);

let configuredWebsiteId = "";

function resolveWebsiteId(): string {
  return pickFirstNonEmpty(
    process.env.EXPO_PUBLIC_CRISP_WEBSITE_ID,
    expoExtra.crispWebsiteId,
    manifestExtra.crispWebsiteId,
    manifest2Extra.crispWebsiteId,
    manifest2ExpoClientExtra.crispWebsiteId
  );
}

function ensureConfigured(): string {
  const websiteId = resolveWebsiteId();
  if (!websiteId) return "";

  if (configuredWebsiteId !== websiteId) {
    configure(websiteId);
    configuredWebsiteId = websiteId;
  }

  return websiteId;
}

export type SupportChatIdentity = {
  nickname?: string | null;
  tokenId?: string | null;
  email?: string | null;
  phone?: string | null;
};

export function initializeSupportChat(): boolean {
  return Boolean(ensureConfigured());
}

export function openSupportChat(identity?: SupportChatIdentity): boolean {
  const websiteId = ensureConfigured();
  if (!websiteId) return false;

  const email = normalizeConfigValue(identity?.email);
  if (email) {
    setUserEmail(email);
  }

  const nickname = normalizeConfigValue(identity?.nickname);
  if (nickname) {
    setUserNickname(nickname);
  }

  const phone = normalizeConfigValue(identity?.phone);
  if (phone) {
    setUserPhone(phone);
  }

  const tokenId = normalizeConfigValue(identity?.tokenId);
  setTokenId(tokenId || null);

  try {
    show();
    return true;
  } catch (error) {
    console.error("[SupportChat] Failed to open native Crisp chat", error);
    return false;
  }
}

export function clearSupportChatSession(): boolean {
  const websiteId = ensureConfigured();
  if (!websiteId) return false;

  setTokenId(null);
  resetSession();
  return true;
}

export function isSupportChatConfigured(): boolean {
  return Boolean(resolveWebsiteId());
}
