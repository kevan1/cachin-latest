import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, Redirect, useSegments, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { Component, ReactNode, ErrorInfo } from "react";
import { StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import Constants from "expo-constants";
import { PrivyProvider, usePrivy } from "@privy-io/expo";
import { PrivyElements } from "@privy-io/expo/ui";
import { avalancheFuji } from "viem/chains";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { Colors } from "@/constants/theme";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { HeroUINativeProvider } from "heroui-native";
import { ChinPopoutProvider } from "@/components/ChinPopout";
import { IconSymbol } from "@/components/ui/icon-symbol";


class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Error info:", errorInfo);
    console.error("[ErrorBoundary] Error stack:", error.stack);
  }

  render() {
    if (this.state.hasError) {
      console.error("[ErrorBoundary] Rendering error state");
    }
    return this.props.children;
  }
}

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

const envPrivyAppId = pickFirstNonEmpty(
  process.env.EXPO_PUBLIC_PRIVY_APP_ID,
  process.env.PRIVY_APP_ID
);
const envPrivyClientId = pickFirstNonEmpty(process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID);

const privyAppId = pickFirstNonEmpty(
  envPrivyAppId,
  expoExtra.privyAppId,
  manifestExtra.privyAppId,
  manifest2Extra.privyAppId,
  manifest2ExpoClientExtra.privyAppId
);
const privyClientId = pickFirstNonEmpty(
  envPrivyClientId,
  expoExtra.privyClientId,
  manifestExtra.privyClientId,
  manifest2Extra.privyClientId,
  manifest2ExpoClientExtra.privyClientId
);

const privyConfigDiagnostics = {
  envAppIdLength: envPrivyAppId.length,
  envClientIdLength: envPrivyClientId.length,
  expoExtraAppIdLength: normalizeConfigValue(expoExtra.privyAppId).length,
  expoExtraClientIdLength: normalizeConfigValue(expoExtra.privyClientId).length,
  manifestExtraAppIdLength: normalizeConfigValue(manifestExtra.privyAppId).length,
  manifestExtraClientIdLength: normalizeConfigValue(manifestExtra.privyClientId).length,
  manifest2ExtraAppIdLength: normalizeConfigValue(manifest2Extra.privyAppId).length,
  manifest2ExtraClientIdLength: normalizeConfigValue(manifest2Extra.privyClientId).length,
  manifest2ExpoClientAppIdLength: normalizeConfigValue(
    manifest2ExpoClientExtra.privyAppId
  ).length,
  manifest2ExpoClientClientIdLength: normalizeConfigValue(
    manifest2ExpoClientExtra.privyClientId
  ).length,
};

function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  const colorScheme = useColorScheme() ?? "light";
  const palette = Colors[colorScheme];

  return (
    <View style={[styles.stateContainer, { backgroundColor: palette.background }]}>
      <View style={[styles.badge, { borderColor: palette.buttonBorder }]}>
        <View style={[styles.badgeDot, { backgroundColor: palette.primary }]} />
        <Text style={[styles.badgeText, { color: palette.secondaryText }]}>No connection</Text>
      </View>
      <Text style={[styles.stateTitle, { color: palette.primaryText }]}>You are offline</Text>
      <Text style={[styles.stateSubtitle, { color: palette.secondaryText }]}>
        Connect to the internet to keep going. We will keep checking for a signal.
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onRetry}
        style={[
          styles.retryButton,
          { backgroundColor: palette.primary, borderColor: palette.buttonBorder },
        ]}
      >
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

