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
import { useState } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '@/constants/theme';

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
  const { amount, currency } = params; // amount in the selected currency
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  
  const [cbu, setCbu] = useState('');
  
  const arsRate = 1500;
  
  // Calculate display amounts
  const getDisplayAmounts = () => {
    if (currency === 'ARS') {
      const arsAmount = parseFloat(amount as string) || 0;
      const usdAmount = arsAmount / arsRate;
      return {
        ars: arsAmount.toFixed(1),
        usd: usdAmount.toFixed(0)
      };
    } else {
      const usdAmount = parseFloat(amount as string) || 0;
      const arsAmount = usdAmount * arsRate;
      return {
        ars: arsAmount.toFixed(1),
        usd: usdAmount.toFixed(0)
      };
    }
  };
  
  const amounts = getDisplayAmounts();

  const handleBack = () => {
    router.back();
  };

  const handleReview = () => {
    console.log('Reviewing withdrawal:', { cbu, amount, currency });
    // Navigate to review/confirmation screen or show alert
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={[styles.container, { backgroundColor: palette.background }]}
        contentContainerStyle={styles.containerContent}
        showsVerticalScrollIndicator={false}
      >
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

        <View style={styles.content}>
          {/* Withdrawal Summary Card */}
          <View style={[styles.summaryCard, { backgroundColor: palette.surface, borderColor: palette.borderSubtle }]}>
            <View style={styles.flagContainer}>
              <View style={styles.flagCircle}>
                <ArgentinaFlagIcon size={40} />
              </View>
              <View style={[styles.bankIconCircle, { backgroundColor: palette.surface, borderColor: palette.borderSubtle }]}>
                <MaterialIcons name="account-balance" size={20} color={palette.primaryText} />
              </View>
            </View>
            
            <Text style={[styles.summaryLabel, { color: palette.secondaryText }]}>You&apos;re withdrawing</Text>
            <Text style={[styles.summaryAmount, { color: palette.primaryText }]}>
              ARS$ {amounts.ars.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            </Text>
            <Text style={[styles.summaryEquivalent, { color: palette.secondaryText }]}>
              ≈ ${amounts.usd} USD
            </Text>
          </View>

          {/* Bank Details Section */}
          <Text style={[styles.sectionTitle, { color: palette.primaryText }]}>Enter Bank Transfer details</Text>

          <View style={[styles.inputContainer, { backgroundColor: palette.surface, borderColor: palette.borderSubtle }]}>
             <MaterialIcons name="account-balance-wallet" size={24} color={palette.secondaryText} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: palette.primaryText }]}
              value={cbu}
              onChangeText={setCbu}
              placeholder="CBU/CVU"
              placeholderTextColor={palette.secondaryText}
              keyboardType="number-pad"
            />
          </View>

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
              { backgroundColor: palette.actionPrimary, opacity: cbu ? 1 : 0.5 }
            ]} 
            onPress={handleReview}
            disabled={!cbu}
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
    borderWidth: 2,
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
  },
  summaryEquivalent: {
    fontSize: 16,
    fontWeight: '500',
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
