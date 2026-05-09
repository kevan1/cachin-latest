import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLinkEmail, usePrivy } from '@privy-io/expo';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from 'react-native-pretty-toast';

import { validateEmail } from '@/components/auth/email-input';

const SHEET_BACKGROUND = '#1C1C1E';

type Step = 'email' | 'code';

type LinkedAccountLike = {
  type?: string;
  address?: string | null;
  email?: string | null;
};

type LinkEmailUser = {
  linkedAccounts?: LinkedAccountLike[];
  linked_accounts?: LinkedAccountLike[];
  email?: string | { address?: string | null } | null;
};

function normalizeText(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function getLinkedEmail(user: LinkEmailUser | null | undefined) {
  const linkedAccounts = user?.linkedAccounts ?? user?.linked_accounts;
  const accounts = Array.isArray(linkedAccounts) ? linkedAccounts : [];
  const emailAccount = accounts.find((account) => account?.type === 'email');
  const rawEmail = user?.email;

  return normalizeText(emailAccount?.address)
    ?? normalizeText(emailAccount?.email)
    ?? normalizeText(typeof rawEmail === 'string' ? rawEmail : rawEmail?.address);
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const candidate =
      (error as { message?: unknown }).message ??
      (error as { error?: unknown }).error ??
      (error as { localizedDescription?: unknown }).localizedDescription;
    if (typeof candidate === 'string') return candidate;
  }
  return '';
}

