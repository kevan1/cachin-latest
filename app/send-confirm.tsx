import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
  ScrollView,
} from "react-native";
import Animated, {
  FadeIn,
  ZoomIn,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Confetti } from "react-native-fast-confetti";
import { useImage } from "@shopify/react-native-skia";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import {
  getAddress,
  isAddress,
} from "viem";

import { saveTransaction } from "@/utils/transactionStorage";
import { Transaction as TransactionType } from "@/types/types";
import { ChainType, getChainToken } from "@/constants/chains";
import { useActiveSolanaWallet } from "@/hooks/useActiveSolanaWallet";
import { useNativeSolanaWalletActions } from "@/hooks/useNativeSolanaWalletActions";
import {
  useEmbeddedSolanaWallet,
  usePrivy,
  useSessionSigners,
} from "@privy-io/expo";
import {
  isDuplicateSessionSignerError,
  isGaslessAuthorizationRequiredError,
  isOnDeviceSessionSignerModeError,
} from "@/utils/privyGasless";
import {
  getPrivyGaslessKeyQuorumId,
  getPrivyGasSponsorPolicyIds,
} from "@/utils/privyGaslessConfig";
import { getSolanaRpcUrl } from "@/utils/solanaRpc";
import { formatTokenUnits, parseDecimalToUnits } from "@/utils/tokenAmount";
import { formatFiatValue, formatTokenAmountDisplay } from "@/utils/numberFormat";
import { Colors } from "@/constants/theme";
import { ChinPopoutOverlay, useChinPopout } from "@/components/ChinPopout";
import { fetchArsPrice } from "@/utils/priceService";
import { getSelectedCurrency, Currency } from "@/utils/userStorage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getSolanaCaip2,
  ensureSponsoredSolanaWallet,
  sendSponsoredSolanaTransaction,
} from "@/utils/privySponsorship";
import {
  setSponsoredSolanaWallet,
} from "@/utils/sponsoredWalletStorage";
import {
  getSolanaProviderAddress,
} from "@/utils/privySolanaWallet";
import {
  getSatochipErrorMessage,
  sendSatochipAvalancheUsdcTransfer,
} from "@/utils/satochip";
import {
  loadSatochipAvalancheAddress,
} from "@/utils/satochipStorage";

const USDC_MINT_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;
const DEFAULT_ARS_RATE = 1500;
const DUMMY_BLOCKHASH = "11111111111111111111111111111111";
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim().length > 0) return error;
  return fallback;
}

async function buildSolanaUsdcTransferTransaction({
  amountDisplay,
  amountUnits,
  connection,
  recentBlockhash,
  recipientAddress,
  senderAddress,
}: {
  amountDisplay: string;
  amountUnits: bigint;
  connection: Connection;
  recentBlockhash: string;
  recipientAddress: string;
  senderAddress: string;
}): Promise<Transaction> {
  const fromPubkey = new PublicKey(senderAddress);
  const toPubkey = new PublicKey(recipientAddress);
  const usdcMintPubkey = new PublicKey(USDC_MINT_ADDRESS);

  const toTokenAccount = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    usdcMintPubkey,
    toPubkey
  );

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(fromPubkey, {
    mint: usdcMintPubkey,
  });

  const senderTokenAccounts = tokenAccounts.value
    .map((acc) => {
      const parsedInfo = acc.account.data.parsed.info;
      const tokenAmount = parsedInfo.tokenAmount;
      const accountAmount = BigInt(tokenAmount.amount as string);
      return {
        pubkey: acc.pubkey,
        amount: accountAmount,
      };
    })
    .filter((acc) => acc.amount > 0n)
    .sort((a, b) => (a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0));

  const senderTotalUnits = senderTokenAccounts.reduce((sum, acc) => sum + acc.amount, 0n);

  if (senderTokenAccounts.length === 0 || senderTotalUnits === 0n) {
    throw new Error("You need to receive USDC before you can send it.");
  }

  if (senderTotalUnits < amountUnits) {
    throw new Error(
      `You only have ${formatTokenUnits(senderTotalUnits, USDC_DECIMALS, {
        minFractionDigits: 0,
        maxFractionDigits: USDC_DECIMALS,
        trimTrailingZeros: true,
      })} USDC but are trying to send ${amountDisplay} USDC`
    );
  }

  const recipientAccountInfo = await connection.getAccountInfo(toTokenAccount);
  const needsTokenAccount = recipientAccountInfo === null;
  const feePayer = fromPubkey;
  const transaction = new Transaction({
    recentBlockhash,
    feePayer,
  });

  if (needsTokenAccount) {
    const createAccountInstruction = Token.createAssociatedTokenAccountInstruction(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      usdcMintPubkey,
      toTokenAccount,
      toPubkey,
      feePayer
    );
    transaction.add(createAccountInstruction);
  }

  let remaining = amountUnits;
  for (const source of senderTokenAccounts) {
    if (remaining <= 0n) break;
    const sendUnits = source.amount >= remaining ? remaining : source.amount;
    if (sendUnits <= 0n) continue;

    const transferInstruction = Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      source.pubkey,
      toTokenAccount,
      fromPubkey,
      [],
      new (u64 as any)(sendUnits.toString())
    );
    transaction.add(transferInstruction);
    remaining -= sendUnits;
  }

  if (remaining !== 0n) {
    throw new Error("Failed to build transfer instructions for full amount");
  }

  return transaction;
}

