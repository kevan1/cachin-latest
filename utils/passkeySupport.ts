import { Platform } from "react-native";
import type * as ExpoLocalAuthentication from "expo-local-authentication";

type PasskeyMode = "login" | "signup";
type LocalAuthenticationModule = typeof ExpoLocalAuthentication;

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const candidate =
      (error as { message?: unknown }).message ??
      (error as { error?: unknown }).error ??
      (error as { localizedDescription?: unknown }).localizedDescription;
    if (typeof candidate === "string") return candidate;
  }
  return "";
};

const getErrorParts = (error: unknown): string[] => {
  if (typeof error === "string") return [error];
  if (!error || typeof error !== "object") return [];

  const values = [
    (error as { code?: unknown }).code,
    (error as { name?: unknown }).name,
    (error as { message?: unknown }).message,
    (error as { error?: unknown }).error,
    (error as { localizedDescription?: unknown }).localizedDescription,
    (error as { reason?: unknown }).reason,
  ];

  return values.filter((value): value is string => typeof value === "string");
};

async function loadLocalAuthentication(): Promise<LocalAuthenticationModule | null> {
  try {
    return await import("expo-local-authentication");
  } catch {
    return null;
  }
}

export const isPasskeySupportedByOs = (): boolean => {
  if (Platform.OS !== "ios") return true;
  const version = Platform.Version;
  const major =
    typeof version === "number"
      ? Math.floor(version)
      : typeof version === "string"
        ? Number.parseInt(version.split(".")[0] ?? "", 10)
        : null;
  if (Number.isNaN(major) || major === null) return true;
  return major >= 16;
};

export const checkPasskeySupport = async (): Promise<boolean> => {
  if (!isPasskeySupportedByOs()) return false;

  const LocalAuthentication = await loadLocalAuthentication();
  if (!LocalAuthentication?.getEnrolledLevelAsync) return true;

  try {
    const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();
    return enrolledLevel !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return true;
  }
};

const getNormalizedPasskeyError = (error: unknown): string =>
  getErrorParts(error).join(" ").toLowerCase();

const isAndroidCredentialDecryptError = (message: string): boolean =>
  message.includes("failed to decrypt credential") ||
  (message.includes("getcredentialcustomexception") &&
    message.includes("decrypt"));

export const shouldFallbackToEmail = (error: unknown): boolean => {
  const message = getNormalizedPasskeyError(error);
  if (!message) return false;
  return (
    isAndroidCredentialDecryptError(message) ||
    message.includes("authorizationerror") ||
    message.includes("authenticationservices") ||
    message.includes("error 1001") ||
    message.includes("passkey") ||
    message.includes("credential") ||
    message.includes("notallowederror") ||
    message.includes("not allowed") ||
    message.includes("not_available") ||
    message.includes("not available") ||
    message.includes("not supported") ||
    message.includes("unsupported") ||
    message.includes("not_enrolled") ||
    message.includes("not enrolled") ||
    message.includes("passcode_not_set") ||
    message.includes("passcode not set") ||
    message.includes("biometric") ||
    message.includes("face id") ||
    message.includes("touch id") ||
    message.includes("json parse") ||
    message.includes("unexpected character") ||
    message.includes("apple-app-site-association") ||
    message.includes("assetlinks")
  );
};

export const getPasskeyFallbackMessage = (mode: PasskeyMode): string => {
  const action = mode === "signup" ? "create your account" : "log in";

  return `Cachin works primarily with passkeys. Turn on Face ID, Touch ID, or a device passcode in Settings, then try again. If this device still cannot complete passkeys, you can ${action} with email.`;
};

export const formatPasskeyError = (
  error: unknown,
  defaultMessage: string,
  biometricMessage: string
): string => {
  const message = getErrorMessage(error) || defaultMessage;
  const normalizedMessage = message.toLowerCase();
  if (isAndroidCredentialDecryptError(normalizedMessage)) {
    return "This passkey could not be read on this device. Continue with email and set up a new passkey.";
  }
  if (
    normalizedMessage.includes("biometric") ||
    normalizedMessage.includes("face id") ||
    normalizedMessage.includes("touch id") ||
    normalizedMessage.includes("passcode")
  ) {
    return biometricMessage;
  }
  return message;
};
