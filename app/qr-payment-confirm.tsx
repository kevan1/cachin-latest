import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/theme";
import { GlassView } from "@/components/ui/GlassView";
import { createMantecaQrPayment, resolveMantecaQrQuote } from "@/utils/mantecaOrders";
import { createP2PArsOrder } from "@/utils/p2pOrders";
import { normalizeDecimalInput } from "@/utils/tokenAmount";
import { formatDecimalForInput } from "@/utils/numberFormat";
import { fetchArsPrice } from "@/utils/priceService";
import {
  buildPrePaymentConfirmation,
  DEFAULT_ARS_RATE,
  type PaymentConfirmationCurrency,
} from "@/utils/paymentConfirmation";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parsePositiveParam(value: string): number {
  const parsed = Number(value.trim().replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function ConfirmationRow({
  label,
  value,
  secondary,
  emphasis,
  labelColor,
  valueColor,
  secondaryColor,
}: {
  label: string;
  value: string;
  secondary?: string;
  emphasis?: boolean;
  labelColor: string;
  valueColor: string;
  secondaryColor: string;
}) {
  return (
    <View style={[styles.confirmationRow, emphasis ? styles.confirmationTotalRow : null]}>
      <Text style={[styles.confirmationLabel, { color: labelColor }]}>{label}</Text>
      <View style={styles.confirmationValueGroup}>
        <Text
          selectable
          style={[
            styles.confirmationValue,
            emphasis ? styles.confirmationValueEmphasis : null,
            { color: valueColor },
          ]}
        >
          {value}
        </Text>
        {secondary ? (
          <Text selectable style={[styles.confirmationSecondary, { color: secondaryColor }]}>
            {secondary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function QrPaymentConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = usePrivy();
  const { height } = useWindowDimensions();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const palette = Colors[colorScheme];
  const isAndroid = process.env.EXPO_OS === "android";
  const useCompactAndroidLayout = isAndroid && height < 780;

  const initialAmount = firstParam(params.amount);
  const currencyParam = firstParam(params.currency).toUpperCase();
  const methodParam = firstParam(params.method).toLowerCase();
  const railParam = firstParam(params.rail).toLowerCase();
  const destination = firstParam(params.paymentAddress);
  const rawQr = firstParam(params.rawQr);
  const amountUsdcParam = firstParam(params.amountUsdc);
  const arsRateParam = firstParam(params.arsRate);
  const scannedAmountLocked = parsePositiveParam(initialAmount) > 0;
  const selectedRail = railParam === "manteca" ? "manteca" : "p2p";
  const isMantecaRail = selectedRail === "manteca";

  const [amount, setAmount] = useState(initialAmount);
  const [resolvedDestination, setResolvedDestination] = useState(destination);
  const [resolvedAmountUsdc, setResolvedAmountUsdc] = useState(() => parsePositiveParam(amountUsdcParam));
  const [feeArs, setFeeArs] = useState(0);
  const [discountArs, setDiscountArs] = useState(0);
  const [isProviderAmountResolved, setIsProviderAmountResolved] = useState(false);
  const [isResolvingQuote, setIsResolvingQuote] = useState(isMantecaRail && rawQr.trim().length > 0);
  const [quoteNotice, setQuoteNotice] = useState("");
  const [arsRate, setArsRate] = useState(() => {
    const parsedRate = parsePositiveParam(arsRateParam);
    return parsedRate || DEFAULT_ARS_RATE;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const requestCurrency =
    currencyParam === "USD" || currencyParam === "USDC" ? "USD" : "ARS";
  const confirmationCurrency: PaymentConfirmationCurrency =
    requestCurrency === "ARS" ? "ARS" : "USDC";
  const confirmation = buildPrePaymentConfirmation({
    amount,
    currency: confirmationCurrency,
    destination: resolvedDestination,
    arsRate,
    amountUsdc:
      scannedAmountLocked || isProviderAmountResolved
        ? resolvedAmountUsdc || amountUsdcParam
        : undefined,
    feeArs,
    discountArs,
  });
  const hasAmount = parsePositiveParam(amount) > 0;
  const amountLocked = scannedAmountLocked || isProviderAmountResolved;
  const canSubmit =
    hasAmount &&
    resolvedDestination.trim().length > 0 &&
    rawQr.trim().length > 0 &&
    !isResolvingQuote &&
    !isSubmitting;

  useEffect(() => {
    if (parsePositiveParam(arsRateParam) > 0) return;

    let isMounted = true;
    fetchArsPrice()
      .then((latestRate) => {
        if (isMounted && Number.isFinite(latestRate) && latestRate > 0) {
          setArsRate(latestRate);
        }
      })
      .catch((error) => {
        console.error("[QrPaymentConfirm] Failed to load ARS rate", error);
      });

    return () => {
      isMounted = false;
    };
  }, [arsRateParam]);

  useEffect(() => {
    if (!isMantecaRail) {
      setIsResolvingQuote(false);
      setQuoteNotice("");
      return;
    }
    if (!rawQr.trim()) {
      setIsResolvingQuote(false);
      return;
    }

    let isMounted = true;
    setIsResolvingQuote(true);
    setQuoteNotice("");

    resolveMantecaQrQuote({
      qrData: rawQr,
      paymentAddress: destination,
      currency: requestCurrency,
      method: methodParam || "mercadopago",
    })
      .then((quote) => {
        if (!isMounted) return;

        if (quote.paymentAddress) {
          setResolvedDestination(quote.paymentAddress);
        }
        if (typeof quote.rateArsPerUsdc === "number" && quote.rateArsPerUsdc > 0) {
          setArsRate(quote.rateArsPerUsdc);
        }
        if (typeof quote.feeArs === "number" && quote.feeArs > 0) {
          setFeeArs(quote.feeArs);
        }
        if (typeof quote.discountArs === "number" && quote.discountArs > 0) {
          setDiscountArs(quote.discountArs);
        }
        if (typeof quote.amountUsdc === "number" && quote.amountUsdc > 0) {
          setResolvedAmountUsdc(quote.amountUsdc);
        }
        if (typeof quote.amountFiat === "number" && quote.amountFiat > 0) {
          setAmount(formatDecimalForInput(quote.amountFiat, 2));
          setIsProviderAmountResolved(true);
          return;
        }

        if (!scannedAmountLocked) {
          setQuoteNotice("Provider amount unavailable.");
        }
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error("[QrPaymentConfirm] Failed to resolve QR quote", error);
        if (!scannedAmountLocked) {
          setQuoteNotice("Provider amount unavailable.");
        }
      })
      .finally(() => {
        if (isMounted) setIsResolvingQuote(false);
      });

    return () => {
      isMounted = false;
    };
  }, [destination, isMantecaRail, methodParam, rawQr, requestCurrency, scannedAmountLocked]);

  const handleConfirm = async () => {
    if (!canSubmit) return;
    if (!user?.id) {
      Alert.alert("Session required", "Sign in again before submitting this payment.");
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);

    try {
      if (isMantecaRail) {
        const response = await createMantecaQrPayment({
          userId: user.id,
          amount,
          currency: requestCurrency,
          paymentAddress: resolvedDestination.trim(),
          method: methodParam || "mercadopago",
          qrData: rawQr,
        });

        const externalIdLabel = response.externalId ? `#${response.externalId}` : "pending id";
        Alert.alert(
          "Manteca QR payment submitted",
          `Request ${externalIdLabel} (${response.status}). Confirm status in the Manteca dashboard or status endpoint.`,
          [{ text: "OK", onPress: () => router.push("/activity") }]
        );
        return;
      }

      const response = await createP2PArsOrder({
        userId: user.id,
        amount,
        currency: requestCurrency,
        paymentAddress: resolvedDestination.trim(),
        method: methodParam || "mercadopago",
      });

      const orderIdLabel = response.orderId ? `#${response.orderId}` : "pending id";
      const nextStepMessage =
        response.nextAction === "SET_PAYMENT_ADDRESS_WHEN_ACCEPTED"
          ? "Payment details will be submitted once a merchant accepts the order."
          : response.nextAction === "POLL_ORDER_STATUS"
            ? "Order is created. Poll order status to continue settlement."
            : "Order flow moved to next stage.";

      Alert.alert(
        "P2P order created",
        `Order ${orderIdLabel} (${response.orderStatus}). ${nextStepMessage}`,
        [{ text: "OK", onPress: () => router.push("/activity") }]
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error submitting QR payment.";
      setSubmitError(message);
      Alert.alert("Payment failed", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={[
          styles.container,
          { backgroundColor: isAndroid ? palette.background : "transparent" },
        ]}
        contentContainerStyle={[
          styles.content,
          isAndroid ? styles.androidContent : null,
          useCompactAndroidLayout ? styles.androidCompactContent : null,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, useCompactAndroidLayout ? styles.androidCompactHeader : null]}>
          <TouchableOpacity
            style={styles.iconButtonPressable}
            onPress={() => router.back()}
            activeOpacity={0.78}
          >
            <GlassView style={styles.iconButton} intensity={26} interactive>
              <MaterialIcons name="arrow-back" size={20} color={palette.primaryText} />
            </GlassView>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: palette.primaryText }]}>
            Confirm payment
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <GlassView
          style={[
            styles.heroCard,
            isAndroid ? styles.androidHeroCard : null,
            useCompactAndroidLayout ? styles.androidCompactHeroCard : null,
            {
              borderColor:
                colorScheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.52)",
            },
          ]}
          intensity={30}
          interactive
        >
          <GlassView
            style={[styles.heroIcon, useCompactAndroidLayout ? styles.androidCompactHeroIcon : null]}
            intensity={24}
            interactive
          >
            <MaterialIcons name="qr-code-2" size={24} color={palette.primaryText} />
          </GlassView>
          <Text style={[styles.heroLabel, { color: palette.secondaryText }]}>
            {isMantecaRail ? "QR 3.0 payment" : "P2P.me payment"}
          </Text>
          <Text
            style={[
              styles.heroAmount,
              useCompactAndroidLayout ? styles.androidCompactHeroAmount : null,
              { color: palette.primaryText },
            ]}
          >
            {confirmation.display.finalTotal}
          </Text>
          <Text style={[styles.heroSecondary, { color: palette.secondaryText }]}>
            {confirmation.display.finalTotalSecondary}
          </Text>
        </GlassView>

        {!amountLocked ? (
          <GlassView
            style={[
              styles.amountCard,
              isAndroid ? styles.androidAmountCard : null,
              {
                borderColor:
                  colorScheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.52)",
              },
            ]}
            intensity={28}
            interactive
          >
            <View style={styles.amountLabelRow}>
              <Text style={[styles.amountLabel, { color: palette.secondaryText }]}>Amount</Text>
              <Text style={[styles.amountStatus, { color: palette.secondaryText }]}>
                {isResolvingQuote ? "Checking provider" : quoteNotice}
              </Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={[styles.currencyPrefix, { color: palette.secondaryText }]}>ARS$</Text>
              <TextInput
                style={[styles.amountInput, { color: palette.primaryText }]}
                value={amount}
                onChangeText={(value) => setAmount(normalizeDecimalInput(value, 2))}
                placeholder="0.00"
                placeholderTextColor={palette.secondaryText}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
          </GlassView>
        ) : null}

        <GlassView
          style={[
            styles.confirmationCard,
            isAndroid ? styles.androidConfirmationCard : null,
            useCompactAndroidLayout ? styles.androidCompactConfirmationCard : null,
            {
              borderColor:
                colorScheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.52)",
            },
          ]}
          intensity={30}
          interactive
        >
          <View style={styles.confirmationHeader}>
            <GlassView style={styles.confirmationIcon} intensity={24} interactive>
              <MaterialIcons name="receipt" size={20} color={palette.primaryText} />
            </GlassView>
            <Text style={[styles.confirmationTitle, { color: palette.primaryText }]}>
              Pre-payment confirmation
            </Text>
          </View>

          <View style={styles.confirmationRows}>
            <ConfirmationRow
              label="Amount"
              value={confirmation.display.amount}
              secondary={confirmation.display.amountSecondary}
              labelColor={palette.secondaryText}
              valueColor={palette.primaryText}
              secondaryColor={palette.secondaryText}
            />
            <ConfirmationRow
              label="Merchant / destination"
              value={confirmation.destination}
              labelColor={palette.secondaryText}
              valueColor={palette.primaryText}
              secondaryColor={palette.secondaryText}
            />
            <ConfirmationRow
              label="FX rate"
              value={confirmation.display.rate}
              labelColor={palette.secondaryText}
              valueColor={palette.primaryText}
              secondaryColor={palette.secondaryText}
            />
            <ConfirmationRow
              label="Fee"
              value={confirmation.display.fee}
              labelColor={palette.secondaryText}
              valueColor={palette.primaryText}
              secondaryColor={palette.secondaryText}
            />
            <ConfirmationRow
              label="Discount"
              value={confirmation.display.discount}
              labelColor={palette.secondaryText}
              valueColor={palette.primaryText}
              secondaryColor={palette.secondaryText}
            />
            <ConfirmationRow
              label="Final total"
              value={confirmation.display.finalTotal}
              secondary={confirmation.display.finalTotalSecondary}
              emphasis
              labelColor={palette.secondaryText}
              valueColor={palette.primaryText}
              secondaryColor={palette.secondaryText}
            />
          </View>
        </GlassView>

        {submitError ? (
          <Text selectable style={styles.errorText}>
            {submitError}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.84}
            onPress={handleConfirm}
            disabled={!canSubmit}
            style={[
              styles.primaryButton,
              {
                backgroundColor: palette.actionPrimary,
                opacity: canSubmit ? 1 : 0.5,
              },
            ]}
          >
            <Text style={[styles.primaryButtonText, { color: palette.actionPrimaryText }]}>
              {isResolvingQuote ? "Checking..." : isSubmitting ? "Submitting..." : "Confirm and submit"}
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
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  androidContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  androidCompactContent: {
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
    marginTop: 12,
  },
  androidCompactHeader: {
    marginBottom: 14,
    marginTop: 8,
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
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
    marginBottom: 16,
    gap: 7,
  },
  androidHeroCard: {
    padding: 18,
    marginBottom: 12,
  },
  androidCompactHeroCard: {
    padding: 14,
    gap: 4,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  androidCompactHeroIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 2,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  androidCompactHeroAmount: {
    fontSize: 28,
  },
  heroSecondary: {
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  amountCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    gap: 10,
  },
  androidAmountCard: {
    padding: 14,
    marginBottom: 12,
  },
  amountLabelRow: {
    minHeight: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  amountStatus: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "right",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: "700",
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    minHeight: 48,
    fontSize: 34,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  confirmationCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    gap: 16,
  },
  androidConfirmationCard: {
    padding: 15,
    marginBottom: 12,
    gap: 13,
  },
  androidCompactConfirmationCard: {
    padding: 13,
    gap: 10,
  },
  confirmationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  confirmationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmationTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
  },
  confirmationRows: {
    gap: 12,
  },
  confirmationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    minHeight: 34,
  },
  confirmationTotalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(107, 114, 128, 0.35)",
    paddingTop: 14,
    marginTop: 2,
  },
  confirmationLabel: {
    flex: 0.9,
    fontSize: 13,
    lineHeight: 18,
  },
  confirmationValueGroup: {
    flex: 1.25,
    alignItems: "flex-end",
    gap: 3,
  },
  confirmationValue: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  confirmationValueEmphasis: {
    fontSize: 16,
    fontWeight: "800",
  },
  confirmationSecondary: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  footer: {
    marginBottom: 16,
  },
  primaryButton: {
    width: "100%",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
