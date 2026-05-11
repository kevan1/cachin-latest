import { Platform } from "react-native";

type PlatformConstantsWithModel = typeof Platform.constants & {
  Model?: unknown;
};

function normalizeEnvFlag(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function isSeekerDevice(): boolean {
  if (Platform.OS !== "android") return false;

  const constants = Platform.constants as PlatformConstantsWithModel;
  return constants.Model === "Seeker";
}

export function isSeekerWalletLoginEnabled(): boolean {
  if (isSeekerDevice()) return true;

  return (
    Platform.OS === "android" &&
    __DEV__ &&
    normalizeEnvFlag(process.env.EXPO_PUBLIC_ENABLE_SEEKER_WALLET_LOGIN)
  );
}
