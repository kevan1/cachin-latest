import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { isAddress } from "viem";

import {
  getAllUsersFromFirestore,
  getUserByUsername,
  type UserData,
} from "@/services/firestoreService";
import { useEmbeddedEthereumWallet, useEmbeddedSolanaWallet } from "@privy-io/expo";
import { ChainType, getChainToken } from "@/constants/chains";
import { getSolanaRpcUrl } from "@/utils/solanaRpc";
import { fetchArsPrice } from "@/utils/priceService";
import {
  formatTokenUnits,
  normalizeDecimalInput,
  parseDecimalToUnits,
} from "@/utils/tokenAmount";
import {
  formatDecimalForInput,
  formatFiatValue,
  formatTokenAmountDisplay,
} from "@/utils/numberFormat";
import { Colors } from "@/constants/theme";
import { getSelectedCurrency, Currency } from "@/utils/userStorage";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { GlassView } from "@/components/ui/GlassView";
import { fetchErc20EvmBalance } from "@/utils/evmBalanceService";
import {
  coerceAvalancheWalletSource,
  loadAvalancheWalletSource,
  loadSatochipAvalancheAddress,
  type AvalancheWalletSource,
} from "@/utils/satochipStorage";

const USDC_MINT_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;
const DEFAULT_ARS_RATE = 1500;

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
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const palette = Colors[colorScheme];
  const isIOS = process.env.EXPO_OS === "ios";
  const amountInputRef = useRef<TextInput>(null);
  const requestedChain = firstParam(params.chain);
  const activeChain =
    requestedChain === ChainType.AVALANCHE ? ChainType.AVALANCHE : ChainType.SOLANA;
  const isAvalancheTransfer = activeChain === ChainType.AVALANCHE;
  const avalancheUsdcToken = getChainToken(ChainType.AVALANCHE, "usdc");
  const assetSymbol = isAvalancheTransfer ? avalancheUsdcToken?.symbol ?? "USDC" : "USDC";
  const assetDecimals = isAvalancheTransfer
    ? avalancheUsdcToken?.decimals ?? USDC_DECIMALS
    : USDC_DECIMALS;

  const initialRecipient =
    firstParam(params.address) || firstParam(params.username) || firstParam(params.recipient);
  const initialAmount = normalizeDecimalInput(firstParam(params.amount), assetDecimals);

  const [recipientInput, setRecipientInput] = useState(initialRecipient);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientUsername, setRecipientUsername] = useState("");
  const [recipientStatus, setRecipientStatus] = useState<RecipientStatus>("idle");
  const [firebaseUsers, setFirebaseUsers] = useState<UserData[]>([]);
  const [isLoadingFirebaseUsers, setIsLoadingFirebaseUsers] = useState(false);
  const [firebaseUsersError, setFirebaseUsersError] = useState("");
  const [amount, setAmount] = useState(initialAmount);
  const [balance, setBalance] = useState("0.00");
  const [balanceUnits, setBalanceUnits] = useState<bigint>(0n);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isUsdInput, setIsUsdInput] = useState(true);
  const [arsRate, setArsRate] = useState(DEFAULT_ARS_RATE);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [avalancheWalletSource, setAvalancheWalletSource] =
    useState<AvalancheWalletSource>("privy");
  const [satochipAvalancheAddress, setSatochipAvalancheAddress] = useState<string | null>(null);
  const didInitInputModeRef = useRef(false);

  const { wallets: solanaWallets } = useEmbeddedSolanaWallet();
  const { wallets: ethereumWallets } = useEmbeddedEthereumWallet();
  const solanaWallet = solanaWallets?.[0];
  const avalancheWallet = ethereumWallets?.[0];
  const walletAddress = isAvalancheTransfer
    ? avalancheWalletSource === "satochip"
      ? satochipAvalancheAddress
      : avalancheWallet?.address ?? null
    : solanaWallet?.publicKey ?? null;

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadAvalancheSource = async () => {
        if (!isAvalancheTransfer) return;

        try {
          const [storedSource, storedAddress] = await Promise.all([
            loadAvalancheWalletSource(),
            loadSatochipAvalancheAddress(),
          ]);
          if (!isActive) return;

          const requestedSource = firstParam(params.walletSource);
          setAvalancheWalletSource(
            requestedSource
              ? coerceAvalancheWalletSource(requestedSource)
              : storedSource
          );
          setSatochipAvalancheAddress(storedAddress);
        } catch (error) {
          console.error("[SendAmount] Failed to load Avalanche wallet source", error);
        }
      };

      void loadAvalancheSource();

      return () => {
        isActive = false;
      };
    }, [isAvalancheTransfer, params.walletSource])
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const loadCurrency = async () => {
        try {
          const selected = await getSelectedCurrency();
          if (!isActive) return;

          setCurrency(selected);
          if (!didInitInputModeRef.current) {
            didInitInputModeRef.current = true;
            setIsUsdInput(selected !== "ARS");
          }
        } catch (error) {
          console.error("Error loading currency:", error);
        }
      };
      void loadCurrency();
      return () => {
        isActive = false;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const loadArsRate = async () => {
        try {
          const latestRate = await fetchArsPrice();
          if (isActive && latestRate > 0) {
            setArsRate(latestRate);
          }
        } catch (error) {
          console.error("[SendAmount] Failed to load ARS rate", error);
        }
      };
      void loadArsRate();
      return () => {
        isActive = false;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadFirebaseUsers = async () => {
        if (isAvalancheTransfer) {
          setFirebaseUsers([]);
          setFirebaseUsersError("");
          setIsLoadingFirebaseUsers(false);
          return;
        }

        try {
          setIsLoadingFirebaseUsers(true);
          setFirebaseUsersError("");
          const users = await getAllUsersFromFirestore();
          if (!isActive) return;
          setFirebaseUsers(users);
        } catch (error) {
          if (!isActive) return;
          console.error("[SendAmount] Failed to load Firebase users", error);
          setFirebaseUsers([]);
          setFirebaseUsersError("Unable to load Firebase usernames.");
        } finally {
          if (isActive) {
            setIsLoadingFirebaseUsers(false);
          }
        }
      };

      void loadFirebaseUsers();

      return () => {
        isActive = false;
      };
    }, [isAvalancheTransfer])
  );

  useEffect(() => {
    const trimmed = recipientInput.trim();
    if (!trimmed) {
      setRecipientAddress("");
      setRecipientUsername("");
      setRecipientStatus("idle");
      return;
    }

    if (isAvalancheTransfer) {
      if (isAddress(trimmed)) {
        setRecipientAddress(trimmed);
        setRecipientUsername("");
        setRecipientStatus("resolved");
        return;
      }

      setRecipientAddress("");
      setRecipientUsername("");
      setRecipientStatus(trimmed.length >= 42 ? "error" : "idle");
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
  }, [isAvalancheTransfer, recipientInput]);

  useEffect(() => {
    const fetchSelectedBalance = async () => {
      if (!walletAddress) {
        setBalanceUnits(0n);
        setBalance("0");
        setIsLoadingBalance(false);
        return;
      }
      try {
        setIsLoadingBalance(true);

        if (isAvalancheTransfer) {
          if (!avalancheUsdcToken) {
            throw new Error("Avalanche USDC is not configured.");
          }

          const tokenBalance = await fetchErc20EvmBalance(
            ChainType.AVALANCHE,
            walletAddress,
            avalancheUsdcToken.address,
            avalancheUsdcToken.decimals
          );
          const normalizedUnits =
            parseDecimalToUnits(String(tokenBalance), assetDecimals) ?? 0n;

          setBalanceUnits(normalizedUnits);
          setBalance(
            formatTokenUnits(normalizedUnits, assetDecimals, {
              minFractionDigits: 0,
              maxFractionDigits: 6,
              trimTrailingZeros: true,
            })
          );
          return;
        }

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
        console.error("Error fetching selected chain balance:", error);
        setBalanceUnits(0n);
        setBalance("0");
      } finally {
        setIsLoadingBalance(false);
      }
    };
    void fetchSelectedBalance();
  }, [assetDecimals, avalancheUsdcToken, isAvalancheTransfer, walletAddress]);

  const normalizedAmount = useMemo(() => {
    const normalizedInput = normalizeDecimalInput(amount, isUsdInput ? assetDecimals : 2);
    if (!normalizedInput) return "";
    if (isUsdInput) return normalizedInput;

    const parsedArs = Number.parseFloat(normalizedInput);
    if (!Number.isFinite(parsedArs) || parsedArs <= 0 || arsRate <= 0) return "";
    return normalizeDecimalInput(String(parsedArs / arsRate), assetDecimals);
  }, [amount, arsRate, assetDecimals, isUsdInput]);

  const amountUnits = useMemo(
    () => parseDecimalToUnits(normalizedAmount, assetDecimals),
    [normalizedAmount, assetDecimals]
  );
  const isAmountValid = !!amountUnits && amountUnits > 0n;
  const safeAmountUnits = amountUnits ?? 0n;
  const currencyLabel = isAvalancheTransfer
    ? "Avalanche Fuji USDC transfer"
    : `${assetSymbol} transfer on Solana`;
  const preferredCurrencyLabel = `Preference: ${currency}`;
  const balanceNumber = Number.parseFloat(balance);
  const availableInputAmount = useMemo(() => {
    if (!Number.isFinite(balanceNumber) || balanceNumber <= 0) return 0;
    return isUsdInput ? balanceNumber : balanceNumber * arsRate;
  }, [arsRate, balanceNumber, isUsdInput]);
  const equivalentDisplayAmount = useMemo(() => {
    const parsedAmount = Number.parseFloat(amount);
    const prefix = isUsdInput ? "ARS$" : "$";
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || arsRate <= 0) {
      return formatFiatValue(0, {
        context: "detailed",
        currencyPrefix: prefix,
      });
    }

    const converted = isUsdInput ? parsedAmount * arsRate : parsedAmount / arsRate;
    return formatFiatValue(converted, {
      context: "detailed",
      currencyPrefix: prefix,
    });
  }, [amount, arsRate, isUsdInput]);
  const canPrefillMax =
    !isLoadingBalance && balanceUnits > 0n && Number.isFinite(balanceNumber) && balanceNumber > 0;
  const avalancheWalletSourceLabel =
    avalancheWalletSource === "satochip" ? "Satochip card" : "Privy embedded wallet";

  const recipientDisplay = recipientUsername
    ? `@${recipientUsername}`
    : recipientAddress
      ? isAvalancheTransfer
        ? formatAddress(recipientAddress)
        : `External wallet (${formatAddress(recipientAddress)})`
      : "Not set";

  const visibleFirebaseUsers = useMemo(() => {
    const normalizedInput = normalizeUsername(recipientInput);

    if (!normalizedInput) {
      return firebaseUsers;
    }

    return firebaseUsers.filter((user) => {
      const username = user.username.toLowerCase();
      const address = user.solanaAddress.toLowerCase();
      return username.includes(normalizedInput) || address.includes(normalizedInput);
    });
  }, [firebaseUsers, recipientInput]);

  const canContinue =
    recipientStatus === "resolved" &&
    !!recipientAddress &&
    isAmountValid &&
    safeAmountUnits <= balanceUnits &&
    (!isAvalancheTransfer || !!walletAddress);
  const amountInputWidth = Math.min(240, Math.max(120, Math.max(amount.length, 4) * 20));

  const handleAmountChange = (text: string) => {
    setAmount(normalizeDecimalInput(text, isUsdInput ? assetDecimals : 2));
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
    setAmount(formatDecimalForInput(converted, isUsdInput ? 2 : assetDecimals));
    setIsUsdInput((prev) => !prev);
  };

  const handleUseMaxAmount = () => {
    if (!canPrefillMax) return;
    if (isIOS) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (isUsdInput) {
      setAmount(
        formatTokenUnits(balanceUnits, assetDecimals, {
          minFractionDigits: 0,
          maxFractionDigits: assetDecimals,
          trimTrailingZeros: true,
        })
      );
      return;
    }

    setAmount(formatDecimalForInput(availableInputAmount, 2));
  };

  const handleBack = () => {
    if (isIOS) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const handleSelectFirebaseUser = useCallback((user: UserData) => {
    if (isIOS) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRecipientInput(user.username);
    setRecipientUsername(user.username);
    setRecipientAddress(user.solanaAddress);
    setRecipientStatus("resolved");
    amountInputRef.current?.focus();
  }, [isIOS]);

  const handleContinue = () => {
    console.log("[SendAmount] Continue pressed", {
      recipientInput,
      recipientAddress,
      recipientStatus,
      amount,
      balance,
      chain: activeChain,
      walletSource: avalancheWalletSource,
    });
    if (!isAmountValid) {
      Alert.alert("Invalid amount", "Please enter an amount greater than 0.");
      return;
    }
    if (amountUnits && amountUnits > balanceUnits) {
      Alert.alert("Insufficient balance", `You do not have enough ${assetSymbol}.`);
      return;
    }
    if (!recipientAddress) {
      Alert.alert(
        "Recipient missing",
        isAvalancheTransfer
          ? "Enter a valid Avalanche address."
          : "Enter a valid username or Solana address."
      );
      return;
    }
    if (isAvalancheTransfer && !walletAddress) {
      Alert.alert(
        "Wallet missing",
        avalancheWalletSource === "satochip"
          ? "Connect your Satochip card first."
          : "Your embedded Avalanche wallet is still being prepared."
      );
      return;
    }
    if (
      (!isAvalancheTransfer && !isValidSolanaAddress(recipientAddress)) ||
      (isAvalancheTransfer && !isAddress(recipientAddress))
    ) {
      Alert.alert(
        "Invalid recipient",
        isAvalancheTransfer
          ? "Recipient address is not a valid Avalanche address."
          : "Recipient address is not a valid Solana address."
      );
      return;
    }

    if (isIOS) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const recipientName = recipientUsername || recipientInput.trim();

    router.replace({
      pathname: "/send-confirm",
      params: {
        chain: activeChain,
        walletSource: isAvalancheTransfer ? avalancheWalletSource : undefined,
        currency: assetSymbol,
        recipient: recipientName,
        address: recipientAddress,
        amount: formatTokenUnits(amountUnits ?? 0n, assetDecimals, {
          minFractionDigits: 0,
          maxFractionDigits: assetDecimals,
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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButtonPressable}
          onPress={handleBack}
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
        <Text style={[styles.headerTitle, { color: palette.primaryText }]}>Send to username</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={[styles.heroIcon, { backgroundColor: palette.success }]}>
        <IconSymbol name="person.crop.circle" size={24} color={palette.actionPrimaryText} />
      </View>
      <Text style={[styles.subheadline, { color: palette.secondaryText }]} selectable>
        {isAvalancheTransfer
          ? "Enter a USDC amount and an Avalanche Fuji address."
          : "Enter an amount to send to the recipient."}
      </Text>

      {isAvalancheTransfer ? (
        <View
          style={[
            styles.walletSourceCard,
            { backgroundColor: palette.surface, borderColor: palette.borderSubtle },
          ]}
        >
          <Text style={[styles.walletSourceLabel, { color: palette.secondaryText }]} selectable>
            Wallet source
          </Text>
          <Text style={[styles.walletSourceTitle, { color: palette.primaryText }]} selectable>
            {avalancheWalletSourceLabel}
          </Text>
          <Text style={[styles.walletSourceBody, { color: palette.secondaryText }]} selectable>
            {avalancheWalletSource === "satochip"
              ? satochipAvalancheAddress
                ? `Sending from ${formatAddress(satochipAvalancheAddress)}.`
                : "Connect your Satochip card before sending from Avalanche."
              : "Using the embedded Privy Avalanche wallet for this transfer."}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.push("/satochip-connect")}
            style={[styles.walletSourceButton, { backgroundColor: palette.actionSecondary }]}
          >
            <Text
              style={[styles.walletSourceButtonText, { color: palette.actionSecondaryText }]}
            >
              {avalancheWalletSource === "satochip" ? "Refresh Satochip" : "Connect Satochip"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.inputSection}>
        <Text style={[styles.inputLabel, { color: palette.secondaryText }]} selectable>
          {isAvalancheTransfer
            ? "Enter the recipient's Avalanche address"
            : "Enter the recipient's username or address"}
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
            <Text style={[styles.inputIconText, { color: palette.secondaryText }]}>
              {isAvalancheTransfer ? "0x" : "@"}
            </Text>
          </View>
          <TextInput
            style={[styles.inputField, { color: palette.primaryText }]}
            value={recipientInput}
            onChangeText={setRecipientInput}
            placeholder={isAvalancheTransfer ? "0x..." : "Username or Solana address"}
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
            {isAvalancheTransfer
              ? "Enter a valid Avalanche address."
              : "We could not find that username."}
          </Text>
        )}
      </View>

      {!isAvalancheTransfer ? (
        <View
          style={[
            styles.firebaseUsersCard,
            { backgroundColor: palette.surface, borderColor: palette.borderSubtle },
          ]}
        >
          <View style={styles.firebaseUsersHeader}>
            <Text style={[styles.firebaseUsersTitle, { color: palette.primaryText }]} selectable>
              Firebase usernames
            </Text>
            <Text style={[styles.firebaseUsersCount, { color: palette.secondaryText }]} selectable>
              {isLoadingFirebaseUsers
                ? "Loading"
                : `${visibleFirebaseUsers.length}/${firebaseUsers.length}`}
            </Text>
          </View>

          {isLoadingFirebaseUsers ? (
            <View style={styles.firebaseUsersLoadingRow}>
              <ActivityIndicator size="small" color={palette.secondaryText} />
              <Text style={[styles.firebaseUsersMeta, { color: palette.secondaryText }]}>
                Loading usernames...
              </Text>
            </View>
          ) : firebaseUsersError ? (
            <Text style={[styles.firebaseUsersMeta, { color: palette.secondaryText }]} selectable>
              {firebaseUsersError}
            </Text>
          ) : visibleFirebaseUsers.length === 0 ? (
            <Text style={[styles.firebaseUsersMeta, { color: palette.secondaryText }]} selectable>
              No Firebase usernames found.
            </Text>
          ) : (
            <View style={styles.firebaseUsersList}>
              {visibleFirebaseUsers.map((user) => (
                <TouchableOpacity
                  key={user.solanaAddress}
                  accessibilityRole="button"
                  activeOpacity={0.78}
                  onPress={() => handleSelectFirebaseUser(user)}
                  style={[
                    styles.firebaseUserRow,
                    { backgroundColor: palette.surfaceMuted },
                  ]}
                >
                  <View style={styles.firebaseUserAvatar}>
                    <Text style={styles.firebaseUserAvatarText}>
                      {user.username[0]?.toUpperCase() ?? "U"}
                    </Text>
                  </View>
                  <View style={styles.firebaseUserBody}>
                    <Text style={[styles.firebaseUserName, { color: palette.primaryText }]}>
                      @{user.username}
                    </Text>
                    <Text
                      style={[styles.firebaseUserAddress, { color: palette.secondaryText }]}
                      numberOfLines={1}
                    >
                      {formatAddress(user.solanaAddress)}
                    </Text>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={palette.secondaryText}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ) : null}

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
              ref={amountInputRef}
            />
          </View>
        </View>
        <Text style={[styles.equivalentText, { color: palette.secondaryText }]} selectable>
          ≈ {equivalentDisplayAmount}
        </Text>
        <Text style={[styles.equivalentText, { color: palette.secondaryText }]} selectable>
          {currencyLabel}
        </Text>
        <Text style={[styles.balanceHelperText, { color: palette.secondaryText }]} selectable>
          {preferredCurrencyLabel}
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
              : formatFiatValue(availableInputAmount, {
                  context: "detailed",
                  currencyPrefix: isUsdInput ? "$" : "ARS$",
                })}
          </Text>
          {!isLoadingBalance ? (
            <Text style={[styles.availableSubtext, { color: palette.secondaryText }]} selectable>
              {assetSymbol}{" "}
              {formatTokenAmountDisplay(balanceNumber, {
                context: "detailed",
                tokenPriceUsd: 1,
                tokenDecimals: assetDecimals,
              })}{" "}
              available
            </Text>
          ) : null}
        </GlassView>
      </TouchableOpacity>

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
          onPress={() => {
            if (isAvalancheTransfer) {
              router.back();
              return;
            }
            router.replace("/send-options");
          }}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    marginTop: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  iconButtonPressable: {
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerSpacer: {
    width: 40,
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
  walletSourceCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  walletSourceLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  walletSourceTitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "700",
  },
  walletSourceBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  walletSourceButton: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  walletSourceButtonText: {
    fontSize: 14,
    fontWeight: "600",
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
  firebaseUsersCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  firebaseUsersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  firebaseUsersTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  firebaseUsersCount: {
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  firebaseUsersLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  firebaseUsersMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  firebaseUsersList: {
    gap: 8,
  },
  firebaseUserRow: {
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  firebaseUserAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3298FF",
  },
  firebaseUserAvatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  firebaseUserBody: {
    flex: 1,
    gap: 2,
  },
  firebaseUserName: {
    fontSize: 14,
    fontWeight: "700",
  },
  firebaseUserAddress: {
    fontSize: 12,
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
