import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { saveTransaction } from "@/utils/transactionStorage";
import { Transaction as TransactionType } from "@/types/types";
import { ChainType } from "@/constants/chains";
import { useEmbeddedSolanaWallet, usePrivy } from "@privy-io/expo";
import { getSolanaRpcUrl } from "@/utils/solanaRpc";
import { formatTokenUnits, parseDecimalToUnits } from "@/utils/tokenAmount";
import { Colors } from "@/constants/theme";
import { ChinPopoutOverlay, useChinPopout } from "@/components/ChinPopout";
import { formatAmount } from "@/utils/formatAmount";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getSolanaCaip2,
  ensureSponsoredSolanaWallet,
  sendSponsoredSolanaTransaction,
} from "@/utils/privySponsorship";
import {
  getSponsoredSolanaWallet,
  setSponsoredSolanaWallet,
} from "@/utils/sponsoredWalletStorage";

const USDC_MINT_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;
const FX_RATE = 0.86;
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

export default function SendConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { recipient, address, amount, comment } = params;
  const colorScheme = useColorScheme() ?? "light";
  const palette = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const recipientAddress = firstParam(address);
  const amountString = firstParam(amount);
  const recipientName = firstParam(recipient);
  const amountUnits = parseDecimalToUnits(amountString, USDC_DECIMALS);
  const amountDisplay =
    amountUnits
      ? formatTokenUnits(amountUnits, USDC_DECIMALS, {
          minFractionDigits: 0,
          maxFractionDigits: USDC_DECIMALS,
          trimTrailingZeros: true,
        })
      : amountString;

  const amountNumber = Number(amountDisplay);
  const equivalentValue =
    Number.isFinite(amountNumber) && amountNumber > 0
      ? formatAmount(amountNumber * FX_RATE, { maxFractionDigits: 2 })
      : "0.00";

  const recipientDisplay = recipientName
    ? isValidSolanaAddress(recipientName)
      ? formatAddress(recipientName)
      : `@${normalizeUsername(recipientName)}`
    : recipientAddress
      ? formatAddress(recipientAddress)
      : "recipient";

  const [isSending, setIsSending] = useState(false);
  const [transactionSent, setTransactionSent] = useState(false);
  const [lastTransactionId, setLastTransactionId] = useState<string | null>(null);
  const { showChin, hideChin, progress, isOpen } = useChinPopout();

  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  const { user } = usePrivy();
  const [sponsoredWalletAddress, setSponsoredWalletAddress] = useState<string | null>(null);
  const [sponsoredWalletId, setSponsoredWalletId] = useState<string | null>(null);
  const walletAddress = sponsoredWalletAddress ?? wallet?.publicKey ?? "";
  const walletDisplay = walletAddress ? formatAddress(walletAddress) : "Not connected";

  useEffect(() => {
    getSponsoredSolanaWallet()
      .then(({ id, address }) => {
        setSponsoredWalletId(id);
        setSponsoredWalletAddress(address);
      })
      .catch(() => {
        setSponsoredWalletId(null);
        setSponsoredWalletAddress(null);
      });
  }, []);

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

      if (!user?.id) {
        Alert.alert("Error", "User not available");
        setIsSending(false);
        return;
      }

      let ensuredWalletId = sponsoredWalletId ?? undefined;
      let ensuredWalletAddress = sponsoredWalletAddress ?? undefined;

      try {
        const ensured = await ensureSponsoredSolanaWallet({
          userId: user.id,
          walletId: ensuredWalletId,
        });
        ensuredWalletId = ensured?.walletId ?? ensuredWalletId;
        ensuredWalletAddress =
          ensured?.publicKey ?? ensured?.address ?? ensuredWalletAddress;
        setSponsoredWalletId(ensuredWalletId ?? null);
        setSponsoredWalletAddress(ensuredWalletAddress ?? null);
        await setSponsoredSolanaWallet({
          id: ensuredWalletId ?? null,
          address: ensuredWalletAddress ?? null,
        });
      } catch (error) {
        console.error("Error ensuring sponsored wallet:", error);
        Alert.alert(
          "Error",
          "Could not prepare sponsored wallet. Please try again."
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
        Alert.alert(
          "No USDC account",
          "You need to receive USDC before you can send it."
        );
        setIsSending(false);
        return;
      }

      if (senderTotalUnits < amountUnits) {
        Alert.alert(
          "Insufficient USDC",
          `You only have ${formatTokenUnits(senderTotalUnits, USDC_DECIMALS, {
            minFractionDigits: 0,
            maxFractionDigits: USDC_DECIMALS,
            trimTrailingZeros: true,
          })} USDC but are trying to send ${amountDisplay} USDC`
        );
        setIsSending(false);
        return;
      }

      const recipientAccountInfo = await connection.getAccountInfo(toTokenAccount);
      const needsTokenAccount = recipientAccountInfo === null;

      const feePayer = fromPubkey;

      const transaction = new Transaction({
        recentBlockhash: DUMMY_BLOCKHASH,
        feePayer: feePayer,
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
          new u64(sendUnits.toString())
        );
        transaction.add(transferInstruction);
        remaining -= sendUnits;
      }

      if (remaining !== 0n) {
        throw new Error("Failed to build transfer instructions for full amount");
      }

      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      const { signature } = await sendSponsoredSolanaTransaction({
        userId: user.id,
        walletId: ensuredWalletId,
        walletAddress: ensuredWalletAddress ?? wallet?.publicKey ?? wallet?.address,
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
        `Failed to send transaction: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      setIsSending(false);
    }
  }, [
    amountDisplay,
    amountString,
    amountUnits,
    comment,
    hideChin,
    recipientAddress,
    recipientName,
    user?.id,
    sponsoredWalletAddress,
    sponsoredWalletId,
    walletAddress,
  ]);

  const chinLabel = useMemo(() => {
    if (!amountDisplay) return "Swipe to send";
    return `Swipe to send $${amountDisplay}`;
  }, [amountDisplay]);

  const handleSendPress = useCallback(() => {
    if (isSending) return;
    showChin({
      label: chinLabel,
      onComplete: () => {
        void handleSendTransaction();
      },
    });
  }, [chinLabel, handleSendTransaction, isSending, showChin]);

  const displayCornerRadius = 44;
  const chinHeight = 110;
  const chinLift = 108;
  const footerHeightClosed = 132;
  const footerHeightOpen = 72;
  const interfaceStyle = useAnimatedStyle(() => ({
    marginBottom: interpolate(progress.value, [0, 1], [0, chinLift]),
  }));

  useEffect(() => {
    return () => {
      hideChin();
    };
  }, [hideChin]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.mainCard,
          { borderBottomLeftRadius: displayCornerRadius, borderBottomRightRadius: displayCornerRadius },
          interfaceStyle,
        ]}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.containerContent,
            {
              paddingTop: insets.top + 12,
              paddingBottom: (isOpen ? footerHeightOpen : footerHeightClosed) + 16,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {transactionSent ? (
            <>
              <View style={styles.header}>
                <View style={styles.headerSpacer} />
                <Text style={[styles.title, { color: palette.primaryText }]}>Sent</Text>
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
                  ${amountDisplay} USDC
                </Animated.Text>
              </View>

              <View style={styles.footer}>
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
                Send to {recipientDisplay}
              </Text>
              <Text style={[styles.subheadline, { color: palette.secondaryText }]}>
                Double-check the details before you send.
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
                  ${amountDisplay}
                </Text>
                <Text style={[styles.equivalentText, { color: palette.secondaryText }]}>
                  ~{equivalentValue}
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
            </>
          )}
        </ScrollView>
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
  },
  equivalentText: {
    fontSize: 13,
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
    justifyContent: "center",
    marginBottom: 40,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  successAmount: {
    fontSize: 36,
    fontWeight: "700",
  },
});
