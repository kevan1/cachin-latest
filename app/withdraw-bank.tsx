import { StyleSheet, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

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

function BankIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M8 10v11M12 10v11M16 10v11M20 10v11" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function InfoIcon({ size = 18, color = '#666' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      <Path d="M12 16v-4M12 8h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export default function WithdrawBankScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { amount, currency } = params; // amount in the selected currency
  
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
    // Navigate to review/confirmation screen
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Withdraw</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Withdrawal Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.flagContainer}>
          <View style={styles.flagCircle}>
            <ArgentinaFlagIcon size={32} />
          </View>
          <View style={styles.bankIconCircle}>
            <BankIcon size={24} color="#000" />
          </View>
        </View>
        
        <Text style={styles.summaryLabel}>↑ You&apos;re withdrawing</Text>
        <Text style={styles.summaryAmount}>ARS {amounts.ars.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</Text>
        <Text style={styles.summaryEquivalent}>≈ {amounts.usd} USD</Text>
      </View>

      {/* Bank Details Section */}
      <Text style={styles.sectionTitle}>Enter Bank Transfer details</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={cbu}
          onChangeText={setCbu}
          placeholder="CBU/CVU"
          placeholderTextColor="#999999"
          keyboardType="number-pad"
        />
      </View>

      {/* Info Message */}
      <View style={styles.infoContainer}>
        <InfoIcon size={18} color="#666666" />
        <Text style={styles.infoText}>You can only withdraw to accounts under your name.</Text>
      </View>

      {/* Review Button */}
      <TouchableOpacity 
        style={[
          styles.reviewButton,
          !cbu && styles.reviewButtonDisabled
        ]} 
        onPress={handleReview}
        disabled={!cbu}
      >
        <Text style={styles.reviewButtonText}>Review</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5E6D3',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 30,
  },
  backButton: {
    width: 50,
    height: 50,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  placeholder: {
    width: 50,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    padding: 30,
    marginBottom: 30,
    alignItems: 'flex-start',
  },
  flagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    height: 60,
  },
  flagCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#60A5FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -15,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  summaryEquivalent: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 20,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    marginBottom: 15,
  },
  input: {
    fontSize: 18,
    color: '#000000',
    padding: 20,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 30,
    paddingHorizontal: 5,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  reviewButton: {
    backgroundColor: '#60A5FA',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  reviewButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  reviewButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
});
