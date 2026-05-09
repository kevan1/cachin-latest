import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";

import { Colors } from "@/constants/theme";
import { GlassView } from "@/components/ui/GlassView";
import { getSelectedCurrency } from "@/utils/userStorage";
import { fetchArsPrice } from "@/utils/priceService";
import { getSolanaRpcUrl } from "@/utils/solanaRpc";
import { formatTokenUnits, normalizeDecimalInput, parseDecimalToUnits } from "@/utils/tokenAmount";
import {
  formatDecimalForInput,
  formatFiatValue,
  formatTokenAmountDisplay,
} from "@/utils/numberFormat";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";

const USDC_MINT_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;
const QUICK_AMOUNTS_USD = [50, 100, 200, 500];
const DEFAULT_ARS_RATE = 1500;

function formatAddress(address: string): string {
  if (!address) return "Not connected";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function SendLinkScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Colors[colorScheme];
  const isIOS = process.env.EXPO_OS === "ios";

  const [amount, setAmount] = useState("");
  const [linkId] = useState(() => Math.random().toString(36).slice(2, 10));
  const [isUsdInput, setIsUsdInput] = useState(true);
  const [arsRate, setArsRate] = useState(DEFAULT_ARS_RATE);
  const [balance, setBalance] = useState("0");
  const [balanceUnits, setBalanceUnits] = useState<bigint>(0n);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [preferredCurrency, setPreferredCurrency] = useState("USD");
  const didInitInputModeRef = useRef(false);

  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  const walletAddress = wallet?.publicKey ?? "";

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadPreferences = async () => {
        try {
          const [currency, latestArsRate] = await Promise.all([
            getSelectedCurrency(),
            fetchArsPrice(),
          ]);
          if (!isActive) return;

          setPreferredCurrency(currency);
          if (latestArsRate > 0) {
            setArsRate(latestArsRate);
          }
          if (!didInitInputModeRef.current) {
            didInitInputModeRef.current = true;
            setIsUsdInput(currency !== "ARS");
          }
        } catch (error) {
          console.error("[SendLink] Failed to load preferences", error);
        }
      };

      void loadPreferences();
      return () => {
        isActive = false;
      };
    }, [])
  );

  useEffect(() => {
    if (!walletAddress) {
      setBalance("0");
      setBalanceUnits(0n);
      setIsLoadingBalance(false);
      return;
    }

    let isCancelled = false;
    const fetchBalance = async () => {
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
          totalUnits += BigInt(tokenAmount.amount as string);
        }

        if (isCancelled) return;
        setBalanceUnits(totalUnits);
        setBalance(
          formatTokenUnits(totalUnits, USDC_DECIMALS, {
            minFractionDigits: 0,
            maxFractionDigits: USDC_DECIMALS,
            trimTrailingZeros: true,
          })
        );
      } catch (error) {
        if (isCancelled) return;
        console.error("[SendLink] Failed to fetch USDC balance", error);
        setBalance("0");
        setBalanceUnits(0n);
      } finally {
        if (!isCancelled) {
          setIsLoadingBalance(false);
        }
      }
    };

    void fetchBalance();
    return () => {
      isCancelled = true;
    };
  }, [walletAddress]);

  const normalizedAmount = useMemo(() => {
    const normalizedInput = normalizeDecimalInput(amount, isUsdInput ? USDC_DECIMALS : 2);
    if (!normalizedInput) return "";
    if (isUsdInput) return normalizedInput;

    const parsedArs = Number.parseFloat(normalizedInput);
    if (!Number.isFinite(parsedArs) || parsedArs <= 0 || arsRate <= 0) return "";
    return normalizeDecimalInput(String(parsedArs / arsRate), USDC_DECIMALS);
  }, [amount, arsRate, isUsdInput]);

  const amountUnits = useMemo(
    () => parseDecimalToUnits(normalizedAmount, USDC_DECIMALS),
    [normalizedAmount]
  );
  const isAmountValid = !!amountUnits && amountUnits > 0n;

  const balanceNumber = Number.parseFloat(balance);
  const availableInputAmount = useMemo(() => {
    if (!Number.isFinite(balanceNumber) || balanceNumber <= 0) return 0;
    return isUsdInput ? balanceNumber : balanceNumber * arsRate;
  }, [arsRate, balanceNumber, isUsdInput]);
  const availableDisplayAmount = useMemo(
    () =>
      formatFiatValue(availableInputAmount, {
        context: "detailed",
        currencyPrefix: isUsdInput ? "$" : "ARS$",
      }),
    [availableInputAmount, isUsdInput]
  );
  const equivalentDisplayAmount = useMemo(() => {
    const parsedAmount = Number.parseFloat(amount);
    const prefix = isUsdInput ? "ARS$" : "$";
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || arsRate <= 0) {
      return formatFiatValue(0, {
        context: "detailed",
        currencyPrefix: prefix,
      });
    }

    if (isUsdInput) {
      return formatFiatValue(parsedAmount * arsRate, {
        context: "detailed",
        currencyPrefix: prefix,
      });
    }

    return formatFiatValue(parsedAmount / arsRate, {
      context: "detailed",
      currencyPrefix: prefix,
    });
  }, [amount, arsRate, isUsdInput]);
  const canPrefillMax =
    !isLoadingBalance && balanceUnits > 0n && Number.isFinite(balanceNumber) && balanceNumber > 0;
  const amountInputWidth = Math.min(240, Math.max(120, Math.max(amount.length, 4) * 20));

  const handleAmountChange = (text: string) => {
    setAmount(normalizeDecimalInput(text, isUsdInput ? USDC_DECIMALS : 2));
  };

  const handleSwapInputCurrency = () => {
    if (isIOS) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || arsRate <= 0) {
      setIsUsdInput((prev) => !prev);
      return;
    }

    const converted = isUsdInput ? parsedAmount * arsRate : parsedAmount / arsRate;
    setAmount(formatDecimalForInput(converted, isUsdInput ? 2 : USDC_DECIMALS));
    setIsUsdInput((prev) => !prev);
  };

  const handleUseMaxAmount = () => {
    if (!canPrefillMax) return;
    if (isIOS) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (isUsdInput) {
      setAmount(
        formatTokenUnits(balanceUnits, USDC_DECIMALS, {
          minFractionDigits: 0,
          maxFractionDigits: USDC_DECIMALS,
          trimTrailingZeros: true,
        })
      );
      return;
    }

    setAmount(formatDecimalForInput(availableInputAmount, 2));
  };

  const handleQuickAmount = (valueUsd: number) => {
    const nextValue = isUsdInput ? valueUsd : valueUsd * arsRate;
    setAmount(formatDecimalForInput(nextValue, isUsdInput ? USDC_DECIMALS : 2));
  };

  const handleCopyLink = async () => {
    if (!amountUnits || amountUnits <= 0n) {
      Alert.alert("Add amount", "Enter a transfer amount to generate a link.");
      return;
    }

    const amountValue = formatTokenUnits(amountUnits, USDC_DECIMALS, {
      minFractionDigits: 0,
      maxFractionDigits: USDC_DECIMALS,
      trimTrailingZeros: true,
    });
    const link = `https://cachin.app/pay/${linkId}?amount=${encodeURIComponent(amountValue)}`;
    await Clipboard.setStringAsync(link);
    Alert.alert("Copied", "Payment link copied to clipboard.");
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={[styles.container, { backgroundColor: "transparent" }]}
        contentContainerStyle={styles.containerContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.iconButtonPressable}
            activeOpacity={0.78}
          >
            <GlassView
              style={[
                styles.iconButton,
                {
                  borderColor:
                    colorScheme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)",
                },
              ]}
              intensity={26}
              interactive
            >
              <MaterialIcons name="arrow-back" size={20} color={palette.primaryText} />
            </GlassView>
          </TouchableOpacity>
          <Text style={[styles.title, { color: palette.primaryText }]} selectable>
            Create link
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.heroIcon, { backgroundColor: palette.success }]}>
          <MaterialIcons name="link" size={22} color={palette.actionPrimaryText} />
        </View>
        <Text style={[styles.headline, { color: palette.primaryText }]} selectable>
          Your payment link is ready
        </Text>
        <Text style={[styles.subheadline, { color: palette.secondaryText }]} selectable>
          Set an amount and share it. Recipient receives USDC when the link is claimed.
        </Text>

        <GlassView
          style={[
            styles.amountCard,
            {
              borderColor:
                colorScheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.52)",
            },
          ]}
          intensity={30}
          interactive
        >
          <TouchableOpacity
            accessibilityRole="button"
            onPress={handleSwapInputCurrency}
            style={styles.amountBadgePressable}
            activeOpacity={0.8}
          >
            <GlassView style={styles.amountBadge} intensity={24} interactive>
              <MaterialIcons
                name="swap-vert"
                size={16}
                color={palette.secondaryText}
                style={styles.amountBadgeIcon}
              />
              <Text style={[styles.amountBadgeText, { color: palette.secondaryText }]} selectable>
                {isUsdInput ? "USD Amount" : "ARS Amount"}
              </Text>
            </GlassView>
          </TouchableOpacity>

          <View style={styles.amountRow}>
            <View style={styles.amountInline}>
              <Text style={[styles.currencySymbol, { color: palette.secondaryText }]}>
                {isUsdInput ? "$" : "ARS$"}
              </Text>
              <TextInput
                style={[
                  styles.amountInput,
                  {
                    color: palette.primaryText,
                    fontSize: amount.length > 8 ? 34 : 40,
                    width: amountInputWidth,
                  },
                ]}
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={palette.secondaryText}
              />
            </View>
          </View>

          <Text style={[styles.equivalentText, { color: palette.secondaryText }]} selectable>
            ≈ {equivalentDisplayAmount}
          </Text>
          <Text style={[styles.balanceHelperText, { color: palette.secondaryText }]} selectable>
            Preference: {preferredCurrency}
          </Text>
        </GlassView>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleUseMaxAmount}
          disabled={!canPrefillMax}
          style={styles.availableCardPressable}
          activeOpacity={0.82}
        >
          <GlassView
            style={[
              styles.availableCard,
              {
                borderColor:
                  colorScheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.52)",
              },
            ]}
            intensity={26}
            interactive
          >
            <View style={styles.availableHeader}>
              <Text style={[styles.availableLabel, { color: palette.secondaryText }]} selectable>
                Available balance
              </Text>
              <View style={[styles.availablePill, { backgroundColor: palette.surfaceMuted }]}>
                <Text style={[styles.availablePillText, { color: palette.secondaryText }]}>
                  {canPrefillMax ? "Tap to use max" : "No funds"}
                </Text>
              </View>
            </View>
            <Text style={[styles.availableAmount, { color: palette.primaryText }]} selectable>
              {isLoadingBalance
                ? "Loading balance..."
                : availableDisplayAmount}
            </Text>
            {!isLoadingBalance ? (
              <Text style={[styles.availableSubtext, { color: palette.secondaryText }]} selectable>
                USDC{" "}
                {formatTokenAmountDisplay(balanceNumber, {
                  context: "detailed",
                  tokenPriceUsd: 1,
                  tokenDecimals: USDC_DECIMALS,
                })}{" "}
                available
              </Text>
            ) : null}
          </GlassView>
        </TouchableOpacity>

        <View style={styles.quickRow}>
          {QUICK_AMOUNTS_USD.map((valueUsd) => {
            const labelValue = isUsdInput
              ? formatFiatValue(valueUsd, { context: "detailed", currencyPrefix: "$" })
              : formatFiatValue(valueUsd * arsRate, {
                  context: "detailed",
                  currencyPrefix: "ARS$",
                });

            return (
              <TouchableOpacity
                key={valueUsd}
                accessibilityRole="button"
                onPress={() => handleQuickAmount(valueUsd)}
                style={styles.quickChipPressable}
                activeOpacity={0.8}
              >
                <GlassView
                  style={[
                    styles.quickChip,
                    {
                      borderColor:
                        colorScheme === "dark"
                          ? "rgba(255,255,255,0.16)"
                          : "rgba(255,255,255,0.52)",
                    },
                  ]}
                  intensity={24}
                  interactive
                >
                  <Text style={[styles.quickChipText, { color: palette.primaryText }]}>
                    {labelValue}
                  </Text>
                </GlassView>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.metaRow}>
          <Text style={[styles.metaLabel, { color: palette.secondaryText }]} selectable>
            Transfer from
          </Text>
          <Text style={[styles.metaValue, { color: palette.primaryText }]} selectable>
            {formatAddress(walletAddress)}
          </Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.back()}
            style={[styles.secondaryButton, { backgroundColor: palette.actionSecondary }]}
          >
            <Text style={[styles.secondaryButtonText, { color: palette.actionSecondaryText }]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={handleCopyLink}
            disabled={!isAmountValid}
            style={[
              styles.primaryButton,
              { backgroundColor: palette.actionPrimary, opacity: isAmountValid ? 1 : 0.5 },
            ]}
          >
            <Text style={[styles.primaryButtonText, { color: palette.actionPrimaryText }]}>
              Copy link
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    marginTop: 12,
  },
  iconButtonPressable: {
    borderRadius: 20,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerSpacer: {
    width: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  headline: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 6,
  },
  subheadline: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
  },
  amountCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 12,
    alignItems: "center",
  },
  amountBadgePressable: {
    borderRadius: 999,
    marginBottom: 12,
  },
  amountBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  amountBadgeIcon: {
    marginRight: 4,
  },
  amountBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  amountRow: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  amountInline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: "600",
    marginRight: 2,
  },
  amountInput: {
    fontWeight: "600",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  equivalentText: {
    textAlign: "center",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  balanceHelperText: {
    textAlign: "center",
    fontSize: 11,
    marginTop: 6,
  },
  availableCardPressable: {
    borderRadius: 16,
    marginBottom: 12,
  },
  availableCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  availableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  availableLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  availablePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  availablePillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  availableAmount: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
    fontVariant: ["tabular-nums"],
  },
  availableSubtext: {
    marginTop: 4,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },
  quickChipPressable: {
    flex: 1,
    borderRadius: 999,
  },
  quickChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
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
