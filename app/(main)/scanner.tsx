import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from "react-native";
import { CameraView, Camera } from "expo-camera";
import { useRouter, useFocusEffect } from "expo-router";
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getUsername } from '@/utils/userStorage';

// const { width } = Dimensions.get('window');

export default function ScannerScreen() {
  const router = useRouter();
  const [wallets, setWallets] = useState<any[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [currentQRIndex, setCurrentQRIndex] = useState(0);
  const [username, setUsername] = useState<string>('User');
  
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['15%', '70%'], []);

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
      const solanaAddress = getFullSolanaAddress();
      const storedUsername = await getUsername(solanaAddress || undefined);
      if (storedUsername && !storedUsername.startsWith('user-')) {
        setUsername(storedUsername);
      }
    };
    loadUsername();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets]);

  // Reset scanned state when screen comes into focus (user returns from another screen)
  useFocusEffect(
    useCallback(() => {
      // Reset scanner when screen comes into focus
      setScanned(false);
      console.log('Scanner screen focused - ready to scan');
    }, [])
  );

  // Get full Solana address
  const getFullSolanaAddress = () => {
    if (wallets && wallets.length > 0) {
      const wallet = wallets[0];
      if (wallet.accounts && wallet.accounts.length > 0) {
        const account = wallet.accounts[0];
        if (account && account.address) {
          return account.address;
        }
      }
    }
    return 'No address available';
  };

  const solanaAddress = getFullSolanaAddress();

  // Truncate address for display
  const getTruncatedAddress = (address: string) => {
    if (address.length > 20) {
      return `${address.slice(0, 12)}...${address.slice(-8)}`;
    }
    return address;
  };

  const handleCopyAddress = async () => {
    if (solanaAddress !== 'No address available') {
      await Clipboard.setStringAsync(solanaAddress);
      console.log('Address copied!');
    }
  };

  const handlePreviousQR = () => {
    setCurrentQRIndex(prev => (prev === 0 ? 1 : 0));
  };

  const handleNextQR = () => {
    setCurrentQRIndex(prev => (prev === 1 ? 0 : 1));
  };

  const handleCloseBottomSheet = () => {
    bottomSheetRef.current?.close();
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    []
  );

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    // Prevent rescanning if already scanned
    if (scanned) return;
    
    setScanned(true);
    console.log('QR Code:', type, data);

    // Check if the scanned URL is .app/$username
    const cachinRegex = /^https?:\/\/cachin\.app\/([^/\s]+)$/i;
    const match = data.match(cachinRegex);

    if (match && match[1]) {
      const scannedUsername = match[1];
      console.log('Detected cachin.app username:', scannedUsername);
      
      // Navigate to send amount screen directly with username
      router.push({
        pathname: '/send-amount',
        params: { recipient: scannedUsername, username: scannedUsername }
      });
      
      // Don't reset scanned state - user needs to manually go back to scan again
      // This prevents stacking multiple screens
    } else {
      // Handle other QR codes (e.g., direct Solana addresses)
      console.log('Other QR code detected:', data);
      
      // Reset scanned state after a delay to allow scanning again for non-payment QRs
      setTimeout(() => setScanned(false), 3000);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No access to camera</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan to pay</Text>
          <TouchableOpacity style={styles.galleryButton} onPress={() => console.log('Gallery')}>
            <Text style={styles.galleryIcon}>🖼</Text>
          </TouchableOpacity>
        </View>

        {/* Scan Frame with Pink Gradient Corners */}
        <View style={styles.scanFrame}>
          {/* Top Left Corner */}
          <View style={[styles.corner, styles.topLeft]} />
          {/* Top Right Corner */}
          <View style={[styles.corner, styles.topRight]} />
          {/* Bottom Left Corner */}
          <View style={[styles.corner, styles.bottomLeft]} />
          {/* Bottom Right Corner */}
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
      </CameraView>

      {/* My QR Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          {/* Title */}
          <Text style={styles.sheetTitle}>My QR</Text>
          
          {/* QR Code Carousel */}
          <View style={styles.carouselContainer}>
            {/* Left Arrow */}
            <TouchableOpacity style={styles.arrowButton} onPress={handlePreviousQR}>
              <Text style={styles.arrowText}>‹</Text>
            </TouchableOpacity>

            {/* QR Code Container */}
            <View style={styles.qrContainer}>
              {currentQRIndex === 0 ? (
                // Username QR (cachin.app/$username)
                <>
                  <View style={styles.qrCodeWrapper}>
                    <QRCode
                      value={`https://cachin.app/${username}`}
                      size={250}
                      color="#000000"
                      backgroundColor="#FFFFFF"
                      logo={require('../../assets/images/logomark.png')}
                      logoSize={60}
                      logoBackgroundColor="transparent"
                      logoBorderRadius={0}
                    />
                  </View>
                  <TouchableOpacity 
                    style={styles.addressContainer}
                    onPress={() => Clipboard.setStringAsync(`https://cachin.app/${username}`)}
                  >
                    <Text style={styles.addressText}>cachin.app/{username}</Text>
                    <Text style={styles.copyIcon}>📋</Text>
                  </TouchableOpacity>
                </>
              ) : (
                // Wallet Address QR
                <>
                  <View style={styles.qrCodeWrapper}>
                    <QRCode
                      value={solanaAddress}
                      size={250}
                      color="#000000"
                      backgroundColor="#FFFFFF"
                      logo={require('../../assets/images/solana-logo.png')}
                      logoSize={60}
                      logoBackgroundColor="transparent"
                      logoBorderRadius={0}
                    />
                  </View>
                  <TouchableOpacity 
                    style={styles.addressContainer}
                    onPress={handleCopyAddress}
                  >
                    <Text style={styles.addressText}>{getTruncatedAddress(solanaAddress)}</Text>
                    <Text style={styles.copyIcon}>📋</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Right Arrow */}
            <TouchableOpacity style={styles.arrowButton} onPress={handleNextQR}>
              <Text style={styles.arrowText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Dots Indicator */}
          <View style={styles.dotsContainer}>
            <View style={[styles.dot, currentQRIndex === 0 && styles.dotActive]} />
            <View style={[styles.dot, currentQRIndex === 1 && styles.dotActive]} />
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeSheetButton} onPress={handleCloseBottomSheet}>
            <Text style={styles.closeSheetButtonText}>Close</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closeButton: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeIcon: {
    fontSize: 24,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  galleryIcon: {
    fontSize: 24,
  },
  scanFrame: {
    position: "absolute",
    top: "35%",
    left: "15%",
    right: "15%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  corner: {
    position: "absolute",
    width: 60,
    height: 60,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 6,
    borderLeftWidth: 6,
    borderTopLeftRadius: 20,
    borderColor: "#FF69B4",
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 6,
    borderRightWidth: 6,
    borderTopRightRadius: 20,
    borderColor: "#FF69B4",
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 6,
    borderLeftWidth: 6,
    borderBottomLeftRadius: 20,
    borderColor: "#FF69B4",
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 6,
    borderRightWidth: 6,
    borderBottomRightRadius: 20,
    borderColor: "#FF69B4",
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 20,
    textAlign: "center",
  },
  bottomSheetBackground: {
    backgroundColor: "#F5E6D3",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomSheetIndicator: {
    backgroundColor: "#000000",
    width: 40,
    height: 5,
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  carouselContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  arrowButton: {
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#000000",
  },
  arrowText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#000000",
  },
  qrContainer: {
    alignItems: "center",
    marginHorizontal: 15,
    flex: 1,
  },
  qrCodeWrapper: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: "#000000",
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    borderWidth: 3,
    borderColor: "#000000",
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 10,
  },
  addressText: {
    fontSize: 16,
    color: "#000000",
    fontFamily: "monospace",
  },
  copyIcon: {
    fontSize: 18,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#CCCCCC",
  },
  dotActive: {
    backgroundColor: "#000000",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  closeSheetButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#000000",
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  closeSheetButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000000",
  },
  text: {
    fontSize: 18,
    color: "#FFFFFF",
  },
});
