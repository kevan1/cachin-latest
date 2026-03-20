import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useColorScheme } from "react-native";
import * as Haptics from "expo-haptics";

import { getUserByUsername } from "@/services/firestoreService";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { getSolanaRpcUrl } from "@/utils/solanaRpc";
import {
  formatTokenUnits,
  normalizeDecimalInput,
  parseDecimalToUnits,
} from "@/utils/tokenAmount";
import { Colors } from "@/constants/theme";
import { getSelectedCurrency, Currency } from "@/utils/userStorage";
import { IconSymbol } from "@/components/ui/icon-symbol";

const USDC_MINT_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;

type RecipientStatus = "idle" | "resolving" | "resolved" | "error";

function firstParam(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return typeof value === "string" ? value : "";
}

function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function formatAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function SendAmountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Colors[colorScheme];
  const isIOS = process.env.EXPO_OS === "ios";
  const amountInputRef = useRef<TextInput>(null);

  const initialRecipient =
    firstParam(params.address) || firstParam(params.username) || firstParam(params.recipient);
  const initialAmount = normalizeDecimalInput(firstParam(params.amount), USDC_DECIMALS);

  const [recipientInput, setRecipientInput] = useState(initialRecipient);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientUsername, setRecipientUsername] = useState("");
  const [recipientStatus, setRecipientStatus] = useState<RecipientStatus>("idle");
  const [amount, setAmount] = useState(initialAmount);
  const [balance, setBalance] = useState("0.00");
  const [balanceUnits, setBalanceUnits] = useState<bigint>(0n);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [currency, setCurrency] = useState<Currency>("USD");

  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  const walletAddress = wallet?.publicKey ?? null;

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const loadCurrency = async () => {
        try {
          const selected = await getSelectedCurrency();
          if (isActive) setCurrency(selected);
        } catch (error) {
          console.error("Error loading currency:", error);
        }
      };
      loadCurrency();
      return () => {
        isActive = false;
      };
    }, [])
  );

  useEffect(() => {
    const trimmed = recipientInput.trim();
    if (!trimmed) {
      setRecipientAddress("");
      setRecipientUsername("");
      setRecipientStatus("idle");
      return;
    }

    if (isValidSolanaAddress(trimmed)) {
      setRecipientAddress(trimmed);
      setRecipientUsername("");
      setRecipientStatus("resolved");
      return;
    }

    const normalized = normalizeUsername(trimmed);
    if (normalized.length < 3) {
      setRecipientAddress("");
      setRecipientUsername(normalized);
      setRecipientStatus("idle");
      return;
    }

    let isActive = true;
    setRecipientStatus("resolving");
    const debounce = setTimeout(async () => {
      try {
        const user = await getUserByUsername(normalized);
        if (!isActive) return;
        if (user?.solanaAddress) {
          setRecipientAddress(user.solanaAddress);
          setRecipientUsername(user.username);
          setRecipientStatus("resolved");
        } else {
          setRecipientAddress("");
          setRecipientUsername(normalized);
          setRecipientStatus("error");
        }
      } catch (error) {
        if (!isActive) return;
        console.error("Error searching users:", error);
        setRecipientAddress("");
        setRecipientStatus("error");
      }
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(debounce);
    };
  }, [recipientInput]);

  useEffect(() => {
    const fetchUSDCBalance = async () => {
      if (!walletAddress) return;
      try {
        setIsLoadingBalance(true);
        const connection = new Connection(getSolanaRpcUrl(), "confirmed");
        const ownerPublicKey = new PublicKey(walletAddress);
        const usdcMintPublicKey = new PublicKey(USDC_MINT_ADDRESS);

        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPublicKey, {
          mint: usdcMintPublicKey,
        });

        let totalUnits = 0n;
        for (const account of tokenAccounts.value) {
          const parsedInfo = account.account.data.parsed.info;
          const tokenAmount = parsedInfo.tokenAmount;
          const amountString = tokenAmount.amount as string;
          totalUnits += BigInt(amountString);
        }

        setBalanceUnits(totalUnits);
        setBalance(
          formatTokenUnits(totalUnits, USDC_DECIMALS, {
            minFractionDigits: 0,
            maxFractionDigits: USDC_DECIMALS,
            trimTrailingZeros: true,
          })
        );
      } catch (error) {
        console.error("Error fetching USDC balance:", error);
        setBalanceUnits(0n);
        setBalance("0");
      } finally {
        setIsLoadingBalance(false);
      }
    };
    fetchUSDCBalance();
  }, [walletAddress]);

  const amountUnits = useMemo(
    () => parseDecimalToUnits(amount, USDC_DECIMALS),
    [amount]
  );
  const isAmountValid = !!amountUnits && amountUnits > 0n;
  const safeAmountUnits = amountUnits ?? 0n;
  const currencyLabel = `Selected currency: ${currency}`;

  const recipientDisplay = recipientUsername
    ? `@${recipientUsername}`
    : recipientAddress
      ? formatAddress(recipientAddress)
      : "Not set";

  const canContinue =
    recipientStatus === "resolved" &&
    !!recipientAddress &&
    isAmountValid &&
    safeAmountUnits <= balanceUnits;

  const handleContinue = () => {
    console.log("[SendAmount] Continue pressed", {
      recipientInput,
      recipientAddress,
      recipientStatus,
      amount,
      balance,
    });
    if (!isAmountValid) {
      Alert.alert("Invalid amount", "Please enter an amount greater than 0.");
      return;
    }
    if (amountUnits && amountUnits > balanceUnits) {
      Alert.alert("Insufficient balance", "You do not have enough USDC.");
      return;
    }
    if (!recipientAddress) {
      Alert.alert("Recipient missing", "Enter a valid username or Solana address.");
      return;
    }
    if (!isValidSolanaAddress(recipientAddress)) {
      Alert.alert("Invalid recipient", "Recipient address is not a valid Solana address.");
      return;
    }

    if (isIOS) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const recipientName = recipientUsername || recipientInput.trim();

    router.replace({
      pathname: "/send-confirm",
      params: {
        recipient: recipientName,
        address: recipientAddress,
        amount: formatTokenUnits(amountUnits ?? 0n, USDC_DECIMALS, {
          minFractionDigits: 0,
          maxFractionDigits: USDC_DECIMALS,
          trimTrailingZeros: true,
        }),
      },
    });
  };

  const statusIcon =
    recipientStatus === "resolving" ? (
      <ActivityIndicator size="small" color={palette.secondaryText} />
    ) : recipientStatus === "resolved" ? (
      <MaterialIcons name="check-circle" size={18} color={palette.success} />
    ) : recipientStatus === "error" ? (
      <MaterialIcons name="error-outline" size={18} color={palette.secondaryText} />
    ) : null;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[
        styles.container,
        { backgroundColor: isIOS ? "transparent" : palette.background },
      ]}
      contentContainerStyle={styles.containerContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={[styles.heroIcon, { backgroundColor: palette.success }]}>
        <IconSymbol name="person.crop.circle" size={24} color={palette.actionPrimaryText} />
      </View>
      <Text style={[styles.subheadline, { color: palette.secondaryText }]} selectable>
        Enter an amount to send to the recipient.
      </Text>

      <View style={styles.inputSection}>
        <Text style={[styles.inputLabel, { color: palette.secondaryText }]} selectable>
          Enter the recipient&apos;s username or address
        </Text>
        <View
          style={[
            styles.inputRow,
            { backgroundColor: palette.surface, borderColor: palette.borderSubtle },
          ]}
        >
          <View
            style={[
              styles.inputIconWrap,
              { backgroundColor: palette.surfaceMuted },
            ]}
          >
            <Text style={[styles.inputIconText, { color: palette.secondaryText }]}>@</Text>
          </View>
          <TextInput
            style={[styles.inputField, { color: palette.primaryText }]}
            value={recipientInput}
            onChangeText={setRecipientInput}
            placeholder="Username or Solana address"
            placeholderTextColor={palette.secondaryText}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            autoFocus
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => amountInputRef.current?.focus()}
          />
          <View style={styles.inputStatus}>{statusIcon}</View>
        </View>
        {recipientStatus === "error" && (
          <Text style={[styles.helperText, { color: palette.secondaryText }]} selectable>
            We could not find that username.
          </Text>
        )}
      </View>

      <View
        style={[
          styles.amountCard,
          { backgroundColor: palette.surface, borderColor: palette.borderSubtle },
        ]}
      >
        <View style={[styles.amountBadge, { backgroundColor: palette.surfaceMuted }]}>
          <Text style={[styles.amountBadgeText, { color: palette.secondaryText }]} selectable>
            Amount to send
          </Text>
        </View>
        <View style={styles.amountRow}>
          <Text style={[styles.currencySymbol, { color: palette.secondaryText }]}>$</Text>
          <TextInput
            style={[styles.amountInput, { color: palette.primaryText }]}
            value={amount}
            onChangeText={(text) => setAmount(normalizeDecimalInput(text, USDC_DECIMALS))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={palette.secondaryText}
            ref={amountInputRef}
          />
        </View>
        <Text style={[styles.equivalentText, { color: palette.secondaryText }]} selectable>
          {currencyLabel}
        </Text>
        <Text style={[styles.balanceText, { color: palette.secondaryText }]} selectable>
          {isLoadingBalance ? "Loading balance..." : `Available $${balance} USDC`}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={[styles.metaLabel, { color: palette.secondaryText }]} selectable>
          Recipient
        </Text>
        <Text style={[styles.metaValue, { color: palette.primaryText }]} selectable>
          {recipientDisplay}
        </Text>
      </View>
      <View style={styles.footer}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.replace("/send-options")}
          style={[
            styles.secondaryButton,
            { backgroundColor: palette.actionSecondary },
          ]}
        >
          <Text style={[styles.secondaryButtonText, { color: palette.actionSecondaryText }]}>
            Cancel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleContinue}
          style={[
            styles.primaryButton,
            { backgroundColor: palette.actionPrimary, opacity: canContinue ? 1 : 0.5 },
          ]}
        >
          <Text style={[styles.primaryButtonText, { color: palette.actionPrimaryText }]}>
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerContent: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 16,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  subheadline: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 18,
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  inputIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  inputIconText: {
    fontSize: 14,
    fontWeight: "600",
  },
  inputField: {
    flex: 1,
    fontSize: 15,
  },
  inputStatus: {
    width: 24,
    alignItems: "center",
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
  },
  amountCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 12,
  },
  amountBadge: {
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  amountBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: "600",
    marginRight: 4,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: "600",
    minWidth: 120,
    textAlign: "center",
  },
  equivalentText: {
    textAlign: "center",
    fontSize: 13,
  },
  balanceText: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 13,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    paddingBottom: 8,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  primaryButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
