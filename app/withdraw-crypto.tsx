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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/theme';
import { GlassView } from '@/components/ui/GlassView';
import { fetchArsPrice } from '@/utils/priceService';
import { getSelectedCurrency, type Currency } from '@/utils/userStorage';

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

export default function WithdrawCryptoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { amount, currency } = params;
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const amountParam = Array.isArray(amount) ? amount[0] : amount;
  const currencyParam = Array.isArray(currency) ? currency[0] : currency;
  const parsedAmount = Number.parseFloat(amountParam ?? '0');

  const [address, setAddress] = useState('');
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
        console.error('[withdraw-crypto] Failed to load money preferences', error);
      }
    };

    void loadMoneyPreferences();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleReview = () => {
    router.push({
      pathname: '/withdraw-crypto-review',
      params: {
        amount,
        currency,
        network: 'solana',
        address,
      },
    });
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

        {/* Summary Card */}
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
          <GlassView style={styles.iconCircle} intensity={24} interactive>
            <MaterialIcons name="account-balance-wallet" size={24} color={palette.primaryText} />
          </GlassView>
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
        </GlassView>

        {/* Network Selection */}
        <GlassView
          style={[
            styles.inputGroup,
            {
              borderColor:
                colorScheme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.52)',
            },
          ]}
          intensity={30}
          interactive
        >
          <View style={styles.inputHeader}>
            <MaterialIcons name="public" size={20} color={palette.secondaryText} />
            <Text style={[styles.inputLabel, { color: palette.primaryText }]}>Token and network</Text>
          </View>
          
          <View style={styles.networkSelector}>
             <Text style={[styles.networkText, { color: palette.primaryText }]}>
                USDC on Solana
             </Text>
          </View>
           <Text style={[styles.helperText, { color: palette.secondaryText }]}>No fees with this token.</Text>
        </GlassView>

        {/* Address Input */}
        <GlassView
          style={[
            styles.inputGroup,
            styles.addressGroup,
            {
              borderColor:
                colorScheme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.52)',
            },
          ]}
          intensity={30}
          interactive
        >
          <Text style={[styles.inputLabel, { color: palette.primaryText, marginBottom: 8 }]}>Wallet address</Text>
          <TextInput
            style={[styles.input, { color: palette.primaryText, borderColor: palette.borderSubtle }]}
            placeholder="Enter an address or SNS"
            placeholderTextColor={palette.secondaryText}
            value={address}
            onChangeText={setAddress}
            autoCapitalize="none"
          />
        </GlassView>

        {/* Review Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: palette.actionPrimary, opacity: address ? 1 : 0.5 },
            ]}
            onPress={handleReview}
            disabled={!address}
          >
            <Text style={[styles.primaryButtonText, { color: palette.actionPrimaryText }]}>Review</Text>
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
    paddingHorizontal: 20,
    paddingBottom: 40,
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
  inputGroup: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  addressGroup: {
    marginTop: 16,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  networkSelector: {
     marginBottom: 8,
  },
  networkText: {
     fontSize: 16,
     marginBottom: 12,
     fontWeight: '500',
  },
  helperText: {
     fontSize: 12,
  },
  input: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  footer: {
    marginTop: 24,
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