export default function LinkEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user } = usePrivy();
  const linkedEmail = getLinkedEmail(user as LinkEmailUser | null);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { sendCode, linkWithCode, state } = useLinkEmail({
    onSendCodeSuccess: ({ email: sentEmail }) => {
      setSentToEmail(sentEmail);
      setStep('code');
      setError(null);
    },
    onLinkSuccess: () => {
      toast.success('Email linked');
      router.back();
    },
    onError: (err) => {
      setError(getErrorMessage(err) || 'Unable to link this email.');
    },
  });

  const isSending = state.status === 'sending-code';
  const isSubmitting = state.status === 'submitting-code';
  const isBusy = isSending || isSubmitting;

  const title = useMemo(() => {
    if (linkedEmail) return 'Email already linked';
    return step === 'email' ? 'Link email' : 'Verify email';
  }, [linkedEmail, step]);

  const handleClose = () => {
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const handleSendCode = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!validateEmail(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    setError(null);
    try {
      await sendCode({ email: trimmedEmail });
    } catch (err) {
      setError(getErrorMessage(err) || 'Unable to send the verification code.');
    }
  };

  const handleVerifyCode = async () => {
    const targetEmail = (sentToEmail ?? email).trim().toLowerCase();
    const trimmedCode = code.trim();

    if (!validateEmail(targetEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!trimmedCode) {
      setError('Enter the code from your email.');
      return;
    }

    setError(null);
    try {
      await linkWithCode({ email: targetEmail, code: trimmedCode });
    } catch (err) {
      setError(getErrorMessage(err) || 'Unable to verify the code.');
    }
  };

  const handleResend = async () => {
    const targetEmail = (sentToEmail ?? email).trim().toLowerCase();
    if (!validateEmail(targetEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    setError(null);
    try {
      await sendCode({ email: targetEmail });
      toast.info('Verification code sent again.');
    } catch (err) {
      setError(getErrorMessage(err) || 'Unable to resend the code.');
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom + 32, 48) },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close link email"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={handleClose}
          style={({ pressed }) => [
            styles.closeButton,
            pressed ? styles.closeButtonPressed : null,
          ]}
        >
          <SymbolView
            name="xmark"
            fallback={<Text style={styles.closeFallback}>X</Text>}
            resizeMode="scaleAspectFit"
            scale="medium"
            size={16}
            tintColor="#FFFFFF"
            weight="semibold"
          />
        </Pressable>
      </View>

      <Text style={styles.title}>{title}</Text>

      {linkedEmail ? (
        <>
          <Text style={styles.subtitle}>
            This account already has an email linked.
          </Text>
          <View style={styles.infoCard}>
            <Text selectable style={styles.infoLabel}>Email</Text>
            <Text selectable numberOfLines={1} style={styles.infoValue}>{linkedEmail}</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.86}
            onPress={handleClose}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </>
      ) : step === 'email' ? (
        <>
          <Text style={styles.subtitle}>
            Add an email as a second way to sign in to this passkey account.
          </Text>

          <View style={styles.warningCard}>
            <SymbolView
              name="exclamationmark.triangle.fill"
              fallback={<Text style={styles.warningFallback}>!</Text>}
              resizeMode="scaleAspectFit"
              scale="medium"
              size={18}
              tintColor="#FFD166"
              weight="semibold"
            />
            <Text style={styles.warningText}>
              This cannot be reversed in the app. Once verified, this email will be linked to your account.
            </Text>
          </View>

          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={!isBusy}
            inputMode="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            onSubmitEditing={handleSendCode}
            placeholder="email@example.com"
            placeholderTextColor="rgba(255,255,255,0.32)"
            returnKeyType="send"
            style={[styles.input, error ? styles.inputError : null]}
            textContentType="emailAddress"
            value={email}
          />

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.86}
            disabled={isBusy}
            onPress={handleSendCode}
            style={[styles.primaryButton, isBusy ? styles.buttonDisabled : null]}
          >
            {isSending ? (
              <ActivityIndicator color="#111111" />
            ) : (
              <Text style={styles.primaryButtonText}>Send OTP</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>
            Enter the verification code sent to {sentToEmail ?? email}.
          </Text>

          <TextInput
            autoCapitalize="none"
            autoComplete="one-time-code"
            autoCorrect={false}
            editable={!isBusy}
            inputMode="numeric"
            keyboardType="number-pad"
            maxLength={8}
            onChangeText={(text) => setCode(text.replace(/\s/g, ''))}
            onSubmitEditing={handleVerifyCode}
            placeholder="123456"
            placeholderTextColor="rgba(255,255,255,0.32)"
            returnKeyType="done"
            style={[styles.input, styles.codeInput, error ? styles.inputError : null]}
            textContentType="oneTimeCode"
            value={code}
          />

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.86}
            disabled={isBusy}
            onPress={handleVerifyCode}
            style={[styles.primaryButton, isBusy ? styles.buttonDisabled : null]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#111111" />
            ) : (
              <Text style={styles.primaryButtonText}>Verify and link</Text>
            )}
          </TouchableOpacity>

          <View style={styles.secondaryRow}>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.84}
              disabled={isBusy}
              onPress={handleResend}
              style={[styles.secondaryButton, isBusy ? styles.buttonDisabled : null]}
            >
              <Text style={styles.secondaryButtonText}>Resend code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.84}
              disabled={isBusy}
              onPress={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
              style={[styles.secondaryButton, isBusy ? styles.buttonDisabled : null]}
            >
              <Text style={styles.secondaryButtonText}>Change email</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SHEET_BACKGROUND,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  header: {
    minHeight: 46,
    alignItems: 'flex-end',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  closeButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ scale: 0.96 }],
  },
  closeFallback: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: 0,
    marginTop: 12,
    marginBottom: 20,
  },
  warningCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,209,102,0.26)',
    backgroundColor: 'rgba(255,209,102,0.10)',
  },
  warningText: {
    flex: 1,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0,
  },
  warningFallback: {
    color: '#FFD166',
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '900',
  },
  input: {
    minHeight: 58,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#303030',
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: 0,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  inputError: {
    borderColor: '#FF6B6B',
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 4,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 28,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 18,
  },
  primaryButtonText: {
    color: '#111111',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: 0,
  },
  secondaryRow: {
    gap: 10,
    marginTop: 12,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 18,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 0,
  },
  infoCard: {
    borderRadius: 22,
    borderCurve: 'continuous',
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#303030',
  },
  infoLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: 0,
  },
  infoValue: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 8,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 0,
    textAlign: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.62,
  },
});
