import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View, Text, TouchableOpacity, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import QRCode from "react-native-qrcode-svg";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { getUsername } from "@/utils/userStorage";

const QR_SIZE = 220;

export default function MyQrScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const palette = Colors[colorScheme];
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  const solanaAddress = wallet?.publicKey ?? "";
  const [username, setUsername] = useState("User");

  useEffect(() => {
    const loadUsername = async () => {
      if (!solanaAddress) return;
      const storedUsername = await getUsername(solanaAddress);
      if (storedUsername && !storedUsername.startsWith("user-")) {
        setUsername(storedUsername);
      }
    };
    loadUsername();
  }, [solanaAddress]);

  const handleCopyUsername = async () => {
    await Clipboard.setStringAsync(`https://cachin.app/${username}`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: Math.max(insets.bottom, 20) + 24,
          paddingTop: Math.max(insets.top, 12),
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.text }]}>My QR Code</Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <View style={[styles.closeButton, { borderColor: palette.buttonBorder }]}>
            <IconSymbol name="xmark" size={16} color={palette.primaryText} />
          </View>
        </TouchableOpacity>
      </View>

      <GlassView
        style={styles.glassCard}
        intensity={26}
        tint={colorScheme === "dark" ? "dark" : "light"}
      >
        <View style={styles.qrContainer}>
          <View style={styles.qrCodeWrapper}>
            <QRCode
              value={`https://cachin.app/${username}`}
              size={QR_SIZE}
              color="#000000"
              backgroundColor="#FFFFFF"
              logo={require("../assets/images/logomark.png")}
              logoSize={50}
              logoBackgroundColor="transparent"
              logoBorderRadius={0}
            />
          </View>
          <TouchableOpacity
            style={[styles.addressContainer, { backgroundColor: palette.surfaceMuted }]}
            onPress={handleCopyUsername}
            activeOpacity={0.85}
          >
            <Text selectable style={[styles.addressText, { color: palette.secondaryText }]}>
              cachin.app/{username}
            </Text>
            <IconSymbol size={16} name="doc.on.doc" color={palette.secondaryText} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.sheetHint, { color: palette.secondaryText }]}>
          Share this code to receive payments
        </Text>
      </GlassView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    paddingHorizontal: 20,
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
  },
  glassCard: {
    borderRadius: 24,
    borderCurve: "continuous",
    paddingVertical: 20,
    paddingHorizontal: 18,
    gap: 22,
    boxShadow: "0 18px 40px rgba(8, 20, 36, 0.24)",
  },
  qrContainer: {
    alignItems: "center",
    gap: 22,
  },
  qrCodeWrapper: {
    padding: 24,
    borderRadius: 32,
    borderCurve: "continuous",
    backgroundColor: "#FFFFFF",
    boxShadow: "0 12px 24px rgba(0, 0, 0, 0.1)",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  addressText: {
    fontSize: 14,
    fontFamily: process.env.EXPO_OS === "ios" ? "Menlo" : "monospace",
  },
  sheetHint: {
    fontSize: 14,
    textAlign: "center",
  },
});
