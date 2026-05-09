import { useState, useEffect, useCallback, useRef } from "react";
import { Alert, StyleSheet, View, Text, TouchableOpacity, useColorScheme, StatusBar } from "react-native";
import { CameraView, Camera } from "expo-camera";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseQrScanData } from '@/utils/qrScan';
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { GlassView } from "@/components/ui/GlassView";
import { formatDecimalForInput } from "@/utils/numberFormat";

const SCAN_SIZE = 260;
const USDC_MINT_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export default function ScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const palette = Colors[colorScheme];
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanEnabled, setScanEnabled] = useState(true);
  const scanLockRef = useRef(false);
  const lastScanDataRef = useRef<string | null>(null);
  const openQrRef = useRef<string | null>(null);
  const { openQr } = useLocalSearchParams<{ openQr?: string | string[] }>();

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    };

    getCameraPermissions();
  }, []);

  useEffect(() => {
    const openQrValue = Array.isArray(openQr) ? openQr[0] : openQr;
    if (!openQrValue) return;
    if (openQrRef.current === openQrValue) return;
    openQrRef.current = openQrValue;
    setScanEnabled(false);
    router.push("/my-qr");
  }, [openQr, router]);

  const resetScanner = useCallback(() => {
    scanLockRef.current = false;
    lastScanDataRef.current = null;
    setScanEnabled(true);
  }, []);

  // Reset scanned state when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      resetScanner();
    }, [resetScanner])
  );

  const handleOpenQrSheet = useCallback(() => {
    setScanEnabled(false);
    router.push("/my-qr");
  }, [router]);

  const handleBarCodeScanned = useCallback(
    async ({ data }: { type: string; data: string }) => {
      const trimmed = data.trim();
      if (!scanEnabled) return;
      if (scanLockRef.current) return;
      if (!trimmed) return;
      if (lastScanDataRef.current === trimmed) return;

      scanLockRef.current = true;
      lastScanDataRef.current = trimmed;
      setScanEnabled(false);
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const result = await parseQrScanData(trimmed);

      if (result.kind === 'cachinUser') {
        try {
          router.push({
            pathname: '/send-amount',
            params: { recipient: result.username, username: result.username },
          });
        } catch {
          resetScanner();
        }
        return;
      }

      if (result.kind === 'solanaAddress') {
        try {
          const displayAddress =
            result.address.length > 12
              ? `${result.address.slice(0, 4)}...${result.address.slice(-4)}`
              : result.address;
          router.push({
            pathname: '/send-amount',
            params: { recipient: displayAddress, address: result.address },
          });
        } catch {
          resetScanner();
        }
        return;
      }

      if (result.kind === 'solanaPay') {
        try {
          if (result.splToken && result.splToken !== USDC_MINT_ADDRESS) {
            Alert.alert(
              "Unsupported Solana Pay token",
              "This Solana Pay request is not for USDC.",
              [{ text: "OK", onPress: resetScanner }],
            );
            return;
          }

          router.push({
            pathname: "/send-amount",
            params: {
              address: result.address,
              amount: result.amount ?? "",
            },
          });
        } catch {
          resetScanner();
        }
        return;
      }

      if (result.kind === 'arsMercadoPago') {
        try {
          const amountParam =
            typeof result.amountFiat === 'number' && Number.isFinite(result.amountFiat)
              ? formatDecimalForInput(result.amountFiat, 2)
              : '';

          router.push({
            pathname: '/qr-rail-select',
            params: {
              amount: amountParam,
              paymentAddress: result.paymentAddress,
              rawQr: trimmed,
            },
          });
        } catch {
          resetScanner();
        }
        return;
      }

      Alert.alert(
        'Invalid QR code',
        'This QR code isn’t a Cachin link, Solana QR, or compatible ARS QR.',
        [{ text: 'OK', onPress: resetScanner }],
      );
    },
    [resetScanner, router, scanEnabled],
  );

  if (hasPermission === null) {
    return (
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <Text style={[styles.text, { color: palette.secondaryText }]}>
          Requesting camera permission...
        </Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <Text style={[styles.text, { color: palette.primaryText }]}>No access to camera</Text>
      </View>
    );
  }

  // Keep camera fully released while this tab/screen is not focused.
  if (!isFocused) {
    return <View style={styles.container} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'black' }}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={isFocused && scanEnabled ? handleBarCodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
        >
          {/* Dimmed Overlay */}
          <View style={styles.overlayContainer}>
            <View style={styles.overlayTop} />
            <View style={styles.overlayCenterRow}>
              <View style={styles.overlaySide} />
              <View style={styles.scanWindow}>
                {/* Corners */}
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              <View style={styles.overlaySide} />
            </View>
            <View style={styles.overlayBottom}>
               <Text style={styles.instructionText}>Scan a QR code to pay</Text>
            </View>
          </View>

          {/* Controls Layer */}
          <View style={[styles.controlsLayer, { paddingTop: insets.top, paddingBottom: insets.bottom + 100 }]}>
            {/* Close Button */}
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <GlassView style={styles.closeButton} intensity={30} tint="dark">
                  <IconSymbol name="xmark" size={20} color="#FFF" />
                </GlassView>
              </TouchableOpacity>
            </View>

            {/* Bottom Button */}
            <View style={styles.bottomRow}>
              <TouchableOpacity
                onPress={handleOpenQrSheet}
                activeOpacity={0.8}
              >
                 <GlassView style={styles.myCodeButton} intensity={40} tint="dark">
                  <IconSymbol name="qrcode" size={20} color="#FFF" />
                  <Text style={styles.myCodeText}>Show My Code</Text>
                </GlassView>
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  text: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  
  // Overlay
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayBottom: {
    flex: 1.2, // Slightly larger bottom to visually balance
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingTop: 40,
  },
  overlayCenterRow: {
    flexDirection: 'row',
    height: SCAN_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanWindow: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  
  // Corners
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: '#FFF',
    borderWidth: 4,
    borderRadius: 4, 
  },
  topLeft: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 16,
  },

  // Controls
  controlsLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'flex-start',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bottomRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  instructionText: {
    color: '#E5E5E5',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.9,
  },
  myCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 100,
    overflow: 'hidden',
  },
  myCodeText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

});
