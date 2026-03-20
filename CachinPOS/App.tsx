import "./polyfills";

import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import Svg, { Circle, Path } from "react-native-svg";

import {
  PrivyProvider,
  useEmbeddedSolanaWallet,
  useLoginWithEmail,
  usePrivy,
} from "@privy-io/expo";

import {
  buildSolanaPayUsdcUri,
  formatSolanaPayAmount,
  SOLANA_USDC_MINT,
} from "./utils/solanaPay";

const privyAppId =
  process.env.EXPO_PUBLIC_PRIVY_APP_ID ||
  Constants.expoConfig?.extra?.privyAppId ||
  "";
const privyClientId =
  process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ||
  Constants.expoConfig?.extra?.privyClientId ||
  "";

const SOLANA_RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ||
  "https://solxar.mainnet.rpcpool.com/efba4db1-e231-40f6-a16f-6e24e8f72b5c";

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

type Screen =
  | { kind: "auth" }
  | { kind: "pos" }
  | { kind: "qr"; uri: string; reference: string; amount: string; recipient: string }
  | { kind: "paid"; signature: string; amount: string; recipient: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toBaseUnits(amount: string, decimals: number): bigint | null {
  const v = String(amount).trim();
  if (!v) return null;
  const [wholeRaw, decRaw = ""] = v.split(".", 2);
  const whole = (wholeRaw || "0").replace(/^0+(?=\d)/, "");
  const dec = (decRaw || "").slice(0, decimals);
  if (!/^\d+$/.test(whole || "0")) return null;
  if (dec && !/^\d+$/.test(dec)) return null;
  const padded = dec.padEnd(decimals, "0");
  try {
    return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
  } catch {
    return null;
  }
}

function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

function formatAddress(address: string): string {
  const v = address.trim();
  if (v.length <= 12) return v;
  return `${v.slice(0, 4)}...${v.slice(-4)}`;
}

function normalizeAmountInput(raw: string): string {
  const cleaned = raw.replace(",", ".").replace(/[^\d.]/g, "");
  const [whole, dec = ""] = cleaned.split(".", 2);
  const wholeNorm = (whole || "").replace(/^0+(?=\d)/, "");
  const decNorm = dec.slice(0, 6);
  if (cleaned.includes(".")) return `${wholeNorm || "0"}.${decNorm}`;
  return wholeNorm;
}

function isValidSolanaAddress(address: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(address.trim());
    return true;
  } catch {
    return false;
  }
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        (pressed || disabled) && styles.primaryButtonPressed,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.secondaryButton,
        (pressed || disabled) && styles.secondaryButtonPressed,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function CheckmarkBadge({ size = 72 }: { size?: number }) {
  return (
    <View
      style={[
        styles.checkWrap,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Circle cx="32" cy="32" r="30" fill="#16A34A" />
        <Path
          d="M18 34 L28 44 L48 22"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

function Keypad({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const press = (key: string) => {
    if (key === "del") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === "clr") {
      onChange("");
      return;
    }
    onChange(normalizeAmountInput(`${value}${key}`));
  };

  const keys: Array<{ label: string; key: string }> = [
    { label: "1", key: "1" },
    { label: "2", key: "2" },
    { label: "3", key: "3" },
    { label: "4", key: "4" },
    { label: "5", key: "5" },
    { label: "6", key: "6" },
    { label: "7", key: "7" },
    { label: "8", key: "8" },
    { label: "9", key: "9" },
    { label: ".", key: "." },
    { label: "0", key: "0" },
    { label: "⌫", key: "del" },
  ];

  return (
    <View style={styles.keypad}>
      {keys.map((k) => (
        <Pressable
          key={k.key}
          accessibilityRole="button"
          onPress={() => press(k.key)}
          style={({ pressed }) => [
            styles.keypadKey,
            pressed && styles.keypadKeyPressed,
          ]}
        >
          <Text style={styles.keypadKeyText}>{k.label}</Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={() => press("clr")}
        style={({ pressed }) => [
          styles.keypadWide,
          pressed && styles.keypadKeyPressed,
        ]}
      >
        <Text style={styles.keypadWideText}>Clear</Text>
      </Pressable>
    </View>
  );
}

function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { sendCode, loginWithCode, state } = useLoginWithEmail({
    onSendCodeSuccess: ({ email: sentEmail }) => {
      setSentToEmail(sentEmail);
      setStep("code");
      setError(null);
    },
    onLoginSuccess: () => {
      setError(null);
      onAuthed();
    },
    onError: (err) => {
      const msg =
        typeof err === "string"
          ? err
          : (err as { message?: string })?.message || "Unable to continue.";
      setError(msg);
    },
  });

  const isSending = state.status === "sending-code";
  const isSubmitting = state.status === "submitting-code";
  const isBusy = isSending || isSubmitting;

  const submitEmail = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!validateEmail(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    await sendCode({ email: trimmedEmail });
  };

  const submitCode = async () => {
    const targetEmail = (sentToEmail ?? email).trim().toLowerCase();
    const trimmedCode = code.trim();
    if (!validateEmail(targetEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!trimmedCode) {
      setError("Enter the code from your email.");
      return;
    }
    setError(null);
    await loginWithCode({ email: targetEmail, code: trimmedCode });
  };

  return (
    <View style={styles.authWrap}>
      <Text style={styles.brand}>CachinPOS</Text>
      <Text style={styles.subtitle}>Sign in to get your merchant wallet</Text>

      {step === "email" ? (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="rgba(255,255,255,0.5)"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.authInput}
          />
          <PrimaryButton
            label={isSending ? "Sending..." : "Send code"}
            onPress={submitEmail}
            disabled={isBusy}
          />
        </>
      ) : (
        <>
          <Text style={styles.authHint}>
            Code sent to {sentToEmail ?? email}
          </Text>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.replace(/\s/g, ""))}
            placeholder="123456"
            placeholderTextColor="rgba(255,255,255,0.5)"
            keyboardType="number-pad"
            style={styles.authInput}
          />
          <View style={styles.authRow}>
            <SecondaryButton
              label="Back"
              onPress={() => {
                setStep("email");
                setCode("");
              }}
              disabled={isBusy}
            />
            <PrimaryButton
              label={isSubmitting ? "Verifying..." : "Verify"}
              onPress={submitCode}
              disabled={isBusy}
            />
          </View>
        </>
      )}

      {error ? <Text style={styles.authError}>{error}</Text> : null}
    </View>
  );
}

function PosApp() {
  const insets = useSafeAreaInsets();
  const { user, isReady, logout } = usePrivy();
  const solana = useEmbeddedSolanaWallet();

  const [screen, setScreen] = useState<Screen>({ kind: "auth" });
  const [amount, setAmount] = useState("");
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!user) setScreen({ kind: "auth" });
    else setScreen((s) => (s.kind === "auth" ? { kind: "pos" } : s));
  }, [isReady, user]);

  const merchantAddress = solana.wallets?.[0]?.address ?? "";
  const hasMerchantAddress = isValidSolanaAddress(merchantAddress);

  useEffect(() => {
    if (!user) return;
    if (!solana.create) return;
    if (solana.status !== "not-created") return;
    solana.create({ recoveryMethod: "privy" }).catch(() => {});
  }, [solana, user]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    };
  }, []);

  const startWatchPayment = (reference: string, amountValue: string, recipient: string) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;

    const connection = new Connection(SOLANA_RPC_URL, {
      commitment: "confirmed",
      disableRetryOnRateLimit: true,
    });
    const refKey = new PublicKey(reference);
    const recipientKey = new PublicKey(recipient);
    const usdcMint = new PublicKey(SOLANA_USDC_MINT);
    const recipientUsdcAta = getAssociatedTokenAddress(usdcMint, recipientKey);
    const expected = toBaseUnits(amountValue, 6) ?? 0n;
    const startedAtSec = Math.floor(Date.now() / 1000) - 5;
    const seen = new Set<string>();
    let stopped = false;
    let fallbackEvery = 2;
    let pollDelayMs = 5000;

    const stop = () => {
      stopped = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    };

    const waitForConfirmed = async (sig: string) => {
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline) {
        const status = await connection.getSignatureStatus(sig, {
          searchTransactionHistory: true,
        });
        const cs = status?.value?.confirmationStatus;
        const ok = status?.value?.err == null;
        if (ok && (cs === "confirmed" || cs === "finalized")) return true;
        await sleep(1500);
      }
      return false;
    };

    const isRateLimitError = (e: unknown) => {
      const msg =
        typeof e === "string"
          ? e
          : (e as { message?: string })?.message || "";
      return msg.includes("429") || msg.toLowerCase().includes("rate limit");
    };

    const checkSignature = async (sig: string) => {
      const ok = await waitForConfirmed(sig);
      if (!ok) return;
      stop();
      setScreen({
        kind: "paid",
        signature: sig,
        amount: amountValue,
        recipient,
      });
    };

    const checkIncomingUsdc = async (sig: string) => {
      const tx = await connection.getParsedTransaction(sig, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!tx?.meta || tx.meta.err != null) return false;

      const keys = tx.transaction.message.accountKeys;
      const ataIndex = keys.findIndex((k) => {
        const pk =
          typeof k === "string"
            ? k
            : typeof k.pubkey === "string"
              ? k.pubkey
              : k.pubkey?.toBase58?.() ?? "";
        return pk === recipientUsdcAta.toBase58();
      });
      if (ataIndex < 0) return false;

      const pre = tx.meta.preTokenBalances?.find(
        (b) => b.accountIndex === ataIndex && b.mint === SOLANA_USDC_MINT,
      );
      const post = tx.meta.postTokenBalances?.find(
        (b) => b.accountIndex === ataIndex && b.mint === SOLANA_USDC_MINT,
      );
      const preAmt = pre?.uiTokenAmount?.amount
        ? BigInt(pre.uiTokenAmount.amount)
        : 0n;
      const postAmt = post?.uiTokenAmount?.amount
        ? BigInt(post.uiTokenAmount.amount)
        : 0n;
      const delta = postAmt - preAmt;
      return expected > 0n && delta === expected;
    };

    const pollOnce = async (attempt: number) => {
      if (stopped) return;
      try {
        // Primary: Solana Pay reference lookup (best if the payer wallet supports it).
        const sigs = await connection.getSignaturesForAddress(refKey, { limit: 10 });
        for (const s of sigs) {
          if (!s.signature || seen.has(s.signature)) continue;
          if (s.blockTime && s.blockTime < startedAtSec) continue;
          seen.add(s.signature);
          await checkSignature(s.signature);
          return;
        }

        // Fallback: scan recent transactions to recipient and match exact USDC amount into its ATA.
        if (attempt % fallbackEvery === 0) {
          const rs = await connection.getSignaturesForAddress(recipientKey, { limit: 20 });
          for (const s of rs) {
            if (!s.signature || seen.has(s.signature)) continue;
            if (s.blockTime && s.blockTime < startedAtSec) continue;
            seen.add(s.signature);
            const matches = await checkIncomingUsdc(s.signature);
            if (matches) {
              await checkSignature(s.signature);
              return;
            }
          }
        }

        pollDelayMs = 5000;
      } catch (e) {
        if (isRateLimitError(e)) {
          pollDelayMs = Math.min(pollDelayMs * 2, 30_000);
        }
      } finally {
        if (stopped) return;
        pollTimerRef.current = setTimeout(() => {
          pollOnce(attempt + 1).catch(() => {});
        }, pollDelayMs);
      }
    };

    pollTimerRef.current = setTimeout(() => {
      pollOnce(1).catch(() => {});
    }, 500);

    return stop;
  };

  const onCharge = async () => {
    const amountCanonical = formatSolanaPayAmount(amount);
    if (!amountCanonical) return;
    if (!hasMerchantAddress) return;

    const reference = Keypair.generate().publicKey.toBase58();
    const uri = buildSolanaPayUsdcUri({
      recipient: merchantAddress,
      amount: amountCanonical,
      reference,
      label: "CachinPOS",
      message: `Charge ${amountCanonical} USDC`,
    });

    setScreen({
      kind: "qr",
      uri,
      reference,
      amount: amountCanonical,
      recipient: merchantAddress,
    });

    startWatchPayment(reference, amountCanonical, merchantAddress);
  };

  if (!isReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!privyAppId || !privyClientId) {
    return (
      <View style={[styles.center, { padding: 16 }]}>
        <Text style={styles.missingTitle}>Missing Privy config</Text>
        <Text style={styles.missingBody}>
          Set `EXPO_PUBLIC_PRIVY_APP_ID` and `EXPO_PUBLIC_PRIVY_CLIENT_ID`, then
          restart Expo with `-c`.
        </Text>
      </View>
    );
  }

  if (!user || screen.kind === "auth") {
    return <AuthScreen onAuthed={() => setScreen({ kind: "pos" })} />;
  }

  if (screen.kind === "paid") {
    const explorer = `https://solscan.io/tx/${screen.signature}`;
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <View style={[styles.kav, { paddingTop: insets.top + 12 }]}>
          <View style={styles.paidBadgeRow}>
            <CheckmarkBadge />
          </View>
          <Text style={styles.paidTitle}>Payment confirmed</Text>
          <Text style={styles.paidAmount}>${screen.amount} USDC</Text>
          <Text style={styles.paidTo}>To {formatAddress(screen.recipient)}</Text>

          <View style={styles.paidCard}>
            <Text style={styles.paidLabel}>Transaction</Text>
            <Text style={styles.paidSig} numberOfLines={1}>
              {screen.signature}
            </Text>
            <View style={styles.paidRow}>
              <SecondaryButton
                label="Copy"
                onPress={() => Clipboard.setStringAsync(screen.signature)}
              />
              <PrimaryButton
                label="Open"
                onPress={() => Linking.openURL(explorer)}
              />
            </View>
          </View>

          <PrimaryButton
            label="New charge"
            onPress={() => {
              setAmount("");
              setScreen({ kind: "pos" });
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (screen.kind === "qr") {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <View style={[styles.kav, { paddingTop: insets.top + 12 }]}>
          <View style={styles.topRow}>
            <View style={styles.topLeft}>
              <Text style={styles.qrTitle}>Charge</Text>
              <Text style={styles.qrAmount}>${screen.amount} USDC</Text>
              <Text style={styles.qrTo}>To {formatAddress(screen.recipient)}</Text>
            </View>
            <SecondaryButton
              label="Cancel"
              onPress={() => {
                if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
                pollTimerRef.current = null;
                setScreen({ kind: "pos" });
              }}
            />
          </View>

          <View style={styles.qrCard}>
            <QRCode value={screen.uri} size={260} />
            <Text style={styles.qrHint}>Scan with Cachin to pay</Text>
          </View>

          <View style={styles.qrActions}>
            <SecondaryButton
              label="Copy link"
              onPress={() => Clipboard.setStringAsync(screen.uri)}
            />
            <SecondaryButton
              label="Copy reference"
              onPress={() => Clipboard.setStringAsync(screen.reference)}
            />
          </View>

          <View style={styles.waitRow}>
            <ActivityIndicator />
            <Text style={styles.waitText}>Waiting for payment...</Text>
          </View>

          <Text style={styles.smallPrint}>
            Token: {SOLANA_USDC_MINT.slice(0, 4)}...{SOLANA_USDC_MINT.slice(-4)}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // POS keypad screen
  const walletStatus =
    solana.status === "connected"
      ? "Ready"
      : solana.status === "creating"
        ? "Creating wallet..."
        : solana.status === "not-created"
          ? "Creating wallet..."
          : solana.status;

  const canCharge = hasMerchantAddress && formatSolanaPayAmount(amount) != null;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={[styles.kav, { paddingTop: insets.top + 12 }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.brand}>CachinPOS</Text>
            <Text style={styles.subtitle}>
              Merchant {formatAddress(merchantAddress || "…")} · {walletStatus}
            </Text>
          </View>
          <SecondaryButton
            label="Logout"
            onPress={() => logout().catch(() => {})}
          />
        </View>

        <View style={styles.amountPanel}>
          <Text style={styles.amountLabel}>Amount (USDC)</Text>
          <Text style={styles.amountValue}>{amount ? amount : "0"}</Text>
          {!hasMerchantAddress ? (
            <Text style={styles.amountWarning}>
              Waiting for Solana wallet to be created.
            </Text>
          ) : null}
        </View>

        <Keypad value={amount} onChange={setAmount} />

        <PrimaryButton
          label={canCharge ? `Charge ${amount} USDC` : "Enter amount"}
          onPress={onCharge}
          disabled={!canCharge}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PrivyProvider
        appId={privyAppId}
        clientId={privyClientId}
        config={{
          embeddedWallets: {
            createOnLogin: "users-without-wallets",
          },
        }}
      >
        <PosApp />
      </PrivyProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F6F2E8",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  kav: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  brand: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.6,
    color: "#121212",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#5C5C5C",
  },

  checkWrap: {
    overflow: "hidden",
  },

  paidBadgeRow: {
    alignItems: "center",
    marginTop: 6,
  },

  amountPanel: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#121212",
    gap: 6,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(255,255,255,0.72)",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  amountValue: {
    fontSize: 42,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  amountWarning: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.72)",
  },

  keypad: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  keypadKey: {
    width: "31%",
    height: 64,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E0D5",
    alignItems: "center",
    justifyContent: "center",
  },
  keypadKeyPressed: {
    opacity: 0.6,
  },
  keypadKeyText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#121212",
  },
  keypadWide: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(18,18,18,0.06)",
    borderWidth: 1,
    borderColor: "#E6E0D5",
    alignItems: "center",
    justifyContent: "center",
  },
  keypadWideText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#121212",
  },

  primaryButton: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#FFDD57",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonPressed: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#121212",
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "rgba(18,18,18,0.08)",
    borderWidth: 1,
    borderColor: "rgba(18,18,18,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonPressed: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#121212",
  },

  authWrap: {
    flex: 1,
    backgroundColor: "#121212",
    paddingHorizontal: 16,
    paddingTop: 70,
    gap: 12,
  },
  authInput: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  authRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  authHint: {
    color: "rgba(255,255,255,0.72)",
    fontWeight: "700",
  },
  authError: {
    color: "#FCA5A5",
    fontWeight: "800",
  },

  qrCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E0D5",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 12,
  },
  qrTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#121212",
  },
  qrAmount: {
    fontSize: 34,
    fontWeight: "900",
    color: "#121212",
  },
  qrTo: {
    fontSize: 13,
    fontWeight: "800",
    color: "#5C5C5C",
  },
  qrHint: {
    fontSize: 13,
    fontWeight: "900",
    color: "#3B3B3B",
  },
  qrActions: {
    flexDirection: "row",
    gap: 10,
  },
  waitRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  waitText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#121212",
  },
  smallPrint: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6D6D6D",
    textAlign: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  topLeft: {
    flex: 1,
    gap: 2,
  },

  paidTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#121212",
  },
  paidAmount: {
    fontSize: 40,
    fontWeight: "900",
    color: "#121212",
  },
  paidTo: {
    fontSize: 13,
    fontWeight: "800",
    color: "#5C5C5C",
  },
  paidCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E0D5",
    gap: 10,
  },
  paidLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#5C5C5C",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  paidSig: {
    fontSize: 12,
    fontWeight: "800",
    color: "#121212",
  },
  paidRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },

  missingTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#121212",
  },
  missingBody: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#5C5C5C",
    textAlign: "center",
  },
});
