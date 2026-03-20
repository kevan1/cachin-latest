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
import { Colors } from '@/constants/theme';

export default function WithdrawCryptoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { amount, currency } = params;
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const [address, setAddress] = useState('');

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

        {/* Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: palette.surface, borderColor: palette.borderSubtle }]}>
          <View style={[styles.iconCircle, { backgroundColor: palette.surfaceMuted }]}>
            <MaterialIcons name="account-balance-wallet" size={24} color={palette.primaryText} />
          </View>
          <View>
            <Text style={[styles.summaryLabel, { color: palette.secondaryText }]}>↑ You&apos;re withdrawing</Text>
            <Text style={[styles.summaryAmount, { color: palette.primaryText }]}>
              {currency === 'USD' ? '$' : 'ARS$'} {amount}
            </Text>
          </View>
        </View>

        {/* Network Selection */}
        <View style={[styles.inputGroup, { backgroundColor: palette.surface, borderColor: palette.borderSubtle }]}>
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
        </View>

        {/* Address Input */}
        <View style={[styles.inputGroup, { backgroundColor: palette.surface, borderColor: palette.borderSubtle, marginTop: 16 }]}>
           <Text style={[styles.inputLabel, { color: palette.primaryText, marginBottom: 8 }]}>Wallet address</Text>
           <TextInput
            style={[styles.input, { color: palette.primaryText, borderColor: palette.borderSubtle }]}
            placeholder="Enter an address or SNS"
            placeholderTextColor={palette.secondaryText}
            value={address}
            onChangeText={setAddress}
            autoCapitalize="none"
          />
        </View>

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
  inputGroup: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
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
