import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/theme";
import { GlassView } from "@/components/ui/GlassView";
import {
  getP2POrderStatus,
  setP2POrderPaymentAddress,
  type P2POrderStatusResponse,
} from "@/utils/p2pOrders";
import { parseQrScanData } from "@/utils/qrScan";

// Polling cadence for order status. The backend reads the subgraph which lags
// the chain by a few seconds, so 3s keeps the UI live without hammering.
const POLL_INTERVAL_MS = 3000;

// Step ordering on the timeline. Statuses returned by the SDK map to one of
// these stages. Anything terminal (completed/cancelled/disputed) is handled
// out-of-band as a final state.
const STEPS = [
  { key: "placed", label: "Connecting" },
  { key: "accepted", label: "Merchant accepted" },
  { key: "paid", label: "Processing" },
  { key: "completed", label: "Done" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function statusToStepKey(status: string): StepKey {
  const s = status.toLowerCase();
  if (s === "completed") return "completed";
  if (s === "paid") return "paid";
  if (s === "accepted") return "accepted";
  // placed | <unknown new statuses> → still in "connecting" stage
  return "placed";
}

function isTerminalStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "completed" || s === "cancelled" || s === "disputed";
}

function copyForStep(stepKey: StepKey, currency: string): {
  title: string;
  subtitle: string;
} {
  switch (stepKey) {
    case "placed":
      return {
        title: `Connecting you to a merchant for your ${currency} payment...`,
        subtitle: "We're matching you with a merchant. This usually takes a few seconds.",
      };
    case "accepted":
      return {
        title: "Merchant accepted your order",
        subtitle: "The merchant is processing the fiat payment to the vendor now.",
      };
    case "paid":
      return {
        title: "Payment sent, releasing USDC...",
        subtitle: "The merchant paid the vendor. Settling the on-chain leg.",
      };
    case "completed":
      return {
        title: "Payment completed",
        subtitle: "USDC released and merchant confirmed payment to the vendor.",
      };
  }
}

export default function OrderTrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const palette = Colors[colorScheme];

  const orderId = firstParam(params.orderId);
  const currency = firstParam(params.currency).toUpperCase() || "ARS";
  const initialStatus = firstParam(params.initialStatus) || "placed";
  const displayUsdc = firstParam(params.displayUsdc);
  const displayFiat = firstParam(params.displayFiat);
  // Split-flow flag: when "true", we MUST scan the vendor's fresh QR after the
  // merchant accepts and post the payment address via /order-set-payment-address.
  // Set by pay-ars.tsx; absent in the legacy single-shot flow from qr-payment-confirm.
  const awaitingQrScan = firstParam(params.awaitingQrScan) === "true";

  const [status, setStatus] = useState<string>(initialStatus);
  const [pollError, setPollError] = useState<string>("");
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  // Tracks whether we've already submitted the freshly-scanned QR to the
  // backend — prevents double submission while the merchant is processing.
  const [paymentAddressSubmitted, setPaymentAddressSubmitted] = useState(false);
  const [qrScanError, setQrScanError] = useState<string>("");
  const [isSubmittingQr, setIsSubmittingQr] = useState(false);
  // Guards against the camera barcode callback firing repeatedly while a
  // submission is in flight.
  const qrSubmissionInProgressRef = useRef(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Keep the last successful response around so the UI doesn't blank out
  // on a transient poll failure.
  const lastResponseRef = useRef<P2POrderStatusResponse | null>(null);

  // Poll order-status until the order reaches a terminal state. Each tick
  // catches its own error so a single hiccup (e.g. cold-start latency on
  // Vercel) doesn't tear down the polling loop.
  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const result = await getP2POrderStatus(orderId);
        if (cancelled) return;

        lastResponseRef.current = result;
        setPollError("");
        const newStatus = result.order?.status ?? status;
        setStatus(newStatus);

        if (isTerminalStatus(newStatus)) {
          return; // stop polling
        }
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Unknown polling error";
        setPollError(message);
      } finally {
        if (!cancelled) {
          setIsInitialLoad(false);
        }
      }

      if (cancelled) return;
      timeoutId = setTimeout(tick, POLL_INTERVAL_MS);
    };

    void tick();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const currentStepKey = statusToStepKey(status);
  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStepKey);
  const isTerminal = isTerminalStatus(status);
  const isCancelled = status.toLowerCase() === "cancelled";
  const isDisputed = status.toLowerCase() === "disputed";
  const copy = copyForStep(currentStepKey, currency);

  // We're in the "scan the vendor's QR" sub-state when:
  //   - the order started with no paymentAddress (awaitingQrScan param);
  //   - a merchant has accepted on-chain (status === "accepted");
  //   - we haven't successfully submitted the scanned address yet.
  // While this is true the screen shows a camera viewfinder instead of the
  // normal hero. After successful submit we stop showing it and resume the
  // normal polling/timeline UI.
  const isScanQrSubState =
    awaitingQrScan && status === "accepted" && !paymentAddressSubmitted;

  // Auto-request camera permission as soon as we enter the scan sub-state.
  useEffect(() => {
    if (!isScanQrSubState || !cameraPermission) return;
    if (!cameraPermission.granted && cameraPermission.canAskAgain) {
      void requestCameraPermission();
    }
  }, [isScanQrSubState, cameraPermission, requestCameraPermission]);

  const handleQrScanned = useCallback(
    async (qrRaw: string) => {
      if (qrSubmissionInProgressRef.current || !orderId) return;
      qrSubmissionInProgressRef.current = true;

      setIsSubmittingQr(true);
      setQrScanError("");

      try {
        const parsed = await parseQrScanData(qrRaw);
        if (parsed.kind !== "arsMercadoPago") {
          throw new Error(
            parsed.kind === "unknown"
              ? "QR is not a supported ARS payment QR. Try again."
              : `Unexpected QR type: ${parsed.kind}`,
          );
        }
        if (!parsed.paymentAddress) {
          throw new Error("Could not extract payment address from QR.");
        }

        // CRITICAL: pass the FULL EMV QR string (qrRaw), NOT the parsed alias.
        // The p2p.me merchant decrypts the encUpi expecting full EMV format;
        // passing just an alias/CVU makes the merchant fail to deliver fiat
        // and the order auto-cancels. Verified by comparing on-chain order
        // 539487 (worked, raw EMV) vs 539449 (cancelled, parsed alias).
        // user-app-client/src/pages/order/pay/accepted.tsx does the same.
        await setP2POrderPaymentAddress(orderId, qrRaw);
        setPaymentAddressSubmitted(true);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error submitting QR.";
        setQrScanError(message);
        // Allow another attempt — clear the in-progress guard.
        qrSubmissionInProgressRef.current = false;
      } finally {
        setIsSubmittingQr(false);
      }
    },
    [orderId],
  );

  const headerLabel = orderId ? `Order #${orderId}` : "Order";
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  const statusBadgeColor = isCancelled || isDisputed
    ? "#FCA5A5"
    : isTerminal
      ? "#86EFAC"
      : currentStepKey === "accepted" || currentStepKey === "paid"
        ? "#FCD34D"
        : palette.surfaceMuted;
  const statusBadgeText = isCancelled || isDisputed
    ? "#7F1D1D"
    : isTerminal
      ? "#14532D"
      : currentStepKey === "accepted" || currentStepKey === "paid"
        ? "#78350F"
        : palette.secondaryText;

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderColor: palette.borderSubtle }]}>
        <TouchableOpacity
          onPress={() => router.replace("/(main)/home" as never)}
          style={[styles.headerButton, { borderColor: palette.borderSubtle }]}
        >
          <MaterialIcons name="arrow-back" size={20} color={palette.primaryText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.primaryText }]}>
          {headerLabel}
        </Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isScanQrSubState ? (
          /* Scan QR sub-state: merchant has accepted and we still need the
             vendor's payment address. Camera viewfinder takes over the hero
             until the user scans a valid ARS QR and the address submission
             succeeds. */
          <View style={styles.scanSection}>
            <Text style={[styles.heroTitle, { color: palette.primaryText }]}>
              Scan the vendor&apos;s QR now
            </Text>
            <Text style={[styles.heroSubtitle, { color: palette.secondaryText }]}>
              Ask the vendor to generate a fresh QR — dynamic QRs expire fast.
            </Text>

            <View style={[styles.cameraFrame, { borderColor: palette.borderSubtle }]}>
              {cameraPermission?.granted ? (
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={
                    isSubmittingQr || paymentAddressSubmitted
                      ? undefined
                      : (result) => {
                          if (result?.data) {
                            void handleQrScanned(String(result.data));
                          }
                        }
                  }
                />
              ) : (
                <View
                  style={[
                    styles.cameraPlaceholder,
                    { backgroundColor: palette.surfaceMuted },
                  ]}
                >
                  <MaterialIcons
                    name="no-photography"
                    size={48}
                    color={palette.secondaryText}
                  />
                  <Text style={[styles.cameraPlaceholderText, { color: palette.secondaryText }]}>
                    {cameraPermission?.canAskAgain === false
                      ? "Camera permission denied. Enable it in Settings."
                      : "Camera permission required"}
                  </Text>
                  {cameraPermission?.canAskAgain !== false ? (
                    <TouchableOpacity
                      onPress={() => void requestCameraPermission()}
                      style={[styles.permissionButton, { backgroundColor: palette.actionPrimary }]}
                    >
                      <Text style={[styles.permissionButtonText, { color: palette.actionPrimaryText }]}>
                        Grant camera access
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>

            {isSubmittingQr ? (
              <View style={styles.scanStatusRow}>
                <ActivityIndicator size="small" color={palette.primary} />
                <Text style={[styles.scanStatusText, { color: palette.secondaryText }]}>
                  Submitting payment address...
                </Text>
              </View>
            ) : qrScanError ? (
              <View style={[styles.errorBanner, { borderColor: "#FCA5A5" }]}>
                <MaterialIcons name="error-outline" size={16} color="#991B1B" />
                <Text style={styles.errorBannerText} numberOfLines={3}>
                  {qrScanError}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          /* Normal hero: spinner while in-flight, check/error on terminal */
          <View style={styles.hero}>
            {!isTerminal && !isCancelled && !isDisputed ? (
              <ActivityIndicator
                size="large"
                color={palette.primary}
                style={styles.heroIndicator}
              />
            ) : (
              <View
                style={[
                  styles.heroIconCircle,
                  {
                    backgroundColor: isCancelled || isDisputed
                      ? "#FEE2E2"
                      : "#DCFCE7",
                  },
                ]}
              >
                <MaterialIcons
                  name={
                    isCancelled || isDisputed ? "error-outline" : "check-circle"
                  }
                  size={48}
                  color={isCancelled || isDisputed ? "#B91C1C" : "#15803D"}
                />
              </View>
            )}

            <Text style={[styles.heroTitle, { color: palette.primaryText }]}>
              {isCancelled
                ? "Order cancelled"
                : isDisputed
                  ? "Order in dispute"
                  : copy.title}
            </Text>
            <Text style={[styles.heroSubtitle, { color: palette.secondaryText }]}>
              {isCancelled
                ? "This order was cancelled. The relayer's USDC was released."
                : isDisputed
                  ? "Contact support. Funds are held until resolved."
                  : copy.subtitle}
            </Text>
          </View>
        )}

        {/* Timeline */}
        <View style={styles.timeline}>
          {STEPS.map((step, index) => {
            const isCompleted = index < currentStepIndex || isTerminal;
            const isActive = index === currentStepIndex && !isTerminal;
            const dotColor = isCompleted
              ? palette.primary
              : isActive
                ? palette.primary
                : palette.borderSubtle;
            const labelColor = isCompleted || isActive
              ? palette.primaryText
              : palette.secondaryText;
            return (
              <View key={step.key} style={styles.timelineItem}>
                <View style={styles.timelineDotColumn}>
                  <View
                    style={[
                      styles.timelineDot,
                      {
                        backgroundColor: dotColor,
                        borderColor: isActive ? palette.primary : "transparent",
                      },
                      isActive && styles.timelineDotActive,
                    ]}
                  />
                  {index < STEPS.length - 1 ? (
                    <View
                      style={[
                        styles.timelineConnector,
                        {
                          backgroundColor: isCompleted
                            ? palette.primary
                            : palette.borderSubtle,
                        },
                      ]}
                    />
                  ) : null}
                </View>
                <Text
                  style={[styles.timelineLabel, { color: labelColor }]}
                  numberOfLines={1}
                >
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Order details card */}
        <GlassView style={[styles.detailsCard, { borderColor: palette.borderSubtle }]}>
          <View style={styles.detailsHeader}>
            <Text style={[styles.detailsTitle, { color: palette.primaryText }]}>
              Order details
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusBadgeColor }]}>
              <Text style={[styles.statusBadgeText, { color: statusBadgeText }]}>
                {statusLabel}
              </Text>
            </View>
          </View>

          {orderId ? (
            <View style={styles.detailsRow}>
              <Text style={[styles.detailsLabel, { color: palette.secondaryText }]}>
                ID
              </Text>
              <Text style={[styles.detailsValue, { color: palette.primaryText }]} selectable>
                #{orderId}
              </Text>
            </View>
          ) : null}
          {displayUsdc ? (
            <View style={styles.detailsRow}>
              <Text style={[styles.detailsLabel, { color: palette.secondaryText }]}>
                You send
              </Text>
              <Text style={[styles.detailsValue, { color: palette.primaryText }]}>
                {displayUsdc} USDC
              </Text>
            </View>
          ) : null}
          {displayFiat ? (
            <View style={styles.detailsRow}>
              <Text style={[styles.detailsLabel, { color: palette.secondaryText }]}>
                Vendor receives
              </Text>
              <Text style={[styles.detailsValue, { color: palette.primaryText }]}>
                {displayFiat} {currency}
              </Text>
            </View>
          ) : null}
        </GlassView>

        {pollError && !isInitialLoad ? (
          <View style={[styles.errorBanner, { borderColor: "#FCA5A5" }]}>
            <MaterialIcons name="info-outline" size={16} color="#991B1B" />
            <Text style={styles.errorBannerText} numberOfLines={2}>
              Couldn't refresh status: {pollError}. Retrying...
            </Text>
          </View>
        ) : null}

        {/* Done CTA when terminal */}
        {isTerminal ? (
          <TouchableOpacity
            onPress={() => router.replace("/(main)/home" as never)}
            style={[styles.doneButton, { backgroundColor: palette.actionPrimary }]}
          >
            <Text style={[styles.doneButtonText, { color: palette.actionPrimaryText }]}>
              Done
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
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
  hero: {
    alignItems: "center",
    paddingVertical: 32,
  },
  scanSection: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 12,
    gap: 12,
  },
  cameraFrame: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 4,
  },
  camera: { flex: 1 },
  cameraPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  cameraPlaceholderText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  permissionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  permissionButtonText: { fontSize: 14, fontWeight: "600" },
  scanStatusRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 8,
  },
  scanStatusText: { fontSize: 13 },
  heroIndicator: { marginBottom: 24 },
  heroIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  heroSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  timeline: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 24,
  },
  timelineItem: { flex: 1, alignItems: "center" },
  timelineDotColumn: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "center",
    position: "relative",
    marginBottom: 8,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
  },
  timelineDotActive: {
    transform: [{ scale: 1.15 }],
  },
  timelineConnector: {
    position: "absolute",
    left: "62%",
    right: 0,
    height: 2,
    top: 7,
  },
  timelineLabel: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
  },
  detailsCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginTop: 8,
  },
  detailsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailsTitle: { fontSize: 16, fontWeight: "700" },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: { fontSize: 12, fontWeight: "600" },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailsLabel: { fontSize: 14 },
  detailsValue: { fontSize: 14, fontWeight: "600" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#FEF2F2",
    marginTop: 12,
  },
  errorBannerText: { fontSize: 12, color: "#991B1B", flex: 1 },
  doneButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  doneButtonText: { fontSize: 16, fontWeight: "700" },
});
