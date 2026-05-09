import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import {
  Stack,
  Redirect,
  useGlobalSearchParams,
  useSegments,
  useRouter,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { Component, ReactNode, ErrorInfo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  type AppStateStatus,
  useColorScheme,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import LottieView from "lottie-react-native";

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
import { ToastProvider } from "react-native-pretty-toast";
import { ChinPopoutProvider } from "@/components/ChinPopout";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { subscribeToReceivedTransactionNotificationResponses } from "@/services/pushNotifications";
import { initializeSupportChat } from "@/services/supportChat";
import { initializeTransactionNotifications } from "@/services/transactionNotifications";
import { authenticateAppLock, getAppLockAvailability } from "@/services/appLock";
import {
  getAppLockBootDecision,
  isAppLockPreferenceCurrent,
  type AppLockState,
} from "@/utils/appLockBootGate";
import {
  clearAppLockRecentUnlock,
  getAppLockEnabledPreference,
  hasRecentAppLockUnlock,
  rememberAppLockRecentUnlock,
  saveAppLockEnabledPreference,
  subscribeAppLockPreference,
} from "@/utils/appLockPreferences";
import { logBootTrace } from "@/utils/bootTrace";
import { saveTransaction, transactionExists } from "@/utils/transactionStorage";


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

void SplashScreen.preventAutoHideAsync()
  .then(() => {
    logBootTrace("native-splash:prevent-auto-hide");
  })
  .catch((error) => {
    logBootTrace("native-splash:prevent-auto-hide:failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  });

const POST_SPLASH_FALLBACK_MS = 1800;
const APP_LOCK_AUTH_GRACE_MS = 2500;
const APP_LOCK_NATIVE_PROMPT_SETTLE_MS = 10000;
const APP_LOCK_SESSION_UNLOCK_MS = 60000;
const APP_LOCK_FEATURE_ENABLED = Platform.OS !== "web";
const APP_LOCK_AUTHENTICATED_USER_FALLBACK_ID = "__authenticated_user__";
let hasConsumedPostSplashTransition = false;
let appLockUnlockedSessionUserId: string | null = null;
let appLockUnlockedSessionUntil = 0;

function logAppLock(event: string, data?: Record<string, unknown>) {
  if (!__DEV__) return;
  console.log(`[AppLock] ${event}`, data ?? {});
}

function consumePostSplashTransitionOnce() {
  if (hasConsumedPostSplashTransition) return false;
  hasConsumedPostSplashTransition = true;
  return true;
}

function rememberAppLockSessionUnlock(userId: string) {
  appLockUnlockedSessionUserId = userId;
  appLockUnlockedSessionUntil = Date.now() + APP_LOCK_SESSION_UNLOCK_MS;
}

function clearAppLockSessionUnlock() {
  appLockUnlockedSessionUserId = null;
  appLockUnlockedSessionUntil = 0;
}

function hasRecentAppLockSessionUnlock(userId: string) {
  return (
    appLockUnlockedSessionUserId === userId &&
    Date.now() < appLockUnlockedSessionUntil
  );
}

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
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
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
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
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

function AppLockScreen({
  isAuthenticating,
  errorMessage,
  onUnlock,
}: {
  isAuthenticating: boolean;
  errorMessage: string | null;
  onUnlock: () => void;
}) {
  const autoUnlockAttemptedRef = useRef(false);
  const onUnlockRef = useRef(onUnlock);

  useEffect(() => {
    onUnlockRef.current = onUnlock;
  }, [onUnlock]);

  useEffect(() => {
    logBootTrace("app-lock-screen:mounted");
    return () => {
      logBootTrace("app-lock-screen:unmounted");
    };
  }, []);

  useEffect(() => {
    logBootTrace("app-lock-screen:state", {
      isAuthenticating,
      hasError: Boolean(errorMessage),
    });
  }, [errorMessage, isAuthenticating]);

  useEffect(() => {
    if (autoUnlockAttemptedRef.current || isAuthenticating || errorMessage) {
      return;
    }

    autoUnlockAttemptedRef.current = true;
    const timeout = setTimeout(() => {
      logBootTrace("app-lock-screen:auto-unlock");
      onUnlockRef.current();
    }, 250);

    return () => clearTimeout(timeout);
  }, [errorMessage, isAuthenticating]);

  return (
    <View style={styles.appLockContainer}>
      <View style={styles.appLockIcon}>
        <IconSymbol name="lock.fill" size={28} color="#111111" />
      </View>
      <Text style={styles.appLockTitle}>Cachin is locked</Text>
      <Text style={styles.appLockSubtitle}>Use Face ID to continue.</Text>
      {errorMessage ? <Text style={styles.appLockError}>{errorMessage}</Text> : null}
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.86}
        disabled={isAuthenticating}
        onPress={onUnlock}
        style={[styles.appLockButton, isAuthenticating ? styles.appLockButtonDisabled : null]}
      >
        {isAuthenticating ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.appLockButtonText}>Unlock with Face ID</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function LaunchGateScreen({ reason }: { reason: string }) {
  useEffect(() => {
    logBootTrace("launch-gate:mounted", { reason });
    return () => {
      logBootTrace("launch-gate:unmounted", { reason });
    };
  }, [reason]);

  return <View style={styles.launchGateContainer} />;
}

function PostSplashTransition({ onDone }: { onDone: () => void }) {
  const completedRef = useRef(false);
  const canRenderNativeLottie = useMemo(() => {
    if (Platform.OS === "web") return false;
    try {
      return Boolean(
        UIManager.getViewManagerConfig?.("LottieAnimationView") ??
        UIManager.getViewManagerConfig?.("LottieAnimationViewModule")
      );
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    logBootTrace("post-splash:mounted", { canRenderNativeLottie });
    return () => {
      logBootTrace("post-splash:unmounted");
    };
  }, [canRenderNativeLottie]);

  const finishTransition = useCallback((source: string) => {
    if (completedRef.current) return;
    completedRef.current = true;
    logBootTrace("post-splash:finish", { source });
    onDone();
  }, [onDone]);

  useEffect(() => {
    const timeout = setTimeout(
      () => finishTransition("fallback-timeout"),
      POST_SPLASH_FALLBACK_MS
    );
    return () => clearTimeout(timeout);
  }, [finishTransition]);

  return (
    <View style={styles.postSplashContainer}>
      {canRenderNativeLottie ? (
        <LottieView
          source={require("../assets/animations/post-splash-transition.json")}
          autoPlay
          loop={false}
          resizeMode="cover"
          onAnimationFinish={() => finishTransition("animation-finish")}
          style={styles.postSplashAnimation}
        />
      ) : (
        <ActivityIndicator size="large" color="#6b7280" />
      )}
    </View>
  );
}

function AppNavigator() {
  const { user, isReady } = usePrivy();
  const { isConnected, refresh } = useNetworkStatus();
  const segments = useSegments();
  const { mode } = useGlobalSearchParams<{ mode?: string | string[] }>();
  const segmentList = segments as readonly string[];
  const firstSegment = segmentList[0];
  const router = useRouter();
  const inAuthGroup = firstSegment === "(main)";
  const isUsernameScreen = firstSegment === "username";
  const isEmailScreen = firstSegment === "email";
  const authFlowMode = Array.isArray(mode) ? mode[0] : mode;
  const isCompletingUsername = isUsernameScreen && authFlowMode === "complete";
  const isSignupUsernameScreen = isUsernameScreen && authFlowMode === "signup";
  const isSignupEmailScreen = isEmailScreen && authFlowMode === "signup";
  const isUnauthScreen =
    segmentList.length === 0 ||
    firstSegment === "index" ||
    (isEmailScreen && !isSignupEmailScreen);
  const isIOS = Platform.OS === "ios";
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const headerBlurEffect =
    colorScheme === "dark" ? "systemMaterialDark" : "systemMaterialLight";
  const routeSegments = segmentList.join("/") || "/";
  const appLockSubjectId =
    user?.id ?? (user ? APP_LOCK_AUTHENTICATED_USER_FALLBACK_ID : null);
  const [appLockPreferenceLoaded, setAppLockPreferenceLoaded] = useState(false);
  const [appLockPreferenceUserId, setAppLockPreferenceUserId] = useState<string | null>(null);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [appLockState, setAppLockState] = useState<AppLockState>("checking");
  const [appLockError, setAppLockError] = useState<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const appLockStateRef = useRef<AppLockState>("checking");
  const appLockAuthInFlightRef = useRef(false);
  const appLockGraceUntilRef = useRef(0);
  const appLockIgnoreAppStateUntilRef = useRef(0);
  const appLockLastSuccessfulAuthAtRef = useRef(0);
  const appLockHasActiveForegroundRef = useRef(
    AppState.currentState === "active"
  );
  const appLockPreferenceIsCurrent = isAppLockPreferenceCurrent({
    preferenceLoaded: appLockPreferenceLoaded,
    preferenceUserId: appLockPreferenceUserId,
    userId: appLockSubjectId,
  });
  const appLockBootDecision = getAppLockBootDecision({
    featureEnabled: APP_LOCK_FEATURE_ENABLED,
    isPrivyReady: isReady,
    userId: appLockSubjectId,
    preferenceLoaded: appLockPreferenceLoaded,
    preferenceUserId: appLockPreferenceUserId,
    preferenceEnabled: appLockEnabled,
    appLockState,
  });
  const shouldUseAppLock = Boolean(
    APP_LOCK_FEATURE_ENABLED &&
      isReady &&
      appLockSubjectId &&
      appLockPreferenceIsCurrent &&
      appLockEnabled
  );

  useEffect(() => {
    logBootTrace("navigator:state", {
      routeSegments,
      isReady,
      hasUser: Boolean(user?.id),
      hasAuthUser: Boolean(user),
      appLockSubjectId,
      appLockPreferenceLoaded,
      appLockPreferenceUserId,
      appLockEnabled,
      appLockState,
      appLockBootDecision,
      shouldUseAppLock,
    });
  }, [
    appLockBootDecision,
    appLockEnabled,
    appLockPreferenceLoaded,
    appLockPreferenceUserId,
    appLockState,
    appLockSubjectId,
    isReady,
    routeSegments,
    shouldUseAppLock,
    user?.id,
  ]);

  const lockAppForAppLock = useCallback((reason = "unknown", errorMessage: string | null = null) => {
    logAppLock("lock", {
      reason,
      currentState: appLockStateRef.current,
      appState: AppState.currentState,
      userId: user?.id,
      subjectId: appLockSubjectId,
    });
    clearAppLockSessionUnlock();
    void clearAppLockRecentUnlock(appLockSubjectId);
    appLockStateRef.current = "locked";
    setAppLockState("locked");
    setAppLockError(errorMessage);
  }, [appLockSubjectId, user?.id]);

  const authenticateForAppLock = useCallback(async () => {
    if (!appLockSubjectId || appLockAuthInFlightRef.current) return;

    try {
      logAppLock("authenticate:start", {
        appState: AppState.currentState,
        userId: user?.id,
        subjectId: appLockSubjectId,
      });
      appLockAuthInFlightRef.current = true;
      appLockIgnoreAppStateUntilRef.current = Date.now() + APP_LOCK_AUTH_GRACE_MS;
      appLockStateRef.current = "authenticating";
      setAppLockState("authenticating");
      setAppLockError(null);

      const availability = await getAppLockAvailability();
      if (!availability.isAvailable) {
        await saveAppLockEnabledPreference(false, user?.id);
        setAppLockEnabled(false);
        appLockStateRef.current = "unlocked";
        setAppLockState("unlocked");
        setAppLockError(null);
        return;
      }

      const result = await authenticateAppLock("Unlock Cachin");
      const now = Date.now();
      appLockGraceUntilRef.current = now + APP_LOCK_AUTH_GRACE_MS;
      appLockIgnoreAppStateUntilRef.current =
        now + APP_LOCK_NATIVE_PROMPT_SETTLE_MS;

      if (result.success) {
        logAppLock("authenticate:success", {
          appState: AppState.currentState,
          userId: user?.id,
          subjectId: appLockSubjectId,
        });
        appLockLastSuccessfulAuthAtRef.current = now;
        appLockHasActiveForegroundRef.current = AppState.currentState === "active";
        rememberAppLockSessionUnlock(appLockSubjectId);
        await rememberAppLockRecentUnlock(appLockSubjectId, APP_LOCK_SESSION_UNLOCK_MS);
        appLockStateRef.current = "unlocked";
        setAppLockState("unlocked");
        setAppLockError(null);
        return;
      }

      logAppLock("authenticate:failed", {
        appState: AppState.currentState,
        error: "error" in result ? result.error : undefined,
      });
      appLockStateRef.current = "locked";
      setAppLockState("locked");
      setAppLockError(`${availability.label} is required to unlock Cachin.`);
    } catch (error) {
      console.error("[AppLock] Failed to authenticate app lock", error);
      appLockStateRef.current = "locked";
      setAppLockState("locked");
      setAppLockError("Authentication failed. Try again.");
    } finally {
      appLockAuthInFlightRef.current = false;
    }
  }, [appLockSubjectId, user?.id]);

  useEffect(() => {
    let isCancelled = false;

    if (!isReady) {
      setAppLockPreferenceLoaded(false);
      setAppLockPreferenceUserId(null);
      setAppLockEnabled(false);
      clearAppLockSessionUnlock();
      appLockStateRef.current = "checking";
      setAppLockState("checking");
      setAppLockError(null);
      return;
    }

    if (!user || !appLockSubjectId) {
      setAppLockPreferenceLoaded(true);
      setAppLockPreferenceUserId(null);
      setAppLockEnabled(false);
      clearAppLockSessionUnlock();
      appLockStateRef.current = "unlocked";
      setAppLockState("unlocked");
      setAppLockError(null);
      return;
    }

    logBootTrace("app-lock:preference-load:start", {
      userId: user.id,
      subjectId: appLockSubjectId,
    });
    setAppLockPreferenceLoaded(false);
    setAppLockPreferenceUserId(null);
    appLockStateRef.current = "checking";
    setAppLockState("checking");
    setAppLockError(null);

    const loadPreference = async () => {
      try {
        const enabled = await getAppLockEnabledPreference(user.id);
        if (isCancelled) return;

        const hasRecentUnlock =
          hasRecentAppLockSessionUnlock(appLockSubjectId) ||
          (enabled ? await hasRecentAppLockUnlock(appLockSubjectId) : false);

        if (isCancelled) return;
        setAppLockEnabled(enabled);
        setAppLockPreferenceUserId(appLockSubjectId);
        logAppLock("preference:loaded", {
          enabled,
          hasRecentUnlock,
          userId: user.id,
          subjectId: appLockSubjectId,
        });

        if (enabled && !hasRecentUnlock) {
          lockAppForAppLock("preference-load");
        } else {
          appLockStateRef.current = "unlocked";
          setAppLockState("unlocked");
          setAppLockError(null);
        }
      } catch (error) {
        console.error("[AppLock] Failed to load app lock preference", error);
        if (isCancelled) return;
        setAppLockEnabled(false);
        setAppLockPreferenceUserId(appLockSubjectId);
        appLockStateRef.current = "unlocked";
        setAppLockState("unlocked");
        setAppLockError(null);
      } finally {
        if (!isCancelled) {
          logBootTrace("app-lock:preference-load:end", {
            userId: user.id,
            subjectId: appLockSubjectId,
          });
          setAppLockPreferenceLoaded(true);
        }
      }
    };

    void loadPreference();

    return () => {
      isCancelled = true;
    };
  }, [appLockSubjectId, isReady, lockAppForAppLock, user?.id]);

  useEffect(() => {
    return subscribeAppLockPreference((enabled, changedUserId) => {
      if (changedUserId && changedUserId !== user?.id) return;
      const currentUserId = appLockSubjectId ?? changedUserId ?? null;
      setAppLockPreferenceLoaded(true);
      setAppLockPreferenceUserId(currentUserId);
      setAppLockEnabled(enabled);
      appLockStateRef.current = "unlocked";
      setAppLockState("unlocked");
      setAppLockError(null);
      logBootTrace("app-lock:preference-subscription", {
        enabled,
        userId: currentUserId,
      });
    });
  }, [appLockSubjectId, user?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;

      if (nextState === "active") {
        appLockHasActiveForegroundRef.current = true;
        return;
      }

      if (Date.now() < appLockIgnoreAppStateUntilRef.current) return;
      if (!shouldUseAppLock) return;
      if (appLockAuthInFlightRef.current) return;
      if (Date.now() < appLockGraceUntilRef.current) return;
      if (appLockStateRef.current !== "unlocked") return;

      if (nextState === "background") {
        const now = Date.now();
        const wasActiveForeground = appLockHasActiveForegroundRef.current;
        appLockHasActiveForegroundRef.current = false;

        if (!wasActiveForeground) return;
        if (
          now - appLockLastSuccessfulAuthAtRef.current <
          APP_LOCK_NATIVE_PROMPT_SETTLE_MS
        ) {
          return;
        }

        lockAppForAppLock("app-background");
      }
    });

    return () => {
      subscription.remove();
    };
  }, [lockAppForAppLock, shouldUseAppLock]);

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

  useEffect(() => {
    return subscribeToReceivedTransactionNotificationResponses(async (transaction) => {
      const exists = await transactionExists(transaction.signature);
      if (!exists) {
        await saveTransaction(transaction);
      }

      router.push({
        pathname: "/transaction-detail",
        params: { transactionId: transaction.id },
      });
    });
  }, [router]);

  if (
    appLockBootDecision === "waitingForPrivy" ||
    appLockBootDecision === "checkingPreference"
  ) {
    return <LaunchGateScreen reason={appLockBootDecision} />;
  }

  if (
    appLockBootDecision === "locked" ||
    appLockBootDecision === "authenticating"
  ) {
    return (
      <AppLockScreen
        isAuthenticating={appLockBootDecision === "authenticating"}
        errorMessage={appLockError}
        onUnlock={() => {
          void authenticateForAppLock();
        }}
      />
    );
  }

  if (isConnected === false) {
    return <OfflineScreen onRetry={refresh} />;
  }

  // Redirect logic
  if (isReady && !user && inAuthGroup) {
    // User is not logged in but trying to access protected routes
    return <Redirect href="/" />;
  }

  if (
    isReady &&
    user &&
    (isUnauthScreen ||
      (isUsernameScreen && !isCompletingUsername && !isSignupUsernameScreen))
  ) {
    // Authenticated users should leave auth screens, except username completion.
    return <Redirect href="/(main)/home" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="username" options={{ headerShown: false }} />
      <Stack.Screen name="email" options={{ headerShown: false }} />
      <Stack.Screen
        name="onboarding-setup"
        options={{
          headerShown: false,
          gestureEnabled: false,
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen
        name="balance"
        options={{
          headerShown: false,
          presentation: "formSheet",
          sheetAllowedDetents: [0.7],
          sheetGrabberVisible: true,
          sheetCornerRadius: 40,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
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
          headerShown: false,
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
          contentStyle: { backgroundColor: "transparent" },
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
          headerShown: false,
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
          contentStyle: { backgroundColor: "transparent" },
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
          contentStyle: { backgroundColor: "transparent" },
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
          contentStyle: { backgroundColor: "transparent" },
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
          contentStyle: { backgroundColor: "transparent" },
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
        name="crypto-deposit"
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
      <Stack.Screen
        name="deposit"
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
      <Stack.Screen
        name="fiat-deposit"
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
      <Stack.Screen
        name="activity"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="transaction-detail"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="earn-oro"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="profile"
        options={{ headerShown: false, animation: "slide_from_left" }}
      />
      <Stack.Screen
        name="export"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="account-details"
        options={{
          headerShown: false,
          presentation: "formSheet",
          sheetAllowedDetents: [0.995],
          sheetLargestUndimmedDetentIndex: "last",
          sheetGrabberVisible: true,
          sheetCornerRadius: 40,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen
        name="link-email"
        options={{
          headerShown: false,
          presentation: "formSheet",
          sheetAllowedDetents: [0.56],
          sheetLargestUndimmedDetentIndex: "last",
          sheetGrabberVisible: true,
          sheetCornerRadius: 34,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen
        name="privacy-policy"
        options={{
          headerShown: false,
          presentation: "formSheet",
          sheetAllowedDetents: [0.995],
          sheetLargestUndimmedDetentIndex: "last",
          sheetGrabberVisible: true,
          sheetCornerRadius: 40,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen
        name="terms-and-conditions"
        options={{
          headerShown: false,
          presentation: "formSheet",
          sheetAllowedDetents: [0.995],
          sheetLargestUndimmedDetentIndex: "last",
          sheetGrabberVisible: true,
          sheetCornerRadius: 40,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen
        name="notification-settings"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="security"
        options={{ headerShown: false, animation: "slide_from_right" }}
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
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    LexendDeca: require("../assets/fonts/LexendDeca-VariableFont_wght.ttf"),
  });
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const [showPostSplash, setShowPostSplash] = useState(
    consumePostSplashTransitionOnce
  );
  const hasPrivyConfig = Boolean(privyAppId && privyClientId);

  useEffect(() => {
    logBootTrace("root:services:init");
    initializeSupportChat();
    initializeTransactionNotifications();
  }, []);

  useEffect(() => {
    logBootTrace("root:fonts-state", { fontsLoaded });
  }, [fontsLoaded]);

  useEffect(() => {
    logBootTrace("root:post-splash-state", { showPostSplash });
  }, [showPostSplash]);

  useEffect(() => {
    if (!fontsLoaded) return;
    let isCancelled = false;

    const hideNativeSplash = async () => {
      try {
        logBootTrace("native-splash:hide:start");
        await SplashScreen.hideAsync();
      } catch (error) {
        logBootTrace("native-splash:hide:failed", {
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (!isCancelled) {
          logBootTrace("native-splash:hide:end");
          setNativeSplashHidden(true);
        }
      }
    };

    void hideNativeSplash();
    return () => {
      isCancelled = true;
    };
  }, [fontsLoaded]);

  if (!fontsLoaded || !nativeSplashHidden) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ToastProvider>
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
                      createOnLogin: "off",
                    },
                    solana: {
                      createOnLogin: "off",
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
            {showPostSplash ? (
              <PostSplashTransition onDone={() => setShowPostSplash(false)} />
            ) : null}
          </ErrorBoundary>
        </ToastProvider>
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
  secondaryActionButton: {
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: "600",
  },
  configList: {
    marginTop: 12,
    marginBottom: 8,
    alignItems: "center",
  },
  postSplashContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    flex: 1,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  postSplashAnimation: {
    ...StyleSheet.absoluteFillObject,
  },
  configCode: {
    fontSize: 13,
    fontWeight: "600",
    marginVertical: 2,
  },
  launchGateContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  appLockContainer: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  appLockIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    marginBottom: 20,
  },
  appLockTitle: {
    color: "#111111",
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
    textAlign: "center",
  },
  appLockSubtitle: {
    marginTop: 8,
    color: "rgba(0,0,0,0.55)",
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
  appLockError: {
    marginTop: 12,
    color: "#B42318",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  appLockButton: {
    marginTop: 24,
    minHeight: 52,
    borderRadius: 26,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111111",
  },
  appLockButtonDisabled: {
    opacity: 0.72,
  },
  appLockButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
