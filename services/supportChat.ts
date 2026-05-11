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
let nativeSupportChatUnavailable = false;

function resolveWebsiteId(): string {
  return pickFirstNonEmpty(
    process.env.EXPO_PUBLIC_CRISP_WEBSITE_ID,
    expoExtra.crispWebsiteId,
    manifestExtra.crispWebsiteId,
    manifest2Extra.crispWebsiteId,
    manifest2ExpoClientExtra.crispWebsiteId
  );
}

function handleNativeSupportChatError(action: string, error: unknown) {
  nativeSupportChatUnavailable = true;
  configuredWebsiteId = "";
  console.warn(`[SupportChat] Native Crisp ${action} unavailable`, error);
}

function callNativeSupportChat(action: string, callback: () => void): boolean {
  if (nativeSupportChatUnavailable) return false;

  try {
    callback();
    return true;
  } catch (error) {
    handleNativeSupportChatError(action, error);
    return false;
  }
}

function ensureConfigured(): string {
  if (nativeSupportChatUnavailable) return "";

  const websiteId = resolveWebsiteId();
  if (!websiteId) return "";

  if (configuredWebsiteId !== websiteId) {
    if (process.env.EXPO_OS !== "android") {
      const didConfigure = callNativeSupportChat("configure", () => {
        configure(websiteId);
      });
      if (!didConfigure) return "";
    }

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
    if (!callNativeSupportChat("set user email", () => setUserEmail(email))) {
      return false;
    }
  }

  const nickname = normalizeConfigValue(identity?.nickname);
  if (nickname) {
    if (!callNativeSupportChat("set user nickname", () => setUserNickname(nickname))) {
      return false;
    }
  }

  const phone = normalizeConfigValue(identity?.phone);
  if (phone) {
    if (!callNativeSupportChat("set user phone", () => setUserPhone(phone))) {
      return false;
    }
  }

  const tokenId = normalizeConfigValue(identity?.tokenId);
  if (!callNativeSupportChat("set token id", () => setTokenId(tokenId || null))) {
    return false;
  }

  return callNativeSupportChat("show chat", show);
}

export function clearSupportChatSession(): boolean {
  const websiteId = ensureConfigured();
  if (!websiteId) return false;

  return (
    callNativeSupportChat("clear token id", () => setTokenId(null)) &&
    callNativeSupportChat("reset session", resetSession)
  );
}

export function isSupportChatConfigured(): boolean {
  return Boolean(resolveWebsiteId());
}
