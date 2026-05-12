import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
  useColorScheme,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useActiveSolanaWallet } from '@/hooks/useActiveSolanaWallet';
import { fetchSolanaUsdcBalance } from '@/utils/balanceService';
import { fetchArsPrice } from '@/utils/priceService';
import { Colors } from '@/constants/theme';
import { GlassView } from '@/components/ui/GlassView';
import { normalizeDecimalInput } from '@/utils/tokenAmount';
import {
  formatDecimalForInput,
  formatFiatValue,
  formatTokenAmountDisplay,
} from '@/utils/numberFormat';

const USDC_DECIMALS = 6;

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function WithdrawAmountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { method } = params; // 'crypto', 'mercadopago', or 'bank'
  const { address: activeSolanaAddress } = useActiveSolanaWallet();
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const palette = Colors[colorScheme];
  const prefilledAmount = firstParam(params.amount);
  const prefilledCurrency = firstParam(params.currency).toUpperCase();
  const prefilledPaymentAddress = firstParam(params.paymentAddress);
  const prefilledSolanaTxSignature = firstParam(params.solanaTxSignature);
  const prefilledRawQr = firstParam(params.rawQr);
  const rail = firstParam(params.rail);

  const [amount, setAmount] = useState(prefilledAmount);
  const [balance, setBalance] = useState<string>('0.00');
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isUsdInput, setIsUsdInput] = useState(prefilledCurrency !== 'ARS'); // true = USD input, false = ARS input
  // Live USDC <-> ARS rate fetched from the same source used by the QR parser.
  // While null, ARS conversion is unavailable and the UI should reflect that
  // rather than display a stale or fake number.
  const [arsRate, setArsRate] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchArsPrice()
      .then((price) => {
        if (cancelled) return;
        if (Number.isFinite(price) && price > 0) {
          setArsRate(price);
        }
      })
      .catch(() => {
        // Leave arsRate as null. UI consumers should handle the null state.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch user balance
  useEffect(() => {
    const fetchBalance = async () => {
      const address = activeSolanaAddress;
      if (!address) {
        setIsLoadingBalance(false);
        return;
      }
      
      try {
        setIsLoadingBalance(true);
        const solanaUsdcBalance = await fetchSolanaUsdcBalance(address);
        setBalance(formatDecimalForInput(solanaUsdcBalance, USDC_DECIMALS) || '0');
      } catch (error) {
        console.error('Error fetching balance:', error);
        setBalance('0.00');
      } finally {
        setIsLoadingBalance(false);
      }
    };
    
    fetchBalance();
  }, [activeSolanaAddress]);

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    const currency = isUsdInput ? 'USD' : 'ARS';
    if (method === 'bank' || method === 'mercadopago') {
      router.push({
        pathname: '/withdraw-bank',
        params: {
          amount,
          currency,
          method: firstParam(method),
          paymentAddress: prefilledPaymentAddress,
          solanaTxSignature: prefilledSolanaTxSignature,
          rawQr: prefilledRawQr,
          rail,
        },
      });
    } else {
      router.push({
        pathname: '/withdraw-crypto',
        params: { amount, currency },
      });
    }
  };

  const handleSwap = () => {
    // Refuse to swap if the live FX rate is not loaded; the user should
    // never see a converted amount based on a fake or zero rate.
    if (arsRate === null) return;
    if (amount && parseFloat(amount) > 0) {
      if (isUsdInput) {
        setAmount(formatDecimalForInput(parseFloat(amount) * arsRate, 2));
      } else {
        setAmount(formatDecimalForInput(parseFloat(amount) / arsRate, USDC_DECIMALS));
      }
    }
    setIsUsdInput(!isUsdInput);
  };

  const calculateEquivalent = () => {
    if (arsRate === null) return 'Loading FX…';
    const numAmount = parseFloat(amount) || 0;
    if (isUsdInput) {
      return formatFiatValue(numAmount * arsRate, {
        context: 'detailed',
        currencyPrefix: 'ARS$',
      });
    } else {
      return formatFiatValue(numAmount / arsRate, {
        context: 'detailed',
        currencyPrefix: '$',
      });
    }
  };

  const hasAmount = amount && parseFloat(amount) > 0;
  const numAmount = parseFloat(amount) || 0;
  // Simple check against balance (assuming balance is USD).
  // When ARS input is active and the live FX rate has not loaded yet,
  // disable Continue rather than letting the user proceed with a wrong rate.
  const isBalanceSufficient = isUsdInput
    ? numAmount <= parseFloat(balance)
    : arsRate !== null && (numAmount / arsRate) <= parseFloat(balance);

  const canContinue = hasAmount && isBalanceSufficient && (isUsdInput || arsRate !== null);

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
          <Text style={[styles.headerTitle, { color: palette.primaryText }]}>Withdraw Amount</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          {/* Amount Input */}
          <GlassView
            style={[
              styles.amountCard,
              {
                borderColor:
                  colorScheme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.52)',
              },
            ]}
            intensity={30}
            interactive
          >
            
            {/* Interactive Badge acting as swap button */}
            <TouchableOpacity
              onPress={handleSwap}
              style={styles.amountBadgePressable}
              activeOpacity={0.78}
            >
              <GlassView style={styles.amountBadge} intensity={24} interactive>
                <MaterialIcons
                  name="swap-vert"
                  size={16}
                  color={palette.secondaryText}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.amountBadgeText, { color: palette.secondaryText }]}>
                  {isUsdInput ? 'USD' : 'ARS'} Amount
                </Text>
              </GlassView>
            </TouchableOpacity>
            
            <View style={styles.amountRow}>
              <Text style={[styles.currencySymbol, { color: palette.secondaryText }]}>
                {isUsdInput ? '$' : 'ARS$'}
              </Text>
              <TextInput
                style={[styles.amountInput, { color: palette.primaryText }]}
                value={amount}
                onChangeText={(text) =>
                  setAmount(normalizeDecimalInput(text, isUsdInput ? USDC_DECIMALS : 2))
                }
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={palette.secondaryText}
                autoFocus
              />
            </View>
            
            <Text style={[styles.equivalentText, { color: palette.secondaryText }]}>
               ≈ {calculateEquivalent()}
            </Text>
            
            <Text style={[styles.balanceText, { color: palette.secondaryText }]}>
              {isLoadingBalance 
                ? "Loading balance..." 
                : `Available Solana USDC: ${formatTokenAmountDisplay(balance, {
                    context: 'detailed',
                    tokenPriceUsd: 1,
                    tokenDecimals: USDC_DECIMALS,
                  })} USDC`}
            </Text>
          </GlassView>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleContinue}
            disabled={!canContinue}
            style={[
              styles.primaryButton,
              { backgroundColor: palette.actionPrimary, opacity: canContinue ? 1 : 0.5 },
            ]}
          >
            <Text style={[styles.primaryButtonText, { color: palette.actionPrimaryText }]}>
              Continue
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
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  amountCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
  },
  amountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 16,
  },
  amountBadgePressable: {
    borderRadius: 999,
  },
  amountBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    width: '100%',
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '600',
    marginRight: 4,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '600',
    textAlign: 'left',
    minWidth: 100,
    fontVariant: ['tabular-nums'],
  },
  equivalentText: {
    fontSize: 16,
    marginBottom: 16,
    fontVariant: ['tabular-nums'],
  },
  balanceText: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
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