function MissingPrivyConfigScreen({
  appId,
  clientId,
  diagnostics,
}: {
  appId: string;
  clientId: string;
  diagnostics: typeof privyConfigDiagnostics;
}) {
  const colorScheme = useColorScheme() ?? "light";
  const palette = Colors[colorScheme];

  return (
    <View style={[styles.stateContainer, { backgroundColor: palette.background }]}>
      <View style={[styles.badge, { borderColor: palette.buttonBorder }]}>
        <View style={[styles.badgeDot, { backgroundColor: palette.primary }]} />
        <Text style={[styles.badgeText, { color: palette.secondaryText }]}>
          Missing Privy config
        </Text>
      </View>
      <Text style={[styles.stateTitle, { color: palette.primaryText }]}>
        Privy credentials not loaded
      </Text>
      <Text style={[styles.stateSubtitle, { color: palette.secondaryText }]}>
        Set these in your environment and restart Expo:
      </Text>
      <View style={styles.configList}>
        <Text style={[styles.configCode, { color: palette.primaryText }]}>
          EXPO_PUBLIC_PRIVY_APP_ID (length: {appId.length})
        </Text>
        <Text style={[styles.configCode, { color: palette.primaryText }]}>
          EXPO_PUBLIC_PRIVY_CLIENT_ID (length: {clientId.length})
        </Text>
        <Text style={[styles.configCode, { color: palette.secondaryText }]}>
          env app/client lengths: {diagnostics.envAppIdLength}/{diagnostics.envClientIdLength}
        </Text>
        <Text style={[styles.configCode, { color: palette.secondaryText }]}>
          expoConfig extra app/client: {diagnostics.expoExtraAppIdLength}/
          {diagnostics.expoExtraClientIdLength}
        </Text>
        <Text style={[styles.configCode, { color: palette.secondaryText }]}>
          manifest extra app/client: {diagnostics.manifestExtraAppIdLength}/
          {diagnostics.manifestExtraClientIdLength}
        </Text>
        <Text style={[styles.configCode, { color: palette.secondaryText }]}>
          manifest2 extra app/client: {diagnostics.manifest2ExtraAppIdLength}/
          {diagnostics.manifest2ExtraClientIdLength}
        </Text>
        <Text style={[styles.configCode, { color: palette.secondaryText }]}>
          manifest2 expoClient.extra app/client: {diagnostics.manifest2ExpoClientAppIdLength}/
          {diagnostics.manifest2ExpoClientClientIdLength}
        </Text>
      </View>
      <Text style={[styles.stateSubtitle, { color: palette.secondaryText }]}>
        Then run: npx expo start -c
      </Text>
    </View>
  );
}


