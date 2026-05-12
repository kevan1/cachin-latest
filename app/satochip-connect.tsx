import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useRouter } from "expo-router";

import { Colors } from "@/constants/theme";
import {
  getSatochipErrorMessage,
  readSatochipAvalancheAddress,
  setupSatochipCard,
} from "@/utils/satochip";
import {
  loadSatochipAvalancheAddress,
  saveSatochipAvalancheAddress,
} from "@/utils/satochipStorage";

function formatAddress(address: string | null) {
  if (!address) return "No card connected yet";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function SatochipConnectScreen() {
  const router = useRouter();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const palette = Colors[colorScheme];
  const [pin, setPin] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);

  useEffect(() => {
    loadSatochipAvalancheAddress()
      .then((address) => {
        setCurrentAddress(address);
      })
      .catch((error) => {
        console.error("[SatochipConnect] Failed to load state", error);
      });
  }, []);

  const handleSetup = async () => {
    if (!pin.trim() || pin.trim().length < 4) {
      Alert.alert("PIN required", "Choose a PIN of at least 4 characters.");
      return;
    }

    try {
      setIsSettingUp(true);
      const result = await setupSatochipCard({
        newPin: pin.trim(),
      });

      await saveSatochipAvalancheAddress(result.address);

      setCurrentAddress(result.address);
      setPin("");
      setShowSetup(false);

      Alert.alert(
        "Satochip initialized",
        `Card is set up and ready. Avalanche address: ${result.address}`,
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch (error) {
      const message = getSatochipErrorMessage(error);
      console.warn("[SatochipConnect] Setup failed:", message);
      Alert.alert("Setup failed", message);
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleConnect = async () => {
    if (!pin.trim()) {
      Alert.alert("PIN required", "Enter your Satochip PIN before you tap the card.");
      return;
    }

    try {
      setIsConnecting(true);
      const result = await readSatochipAvalancheAddress(pin.trim());

      await saveSatochipAvalancheAddress(result.address);

      setCurrentAddress(result.address);
      setPin("");

      Alert.alert(
        "Satochip connected",
        `Avalanche address ${result.address} is now active for Avalanche balances and sends.`,
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch (error) {
      const message = getSatochipErrorMessage(error);
      console.warn("[SatochipConnect] Failed to connect card:", message);
      Alert.alert("Could not connect Satochip", message);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.hero,
            {
              backgroundColor: palette.surface,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <Text style={[styles.eyebrow, { color: palette.secondaryText }]}>
            Satochip card
          </Text>
          <Text style={[styles.title, { color: palette.primaryText }]}>
            Connect a Satochip card
          </Text>
          <Text style={[styles.subtitle, { color: palette.secondaryText }]}>
            Cachin keeps Privy passkeys for app sign-in. This screen connects a
            Satochip card over NFC for card-signed transfers.
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.surface,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <Text style={[styles.sectionLabel, { color: palette.secondaryText }]}>
            Last connected Satochip address
          </Text>
          <Text style={[styles.addressValue, { color: palette.primaryText }]}>
            {formatAddress(currentAddress)}
          </Text>
        </View>

        {showSetup ? (
          <>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <Text style={[styles.sectionLabel, { color: palette.secondaryText }]}>
                New card setup
              </Text>
              <Text style={[styles.helper, { color: palette.secondaryText, marginTop: 6 }]}>
                This will initialize a fresh Satochip card: set your PIN and PUK, then generate
                a new wallet keypair on the card.
              </Text>

              <Text style={[styles.sectionLabel, { color: palette.secondaryText, marginTop: 16 }]}>
                Choose a PIN
              </Text>
              <TextInput
                value={pin}
                onChangeText={setPin}
                placeholder="At least 4 characters"
                placeholderTextColor={palette.secondaryText}
                secureTextEntry
                style={[
                  styles.pinInput,
                  {
                    color: palette.primaryText,
                    backgroundColor: palette.surfaceMuted,
                    borderColor: palette.borderSubtle,
                  },
                ]}
              />

              <Text style={[styles.helper, { color: palette.secondaryText, marginTop: 10 }]}>
                Hold the card near the phone after tapping initialize.
              </Text>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleSetup}
              disabled={isSettingUp}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: palette.actionPrimary,
                  opacity: isSettingUp ? 0.7 : 1,
                },
              ]}
            >
              {isSettingUp ? (
                <ActivityIndicator color={palette.actionPrimaryText} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: palette.actionPrimaryText }]}>
                  Tap card to initialize
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                setShowSetup(false);
                setPin("");
              }}
              style={[
                styles.secondaryButton,
                { backgroundColor: palette.actionSecondary },
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: palette.actionSecondaryText }]}>
                Back to connect
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.borderSubtle,
                },
              ]}
            >
              <Text style={[styles.sectionLabel, { color: palette.secondaryText }]}>
                Satochip PIN
              </Text>
              <TextInput
                value={pin}
                onChangeText={setPin}
                placeholder="Enter PIN"
                placeholderTextColor={palette.secondaryText}
                secureTextEntry
                style={[
                  styles.pinInput,
                  {
                    color: palette.primaryText,
                    backgroundColor: palette.surfaceMuted,
                    borderColor: palette.borderSubtle,
                  },
                ]}
              />
              <Text style={[styles.helper, { color: palette.secondaryText }]}>
                Hold the card near the phone after tapping connect. Keep it steady until the NFC
                prompt completes.
              </Text>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleConnect}
              disabled={isConnecting}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: palette.actionPrimary,
                  opacity: isConnecting ? 0.7 : 1,
                },
              ]}
            >
              {isConnecting ? (
                <ActivityIndicator color={palette.actionPrimaryText} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: palette.actionPrimaryText }]}>
                  Tap card to connect
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                setShowSetup(true);
                setPin("");
              }}
              style={[
                styles.secondaryButton,
                { backgroundColor: palette.actionSecondary },
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: palette.actionSecondaryText }]}>
                Set up a new card
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    gap: 16,
    paddingBottom: 28,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    gap: 10,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  addressValue: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 6,
  },
  pinInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
    fontSize: 16,
  },
  helper: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  primaryButton: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
