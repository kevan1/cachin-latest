import { useCallback, useEffect, useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { useLoginWithPasskey } from "@privy-io/expo/passkey";
import { usePrivy } from "@privy-io/expo";
import { toast as appToast } from "react-native-pretty-toast";

import { AlertSheet } from "@/components/AlertSheet";
import WabiTimerExperiment from "@/components/wabi-onboarding/WabiTimerExperiment";
import { useSeekerWalletLogin } from "@/hooks/useSeekerWalletLogin";
import {
  checkPasskeySupport,
  formatPasskeyError,
  getPasskeyFallbackMessage,
  isPasskeySupportedByOs,
  shouldFallbackToEmail,
} from "@/utils/passkeySupport";
import { getPasskeyRelyingPartyOrigin } from "@/utils/runtimeConfig";
import { logBootTrace } from "@/utils/bootTrace";
import { isSeekerWalletLoginEnabled } from "@/utils/seekerDevice";

export default function Index() {
  const router = useRouter();
  const passkeyRelyingParty =
    getPasskeyRelyingPartyOrigin() ?? "https://auth.kevan.ar";
  const [loading, setLoading] = useState(false);
  const [seekerWalletLoading, setSeekerWalletLoading] = useState(false);
  const [useEmailFallback, setUseEmailFallback] = useState(
    () => !isPasskeySupportedByOs()
  );
  const [passkeyAlert, setPasskeyAlert] = useState({
    visible: false,
    title: "Passkey unavailable",
    message: getPasskeyFallbackMessage("login"),
    mode: "login" as "login" | "signup",
  });
  const { user, isReady } = usePrivy();
  const loginWithSeekerWallet = useSeekerWalletLogin();
  const showSeekerWalletLogin = isSeekerWalletLoginEnabled();

  const showToast = useCallback((message: string) => {
    appToast.show({ title: message });
  }, []);

  useEffect(() => {
    logBootTrace("index:privy-state", {
      isReady,
      hasUser: Boolean(user?.id),
    });
  }, [isReady, user?.id]);

  useEffect(() => {
    if (!isReady || !user?.id) return;
    logBootTrace("index:redirect-home", { userId: user.id });
  }, [isReady, user?.id]);

  useEffect(() => {
    let isMounted = true;
    checkPasskeySupport().then((supported) => {
      if (!isMounted) return;
      if (!supported) {
        setUseEmailFallback(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const openPasskeyAlert = useCallback(
    (mode: "login" | "signup", title: string, message: string) => {
      setPasskeyAlert({ visible: true, mode, title, message });
    },
    []
  );

  const handlePasskeyAlertPrimary = useCallback(() => {
    setPasskeyAlert((prev) => ({ ...prev, visible: false }));
    router.push({ pathname: "/email", params: { mode: passkeyAlert.mode } });
  }, [passkeyAlert.mode, router]);

  const handlePasskeyAlertRetry = useCallback(() => {
    setUseEmailFallback(false);
    setPasskeyAlert((prev) => ({ ...prev, visible: false }));
  }, []);

  const { loginWithPasskey } = useLoginWithPasskey({
    onSuccess: () => {
      setLoading(false);
      showToast("Logged in");
      router.replace("/(main)/home");
    },
  });

  if (!isReady) {
    return null;
  }

  if (user) {
    return <Redirect href="/(main)/home" />;
  }

  const handleRegister = () => {
    if (useEmailFallback) {
      openPasskeyAlert(
        "signup",
        "Passkey unavailable",
        getPasskeyFallbackMessage("signup")
      );
      return;
    }
    router.push({ pathname: "/username", params: { mode: "signup" } });
  };

  const handleLogin = async () => {
    if (user) {
      router.replace("/(main)/home");
      return;
    }

    if (useEmailFallback) {
      openPasskeyAlert(
        "login",
        "Passkey unavailable",
        getPasskeyFallbackMessage("login")
      );
      return;
    }

    setLoading(true);
    try {
      await loginWithPasskey({
        relyingParty: passkeyRelyingParty,
      });
    } catch (err: any) {
      const message = formatPasskeyError(
        err,
        "Unable to log in with a passkey.",
        "Passkeys are not available on this device right now."
      );
      if (err?.code === "attempted_login_with_passkey_while_already_logged_in") {
        router.replace("/(main)/home");
        setLoading(false);
        return;
      }
      if (shouldFallbackToEmail(err)) {
        openPasskeyAlert(
          "login",
          "Passkey unavailable",
          message.includes("Passkeys are not available")
            ? getPasskeyFallbackMessage("login")
            : `${getPasskeyFallbackMessage("login")}\n\n${message}`
        );
        setLoading(false);
        return;
      }
      showToast(message);
      setLoading(false);
    }
  };

  const handleSeekerWalletLogin = async () => {
    if (user) {
      router.replace("/(main)/home");
      return;
    }

    setSeekerWalletLoading(true);
    try {
      const result = await loginWithSeekerWallet();
      showToast("Logged in");
      if (result.hasUsername) {
        router.replace("/(main)/home");
      } else {
        router.replace({
          pathname: "/username",
          params: { mode: "complete", source: "seeker-wallet" },
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to log in with Seeker Wallet.";
      showToast(message);
    } finally {
      setSeekerWalletLoading(false);
    }
  };

  return (
    <>
      <WabiTimerExperiment
        onRegister={handleRegister}
        onLogin={handleLogin}
        onNativeWalletLogin={
          showSeekerWalletLogin ? handleSeekerWalletLogin : undefined
        }
        loginLabel={loading ? "Signing in..." : "Login"}
        nativeWalletLabel={
          seekerWalletLoading ? "Opening wallet..." : "Continue with Seeker Wallet"
        }
        disabled={loading || seekerWalletLoading}
        nativeWalletDisabled={loading || seekerWalletLoading}
      />

      <AlertSheet
        isVisible={passkeyAlert.visible}
        eyebrow="Passkey sign in"
        title={passkeyAlert.title}
        message={passkeyAlert.message}
        helperText="After changing Settings, close this sheet and try passkey sign in again."
        primaryLabel="Continue with email"
        onPrimaryPress={handlePasskeyAlertPrimary}
        secondaryLabel="Try passkey again"
        onSecondaryPress={handlePasskeyAlertRetry}
        onClose={() => setPasskeyAlert((prev) => ({ ...prev, visible: false }))}
        showClose
      />
    </>
  );
}