function AppNavigator() {
  const { user, isReady } = usePrivy();
  const { isConnected, refresh } = useNetworkStatus();
  const segments = useSegments();
  const router = useRouter();
  const isIOS = process.env.EXPO_OS === "ios";
  const colorScheme = useColorScheme() ?? "light";
  const headerBlurEffect =
    colorScheme === "dark" ? "systemMaterialDark" : "systemMaterialLight";

  const renderSheetCloseButton = () => (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => router.back()}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isIOS ? "rgba(118,118,128,0.12)" : "rgba(0,0,0,0.06)",
        borderWidth: isIOS ? 0 : 1,
        borderColor: "rgba(60,60,67,0.18)",
      }}
    >
      <IconSymbol name="xmark" size={14} color={isIOS ? "#1C1C1E" : "#111827"} />
    </TouchableOpacity>
  );

  if (isConnected === false) {
    return <OfflineScreen onRetry={refresh} />;
  }
  
  const inAuthGroup = segments[0] === '(main)';
  const isUnauthScreen =
    segments.length === 0 ||
    segments[0] === "index" ||
    segments[0] === "username" ||
    segments[0] === "email";
  
  // Redirect logic
  if (isReady && !user && inAuthGroup) {
    // User is not logged in but trying to access protected routes
    return <Redirect href="/" />;
  }
  
  if (isReady && user && isUnauthScreen) {
    // User is logged in but on unauthenticated screens (index/username)
    return <Redirect href="/(main)/home" />;
  }
  
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="username" options={{ headerShown: false }} />
      <Stack.Screen name="email" options={{ headerShown: false }} />
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen
        name="card-setup-onboarding"
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          animation: "slide_from_right",
          gestureEnabled: true,
          contentStyle: { backgroundColor: "#00050D" },
        }}
      />
      <Stack.Screen
        name="send-amount"
        options={{
          headerShown: true,
          title: "Send to username",
          headerShadowVisible: false,
          headerTransparent: false,
          headerStyle: { backgroundColor: "transparent" },
          headerBlurEffect,
          headerRight: renderSheetCloseButton,
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetLargestUndimmedDetentIndex: "last",
          sheetGrabberVisible: false,
          sheetCornerRadius: 28,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen
        name="send-link"
        options={{
          headerShown: false,
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetLargestUndimmedDetentIndex: "last",
          sheetGrabberVisible: false,
          sheetCornerRadius: 28,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      />
      <Stack.Screen
        name="satochip-connect"
        options={{
          headerShown: true,
          title: "Satochip",
          headerShadowVisible: false,
          headerTransparent: false,
          headerStyle: { backgroundColor: "transparent" },
          headerBlurEffect,
          headerRight: renderSheetCloseButton,
          presentation: isIOS ? "fullScreenModal" : "formSheet",
          sheetAllowedDetents: isIOS ? undefined : "fitToContents",
          sheetLargestUndimmedDetentIndex: isIOS ? undefined : "last",
          sheetGrabberVisible: isIOS ? undefined : false,
          sheetCornerRadius: isIOS ? undefined : 28,
          contentStyle: { backgroundColor: isIOS ? "#FFFFFF" : "transparent" },
        }}
      />
      <Stack.Screen
        name="send-options"
        options={{
          headerShown: true,
          title: "Send",
          headerShadowVisible: false,
          headerTransparent: false,
          headerStyle: { backgroundColor: "transparent" },
          headerBlurEffect,
          headerRight: renderSheetCloseButton,
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetLargestUndimmedDetentIndex: "last",
          sheetGrabberVisible: false,
          sheetCornerRadius: 28,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen
        name="send-confirm"
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="withdraw"
        options={{
          headerShown: false,
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetLargestUndimmedDetentIndex: "last",
          sheetGrabberVisible: false,
          sheetCornerRadius: 28,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      />
      <Stack.Screen
        name="withdraw-amount"
        options={{
          headerShown: false,
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetLargestUndimmedDetentIndex: "last",
          sheetGrabberVisible: false,
          sheetCornerRadius: 28,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      />
      <Stack.Screen
        name="withdraw-bank"
        options={{
          headerShown: false,
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetLargestUndimmedDetentIndex: "last",
          sheetGrabberVisible: false,
          sheetCornerRadius: 28,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      />
      <Stack.Screen
        name="withdraw-crypto"
        options={{
          headerShown: false,
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetLargestUndimmedDetentIndex: "last",
          sheetGrabberVisible: false,
          sheetCornerRadius: 28,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      />
      <Stack.Screen
        name="withdraw-crypto-review"
        options={{
          headerShown: false,
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetLargestUndimmedDetentIndex: "last",
          sheetGrabberVisible: false,
          sheetCornerRadius: 28,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      />
      <Stack.Screen
        name="activity"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="profile"
        options={{ headerShown: false, animation: "slide_from_left" }}
      />
      <Stack.Screen
        name="my-qr"
        options={{
          headerShown: false,
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetLargestUndimmedDetentIndex: "last",
          sheetGrabberVisible: false,
          sheetCornerRadius: 28,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const hasPrivyConfig = Boolean(privyAppId && privyClientId);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <HeroUINativeProvider
          config={{
            toast: {
              defaultProps: {
                placement: "top",
              },
            },
          }}
        >
          <ErrorBoundary>
            {!hasPrivyConfig ? (
              <MissingPrivyConfigScreen
                appId={privyAppId}
                clientId={privyClientId}
                diagnostics={privyConfigDiagnostics}
              />
            ) : (
              <PrivyProvider
                appId={privyAppId}
                clientId={privyClientId}
                supportedChains={[avalancheFuji]}
                config={{
                  embedded: {
                    ethereum: {
                      createOnLogin: "users-without-wallets",
                    },
                  },
                }}
              >
                <ChinPopoutProvider>
                  <AppNavigator />
                </ChinPopoutProvider>
                <PrivyElements />
                <StatusBar style="auto" />
              </PrivyProvider>
            )}
          </ErrorBoundary>
        </HeroUINativeProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  stateContainer: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 12,
  },
  badgeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  stateTitle: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  stateSubtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
    marginTop: 2,
  },
  retryButton: {
    marginTop: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  retryText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  configList: {
    marginTop: 12,
    marginBottom: 8,
    alignItems: "center",
  },
  configCode: {
    fontSize: 13,
    fontWeight: "600",
    marginVertical: 2,
  },
});