export default function SendConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { recipient, address, amount, comment, chain, currency } = params;
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const palette = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const activeChain =
    firstParam(chain) === ChainType.AVALANCHE ? ChainType.AVALANCHE : ChainType.SOLANA;
  const isAvalancheTransfer = activeChain === ChainType.AVALANCHE;
  const avalancheUsdcToken = getChainToken(ChainType.AVALANCHE, "usdc");
  const assetSymbol =
    firstParam(currency) || (isAvalancheTransfer ? avalancheUsdcToken?.symbol ?? "USDC" : "USDC");
  const assetDecimals = isAvalancheTransfer
    ? avalancheUsdcToken?.decimals ?? USDC_DECIMALS
    : USDC_DECIMALS;

  const recipientAddress = firstParam(address);
  const amountString = firstParam(amount);
  const recipientName = firstParam(recipient);
  const amountUnits = parseDecimalToUnits(amountString, assetDecimals);
  const amountDisplay =
    amountUnits
      ? formatTokenUnits(amountUnits, assetDecimals, {
          minFractionDigits: 0,
          maxFractionDigits: assetDecimals,
          trimTrailingZeros: true,
        })
      : amountString;
  const amountValueUsd = Number.parseFloat(amountDisplay);

  const recipientDisplay = recipientName
    ? !isAvalancheTransfer && isValidSolanaAddress(recipientName)
      ? formatAddress(recipientName)
      : isAvalancheTransfer
        ? formatAddress(recipientName)
        : `@${normalizeUsername(recipientName)}`
    : recipientAddress
      ? formatAddress(recipientAddress)
      : "recipient";

  const [isSending, setIsSending] = useState(false);
  const [transactionSent, setTransactionSent] = useState(false);
  const [lastTransactionId, setLastTransactionId] = useState<string | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState<Currency>("USD");
  const [arsRate, setArsRate] = useState(DEFAULT_ARS_RATE);
  const [satochipAvalancheAddress, setSatochipAvalancheAddress] = useState<string | null>(null);
  const [satochipPin, setSatochipPin] = useState("");
  const { showChin, hideChin, progress, isOpen } = useChinPopout();
  const successChimePlayerRef = useRef<{
    play: () => void;
    seekTo?: (seconds: number) => Promise<void> | void;
    remove?: () => void;
  } | null>(null);
  const hasPlayedSuccessFeedback = useRef(false);

  const {
    create: createSolanaWallet,
    status: solanaWalletStatus,
  } = useEmbeddedSolanaWallet();
  const activeSolanaWallet = useActiveSolanaWallet();
  const { signAndSendTransactions } = useNativeSolanaWalletActions();
  const { user } = usePrivy();
  const { addSessionSigners } = useSessionSigners();
  const [sponsoredWalletAddress, setSponsoredWalletAddress] = useState<string | null>(null);
  const effectiveSponsoredWalletAddress =
    sponsoredWalletAddress ?? activeSolanaWallet.sponsoredWalletAddress;
  const isSatochipTransfer = isAvalancheTransfer;
  const walletAddress = isAvalancheTransfer
    ? satochipAvalancheAddress ?? ""
    : activeSolanaWallet.source === "native-mwa"
      ? activeSolanaWallet.address ?? ""
      : effectiveSponsoredWalletAddress ?? activeSolanaWallet.embeddedWalletAddress ?? "";
  const walletDisplay = walletAddress ? formatAddress(walletAddress) : "Not connected";
  const primaryFiatCurrency = preferredCurrency === "ARS" ? "ARS" : "USD";
  const secondaryFiatCurrency = primaryFiatCurrency === "ARS" ? "USD" : "ARS";
  const primaryFiatValue =
    Number.isFinite(amountValueUsd) && amountValueUsd > 0
      ? primaryFiatCurrency === "ARS"
        ? amountValueUsd * arsRate
        : amountValueUsd
      : 0;
  const secondaryFiatValue =
    Number.isFinite(amountValueUsd) && amountValueUsd > 0
      ? secondaryFiatCurrency === "ARS"
        ? amountValueUsd * arsRate
        : amountValueUsd
      : 0;
  const primaryAmountLabel = formatFiatValue(primaryFiatValue, {
    context: "detailed",
    currencyPrefix: primaryFiatCurrency === "ARS" ? "ARS$" : "$",
  });
  const secondaryAmountLabel = formatFiatValue(secondaryFiatValue, {
    context: "detailed",
    currencyPrefix: secondaryFiatCurrency === "ARS" ? "ARS$" : "$",
  });
  const assetAmountLabel = formatTokenAmountDisplay(amountValueUsd, {
    context: "detailed",
    tokenPriceUsd: 1,
    tokenDecimals: assetDecimals,
  });
  const keyQuorumId = useMemo(() => getPrivyGaslessKeyQuorumId(), []);
  const sessionSignerPolicyIds = useMemo(() => getPrivyGasSponsorPolicyIds(), []);

  const authorizeGaslessForAddress = useCallback(
    async (address: string) => {
      if (!keyQuorumId) return;

      try {
        await addSessionSigners({
          address,
          signers: [
            {
              signerId: keyQuorumId,
              policyIds: sessionSignerPolicyIds,
            },
          ],
        });
      } catch (error) {
        if (isOnDeviceSessionSignerModeError(error)) {
          await addSessionSigners({
            address,
            signers: [],
          });
          return;
        }

        if (isDuplicateSessionSignerError(error)) {
          return;
        }
        throw error;
      }
    },
    [addSessionSigners, keyQuorumId, sessionSignerPolicyIds]
  );

  useEffect(() => {
    if (!user?.id) {
      setSponsoredWalletAddress(null);
      return;
    }

    if (activeSolanaWallet.sponsoredWalletAddress) {
      setSponsoredWalletAddress(activeSolanaWallet.sponsoredWalletAddress);
    }
  }, [activeSolanaWallet.sponsoredWalletAddress, user?.id]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadSatochipAddress = async () => {
        if (!isAvalancheTransfer) return;

        try {
          const storedAddress = await loadSatochipAvalancheAddress();
          if (!isActive) return;

          setSatochipAvalancheAddress(storedAddress);
        } catch (error) {
          console.error("[SendConfirm] Failed to load Satochip address", error);
        }
      };

      void loadSatochipAddress();

      return () => {
        isActive = false;
      };
    }, [isAvalancheTransfer])
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadMoneyPreferences = async () => {
        try {
          const [selectedCurrency, latestArsRate] = await Promise.all([
            getSelectedCurrency(),
            fetchArsPrice(),
          ]);

          if (!isActive) return;
          setPreferredCurrency(selectedCurrency);
          if (latestArsRate > 0) {
            setArsRate(latestArsRate);
          }
        } catch (error) {
          console.error("[SendConfirm] Failed to load money preferences", error);
        }
      };

      void loadMoneyPreferences();
      return () => {
        isActive = false;
      };
    }, [])
  );

  const handleClose = useCallback(() => {
    hideChin();
    router.push("/(main)/home");
  }, [hideChin, router]);

  const handleViewReceipt = useCallback(() => {
    hideChin();
    if (lastTransactionId) {
      router.push({
        pathname: "/transaction-detail",
        params: { transactionId: lastTransactionId },
      });
    }
  }, [hideChin, lastTransactionId, router]);

  const handleSendTransaction = useCallback(async () => {
    try {
      setIsSending(true);
      hideChin();

      if (isAvalancheTransfer) {
        if (!avalancheUsdcToken) {
          throw new Error("Avalanche USDC is not configured.");
        }

        if (!recipientAddress || !isAddress(recipientAddress)) {
          throw new Error("Recipient address is not a valid Avalanche address.");
        }

        if (!amountUnits || amountUnits <= 0n) {
          throw new Error(`Amount "${amountString}" is not valid.`);
        }

        const toAddress = getAddress(recipientAddress);
        let signature: string;
        let fromAddress: string;
        let feeValue: number | undefined;
        let receiptStatus: "confirmed" | "failed" = "confirmed";

        if (!satochipAvalancheAddress) {
          throw new Error("Connect your Satochip card first.");
        }
        if (!satochipPin.trim()) {
          throw new Error("Enter your Satochip PIN before sending.");
        }

        const result = await sendSatochipAvalancheUsdcTransfer({
          pin: satochipPin.trim(),
          recipientAddress: toAddress,
          amountUnits,
          expectedAddress: satochipAvalancheAddress,
        });

        signature = result.signature;
        fromAddress = result.address;
        feeValue = result.fee;

        const newTransaction: TransactionType = {
          id: signature,
          signature,
          type: "send",
          currency: "USDC",
          chain: ChainType.AVALANCHE,
          amount: parseFloat(amountDisplay),
          recipient: recipientName || toAddress,
          sender: fromAddress,
          address: toAddress,
          timestamp: Date.now(),
          status: receiptStatus,
          comment: comment as string | undefined,
          fee: feeValue,
        };

        await saveTransaction(newTransaction);

        setLastTransactionId(signature);
        setTransactionSent(true);
        setIsSending(false);
        return;
      }

      if (!user?.id) {
        Alert.alert("Error", "User not available");
        setIsSending(false);
        return;
      }

      if (!recipientAddress) {
        Alert.alert("Error", "Recipient address not found");
        setIsSending(false);
        return;
      }

      if (!amountUnits || amountUnits <= 0n) {
        Alert.alert("Invalid amount", `Amount "${amountString}" is not valid.`);
        setIsSending(false);
        return;
      }

      if (activeSolanaWallet.source === "native-mwa") {
        const senderAddress = activeSolanaWallet.address;
        if (!senderAddress) {
          Alert.alert("Error", "No native Solana wallet found");
          setIsSending(false);
          return;
        }

        const connection = new Connection(getSolanaRpcUrl(), "confirmed");
        const latestBlockhash = await connection.getLatestBlockhashAndContext("confirmed");
        const transaction = await buildSolanaUsdcTransferTransaction({
          amountDisplay,
          amountUnits,
          connection,
          recentBlockhash: latestBlockhash.value.blockhash,
          recipientAddress,
          senderAddress,
        });
        const signature = await signAndSendTransactions(
          transaction,
          latestBlockhash.context.slot
        );

        await connection.confirmTransaction(
          {
            signature,
            blockhash: latestBlockhash.value.blockhash,
            lastValidBlockHeight: latestBlockhash.value.lastValidBlockHeight,
          },
          "confirmed"
        );

        const newTransaction: TransactionType = {
          id: signature,
          signature,
          type: "send",
          currency: "USDC",
          chain: ChainType.SOLANA,
          amount: parseFloat(amountDisplay),
          recipient: recipientName,
          sender: senderAddress,
          address: recipientAddress,
          timestamp: Date.now(),
          status: "confirmed",
          comment: comment as string | undefined,
        };

        await saveTransaction(newTransaction);

        setLastTransactionId(signature);
        setTransactionSent(true);
        setIsSending(false);
        return;
      }

      let ensuredWalletId: string | undefined;
      let ensuredWalletAddress =
        effectiveSponsoredWalletAddress ??
        activeSolanaWallet.embeddedWalletAddress ??
        undefined;

      if (!ensuredWalletAddress) {
        const walletIsBusy =
          solanaWalletStatus === "creating" ||
          solanaWalletStatus === "connecting" ||
          solanaWalletStatus === "reconnecting";

        if (walletIsBusy) {
          throw new Error("Your Solana wallet is still being prepared. Please try again in a moment.");
        }

        if (typeof createSolanaWallet !== "function") {
          throw new Error("No Solana wallet is available for this user.");
        }

        const provider = await createSolanaWallet({ recoveryMethod: "privy" });
        ensuredWalletAddress =
          getSolanaProviderAddress(provider) ??
          activeSolanaWallet.embeddedWalletAddress ??
          effectiveSponsoredWalletAddress ??
          undefined;

        if (!ensuredWalletAddress) {
          throw new Error("Created a Solana wallet, but it has not finished syncing yet. Please try again in a moment.");
        }
      }

      await authorizeGaslessForAddress(ensuredWalletAddress);

      try {
        let ensured;
        try {
          ensured = await ensureSponsoredSolanaWallet({
            userId: user.id,
            walletAddress: ensuredWalletAddress,
          });
        } catch (error) {
          if (isGaslessAuthorizationRequiredError(error)) {
            await authorizeGaslessForAddress(ensuredWalletAddress);
            ensured = await ensureSponsoredSolanaWallet({
              userId: user.id,
              walletAddress: ensuredWalletAddress,
            });
          } else {
            throw error;
          }
        }
        ensuredWalletId = ensured?.walletId ?? ensuredWalletId;
        ensuredWalletAddress =
          ensured?.publicKey ?? ensured?.address ?? ensuredWalletAddress;
        setSponsoredWalletAddress(ensuredWalletAddress ?? null);
        await setSponsoredSolanaWallet({
          id: ensuredWalletId ?? null,
          address: ensuredWalletAddress ?? null,
        }, user.id);
      } catch (error) {
        console.error("Error ensuring sponsored wallet:", error);
        Alert.alert(
          "Error",
          `Could not prepare sponsored wallet.\n\n${getErrorMessage(
            error,
            "Please try again."
          )}`
        );
        setIsSending(false);
        return;
      }

      const senderAddress = ensuredWalletAddress || walletAddress || null;
      if (!senderAddress) {
        Alert.alert("Error", "No wallet found");
        setIsSending(false);
        return;
      }

      if (!recipientAddress) {
        Alert.alert("Error", "Recipient address not found");
        setIsSending(false);
        return;
      }

      if (!amountUnits || amountUnits <= 0n) {
        Alert.alert("Invalid amount", `Amount "${amountString}" is not valid.`);
        setIsSending(false);
        return;
      }

      const connection = new Connection(getSolanaRpcUrl(), "confirmed");
      const transaction = await buildSolanaUsdcTransferTransaction({
        amountDisplay,
        amountUnits,
        connection,
        recentBlockhash: DUMMY_BLOCKHASH,
        recipientAddress,
        senderAddress,
      });

      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      const { signature } = await sendSponsoredSolanaTransaction({
        userId: user.id,
        walletId: ensuredWalletId,
        walletAddress: ensuredWalletAddress ?? activeSolanaWallet.embeddedWalletAddress,
        transactionBase64: serializedTransaction.toString("base64"),
        caip2: getSolanaCaip2(),
      });

      await connection.confirmTransaction(signature, "confirmed");

      const newTransaction: TransactionType = {
        id: signature,
        signature,
        type: "send",
        currency: "USDC",
        chain: ChainType.SOLANA,
        amount: parseFloat(amountDisplay),
        recipient: recipientName,
        sender: senderAddress,
        address: recipientAddress,
        timestamp: Date.now(),
        status: "confirmed",
        comment: comment as string | undefined,
      };

      await saveTransaction(newTransaction);

      setLastTransactionId(signature);
      setTransactionSent(true);
      setIsSending(false);
    } catch (error) {
      console.error("Error sending transaction:", error);
      Alert.alert(
        "Error",
        `Failed to send transaction: ${getSatochipErrorMessage(
          error,
          "Unknown error"
        )}`
      );
      setIsSending(false);
    }
  }, [
    amountDisplay,
    amountString,
    amountUnits,
    activeSolanaWallet.address,
    activeSolanaWallet.embeddedWalletAddress,
    activeSolanaWallet.source,
    avalancheUsdcToken,
    authorizeGaslessForAddress,
    comment,
    createSolanaWallet,
    effectiveSponsoredWalletAddress,
    hideChin,
    isAvalancheTransfer,
    recipientAddress,
    recipientName,
    satochipAvalancheAddress,
    satochipPin,
    signAndSendTransactions,
    solanaWalletStatus,
    user?.id,
    walletAddress,
  ]);

  const chinLabel = useMemo(() => {
    if (!amountDisplay) return "Swipe to send";
    return isSatochipTransfer
      ? `Swipe to sign ${primaryAmountLabel} with Satochip`
      : `Swipe to send ${primaryAmountLabel}`;
  }, [amountDisplay, isSatochipTransfer, primaryAmountLabel]);

  const handleSendPress = useCallback(() => {
    if (isSending) return;
    if (isSatochipTransfer && !satochipPin.trim()) {
      Alert.alert("PIN required", "Enter your Satochip PIN before sending.");
      return;
    }
    showChin({
      label: chinLabel,
      onComplete: () => {
        void handleSendTransaction();
      },
    });
  }, [chinLabel, handleSendTransaction, isSending, isSatochipTransfer, satochipPin, showChin]);

  const displayCornerRadius = 44;
  const chinHeight = 110;
  const chinLift = 108;
  const footerHeightClosed = 132;
  const footerHeightOpen = 72;
  const moneyStackImage = useImage(require("../assets/images/money-stack.png"));
  const interfaceStyle = useAnimatedStyle(() => ({
    marginBottom: interpolate(progress.value, [0, 1], [0, chinLift]),
  }));

  useEffect(() => {
    return () => {
      hideChin();
    };
  }, [hideChin]);

  useEffect(() => {
    let cancelled = false;

    const loadConfirmationSound = async () => {
      try {
        const expoAudio = await import("expo-audio");
        await expoAudio.setAudioModeAsync({ playsInSilentMode: true });
        const player = expoAudio.createAudioPlayer(
          require("../assets/sounds/confirmation-chime.wav")
        );

        if (cancelled) {
          player.remove?.();
          return;
        }

        successChimePlayerRef.current = player;
      } catch {
        // If the native module is not present in this build, keep running without sound.
        successChimePlayerRef.current = null;
      }
    };

    void loadConfirmationSound();

    return () => {
      cancelled = true;
      successChimePlayerRef.current?.remove?.();
      successChimePlayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!transactionSent) {
      hasPlayedSuccessFeedback.current = false;
      return;
    }
    if (hasPlayedSuccessFeedback.current) {
      return;
    }

    hasPlayedSuccessFeedback.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
      // Haptics are best effort.
    });

    const player = successChimePlayerRef.current;
    if (player?.seekTo) {
      void Promise.resolve(player.seekTo(0)).catch(() => {
        // Ignore seek errors and try playing anyway.
      });
    }
    player?.play();
  }, [transactionSent]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.mainCard,
          { borderBottomLeftRadius: displayCornerRadius, borderBottomRightRadius: displayCornerRadius },
          interfaceStyle,
        ]}
      >
        {transactionSent && moneyStackImage ? (
          <View pointerEvents="none" style={styles.confettiLayer}>
            <Confetti
              type="image"
              flakeImage={moneyStackImage}
              count={90}
              flakeSize={{ width: 28, height: 18 }}
              autoStartDelay={120}
              fallDuration={6800}
              fadeOutOnEnd
            />
          </View>
        ) : null}
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.containerContent,
            {
              paddingTop: insets.top + 12,
              paddingBottom: transactionSent
                ? insets.bottom + 24
                : (isOpen ? footerHeightOpen : footerHeightClosed) + 16,
            },
          ]}
          scrollEnabled={false}
          bounces={false}
          alwaysBounceVertical={false}
          showsVerticalScrollIndicator={false}
        >
          {transactionSent ? (
            <>
              <View style={styles.header}>
                <View style={styles.headerSpacer} />
                <Text style={[styles.title, { color: palette.primaryText }]}>Transfer sent</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={handleClose}
                  style={[
                    styles.iconButton,
                    {
                      backgroundColor: palette.surfaceMuted,
                      borderColor: palette.borderSubtle,
                    },
                  ]}
                >
                  <MaterialIcons name="close" size={18} color={palette.primaryText} />
                </TouchableOpacity>
              </View>

              <View style={styles.successContainer}>
                <Animated.View
                  entering={ZoomIn.springify().damping(12)}
                  style={[styles.heroIcon, { backgroundColor: palette.success }]}
                >
                  <MaterialIcons name="check" size={26} color={palette.actionPrimaryText} />
                </Animated.View>
                <Animated.Text
                  entering={FadeIn.delay(200).duration(500)}
                  style={[styles.successTitle, { color: palette.primaryText }]}
                >
                  Payment sent
                </Animated.Text>
                <Animated.Text
                  entering={FadeIn.delay(400).duration(500)}
                  style={[styles.successAmount, { color: palette.primaryText }]}
                >
                  {primaryAmountLabel}
                </Animated.Text>
                <Text style={[styles.successAmountSecondary, { color: palette.secondaryText }]}>
                  {secondaryAmountLabel}
                </Text>

                <View
                  style={[
                    styles.successDetailCard,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderSubtle,
                    },
                  ]}
                >
                  <View style={styles.successDetailRow}>
                    <Text style={[styles.successDetailLabel, { color: palette.secondaryText }]}>
                      Recipient
                    </Text>
                    <Text style={[styles.successDetailValue, { color: palette.primaryText }]}>
                      {recipientDisplay}
                    </Text>
                  </View>
                  <View style={styles.successDetailRow}>
                    <Text style={[styles.successDetailLabel, { color: palette.secondaryText }]}>
                      From
                    </Text>
                    <Text style={[styles.successDetailValue, { color: palette.primaryText }]}>
                      {walletDisplay}
                    </Text>
                  </View>
                  <View style={styles.successDetailRow}>
                    <Text style={[styles.successDetailLabel, { color: palette.secondaryText }]}>
                      Status
                    </Text>
                    <Text style={[styles.successDetailValue, { color: palette.success }]}>
                      Confirmed
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.successActions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={handleClose}
                  style={[
                    styles.primaryButton,
                    { backgroundColor: palette.actionPrimary },
                  ]}
                >
                  <Text
                    style={[styles.primaryButtonText, { color: palette.actionPrimaryText }]}
                  >
                    Back to home
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={handleViewReceipt}
                  style={[
                    styles.secondaryButton,
                    { backgroundColor: palette.actionSecondary },
                  ]}
                >
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: palette.actionSecondaryText },
                    ]}
                  >
                    View receipt
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.header}>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => router.back()}
                  style={[
                    styles.iconButton,
                    {
                      backgroundColor: palette.surfaceMuted,
                      borderColor: palette.borderSubtle,
                    },
                  ]}
                >
                  <MaterialIcons name="arrow-back" size={20} color={palette.primaryText} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: palette.primaryText }]}>Confirm</Text>
                <View style={styles.headerSpacer} />
              </View>

              <View style={[styles.heroIcon, { backgroundColor: palette.success }]}>
                <MaterialIcons name="send" size={22} color={palette.actionPrimaryText} />
              </View>
              <Text style={[styles.headline, { color: palette.primaryText }]}>
                {isAvalancheTransfer
                  ? `Send ${assetSymbol} to ${recipientDisplay}`
                  : `Send to ${recipientDisplay}`}
              </Text>
              <Text style={[styles.subheadline, { color: palette.secondaryText }]}>
                {isSatochipTransfer
                  ? "Hold the Satochip card near the phone when you confirm. The card will sign the Fuji USDC transfer."
                  : isAvalancheTransfer
                  ? "Double-check the Avalanche Fuji address before you send."
                  : "Double-check the details before you send."}
              </Text>

              <View
                style={[
                  styles.amountCard,
                  { backgroundColor: palette.surface, borderColor: palette.borderSubtle },
                ]}
              >
                <View style={[styles.amountBadge, { backgroundColor: palette.surfaceMuted }]}>
                  <Text style={[styles.amountBadgeText, { color: palette.secondaryText }]}>
                    Transfer amount
                  </Text>
                </View>
                <Text style={[styles.amountText, { color: palette.primaryText }]}>
                  {primaryAmountLabel}
                </Text>
                <Text style={[styles.equivalentText, { color: palette.secondaryText }]}>
                  {secondaryAmountLabel}
                </Text>
                <Text style={[styles.assetAmountText, { color: palette.secondaryText }]}>
                  {assetSymbol} {assetAmountLabel}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: palette.secondaryText }]}>Recipient</Text>
                <Text style={[styles.metaValue, { color: palette.primaryText }]}>
                  {recipientDisplay}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: palette.secondaryText }]}>
                  Transfer from
                </Text>
                <Text style={[styles.metaValue, { color: palette.primaryText }]}>
                  {walletDisplay}
                </Text>
              </View>

              {isSatochipTransfer ? (
                <View
                  style={[
                    styles.satochipCard,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderSubtle,
                    },
                  ]}
                >
                  <Text style={[styles.satochipLabel, { color: palette.secondaryText }]}>
                    Sign with Satochip
                  </Text>
                  <Text style={[styles.satochipTitle, { color: palette.primaryText }]}>
                    Enter the card PIN
                  </Text>
                  <Text style={[styles.satochipBody, { color: palette.secondaryText }]}>
                    Cachin will ask the card to sign this Avalanche Fuji USDC transfer over NFC.
                  </Text>
                  <TextInput
                    value={satochipPin}
                    onChangeText={setSatochipPin}
                    placeholder="Card PIN"
                    placeholderTextColor={palette.secondaryText}
                    keyboardType="number-pad"
                    secureTextEntry
                    style={[
                      styles.satochipInput,
                      {
                        color: palette.primaryText,
                        backgroundColor: palette.surfaceMuted,
                        borderColor: palette.borderSubtle,
                      },
                    ]}
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => router.push("/satochip-connect")}
                    style={[
                      styles.satochipManageButton,
                      { backgroundColor: palette.actionSecondary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.satochipManageButtonText,
                        { color: palette.actionSecondaryText },
                      ]}
                    >
                      Refresh connected card
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
        {transactionSent ? null : (
          <View style={[styles.footer, styles.footerPinned, isOpen && styles.footerChinOpen]}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                hideChin();
                router.back();
              }}
              style={[
                styles.secondaryButton,
                { backgroundColor: palette.actionSecondary },
              ]}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: palette.actionSecondaryText },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            {isOpen ? null : (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={handleSendPress}
                disabled={isSending}
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: palette.actionPrimary,
                    opacity: isSending ? 0.6 : 1,
                  },
                ]}
              >
                {isSending ? (
                  <ActivityIndicator color={palette.actionPrimaryText} />
                ) : (
                  <Text
                    style={[
                      styles.primaryButtonText,
                      { color: palette.actionPrimaryText },
                    ]}
                  >
                    Send
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.View>

      <ChinPopoutOverlay
        useModal={false}
        showBackdrop={false}
        bottomPadding={20}
        chinHeight={chinHeight}
        includeSafeArea={false}
        allowPassthrough
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  mainCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
  },
  scrollArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  containerContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
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
    marginBottom: 14,
    lineHeight: 18,
  },
  amountCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 12,
    alignItems: "center",
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
  amountText: {
    fontSize: 36,
    fontWeight: "600",
    marginBottom: 6,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  equivalentText: {
    fontSize: 13,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  assetAmountText: {
    fontSize: 12,
    marginTop: 4,
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
  satochipCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  satochipLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  satochipTitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "700",
  },
  satochipBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  satochipInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
    fontSize: 15,
  },
  satochipManageButton: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  satochipManageButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    gap: 12,
  },
  footerPinned: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 16,
  },
  footerChinOpen: {
    bottom: 10,
  },
  primaryButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  secondaryButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 56,
    paddingBottom: 20,
    gap: 10,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  successAmount: {
    fontSize: 36,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  successAmountSecondary: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: -6,
    fontVariant: ["tabular-nums"],
  },
  successDetailCard: {
    marginTop: 18,
    width: "100%",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  successDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  successDetailLabel: {
    fontSize: 13,
  },
  successDetailValue: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  successActions: {
    gap: 12,
    marginTop: 12,
    marginBottom: 8,
  },
});
