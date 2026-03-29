import Constants from "expo-constants";

function getExtraConfig(): Record<string, unknown> {
  return (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ?? {};
}

function normalize(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getPrivyGaslessKeyQuorumId(): string | null {
  const extra = getExtraConfig();
  return (
    normalize(process.env.EXPO_PUBLIC_PRIVY_KEY_QUORUM_ID) ??
    normalize(extra.privyKeyQuorumId) ??
    null
  );
}

export function getPrivyGasSponsorPolicyIds(): string[] {
  const extra = getExtraConfig();
  const raw =
    normalize(process.env.EXPO_PUBLIC_PRIVY_GAS_SPONSOR_POLICY_IDS) ??
    normalize(extra.privyGasSponsorPolicyIds);

  if (!raw) return [];

  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}
