import { Linking, Text, View } from "react-native";
import Constants from "expo-constants";
import * as Application from "expo-application";
import PasskeyLogin from "./login/PasskeyLogin";

export default function LoginScreen() {
  const privyAppId =
    process.env.EXPO_PUBLIC_PRIVY_APP_ID ||
    Constants.expoConfig?.extra?.privyAppId ||
    "";
  const privyClientId =
    process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ||
    Constants.expoConfig?.extra?.privyClientId ||
    "";

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
