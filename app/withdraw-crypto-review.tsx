import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  useColorScheme,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveTransaction } from '@/utils/transactionStorage';
import { ChainType } from '@/constants/chains';
import { Transaction } from '@/types/types';
import { useToast } from 'heroui-native';
import { BlurView } from 'expo-blur';
import { resolveSolanaDomain } from '@/utils/sns';
import { fetchArsPrice } from '@/utils/priceService';
import { getSelectedCurrency, type Currency } from '@/utils/userStorage';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  runOnJS,
  interpolate,
  Extrapolation
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const BUTTON_HEIGHT = 56;
const BUTTON_PADDING = 4;
const THUMB_SIZE = BUTTON_HEIGHT - BUTTON_PADDING * 2;
const DEFAULT_ARS_RATE = 1500;

function formatMoneyValue(value: number, currency: 'USD' | 'ARS'): string {
  if (!Number.isFinite(value) || value <= 0) {
    return currency === 'ARS' ? 'ARS$0.00' : '$0.00';
  }

  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return currency === 'ARS' ? `ARS$${formatted}` : `$${formatted}`;
}

function SlideToProceed({
  onConfirm,
  palette,
  disabled = false,
  label = 'Slide to confirm',
}: {
  onConfirm: () => void;
  palette: any;
  disabled?: boolean;
  label?: string;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const confirmedSV = useSharedValue(false);
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const [sliderWidth, setSliderWidth] = useState(0);

  // Maximum drag distance
  const maxDrag = Math.max(sliderWidth - THUMB_SIZE - BUTTON_PADDING * 2, 0);

  const handleComplete = (isFinished: boolean) => {
    if (isFinished) {
      confirmedSV.value = true;
      setConfirmed(true);
      onConfirm();
    }
  };

  const panGesture = Gesture.Pan()
    .enabled(!confirmed && !disabled)
    .onBegin(() => {
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      if (confirmedSV.value) return;
      const newValue = startX.value + event.translationX;
      translateX.value = Math.min(Math.max(newValue, 0), maxDrag);
    })
    .onEnd(() => {
      if (confirmedSV.value) return;
      if (translateX.value > maxDrag * 0.7) {
        // Snap to end and confirm
        translateX.value = withSpring(maxDrag, { damping: 20 });
        runOnJS(handleComplete)(true);
      } else {
        // Snap back to start
        translateX.value = withSpring(0);
      }
    });

  const animatedThumbStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      backgroundColor: confirmedSV.value 
        ? '#10B981' // Green success color
        : palette.background
    };
  }, [palette.background]);

  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        translateX.value,
        [0, maxDrag * 0.5],
        [1, 0],
        Extrapolation.CLAMP
      ),
    };
  }, [maxDrag]);

  return (
    <View 
      style={[
        styles.sliderContainer,
        { backgroundColor: palette.actionPrimary, opacity: disabled ? 0.6 : 1 },
      ]}
      onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
    >
      <Animated.Text style={[styles.sliderText, animatedTextStyle, { color: palette.actionPrimaryText }]}>
        {label}
      </Animated.Text>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.sliderThumb, animatedThumbStyle]}>
          <MaterialIcons 
            name={confirmed ? "check" : "chevron-right"} 
            size={28} 
            color={confirmed ? "#FFFFFF" : palette.primaryText} 
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default function WithdrawCryptoReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { amount, currency, network, address } = params;
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const { toast } = useToast();
  const amountParam = Array.isArray(amount) ? amount[0] : amount;
  const currencyParam = Array.isArray(currency) ? currency[0] : currency;
  const networkParam = Array.isArray(network) ? network[0] : network;
  const addressParam = Array.isArray(address) ? address[0] : address;
  const parsedAmount = Number.parseFloat(amountParam ?? '0');
  const inputAddress = (addressParam ?? '').trim();
  const isSolanaNetwork = networkParam === 'solana';
  const isSnsAddress = isSolanaNetwork && inputAddress.toLowerCase().endsWith('.sol');

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [isResolvingSns, setIsResolvingSns] = useState(false);
  const [snsError, setSnsError] = useState<string | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState<Currency>('USD');
  const [arsRate, setArsRate] = useState(DEFAULT_ARS_RATE);

  const amountUsdValue =
    Number.isFinite(parsedAmount) && parsedAmount > 0
      ? currencyParam === 'ARS'
        ? parsedAmount / Math.max(arsRate, 1)
        : parsedAmount
      : 0;
  const primaryFiatCurrency: 'USD' | 'ARS' = preferredCurrency === 'ARS' ? 'ARS' : 'USD';
  const secondaryFiatCurrency: 'USD' | 'ARS' =
    primaryFiatCurrency === 'ARS' ? 'USD' : 'ARS';
  const primaryFiatValue =
    primaryFiatCurrency === 'ARS' ? amountUsdValue * arsRate : amountUsdValue;
  const secondaryFiatValue =
    secondaryFiatCurrency === 'ARS' ? amountUsdValue * arsRate : amountUsdValue;
  const primaryAmountLabel = formatMoneyValue(primaryFiatValue, primaryFiatCurrency);
  const secondaryAmountLabel = formatMoneyValue(secondaryFiatValue, secondaryFiatCurrency);

  const shortenAddress = (value: string) => {
    if (value.length >= 12) {
      return `${value.slice(0, 6)}...${value.slice(-6)}`;
    }
    return value;
  };

  useEffect(() => {
    let isMounted = true;

    if (!isSnsAddress) {
      setResolvedAddress(null);
      setSnsError(null);
      setIsResolvingSns(false);
      return undefined;
    }

    setIsResolvingSns(true);
    setSnsError(null);
    resolveSolanaDomain(inputAddress)
      .then((resolved) => {
        if (!isMounted) return;
        if (resolved) {
          setResolvedAddress(resolved);
          setSnsError(null);
        } else {
          setResolvedAddress(null);
          setSnsError('Unable to resolve SNS address.');
        }
      })
      .catch((error) => {
        console.warn('[sns] Failed to resolve domain', error);
        if (!isMounted) return;
        setResolvedAddress(null);
        setSnsError('Unable to resolve SNS address.');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsResolvingSns(false);
      });

    return () => {
      isMounted = false;
    };
  }, [inputAddress, isSnsAddress]);

  useEffect(() => {
    let isMounted = true;

    const loadMoneyPreferences = async () => {
      try {
        const [selectedCurrency, latestArsRate] = await Promise.all([
          getSelectedCurrency(),
          fetchArsPrice(),
        ]);
        if (!isMounted) return;

        setPreferredCurrency(selectedCurrency);
        if (latestArsRate > 0) {
          setArsRate(latestArsRate);
        }
      } catch (error) {
        console.error('[withdraw-crypto-review] Failed to load money preferences', error);
      }
    };

    void loadMoneyPreferences();
    return () => {
      isMounted = false;
    };
  }, []);

  const confirmDisabled = isSnsAddress && (!resolvedAddress || isResolvingSns);
  const confirmLabel = isSnsAddress
    ? isResolvingSns
      ? 'Resolving address...'
      : resolvedAddress
      ? 'Slide to confirm'
      : 'Resolve address to continue'
    : 'Slide to confirm';

  const handleBack = () => {
    router.back();
  };

  const handleWithdraw = () => {
     setShowConfirmation(true);
  };

  const handleConfirmTransaction = async () => {
    const recipientAddress =
      isSnsAddress && resolvedAddress ? resolvedAddress : inputAddress;
    // Execute mock transaction
    try {
        const newTransaction: Transaction = {
          id: `tx-${Date.now()}`,
          signature: `sig-${Date.now()}`,
          type: 'send', // withdrawal acts as a send
          currency: 'USDC', // Assuming USDC for now
          chain: ChainType.SOLANA,
          amount: amountUsdValue,
          recipient: 'External Wallet',
          address: recipientAddress,
          timestamp: Date.now(),
          status: 'confirmed',
        };
  
        await saveTransaction(newTransaction);

        // Close the modal and return home; show confirmation as a toast.
        setShowConfirmation(false);
        toast.show('Withdrawal confirmed!');
        router.dismissTo('/(main)/home');

    } catch (e) {
        console.error(e);
        Alert.alert("Error", "Transaction failed");
    }
  };

  return (
    <SafeAreaView 
        style={[styles.container, { backgroundColor: palette.background }]}
        edges={['top', 'left', 'right', 'bottom']}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={[styles.iconButton, { backgroundColor: palette.surfaceMuted, borderColor: palette.borderSubtle }]} 
            onPress={handleBack}
          >
            <MaterialIcons name="arrow-back" size={20} color={palette.primaryText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: palette.primaryText }]}>Withdraw</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: palette.surface, borderColor: palette.borderSubtle }]}>
          <View style={[styles.iconCircle, { backgroundColor: palette.surfaceMuted }]}>
            <MaterialIcons name="account-balance-wallet" size={24} color={palette.primaryText} />
          </View>
          <View>
          <Text style={[styles.summaryLabel, { color: palette.secondaryText }]}>↑ You&apos;re withdrawing</Text>
          <Text style={[styles.summaryAmount, { color: palette.primaryText }]}>
            {primaryAmountLabel}
          </Text>
          <Text style={[styles.summarySecondary, { color: palette.secondaryText }]}>
            {secondaryAmountLabel}
          </Text>
          <Text style={[styles.summaryAssetAmount, { color: palette.secondaryText }]}>
            USDC {amountUsdValue.toFixed(2)}
          </Text>
        </View>
      </View>

        {/* Details Card */}
        <View style={[styles.detailsCard, { backgroundColor: palette.surface, borderColor: palette.borderSubtle }]}>
           {/* Token and Network */}
           <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: palette.primaryText }]}>Token and network</Text>
              <View style={styles.networkValue}>
                  <MaterialIcons name="public" size={16} color={palette.primary} style={{marginRight: 4}} />
                <Text style={[styles.detailValue, { color: palette.primaryText }]}>USDC on Solana</Text>
            </View>
         </View>
           <View style={[styles.separator, { backgroundColor: palette.borderSubtle }]} />

         {/* To Address */}
         <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: palette.primaryText }]}>To</Text>
            <Text style={[styles.detailValue, { color: palette.primaryText, fontFamily: 'monospace' }]}>
              {inputAddress}
            </Text>
            {isSnsAddress && (
              <Text style={[styles.resolvedValue, { color: palette.secondaryText }]}>
                {isResolvingSns
                  ? 'Resolving SNS address...'
                  : resolvedAddress
                  ? `Resolved: ${shortenAddress(resolvedAddress)}`
                  : snsError || 'Unable to resolve SNS address.'}
              </Text>
            )}
         </View>
           <View style={[styles.separator, { backgroundColor: palette.borderSubtle }]} />

           {/* Max Network Fee */}
           <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: palette.primaryText }]}>Max network fee</Text>
              <Text style={[styles.detailValue, { color: palette.primaryText, fontWeight: '700' }]}>Sponsored by Cachin!</Text>
           </View>
        </View>

        {/* Withdraw Button */}
        <View style={styles.footer}>
           <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: palette.actionPrimary }]}
              onPress={handleWithdraw}
           >
              <Text style={[styles.primaryButtonText, { color: palette.actionPrimaryText }]}>Withdraw</Text>
           </TouchableOpacity>
        </View>
      </View>

      {/* Confirmation Modal Overlay */}
      <Modal
        transparent
        visible={showConfirmation}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowConfirmation(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={18} style={StyleSheet.absoluteFill} tint="dark" />
          <View style={styles.modalBackdrop} />
          <View style={[styles.modalContent, { backgroundColor: palette.surface }]}>
              <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setShowConfirmation(false)}>
                      <MaterialIcons name="close" size={24} color={palette.primaryText} />
                  </TouchableOpacity>
              </View>
              
              <View style={[styles.warningIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <MaterialIcons name="warning" size={32} color="#D97706" />
              </View>
              
              <Text style={[styles.modalTitle, { color: palette.primaryText }]}>Is this address compatible?</Text>
              
              <Text style={[styles.modalText, { color: palette.secondaryText }]}>
                  Only send to address that support the selected network and token. Incorrect transfers may be lost.
              </Text>

                <View style={{ marginTop: 24, width: '100%' }}>
                    <SlideToProceed
                      onConfirm={handleConfirmTransaction}
                      palette={palette}
                      disabled={confirmDisabled}
                      label={confirmLabel}
                    />
                </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  summaryLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '700',
  },
  summarySecondary: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  summaryAssetAmount: {
    fontSize: 12,
    marginTop: 2,
  },
  detailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  detailRow: {
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 14,
    marginBottom: 4,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 16,
  },
  resolvedValue: {
    marginTop: 6,
    fontSize: 12,
  },
  networkValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    width: '100%',
    marginVertical: 4,
    borderStyle: 'dashed', // simple fallback
    opacity: 0.5,
  },
  footer: {
    marginTop: 'auto',
    marginBottom: 20,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalContent: {
     width: '100%',
     borderRadius: 24,
     padding: 24,
     alignItems: 'center',
  },
  modalHeader: {
     width: '100%',
     alignItems: 'flex-end',
     marginBottom: 10,
  },
  warningIconCircle: {
     width: 64,
     height: 64,
     borderRadius: 32,
     justifyContent: 'center',
     alignItems: 'center',
     marginBottom: 16,
  },
  modalTitle: {
     fontSize: 20,
     fontWeight: '700',
     marginBottom: 12,
     textAlign: 'center',
  },
  modalText: {
     fontSize: 14,
     textAlign: 'center',
     lineHeight: 20,
  },
  // Slider Styles
  sliderContainer: {
     height: BUTTON_HEIGHT,
     width: '100%',
     borderRadius: BUTTON_HEIGHT / 2,
     justifyContent: 'center',
     alignItems: 'center',
     position: 'relative',
     overflow: 'hidden',
  },
  sliderThumb: {
     position: 'absolute',
     left: BUTTON_PADDING,
     width: THUMB_SIZE,
     height: THUMB_SIZE,
     borderRadius: THUMB_SIZE / 2,
     justifyContent: 'center',
     alignItems: 'center',
     zIndex: 2,
     // Shadow for better affordance
     shadowColor: "#000",
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.25,
     shadowRadius: 3.84,
     elevation: 5,
  },
  sliderText: {
     fontSize: 16,
     fontWeight: '600',
     zIndex: 1,
  },
});
