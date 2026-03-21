import { Platform } from "react-native";
import { isSupported as isPasskeySupported } from "react-native-passkeys";

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
  try {
    return await isPasskeySupported();
  } catch {
    return false;
  }
};

const getNormalizedPasskeyError = (error: unknown): string =>
  getErrorMessage(error).toLowerCase();

const isAndroidCredentialDecryptError = (message: string): boolean =>
  message.includes("failed to decrypt credential") ||
  (message.includes("getcredentialcustomexception") &&
    message.includes("decrypt"));

export const shouldFallbackToEmail = (error: unknown): boolean => {
  const message = getNormalizedPasskeyError(error);
  if (!message) return false;
  return (
    isAndroidCredentialDecryptError(message) ||
    message.includes("biometric") ||
    message.includes("authorizationerror") ||
    message.includes("authenticationservices") ||
    message.includes("error 1001") ||
    message.includes("json parse") ||
    message.includes("unexpected character") ||
    message.includes("apple-app-site-association") ||
    message.includes("assetlinks")
  );
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
  if (normalizedMessage.includes("biometric")) {
    return biometricMessage;
  }
  return message;
};
