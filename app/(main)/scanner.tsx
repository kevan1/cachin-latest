import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Alert, StyleSheet, View, Text, TouchableOpacity, Platform, useColorScheme, StatusBar, Dimensions } from "react-native";
import { CameraView, Camera } from "expo-camera";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getUsername } from '@/utils/userStorage';
import { parseQrScanData } from '@/utils/qrScan';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { GlassView } from "@/components/ui/GlassView";

const SCAN_SIZE = 260;

export default function ScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const palette = Colors[colorScheme];
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [username, setUsername] = useState<string>('User');
  const [scanEnabled, setScanEnabled] = useState(true);
  const scanLockRef = useRef(false);
  const lastScanDataRef = useRef<string | null>(null);
  const openQrRef = useRef<string | null>(null);
  const { openQr } = useLocalSearchParams<{ openQr?: string | string[] }>();
  
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '90%'], []);
  const tabBarInset =
    Platform.OS === "ios"
      ? 49 + insets.bottom
      : 56 + Math.max(insets.bottom + 10, 18);
  
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  const solanaAddress = wallet?.publicKey ?? '';

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    };

    getCameraPermissions();
  }, []);

  // Load username on mount
  useEffect(() => {
    const loadUsername = async () => {
      if (!solanaAddress) return;
      const storedUsername = await getUsername(solanaAddress);
      if (storedUsername && !storedUsername.startsWith('user-')) {
        setUsername(storedUsername);
      }
    };
    loadUsername();
  }, [solanaAddress]);

  useEffect(() => {
    const openQrValue = Array.isArray(openQr) ? openQr[0] : openQr;
    if (!openQrValue) return;
    if (openQrRef.current === openQrValue) return;
    openQrRef.current = openQrValue;
    setScanEnabled(false);
    bottomSheetRef.current?.snapToIndex(0);
  }, [openQr]);

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

  const handleCopyUsername = async () => {
    await Clipboard.setStringAsync(`https://cachin.app/${username}`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleOpenQrSheet = useCallback(() => {
    setScanEnabled(false);
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        resetScanner();
      }
    },
    [resetScanner]
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.7}
      />
    ),
    []
  );

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

      const result = parseQrScanData(trimmed);

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

      Alert.alert(
        'Invalid QR code',
        'This QR code isn’t a Cachin link or a Solana address.',
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

  const sheetContent = (
    <View style={styles.sheetContainer}>
      <Text style={[styles.sheetTitle, { color: palette.text }]}>My QR Code</Text>
      <View style={styles.qrContainer}>
        <View style={styles.qrCodeWrapper}>
          <QRCode
            value={`https://cachin.app/${username}`}
            size={220}
            color="#000000"
            backgroundColor="#FFFFFF"
            logo={require('../../assets/images/logomark.png')}
            logoSize={50}
            logoBackgroundColor="transparent"
            logoBorderRadius={0}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.addressContainer,
            { backgroundColor: palette.surfaceMuted }
          ]}
          onPress={handleCopyUsername}
        >
          <Text style={[styles.addressText, { color: palette.secondaryText }]}>
            cachin.app/{username}
          </Text>
          <IconSymbol size={16} name="doc.on.doc" color={palette.secondaryText} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.sheetHint, { color: palette.secondaryText }]}>
        Share this code to receive payments
      </Text>
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'black' }}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={scanEnabled ? handleBarCodeScanned : undefined}
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

        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose
          backdropComponent={renderBackdrop}
          onChange={handleSheetChange}
          bottomInset={tabBarInset}
          backgroundStyle={{ backgroundColor: "transparent" }}
          handleIndicatorStyle={{ backgroundColor: palette.icon }}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            <GlassView
              style={styles.glassSheet}
              intensity={28}
              tint={colorScheme === "dark" ? "dark" : "light"}
            >
              {sheetContent}
            </GlassView>
          </BottomSheetView>
        </BottomSheet>
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

  // Bottom Sheet
  bottomSheetContent: {
    flex: 1,
  },
  glassSheet: {
    flex: 1,
    paddingTop: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  sheetContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 30,
  },
  qrContainer: {
    alignItems: "center",
    gap: 24,
  },
  qrCodeWrapper: {
    padding: 24,
    borderRadius: 32,
    backgroundColor: '#FFF',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
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
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  sheetHint: {
    marginTop: 30,
    fontSize: 14,
    textAlign: 'center',
  },
});
