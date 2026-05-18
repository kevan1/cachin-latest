import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useColorScheme,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/theme";
import { GlassView } from "@/components/ui/GlassView";
import { createP2PArsOrder } from "@/utils/p2pOrders";
import { normalizeDecimalInput } from "@/utils/tokenAmount";
import { formatDecimalForInput } from "@/utils/numberFormat";
import { fetchArsPrice } from "@/utils/priceService";
import { DEFAULT_ARS_RATE } from "@/utils/paymentConfirmation";

// Minimum ARS amount under which we know merchants won't bother fulfilling.
// Derived from observed mainnet behavior: PAY-ARS settlements live at $5+ USDC
// equivalent. Below this, orders are accepted but never progress to "paid".
// Minimum order size. p2p.me applies a flat 0.05 USDC fee on orders < 10 USDC,
// which becomes a meaningful percentage as the order shrinks (10% at 0.5 USDC,
// 5% at 1 USDC, 1% at 5 USDC). 0.5 is the lower bound where the fee is still
// tolerable for retail use (cafés, snacks, micro-payments). Previously set to
// 5 as a defensive guard against the old recipientAddr/EMV-QR settlement bugs
// (now fixed — see PR #2). Anything > 0 is technically fulfillable on chain.
const MIN_USDC_THRESHOLD = 0.5;

function parsePositiveAmount(value: string): number {
  const parsed = Number(value.trim().replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function PayArsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = usePrivy();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const palette = Colors[colorScheme];

  // Pre-fill amount when the scanner forwarded one from an ARS QR. The
  // paymentAddress from that scan is intentionally NOT carried forward — we
  // re-scan a fresh QR after merchant acceptance to dodge dynamic-QR expiry.
  const prefilledAmount = firstParam(params.amount);
  const [amountArs, setAmountArs] = useState(prefilledAmount);
  const [arsRate, setArsRate] = useState(DEFAULT_ARS_RATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchArsPrice()
      .then((rate) => {
        if (mounted && Number.isFinite(rate) && rate > 0) setArsRate(rate);
      })
      .catch((error) => {
        console.warn("[pay-ars] failed to fetch ARS rate:", error);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const amountNum = parsePositiveAmount(amountArs);
  const usdcEquivalent = arsRate > 0 ? amountNum / arsRate : 0;
  const isBelowThreshold = usdcEquivalent > 0 && usdcEquivalent < MIN_USDC_THRESHOLD;
  const canSubmit = amountNum > 0 && !isSubmitting && !isBelowThreshold;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!user?.id) {
      Alert.alert("Session required", "Sign in again before placing an order.");
      return;
    }

    setIsSubmitting(true);
    try {
      // No paymentAddress here — backend treats that as "split flow":
      // user will scan the vendor QR after the merchant accepts.
      const response = await createP2PArsOrder({
        userId: user.id,
        amount: amountArs,
        currency: "ARS",
        // Pass empty string; the optional field on the wire is empty by design.
        paymentAddress: "",
        method: "mercadopago",
      });

      if (response.orderId) {
        router.replace({
          pathname: "/order-tracking" as never,
          params: {
            orderId: response.orderId,
            currency: "ARS",
            initialStatus: response.orderStatus || "placed",
            displayUsdc: response.resolvedAmounts?.usdc ?? "",
            displayFiat: response.resolvedAmounts?.ars ?? amountArs,
            // Tells tracking screen we need to surface a QR scanner step
            // when status flips to "accepted" (mobile then calls
            // /api/p2p/order-set-payment-address with the scanned address).
            awaitingQrScan: "true",
          },
        });
      } else {
        Alert.alert(
          "Order created",
          `Status: ${response.orderStatus}. Check Activity for details.`,
          [{ text: "OK", onPress: () => router.push("/activity") }]
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error placing the order.";
      Alert.alert("Order failed", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.root, { backgroundColor: palette.background }]}>
        <View style={[styles.header, { borderColor: palette.borderSubtle }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.headerButton, { borderColor: palette.borderSubtle }]}
          >
            <MaterialIcons name="arrow-back" size={20} color={palette.primaryText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: palette.primaryText }]}>
            Pay with ARS
          </Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.hint, { color: palette.secondaryText }]}>
            Enter the bill amount in ARS. You will scan the vendor&apos;s QR
            on the next step, after a merchant accepts your order.
          </Text>

          <GlassView style={[styles.amountCard, { borderColor: palette.borderSubtle }]}>
            <Text style={[styles.amountLabel, { color: palette.secondaryText }]}>
              Amount in ARS
            </Text>
            <View style={styles.amountRow}>
              <Text style={[styles.currencyPrefix, { color: palette.primaryText }]}>
                $
              </Text>
              <TextInput
                value={amountArs}
                onChangeText={(text) => setAmountArs(normalizeDecimalInput(text, 2))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={palette.secondaryText}
                style={[styles.amountInput, { color: palette.primaryText }]}
                autoFocus
                editable={!isSubmitting}
              />
            </View>
            {amountNum > 0 ? (
              <Text style={[styles.equivalent, { color: palette.secondaryText }]}>
                ≈ {formatDecimalForInput(usdcEquivalent, 6)} USDC
              </Text>
            ) : null}
          </GlassView>

          {isBelowThreshold ? (
            <View style={[styles.warning, { borderColor: "#FCD34D" }]}>
              <MaterialIcons name="warning-amber" size={18} color="#92400E" />
              <Text style={styles.warningText}>
                Minimum order size is {MIN_USDC_THRESHOLD} USDC (a flat 0.05 USDC
                fee applies under 10 USDC and gets disproportionate at very small
                amounts). Increase the amount.
              </Text>
            </View>
          ) : null}

          <View style={[styles.note, { borderColor: palette.borderSubtle }]}>
            <MaterialIcons
              name="info-outline"
              size={18}
              color={palette.secondaryText}
            />
            <Text style={[styles.noteText, { color: palette.secondaryText }]}>
              Don&apos;t generate the vendor QR yet. Wait until the next screen
              tells you to — dynamic QRs have short timers and we want maximum
              payment time once a merchant accepts.
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={[
              styles.submitButton,
              {
                backgroundColor: canSubmit
                  ? palette.actionPrimary
                  : palette.surfaceMuted,
              },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={palette.actionPrimaryText} />
            ) : (
              <Text
                style={[
                  styles.submitButtonText,
                  {
                    color: canSubmit
                      ? palette.actionPrimaryText
                      : palette.secondaryText,
                  },
                ]}
              >
                Continue
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  scrollContent: { padding: 20, paddingBottom: 48 },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  amountCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currencyPrefix: { fontSize: 32, fontWeight: "700" },
  amountInput: {
    flex: 1,
    fontSize: 40,
    fontWeight: "700",
    paddingVertical: 4,
  },
  equivalent: {
    fontSize: 14,
    marginTop: 8,
  },
  warning: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#FEF3C7",
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 17,
  },
  note: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17 },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  submitButtonText: { fontSize: 16, fontWeight: "700" },
});
