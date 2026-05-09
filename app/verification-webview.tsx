import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from "react-native-webview";

import { Colors } from "@/constants/theme";
import { updateIdentityVerificationInFirestore } from "@/services/firestoreService";
import { saveIdentityVerificationCache } from "@/utils/identityVerificationCache";
import { createIdentityVerificationLink } from "@/utils/identityVerificationService";

type VerificationResultMessage = {
  status?: string;
  error?: string;
  message?: string;
  reason?: string;
};

type WebViewErrorPayload = {
  nativeEvent?: {
    description?: string;
    title?: string;
  };
};

type VerificationLinkRequest = {
  url: string;
};

const SUCCESS_STATUSES = new Set(["approved", "completed", "success", "verified"]);
const PENDING_STATUSES = new Set([
  "in review",
  "in_review",
  "pending",
  "processing",
]);
const SUMSUB_VERIFIED_TEXT_SNIPPETS = [
  "your profile has been verified",
  "profile has been verified",
  "verification completed",
  "identity verified",
  "verification successful",
] as const;
const SUMSUB_PENDING_TEXT_SNIPPETS = [
  "being reviewed",
  "under review",
  "verification is in progress",
  "verification in progress",
  "we are reviewing",
] as const;
const STATUS_BRIDGE_SCRIPT = `
  (function () {
    if (window.__cachinVerificationBridgeInstalled) {
      return true;
    }
    window.__cachinVerificationBridgeInstalled = true;

    const VERIFIED = ${JSON.stringify(SUMSUB_VERIFIED_TEXT_SNIPPETS)};
    const PENDING = ${JSON.stringify(SUMSUB_PENDING_TEXT_SNIPPETS)};

    function post(status, message) {
      try {
        window.ReactNativeWebView &&
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ status: status, message: message, source: "dom" })
          );
      } catch (error) {}
    }

    function evaluate() {
      const text = (document.body && document.body.innerText || "").toLowerCase();
      if (!text) return;

      if (!window.__cachinVerifiedPosted && VERIFIED.some((snippet) => text.includes(snippet))) {
        window.__cachinVerifiedPosted = true;
        post("verified", "Your profile has been verified.");
        return;
      }

      if (!window.__cachinPendingPosted && PENDING.some((snippet) => text.includes(snippet))) {
        window.__cachinPendingPosted = true;
        post("pending", "Your verification is in review.");
      }
    }

    setInterval(evaluate, 1200);
    document.addEventListener("readystatechange", evaluate);
    window.addEventListener("load", evaluate);
    setTimeout(evaluate, 600);
    setTimeout(evaluate, 1800);
    return true;
  })();
`;
const CALLBACK_HOSTS = new Set(["cachin.app", "www.cachin.app"]);
const CALLBACK_PATHS = new Set(["/verification-result"]);

function parseVerificationResult(raw: string): VerificationResultMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as VerificationResultMessage;
  } catch {
    return null;
  }
}

function normalizeStatus(raw: string | undefined): string {
  return raw?.trim().toLowerCase() ?? "";
}

