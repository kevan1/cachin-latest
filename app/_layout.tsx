import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, Redirect, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { Component, ReactNode, ErrorInfo } from "react";
import { StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import Constants from "expo-constants";
import { PrivyProvider, usePrivy } from "@privy-io/expo";
import { PrivyElements } from "@privy-io/expo/ui";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { monadTestnet } from "@/constants/chains";
import { Colors } from "@/constants/theme";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { HeroUINativeProvider } from "heroui-native";


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

const privyAppId =
  process.env.EXPO_PUBLIC_PRIVY_APP_ID ||
  Constants.expoConfig?.extra?.privyAppId ||
  "";
const privyClientId =
  process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ||
  Constants.expoConfig?.extra?.privyClientId ||
  "";

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


function AppNavigator() {
  const { user, isReady } = usePrivy();
  const { isConnected, refresh } = useNetworkStatus();
  const segments = useSegments();

  if (isConnected === false) {
    return <OfflineScreen onRetry={refresh} />;
  }
  
  const inAuthGroup = segments[0] === '(main)';
  const isUnauthScreen =
    segments.length === 0 || segments[0] === "index" || segments[0] === "username";
  
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
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen
        name="send-amount"
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
        name="send-confirm"
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
        name="profile"
        options={{ headerShown: false, animation: "slide_from_left" }}
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
            <PrivyProvider
              appId={privyAppId}
              clientId={privyClientId}
              supportedChains={[monadTestnet]}
              embeddedWallets={{
                createOnLogin: 'all-wallets',
                noPromptOnSignature: false,
              }}
            >
              <AppNavigator />
              <PrivyElements />
              <StatusBar style="auto" />
            </PrivyProvider>
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
});
