import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  useColorScheme,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { usePrivy } from '@privy-io/expo';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Svg, { Path, Circle } from 'react-native-svg';
import { validateArgentinePaymentId } from '@p2pdotme/sdk/country';
import { Colors } from '@/constants/theme';
import { GlassView } from '@/components/ui/GlassView';
import { createP2PArsOrder } from '@/utils/p2pOrders';
import { createMantecaQrPayment } from '@/utils/mantecaOrders';
import { formatFiatValue } from '@/utils/numberFormat';

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

// Icon components
function ArgentinaFlagIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Circle cx="16" cy="16" r="16" fill="#74ACDF" />
      <Path d="M0 10.667h32v10.666H0z" fill="#FFF" />
      <Path d="M16 19.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z" fill="#F6B40E" />
      <Path d="M16 18a2 2 0 100-4 2 2 0 000 4z" fill="#FFF" />
    </Svg>
  );
}

export default function WithdrawBankScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const amountParam = firstParam(params.amount);
  const currencyParam = firstParam(params.currency).toUpperCase();
  const methodParam = firstParam(params.method).toLowerCase();
  const railParam = firstParam(params.rail).toLowerCase();
  const scannedPaymentAddress = firstParam(params.paymentAddress);
  const rawQr = firstParam(params.rawQr);
  const solanaTxSignatureParam = firstParam(params.solanaTxSignature);
  const { user } = usePrivy();
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const palette = Colors[colorScheme];

  const [cbu, setCbu] = useState(scannedPaymentAddress);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const isMercadoPagoFlow = methodParam === 'mercadopago';
  const selectedRail = railParam === 'manteca' ? 'manteca' : 'p2p';
  const normalizedPaymentId = cbu.trim();
  const hasPaymentId = normalizedPaymentId.length > 0;
  const isPaymentIdValid = hasPaymentId && validateArgentinePaymentId(normalizedPaymentId);
  
  const arsRate = 1500;
  
  const getDisplayAmounts = () => {
    if (currencyParam === 'ARS') {
      const arsAmount = parseFloat(amountParam) || 0;
      const usdAmount = arsAmount / arsRate;
      return {
        ars: formatFiatValue(arsAmount, {
          context: 'detailed',
          currencyPrefix: 'ARS$',
        }),
        usd: formatFiatValue(usdAmount, {
          context: 'detailed',
          currencyPrefix: '$',
        }),
      };
    } else {
      const usdAmount = parseFloat(amountParam) || 0;
      const arsAmount = usdAmount * arsRate;
      return {
        ars: formatFiatValue(arsAmount, {
          context: 'detailed',
          currencyPrefix: 'ARS$',
        }),
        usd: formatFiatValue(usdAmount, {
          context: 'detailed',
          currencyPrefix: '$',
        }),
      };
    }
  };
  
  const amounts = getDisplayAmounts();

  const handleBack = () => {
    router.back();
  };

  const handleReview = async () => {
    if (!isPaymentIdValid) return;
    if (!amountParam || Number.parseFloat(amountParam) <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount before creating the order.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Session required', 'Sign in again before creating this order.');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    const requestCurrency =
      currencyParam === 'USD' || currencyParam === 'USDC' ? 'USD' : 'ARS';

    try {
      if (selectedRail === 'manteca') {
        const response = await createMantecaQrPayment({
          userId: user.id,
          amount: amountParam,
          currency: requestCurrency,
          paymentAddress: normalizedPaymentId,
          method: methodParam || 'mercadopago',
          qrData: rawQr || undefined,
        });

        const externalIdLabel = response.externalId ? `#${response.externalId}` : 'pending id';
        Alert.alert(
          'Manteca QR payment submitted',
          `Request ${externalIdLabel} (${response.status}). Confirm status in the Manteca dashboard or status endpoint.`,
          [{ text: 'OK', onPress: () => router.push('/activity') }]
        );
        return;
      }

      const response = await createP2PArsOrder({
        userId: user.id,
        amount: amountParam,
        currency: requestCurrency,
        paymentAddress: normalizedPaymentId,
        method: methodParam || 'bank',
        solanaTxSignature: solanaTxSignatureParam || undefined,
      });

      const orderIdLabel = response.orderId ? `#${response.orderId}` : 'pending id';
      const nextStepMessage =
        response.nextAction === 'SET_PAYMENT_ADDRESS_WHEN_ACCEPTED'
          ? 'Payment address will be submitted once a merchant accepts the order.'
          : response.nextAction === 'POLL_ORDER_STATUS'
            ? 'Order is created. Poll order status to continue settlement.'
            : 'Order flow moved to next stage.';

      Alert.alert(
        'P2P order created',
        `Order ${orderIdLabel} (${response.orderStatus}). ${nextStepMessage}`,
        [{ text: 'OK', onPress: () => router.push('/activity') }]
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error creating P2P order.';
      setSubmitError(message);
      Alert.alert('Order creation failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={[styles.container, { backgroundColor: 'transparent' }]}
        contentContainerStyle={styles.containerContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconButtonPressable}
            onPress={handleBack}
            activeOpacity={0.78}
          >
            <GlassView
              style={[
                styles.iconButton,
                {
                  borderColor:
                    colorScheme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)',
                },
              ]}
              intensity={26}
              interactive
            >
              <MaterialIcons name="arrow-back" size={20} color={palette.primaryText} />
            </GlassView>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: palette.primaryText }]}>Withdraw</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          {/* Withdrawal Summary Card */}
          <GlassView
            style={[
              styles.summaryCard,
              {
                borderColor:
                  colorScheme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.52)',
              },
            ]}
            intensity={30}
            interactive
          >
            <View style={styles.flagContainer}>
              <View style={styles.flagCircle}>
                <ArgentinaFlagIcon size={40} />
              </View>
              <GlassView style={styles.bankIconCircle} intensity={24} interactive>
                <MaterialIcons name="account-balance" size={20} color={palette.primaryText} />
              </GlassView>
            </View>
            
            <Text style={[styles.summaryLabel, { color: palette.secondaryText }]}>You&apos;re withdrawing</Text>
            <Text style={[styles.summaryAmount, { color: palette.primaryText }]}>
              {amounts.ars}
            </Text>
            <Text style={[styles.summaryEquivalent, { color: palette.secondaryText }]}>
              ≈ {amounts.usd} USD
            </Text>
          </GlassView>

          {/* Bank Details Section */}
          <Text style={[styles.sectionTitle, { color: palette.primaryText }]}>
            {isMercadoPagoFlow ? 'Enter Mercado Pago details' : 'Enter Bank Transfer details'}
          </Text>

          <GlassView
            style={[
              styles.inputContainer,
              {
                borderColor:
                  colorScheme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.52)',
              },
            ]}
            intensity={28}
            interactive
          >
            <MaterialIcons name="account-balance-wallet" size={24} color={palette.secondaryText} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: palette.primaryText }]}
              value={cbu}
              onChangeText={setCbu}
              placeholder={isMercadoPagoFlow ? 'Alias / CBU / CVU' : 'Alias / CBU / CVU'}
              placeholderTextColor={palette.secondaryText}
              keyboardType='default'
            />
          </GlassView>

          {hasPaymentId && !isPaymentIdValid ? (
            <Text style={[styles.validationError, { color: '#ef4444' }]}>
              Ingresa un Alias valido (6-20) o un CBU/CVU valido (22 digitos).
            </Text>
          ) : null}

          {submitError ? (
            <Text style={[styles.validationError, { color: '#ef4444' }]}>
              {submitError}
            </Text>
          ) : null}

          {scannedPaymentAddress ? (
            <Text style={[styles.prefillHint, { color: palette.secondaryText }]}>
              Scanned from QR: {scannedPaymentAddress}
            </Text>
          ) : null}

          {/* Info Message */}
          <View style={styles.infoContainer}>
            <MaterialIcons name="info-outline" size={18} color={palette.secondaryText} />
            <Text style={[styles.infoText, { color: palette.secondaryText }]}>
              You can only withdraw to accounts under your name.
            </Text>
          </View>
        </View>

        {/* Review Button */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[
              styles.primaryButton,
              {
                backgroundColor: palette.actionPrimary,
                opacity: isPaymentIdValid && !isSubmitting ? 1 : 0.5,
              }
            ]} 
            onPress={handleReview}
            disabled={!isPaymentIdValid || isSubmitting}
          >
            <Text style={[styles.primaryButtonText, { color: palette.actionPrimaryText }]}>
              {isSubmitting
                ? selectedRail === 'manteca'
                  ? 'Submitting...'
                  : 'Creating order...'
                : selectedRail === 'manteca'
                  ? 'Submit Manteca test'
                  : 'Review'}
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
  containerContent: {
    flexGrow: 1,
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
  iconButtonPressable: {
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  summaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    marginBottom: 30,
    alignItems: 'center',
  },
  flagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    height: 50,
    width: 60,
  },
  flagCircle: {
    zIndex: 1,
  },
  bankIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -10,
    zIndex: 2,
    borderWidth: 1,
  },
  summaryLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  summaryEquivalent: {
    fontSize: 16,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 30,
    paddingHorizontal: 4,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  prefillHint: {
    marginTop: 8,
    marginBottom: 12,
    fontSize: 12,
  },
  validationError: {
    marginTop: 8,
    marginBottom: 12,
    fontSize: 12,
  },
  footer: {
    marginBottom: 16,
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
});
