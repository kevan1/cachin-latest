import { Linking, Text, View } from "react-native";
import Constants from "expo-constants";
import * as Application from "expo-application";
import PasskeyLogin from "./login/PasskeyLogin";

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

export default function LoginScreen() {
  const expoExtra = asRecord(Constants.expoConfig?.extra);
  const manifestExtra = asRecord(constantsWithLegacyManifests.manifest?.extra);
  const manifest2Extra = asRecord(constantsWithLegacyManifests.manifest2?.extra);
  const manifest2ExpoClientExtra = asRecord(asRecord(manifest2Extra.expoClient).extra);
  const privyAppId = pickFirstNonEmpty(
    process.env.EXPO_PUBLIC_PRIVY_APP_ID,
    process.env.PRIVY_APP_ID,
    expoExtra.privyAppId,
    manifestExtra.privyAppId,
    manifest2Extra.privyAppId,
    manifest2ExpoClientExtra.privyAppId
  );
  const privyClientId = pickFirstNonEmpty(
    process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID,
    expoExtra.privyClientId,
    manifestExtra.privyClientId,
    manifest2Extra.privyClientId,
    manifest2ExpoClientExtra.privyClientId
  );

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 10,
        marginHorizontal: 10,
      }}
    >
      <Text>Privy App ID:</Text>
      <Text style={{ fontSize: 10 }}>{privyAppId}</Text>
      <Text>Privy Client ID:</Text>
      <Text style={{ fontSize: 10 }}>{privyClientId}</Text>
      <Text>
        Navigate to your{" "}
        <Text
          onPress={() =>
            Linking.openURL(
              `https://dashboard.privy.io/apps/${privyAppId}/settings?setting=clients`
            )
          }
        >
          dashboard
        </Text>{" "}
        and ensure the following Expo Application ID is listed as an `Allowed
        app identifier`:
      </Text>
      <Text style={{ fontSize: 10 }}>{Application.applicationId}</Text>
      <Text>
        Navigate to your{" "}
        <Text
          onPress={() =>
            Linking.openURL(
              `https://dashboard.privy.io/apps/${privyAppId}/settings?setting=clients`
            )
          }
        >
          dashboard
        </Text>{" "}
        and ensure the following value is listed as an `Allowed app URL scheme`:
      </Text>
      <Text style={{ fontSize: 10 }}>
        {Application.applicationId === "host.exp.Exponent"
          ? "exp"
          : Constants.expoConfig?.scheme}
      </Text>

      <PasskeyLogin />
    </View>
  );
}
