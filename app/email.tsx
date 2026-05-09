import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useLoginWithEmail,
} from "@privy-io/expo";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmailInput, validateEmail } from "@/components/auth/email-input";
import { HomeOnboardingBackground } from "@/components/onboarding/HomeOnboardingBackground";

type Step = "email" | "code";

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const candidate =
      (error as { message?: unknown }).message ??
      (error as { error?: unknown }).error ??
      (error as { localizedDescription?: unknown }).localizedDescription;
    if (typeof candidate === "string") return candidate;
  }
  return "";
};

export default function EmailOnboardingScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableHeight = Math.max(1, screenHeight - insets.top - insets.bottom);
  const isCompactLayout = availableHeight < 820 || screenWidth < 380;
  const { mode } = useLocalSearchParams<{ mode?: string | string[] }>();
  const modeValue = Array.isArray(mode) ? mode[0] : mode;
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    if (modeValue === "signup") return "Sign up with email";
    if (modeValue === "login") return "Log in with email";
    return "Continue with email";
  }, [modeValue]);

  const { sendCode, loginWithCode, state } = useLoginWithEmail({
    onSendCodeSuccess: ({ email: sentEmail }) => {
      setSentToEmail(sentEmail);
      setStep("code");
      setError(null);
    },
    onLoginSuccess: async () => {
      if (modeValue === "signup") {
        router.replace({ pathname: "/username", params: { mode: "complete" } });
        return;
      }

      router.replace("/(main)/home");
    },
    onError: (err) => {
      setError(getErrorMessage(err) || "Unable to continue with email.");
    },
  });

  const isSending = state.status === "sending-code";
  const isSubmitting = state.status === "submitting-code";
  const isBusy = isSending || isSubmitting;

  const handleSendCode = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!validateEmail(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    try {
      await sendCode({ email: trimmedEmail });
    } catch (err) {
      setError(getErrorMessage(err) || "Unable to send the code.");
    }
  };

  const handleVerifyCode = async () => {
    const trimmedCode = code.trim();
    const targetEmail = (sentToEmail ?? email).trim().toLowerCase();
    if (!validateEmail(targetEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!trimmedCode) {
      setError("Enter the code from your email.");
      return;
    }
    setError(null);
    try {
      await loginWithCode({ email: targetEmail, code: trimmedCode });
    } catch (err) {
      setError(getErrorMessage(err) || "Unable to verify the code.");
    }
  };

  const handleResend = async () => {
    const targetEmail = (sentToEmail ?? email).trim().toLowerCase();
    if (!validateEmail(targetEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    try {
      await sendCode({ email: targetEmail });
    } catch (err) {
      setError(getErrorMessage(err) || "Unable to resend the code.");
    }
  };

  const handleBack = () => {
    if (step === "code") {
      setStep("email");
      setCode("");
      return;
    }
    router.back();
  };

  return (
    <>
      <StatusBar style="dark" />
      <View style={styles.root}>
        <HomeOnboardingBackground />
        <KeyboardAvoidingView
          style={styles.keyboardAvoiding}
          behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            style={styles.container}
            contentContainerStyle={[
              styles.containerContent,
              {
                minHeight: availableHeight,
                paddingHorizontal: screenWidth < 380 ? 16 : 20,
                paddingTop: Math.max(insets.top + 2, 10),
                paddingBottom: Math.max(insets.bottom + 18, 28),
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.screen}>
              <View style={styles.header}>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={handleBack}
                  style={styles.backButton}
                >
                  <Text style={styles.backText}>
                    {step === "code" ? "‹" : "✕"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.content,
                  isCompactLayout ? styles.contentCompact : null,
                ]}
              >
                <Text style={[styles.kicker, isCompactLayout ? styles.kickerCompact : null]}>
                  Email access
                </Text>
                <Text style={[styles.title, isCompactLayout ? styles.titleCompact : null]}>
                  {title}
                </Text>
                <Text style={[styles.subtitle, isCompactLayout ? styles.subtitleCompact : null]}>
                  We&apos;ll email you a one-time code to verify your account.
                </Text>

                {step === "email" ? (
                  <>
                    <View style={styles.inputShell}>
                      <EmailInput value={email} onChangeText={setEmail} error={!!error} />
                    </View>
                    <View style={styles.spacer} />
                    <TouchableOpacity
                      accessibilityRole="button"
                      style={[
                        styles.primaryButton,
                        isBusy && styles.buttonDisabled,
                      ]}
                      onPress={handleSendCode}
                      disabled={isBusy}
                    >
                      {isSending ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Send code</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.codeBlock}>
                      <Text style={styles.codeLabel}>
                        Enter the code sent to {sentToEmail ?? email}
                      </Text>
                      <TextInput
                        value={code}
                        onChangeText={(text) => setCode(text.replace(/\s/g, ""))}
                        placeholder="123456"
                        placeholderTextColor="rgba(0,0,0,0.30)"
                        keyboardType="number-pad"
                        textContentType="oneTimeCode"
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={8}
                        style={[
                          styles.codeInput,
                          error ? styles.codeInputError : null,
                        ]}
                      />
                    </View>
                    <View style={styles.spacer} />
                    <TouchableOpacity
                      accessibilityRole="button"
                      style={[
                        styles.primaryButton,
                        isBusy && styles.buttonDisabled,
                      ]}
                      onPress={handleVerifyCode}
                      disabled={isBusy}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Verify code</Text>
                      )}
                    </TouchableOpacity>
                    <View style={styles.secondaryRow}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        style={[
                          styles.secondaryButton,
                          isBusy && styles.buttonDisabled,
                        ]}
                        onPress={handleResend}
                        disabled={isBusy}
                      >
                        <Text style={styles.secondaryButtonText}>
                          Resend code
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityRole="button"
                        style={[
                          styles.secondaryButton,
                          isBusy && styles.buttonDisabled,
                        ]}
                        onPress={() => setStep("email")}
                        disabled={isBusy}
                      >
                        <Text style={styles.secondaryButtonText}>
                          Use a different email
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {error ? (
                  <Text selectable style={styles.errorText}>
                    {error}
                  </Text>
                ) : null}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  keyboardAvoiding: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  containerContent: {
    flexGrow: 1,
  },
  screen: {
    flexGrow: 1,
    backgroundColor: "transparent",
  },
  header: {
    alignItems: "flex-start",
    paddingBottom: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.38)",
    boxShadow: "0 8px 18px rgba(11, 26, 51, 0.18)",
  },
  backText: {
    fontSize: 24,
    fontWeight: "600",
    color: "rgba(0,0,0,0.64)",
  },
  content: {
    gap: 16,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.38)",
    boxShadow: "0 18px 38px rgba(13, 28, 54, 0.18)",
  },
  contentCompact: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    gap: 12,
  },
  kicker: {
    color: "rgba(0,0,0,0.46)",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  kickerCompact: {
    marginBottom: -2,
  },
  title: {
    color: "rgba(0,0,0,0.72)",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: 0,
  },
  titleCompact: {
    fontSize: 29,
    lineHeight: 33,
  },
  subtitle: {
    color: "rgba(0,0,0,0.50)",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "600",
    letterSpacing: 0,
    marginBottom: 8,
  },
  subtitleCompact: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 4,
  },
  inputShell: {
    borderRadius: 22,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17,24,39,0.92)",
    boxShadow: "0 14px 26px rgba(12, 24, 46, 0.22)",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
  },
  secondaryRow: {
    flexDirection: "column",
    gap: 10,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.34)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.48)",
  },
  secondaryButtonText: {
    color: "rgba(0,0,0,0.62)",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
  },
  codeBlock: {
    gap: 8,
  },
  codeLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(0,0,0,0.46)",
    fontWeight: "800",
  },
  codeInput: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.44)",
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.42)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 20,
    letterSpacing: 2,
    color: "rgba(0,0,0,0.72)",
    fontWeight: "700",
  },
  codeInputError: {
    borderColor: "#ef4444",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    fontWeight: "600",
  },
  spacer: {
    height: 22,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
