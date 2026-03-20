import { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { EmailInput, validateEmail } from "@/components/auth/email-input";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

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
  const { height: screenHeight } = useWindowDimensions();
  const { mode } = useLocalSearchParams<{ mode?: string | string[] }>();
  const modeValue = Array.isArray(mode) ? mode[0] : mode;
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? "light"];
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
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.containerContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={[styles.screen, { minHeight: screenHeight }]}>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={handleBack}
            style={styles.backButton}
          >
            <Text style={[styles.backText, { color: palette.secondaryText }]}>
              {step === "code" ? "‹" : "✕"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: palette.primaryText }]}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: palette.secondaryText }]}>
            We&apos;ll email you a one-time code to verify your account.
          </Text>

          {step === "email" ? (
            <>
              <EmailInput value={email} onChangeText={setEmail} error={!!error} />
              <TouchableOpacity
                accessibilityRole="button"
                style={[
                  styles.primaryButton,
                  { backgroundColor: palette.accent },
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
                <Text style={[styles.codeLabel, { color: palette.secondaryText }]}>
                  Enter the code sent to {sentToEmail ?? email}
                </Text>
                <TextInput
                  value={code}
                  onChangeText={(text) => setCode(text.replace(/\s/g, ""))}
                  placeholder="123456"
                  placeholderTextColor={palette.secondaryText}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={8}
                  style={[
                    styles.codeInput,
                    {
                      borderColor: error ? "#ef4444" : palette.inputBorder,
                      color: palette.primaryText,
                    },
                  ]}
                />
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                style={[
                  styles.primaryButton,
                  { backgroundColor: palette.accent },
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
                    { backgroundColor: palette.actionSecondary },
                    isBusy && styles.buttonDisabled,
                  ]}
                  onPress={handleResend}
                  disabled={isBusy}
                >
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: palette.actionSecondaryText },
                    ]}
                  >
                    Resend code
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.secondaryButton,
                    { backgroundColor: palette.actionSecondary },
                    isBusy && styles.buttonDisabled,
                  ]}
                  onPress={() => setStep("email")}
                  disabled={isBusy}
                >
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: palette.actionSecondaryText },
                    ]}
                  >
                    Use a different email
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {error ? (
            <Text style={[styles.errorText, { color: "#ef4444" }]}>{error}</Text>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerContent: {
    flexGrow: 1,
  },
  screen: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  header: {
    alignItems: "flex-start",
    marginBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 24,
    fontWeight: "600",
  },
  content: {
    flexGrow: 1,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryRow: {
    flexDirection: "column",
    gap: 10,
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  codeBlock: {
    gap: 8,
  },
  codeLabel: {
    fontSize: 13,
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    letterSpacing: 2,
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
    textAlign: "center",
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
