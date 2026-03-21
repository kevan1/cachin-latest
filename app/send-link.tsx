import {
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";

import { Colors } from "@/constants/theme";
import { normalizeDecimalInput, parseDecimalToUnits } from "@/utils/tokenAmount";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { formatAmount } from "@/utils/formatAmount";

const USDC_DECIMALS = 6;
const QUICK_AMOUNTS = [50, 100, 200, 500];
const FX_RATE = 0.86;

function formatAddress(address: string): string {
  if (!address) return "Not connected";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function SendLinkScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Colors[colorScheme];
  const [amount, setAmount] = useState("");
  const [linkId] = useState(() => Math.random().toString(36).slice(2, 10));

  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  const walletAddress = wallet?.publicKey ?? "";

  const handleAmountChange = (text: string) => {
    setAmount(normalizeDecimalInput(text, USDC_DECIMALS));
  };

  const amountUnits = parseDecimalToUnits(amount, USDC_DECIMALS);
  const isAmountValid = !!amountUnits && amountUnits > 0n;
  const amountNumber = Number(amount);
  const equivalentValue =
    Number.isFinite(amountNumber) && amountNumber > 0
      ? formatAmount(amountNumber * FX_RATE, { maxFractionDigits: 2 })
      : "0";

  const handleCopyLink = async () => {
    if (!amountUnits || amountUnits <= 0n) {
      Alert.alert("Add amount", "Enter a transfer amount to generate a link.");
      return;
    }

    const link = `https://cachin.app/pay/${linkId}?amount=${encodeURIComponent(amount)}`;
    await Clipboard.setStringAsync(link);
    Alert.alert("Copied", "Payment link copied to clipboard.");
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={[styles.container, { backgroundColor: palette.background }]}
        contentContainerStyle={styles.containerContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.back()}
            style={[
              styles.iconButton,
              { backgroundColor: palette.surfaceMuted, borderColor: palette.borderSubtle },
            ]}
          >
            <MaterialIcons name="arrow-back" size={20} color={palette.primaryText} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: palette.primaryText }]}>Create link</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.heroIcon, { backgroundColor: palette.success }]}>
          <MaterialIcons name="link" size={22} color={palette.actionPrimaryText} />
        </View>
        <Text style={[styles.headline, { color: palette.primaryText }]}>
          Your payment link is ready
        </Text>
        <Text style={[styles.subheadline, { color: palette.secondaryText }]}>
          The recipient will receive the money once they open it and complete onboarding.
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
          <View style={styles.amountRow}>
            <Text style={[styles.currencySymbol, { color: palette.secondaryText }]}>$</Text>
            <TextInput
              style={[styles.amountInput, { color: palette.primaryText }]}
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={palette.secondaryText}
            />
          </View>
          <Text style={[styles.equivalentText, { color: palette.secondaryText }]}>
            ~{equivalentValue}
          </Text>
        </View>

        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map((value) => (
            <TouchableOpacity
              key={value}
              accessibilityRole="button"
              onPress={() => setAmount(String(value))}
              style={[
                styles.quickChip,
                { backgroundColor: palette.surfaceMuted, borderColor: palette.borderSubtle },
              ]}
            >
              <Text style={[styles.quickChipText, { color: palette.primaryText }]}>
                ${value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.metaRow}>
          <Text style={[styles.metaLabel, { color: palette.secondaryText }]}>Transfer from</Text>
          <Text style={[styles.metaValue, { color: palette.primaryText }]}>
            {formatAddress(walletAddress)}
          </Text>
        </View>
        <View style={styles.footer}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.back()}
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
    marginBottom: 16,
    lineHeight: 18,
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
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  quickChip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: "600",
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
