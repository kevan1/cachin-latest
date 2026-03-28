import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useMemo, useState, useCallback } from "react";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import Svg, { Path } from "react-native-svg";
import {
  getPasskeyRelyingPartyOrigin,
  getPrivyExportClientId,
  getPrivyExportPageUrl,
} from "@/utils/runtimeConfig";

function LockIcon({ size = 60, color = "#000" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function WarningIcon({ size = 20, color = "#D97706" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type ExportResultMessage = {
  status?: "success" | "error";
  error?: string;
};

function parseExportResult(raw: string): ExportResultMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as ExportResultMessage;
  } catch {
    return null;
  }
}

export default function ExportPrivateKeyScreen() {
  const router = useRouter();
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];

  const passkeyOrigin = getPasskeyRelyingPartyOrigin();
  const exportClientId = getPrivyExportClientId();
  const [isExporting, setIsExporting] = useState(false);
  const [isWebViewVisible, setIsWebViewVisible] = useState(false);

  const exportUrl = useMemo(() => {
    return getPrivyExportPageUrl({
      chain: "solana",
      address: wallet?.publicKey ?? null,
    });
  }, [wallet?.publicKey]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const closeExportModal = useCallback(() => {
    setIsWebViewVisible(false);
    setIsExporting(false);
  }, []);

  const handleOpenExport = useCallback(() => {
    if (!wallet?.publicKey) {
      Alert.alert("Error", "No Solana wallet found.");
      return;
    }

    if (!exportUrl) {
      const domainHint = passkeyOrigin ?? "your passkey domain";
      Alert.alert(
        "Missing export URL",
        `Configure EXPO_PUBLIC_PRIVY_EXPORT_PAGE_URL or EXPO_PUBLIC_PASSKEY_ASSOCIATED_DOMAIN. Current passkey domain: ${domainHint}`
      );
      return;
    }
    if (!exportClientId) {
      Alert.alert(
        "Missing web client ID",
        "Set EXPO_PUBLIC_PRIVY_EXPORT_CLIENT_ID to your Privy Web client ID for export.cachin.app."
      );
      return;
    }

    setIsExporting(true);
    setIsWebViewVisible(true);
  }, [exportClientId, exportUrl, passkeyOrigin, wallet?.publicKey]);

  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const parsed = parseExportResult(event.nativeEvent.data);
      if (!parsed?.status) return;

      if (parsed.status === "success") {
        closeExportModal();
        Alert.alert("Export complete", "Private key export finished successfully.");
        return;
      }

      closeExportModal();
      Alert.alert(
        "Export failed",
        parsed.error?.trim() || "The export page returned an error."
      );
    },
    [closeExportModal]
  );

  const handleWebViewError = useCallback(
    (event: any) => {
      closeExportModal();
      const message =
        event?.nativeEvent?.description ??
        event?.nativeEvent?.title ??
        "Could not load the export page.";
      Alert.alert("WebView error", message);
    },
    [closeExportModal]
  );

  const exportHostLabel = useMemo(() => {
    if (!exportUrl) return "your export URL";
    try {
      return new URL(exportUrl).origin;
    } catch {
      return exportUrl;
    }
  }, [exportUrl]);

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.headerIconContainer}>
            <LockIcon size={60} color="#000" />
          </View>
          <Text style={styles.headerTitle}>Export Private Key</Text>
          <Text style={styles.headerSubtitle}>
            Open a secure web flow and export your embedded wallet key.
          </Text>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.warningCard}>
            <View style={styles.warningTitleContainer}>
              <WarningIcon size={20} color="#D97706" />
              <Text style={styles.warningTitle}>Important Security Notes</Text>
            </View>
            <Text style={styles.warningText}>
              • Anyone with your private key controls your wallet{"\n"}
              • Export only on a trusted device{"\n"}
              • Do not share your key in chat, screenshots, or cloud notes{"\n"}
              • Store backup material offline whenever possible
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>How this works</Text>
            <Text style={styles.infoText}>
              Privy key export for React Native runs via a secure web page loaded in an ephemeral
              WebView.
              {"\n\n"}
              Target URL: {exportHostLabel}
              {"\n"}
              Wallet: {wallet?.publicKey ?? "No wallet detected"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
          onPress={handleOpenExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <LockIcon size={20} color="#000" />
          )}
          <Text style={styles.exportButtonText}>
            {isExporting ? "Opening secure export..." : "Open Secure Export"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={isWebViewVisible}
        animationType="slide"
        onRequestClose={closeExportModal}
        presentationStyle="fullScreen"
      >
        <View style={styles.webViewHeader}>
          <TouchableOpacity onPress={closeExportModal} style={styles.webViewCloseButton}>
            <Text style={styles.webViewCloseText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.webViewTitle}>Secure Key Export</Text>
          <View style={styles.webViewRightSpacer} />
        </View>

        {exportUrl ? (
          <WebView
            source={{ uri: exportUrl }}
            onMessage={handleWebViewMessage}
            onError={handleWebViewError}
            incognito
            cacheEnabled={false}
            javaScriptEnabled
            domStorageEnabled
            javaScriptCanOpenWindowsAutomatically
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webViewLoader}>
                <ActivityIndicator size="large" color="#000" />
                <Text style={styles.webViewLoaderText}>Loading secure export flow...</Text>
              </View>
            )}
          />
        ) : (
          <View style={styles.webViewLoader}>
            <Text style={styles.webViewLoaderText}>No export URL configured.</Text>
          </View>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    paddingBottom: 40,
  },
  backButton: {
    width: 50,
    height: 50,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: "#000000",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    margin: 20,
  },
  backIcon: {
    fontSize: 32,
    fontWeight: "700",
    color: "#000000",
  },
  header: {
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 30,
  },
  headerIconContainer: {
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 10,
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
    lineHeight: 22,
  },
  infoSection: {
    marginHorizontal: 20,
    gap: 15,
  },
  infoCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#000000",
    padding: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 10,
  },
  infoText: {
    fontSize: 15,
    color: "#333333",
    lineHeight: 22,
  },
  warningCard: {
    backgroundColor: "#FFF3CD",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFA500",
    padding: 20,
  },
  warningTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000000",
  },
  warningText: {
    fontSize: 15,
    color: "#333333",
    lineHeight: 24,
  },
  exportButton: {
    flexDirection: "row",
    backgroundColor: "#B8A5E8",
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "#000000",
    paddingVertical: 18,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 30,
  },
  exportButtonDisabled: {
    backgroundColor: "#E5E5E5",
    opacity: 0.8,
  },
  exportButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000000",
  },
  webViewHeader: {
    height: 56,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  webViewCloseButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  webViewCloseText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "600",
  },
  webViewTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  webViewRightSpacer: {
    width: 58,
  },
  webViewLoader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
  },
  webViewLoaderText: {
    fontSize: 15,
    color: "#4B5563",
    textAlign: "center",
  },
});