export default function VerificationWebViewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme: keyof typeof Colors =
    useColorScheme() === "dark" ? "dark" : "light";
  const palette = Colors[colorScheme];
  const handledResultRef = useRef(false);
  const { url, title, address, addresses, userId } = useLocalSearchParams<{
    url?: string | string[];
    title?: string | string[];
    address?: string | string[];
    addresses?: string | string[];
    userId?: string | string[];
  }>();
  const [resolvedVerificationUrl, setResolvedVerificationUrl] = useState<string | null>(null);
  const [isLoadingVerificationUrl, setIsLoadingVerificationUrl] = useState(true);
  const [verificationUrlError, setVerificationUrlError] = useState<string | null>(null);
  const [isSandboxFlow, setIsSandboxFlow] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const verificationUrl = useMemo(() => {
    const raw = Array.isArray(url) ? url[0] : url;
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [url]);

  const verificationUserId = useMemo(() => {
    const raw = Array.isArray(userId) ? userId[0] : userId;
    const trimmed = raw?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
  }, [userId]);

  const screenTitle = useMemo(() => {
    const raw = Array.isArray(title) ? title[0] : title;
    const trimmed = raw?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : "Identity verification";
  }, [title]);

  const solanaAddresses = useMemo(() => {
    const uniqueAddresses = new Set<string>();
    const rawAddresses = Array.isArray(addresses) ? addresses[0] : addresses;
    const rawPrimaryAddress = Array.isArray(address) ? address[0] : address;

    for (const candidate of [rawAddresses, rawPrimaryAddress]) {
      if (!candidate) continue;

      for (const token of candidate.split(",")) {
        const trimmed = token.trim();
        if (!trimmed) continue;
        uniqueAddresses.add(trimmed);
      }
    }

    return Array.from(uniqueAddresses);
  }, [address, addresses]);

  useEffect(() => {
    let isActive = true;

    const resolveVerificationUrl = async () => {
      if (verificationUserId) {
        try {
          setIsLoadingVerificationUrl(true);
          setVerificationUrlError(null);
          const session = await createIdentityVerificationLink({ userId: verificationUserId });
          if (!isActive) return;
          setResolvedVerificationUrl(session.url);
          setIsSandboxFlow(session.isSandbox);
          return;
        } catch (error) {
          if (!isActive) return;
          if (verificationUrl) {
            setResolvedVerificationUrl(verificationUrl);
            setIsSandboxFlow(verificationUrl.includes("/sbx_"));
            setVerificationUrlError(null);
            return;
          }

          setResolvedVerificationUrl(null);
          setVerificationUrlError(
            error instanceof Error ? error.message : "Failed to create verification link."
          );
          return;
        } finally {
          if (isActive) {
            setIsLoadingVerificationUrl(false);
          }
        }
      }

      setResolvedVerificationUrl(verificationUrl);
      setIsSandboxFlow(verificationUrl?.includes("/sbx_") ?? false);
      setVerificationUrlError(null);
      setIsLoadingVerificationUrl(false);
    };

    void resolveVerificationUrl();

    return () => {
      isActive = false;
    };
  }, [retryCount, verificationUrl, verificationUserId]);

  const persistVerificationStatus = useCallback(
    async (status: "verified" | "pending") => {
      if (solanaAddresses.length === 0 && !verificationUserId) return;

      const identityVerification = {
        status,
        provider: "sumsub",
        verifiedAt: status === "verified" ? Date.now() : undefined,
        lastEventAt: Date.now(),
        isSandbox: isSandboxFlow,
      } as const;

      await saveIdentityVerificationCache({
        userId: verificationUserId,
        addresses: solanaAddresses,
        identityVerification,
      });

      if (solanaAddresses.length === 0) {
        return;
      }

      await Promise.all(
        solanaAddresses.map((solanaAddress) =>
          updateIdentityVerificationInFirestore(solanaAddress, identityVerification)
        )
      );
    },
    [isSandboxFlow, solanaAddresses, verificationUserId]
  );

  const closeScreen = useCallback(() => {
    router.back();
  }, [router]);

  const finishWithAlert = useCallback(
    (
      alertTitle: string,
      alertMessage: string,
      buttons?: { text: string; onPress?: () => void }[]
    ) => {
      if (handledResultRef.current) return;
      handledResultRef.current = true;
      Alert.alert(
        alertTitle,
        alertMessage,
        buttons ?? [{ text: "Close", onPress: closeScreen }]
      );
    },
    [closeScreen]
  );

  const handleSuccessfulCompletion = useCallback(async () => {
    try {
      await persistVerificationStatus("verified");
    } catch (error) {
      console.error("[verification-webview] failed to persist verified status", error);
    }

    finishWithAlert(
      "Verification complete",
      isSandboxFlow
        ? "Your identity verification is marked as verified for this sandbox account."
        : "Your identity verification is marked as verified.",
      [{ text: "Done", onPress: closeScreen }]
    );
  }, [closeScreen, finishWithAlert, isSandboxFlow, persistVerificationStatus]);

  const handlePendingCompletion = useCallback(
    async (message?: string) => {
      try {
        await persistVerificationStatus("pending");
      } catch (error) {
        console.error("[verification-webview] failed to persist pending status", error);
      }

      finishWithAlert(
        "Verification in review",
        message?.trim() || "Your verification is still being reviewed. Check back shortly."
      );
    },
    [finishWithAlert, persistVerificationStatus]
  );

  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const parsed = parseVerificationResult(event.nativeEvent.data);
      const status = normalizeStatus(parsed?.status);

      if (SUCCESS_STATUSES.has(status)) {
        void handleSuccessfulCompletion();
        return;
      }

      if (PENDING_STATUSES.has(status)) {
        void handlePendingCompletion(parsed?.message);
        return;
      }

      if (status === "error" || parsed?.error?.trim()) {
        finishWithAlert(
          "Verification failed",
          parsed?.error?.trim() ||
            parsed?.reason?.trim() ||
            parsed?.message?.trim() ||
            "The verification page returned an error."
        );
      }
    },
    [finishWithAlert, handlePendingCompletion, handleSuccessfulCompletion]
  );

  const handleCallbackUrl = useCallback(
    (rawUrl: string) => {
      if (handledResultRef.current) return true;

      try {
        const currentUrl = new URL(rawUrl);
        const host = currentUrl.hostname.toLowerCase();
        const path = currentUrl.pathname.replace(/\/+$/, "") || "/";

        if (!CALLBACK_HOSTS.has(host) || !CALLBACK_PATHS.has(path)) {
          return false;
        }

        const status = normalizeStatus(
          currentUrl.searchParams.get("status") ??
            currentUrl.searchParams.get("verificationStatus") ??
            currentUrl.searchParams.get("kycStatus") ??
            undefined
        );

        if (SUCCESS_STATUSES.has(status)) {
          void handleSuccessfulCompletion();
          return true;
        }

        if (PENDING_STATUSES.has(status)) {
          void handlePendingCompletion();
          return true;
        }

        finishWithAlert(
          "Verification failed",
          currentUrl.searchParams.get("error")?.trim() ||
            currentUrl.searchParams.get("message")?.trim() ||
            "The verification flow returned an error."
        );
        return true;
      } catch {
        return false;
      }
    },
    [finishWithAlert, handlePendingCompletion, handleSuccessfulCompletion]
  );

  const handleShouldStartLoadWithRequest = useCallback(
    (request: VerificationLinkRequest) => !handleCallbackUrl(request.url),
    [handleCallbackUrl]
  );

  const handleNavigationStateChange = useCallback(
    (navigation: WebViewNavigation) => {
      if (handledResultRef.current) return;
      if (handleCallbackUrl(navigation.url)) return;

      try {
        const currentUrl = new URL(navigation.url);
        const status = normalizeStatus(
          currentUrl.searchParams.get("status") ??
            currentUrl.searchParams.get("verificationStatus") ??
            currentUrl.searchParams.get("kycStatus") ??
            undefined
        );

        if (SUCCESS_STATUSES.has(status)) {
          void handleSuccessfulCompletion();
          return;
        }

        if (PENDING_STATUSES.has(status)) {
          void handlePendingCompletion();
          return;
        }

        if (status === "error") {
          finishWithAlert(
            "Verification failed",
            currentUrl.searchParams.get("error")?.trim() ||
              currentUrl.searchParams.get("message")?.trim() ||
              "The verification flow returned an error."
          );
        }
      } catch {
        // Ignore navigation events with non-URL values.
      }
    },
    [finishWithAlert, handleCallbackUrl, handlePendingCompletion, handleSuccessfulCompletion]
  );

  const handleWebViewError = useCallback(
    (event: WebViewErrorPayload) => {
      const message =
        event.nativeEvent?.description?.trim() ||
        event.nativeEvent?.title?.trim() ||
        "Could not load the verification page.";
      finishWithAlert("WebView error", message);
    },
    [finishWithAlert]
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.surface }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: palette.surface,
            borderBottomColor: palette.borderSubtle,
            paddingTop: Math.max(insets.top, 8) + 4,
          },
        ]}
      >
        <TouchableOpacity
          onPress={closeScreen}
          style={[styles.closeButton, { backgroundColor: palette.actionSecondary }]}
          activeOpacity={0.86}
        >
          <MaterialIcons
            name="close"
            size={16}
            color={palette.actionSecondaryText}
          />
          <Text
            style={[styles.closeButtonText, { color: palette.actionSecondaryText }]}
          >
            Close
          </Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: palette.primaryText }]}>
          {screenTitle}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoadingVerificationUrl ? (
        <View style={[styles.loader, { backgroundColor: palette.surface }]}>
          <ActivityIndicator size="small" color={palette.secondaryText} />
          <Text style={[styles.loaderText, { color: palette.secondaryText }]}>
            Loading verification flow...
          </Text>
        </View>
      ) : resolvedVerificationUrl ? (
        <WebView
          source={{ uri: resolvedVerificationUrl }}
          onMessage={handleWebViewMessage}
          onError={handleWebViewError}
          onNavigationStateChange={handleNavigationStateChange}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          injectedJavaScript={STATUS_BRIDGE_SCRIPT}
          incognito
          cacheEnabled={false}
          javaScriptEnabled
          domStorageEnabled
          javaScriptCanOpenWindowsAutomatically
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.loader, { backgroundColor: palette.surface }]}>
              <ActivityIndicator size="small" color={palette.secondaryText} />
              <Text style={[styles.loaderText, { color: palette.secondaryText }]}>
                Loading verification flow...
              </Text>
            </View>
          )}
          style={styles.webView}
        />
      ) : (
        <View style={[styles.loader, { backgroundColor: palette.surface }]}>
          <Text style={[styles.loaderText, { color: palette.secondaryText }]}>
            {verificationUrlError ?? "Missing verification URL configuration."}
          </Text>
          {verificationUserId ? (
            <TouchableOpacity
              onPress={() => {
                handledResultRef.current = false;
                setIsLoadingVerificationUrl(true);
                setVerificationUrlError(null);
                setResolvedVerificationUrl(null);
                setRetryCount((current) => current + 1);
              }}
              style={[styles.fallbackButton, { backgroundColor: palette.actionSecondary }]}
            >
              <Text
                style={[
                  styles.fallbackButtonText,
                  { color: palette.actionSecondaryText },
                ]}
              >
                Retry
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={closeScreen}
            style={[styles.fallbackButton, { backgroundColor: palette.actionSecondary }]}
          >
            <Text
              style={[
                styles.fallbackButtonText,
                { color: palette.actionSecondaryText },
              ]}
            >
              Go back
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeButton: {
    borderRadius: 10,
    minHeight: 34,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  headerSpacer: {
    width: 66,
  },
  webView: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  loaderText: {
    fontSize: 14,
    textAlign: "center",
  },
  fallbackButton: {
    borderRadius: 10,
    minHeight: 40,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
