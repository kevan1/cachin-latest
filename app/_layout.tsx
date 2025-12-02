import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, Redirect, useSegments, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { Component, ReactNode, ErrorInfo } from "react";
import { useColorScheme } from "react-native";
  
import Constants from "expo-constants";
import { PrivyProvider } from "@privy-io/expo";
import { PrivyElements } from "@privy-io/expo/ui";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { usePrivy } from "@privy-io/expo";
import { monadTestnet } from "@/constants/chains";

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


function AppNavigator() {
  const { user, isReady } = usePrivy();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  
  // Show nothing while checking auth state or navigation isn't ready
  if (!isReady || !navigationState?.key) {
    return null;
  }
  
  const inAuthGroup = segments[0] === '(main)';
  const isUnauthScreen = segments[0] === 'index' || segments[0] === 'username';
  
  // Redirect logic
  if (!user && inAuthGroup) {
    // User is not logged in but trying to access protected routes
    return <Redirect href="/" />;
  }
  
  if (user && isUnauthScreen) {
    // User is logged in but on unauthenticated screens (index/username)
    return <Redirect href="/(main)" />;
  }
  
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="username" options={{ headerShown: false }} />
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
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
      <ErrorBoundary>
        <PrivyProvider
          appId={Constants.expoConfig?.extra?.privyAppId}
          clientId={Constants.expoConfig?.extra?.privyClientId}
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
    </ThemeProvider>
  );
}
