import { StyleSheet, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import { fetchAllTokenBalances } from '@/utils/balanceService';
import { fetchTokenPrices } from '@/utils/priceService';
import Svg, { Path } from 'react-native-svg';

// Icon component
function SwapIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function WithdrawAmountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { method } = params; // 'crypto', 'mercadopago', or 'bank'
  const { wallets } = useEmbeddedSolanaWallet();
  
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState<string>('0.00');
  const [isUsdInput, setIsUsdInput] = useState(true); // true = USD input, false = ARS input
  const arsRate = 1500; // 1 USD = 1500 ARS

  // Get full Solana address
  const getFullSolanaAddress = () => {
    if (wallets && wallets.length > 0) {
      const wallet = wallets[0];
      return wallet.publicKey || null;
    }
    return null;
  };

  // Fetch user balance
  useEffect(() => {
    const fetchBalance = async () => {
      const address = getFullSolanaAddress();
      if (!address) return;
      
      try {
        const [balances, prices] = await Promise.all([
          fetchAllTokenBalances(address),
          fetchTokenPrices(),
        ]);
        
        const totalUsd = 
          (balances.sol * prices.sol) +
          (balances.usdc * prices.usdc) +
          (balances.usdt * prices.usdt);
        
        setBalance(totalUsd.toFixed(2));
      } catch (error) {
        console.error('Error fetching balance:', error);
        setBalance('0.00');
      }
    };
    
    fetchBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    // Navigate based on withdrawal method
    if (method === 'bank') {
      router.push({
        pathname: '/withdraw-bank',
        params: { 
          amount: amount,
          currency: isUsdInput ? 'USD' : 'ARS'
        }
      });
    } else if (method === 'mercadopago') {
      router.push({
        pathname: '/withdraw-bank',
        params: { 
          amount: amount,
          currency: isUsdInput ? 'USD' : 'ARS'
        }
      });
    } else {
      // Crypto withdrawal - implement later
      console.log(`Withdrawing ${amount} ${isUsdInput ? 'USD' : 'ARS'} via ${method}`);
    }
  };

  const handleSwap = () => {
    if (amount && parseFloat(amount) > 0) {
      if (isUsdInput) {
        // Convert USD to ARS
        const arsValue = (parseFloat(amount) * arsRate).toFixed(2);
        setAmount(arsValue);
      } else {
        // Convert ARS to USD
        const usdValue = (parseFloat(amount) / arsRate).toFixed(2);
        setAmount(usdValue);
      }
    }
    setIsUsdInput(!isUsdInput);
  };

  const calculateEquivalent = () => {
    const numAmount = parseFloat(amount) || 0;
    if (isUsdInput) {
      return (numAmount * arsRate).toFixed(2);
    } else {
      return (numAmount / arsRate).toFixed(2);
    }
  };

  const hasAmount = amount && parseFloat(amount) > 0;

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

      {/* Section Title */}
      <Text style={styles.sectionTitle}>Amount to withdraw</Text>

      {/* Amount Input Container */}
      <View style={styles.amountContainer}>
        <View style={styles.amountInput}>
          <Text style={[styles.currencyLabel, hasAmount && styles.currencyLabelActive]}>
            {isUsdInput ? 'USD' : 'ARS'}
          </Text>
          <TextInput
            style={[styles.amountText, hasAmount && styles.amountTextActive]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#CCCCCC"
          />
          <TouchableOpacity style={styles.swapButton} onPress={handleSwap}>
            <SwapIcon size={24} color="#000" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.equivalentAmount}>
          ≈ {calculateEquivalent()} {isUsdInput ? 'ARS' : 'USD'}
        </Text>
        <Text style={styles.balanceText}>Balance: USD {balance}</Text>
      </View>

      {/* Continue Button */}
      <TouchableOpacity 
        style={[
          styles.continueButton,
          !hasAmount && styles.continueButtonDisabled
        ]} 
        onPress={handleContinue}
        disabled={!hasAmount}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
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
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 20,
  },
  amountContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    padding: 30,
    marginBottom: 30,
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  currencyLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#999999',
    marginRight: 10,
  },
  currencyLabelActive: {
    color: '#000000',
  },
  amountText: {
    flex: 1,
    fontSize: 48,
    fontWeight: 'bold',
    color: '#999999',
    padding: 0,
  },
  amountTextActive: {
    color: '#000000',
  },
  swapButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  equivalentAmount: {
    fontSize: 18,
    color: '#666666',
    marginBottom: 15,
  },
  balanceText: {
    fontSize: 16,
    color: '#666666',
  },
  continueButton: {
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
  continueButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  continueButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
});
