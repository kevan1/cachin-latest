import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { getUserByUsername } from '@/services/firestoreService';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';

// USDC Token Mint Address on Solana Mainnet
const USDC_MINT_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export default function SendAmountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { recipient, address, username } = params;
  
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState('0.00');
  const [comment, setComment] = useState('');
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [recipientAddress, setRecipientAddress] = useState<string>(address as string || '');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];

  const getWalletAddress = () => {
    if (wallet?.publicKey) {
      return wallet.publicKey;
    }
    return null;
  };

  // Handle amount change and replace commas with dots for iOS compatibility
  const handleAmountChange = (text: string) => {
    // Replace comma with dot for decimal separator
    const normalizedText = text.replace(/,/g, '.');
    setAmount(normalizedText);
  };

  // Fetch Solana address if only username is provided (from QR scan)
  useEffect(() => {
    const fetchAddress = async () => {
      if (!recipientAddress && username) {
        console.log('[Send Amount] Fetching address for username:', username);
        setIsLoadingAddress(true);
        try {
          const user = await getUserByUsername(username as string);
          if (user && user.solanaAddress) {
            console.log('[Send Amount] Found address:', user.solanaAddress);
            setRecipientAddress(user.solanaAddress);
          } else {
            Alert.alert('User Not Found', `Could not find a wallet for ${username}`);
            router.back();
          }
        } catch (error) {
          console.error('[Send Amount] Error fetching user:', error);
          Alert.alert('Error', 'Could not look up user wallet address');
          router.back();
        } finally {
          setIsLoadingAddress(false);
        }
      }
    };
    fetchAddress();
  }, [username, recipientAddress]);

  // Fetch USDC balance
  useEffect(() => {
    const fetchUSDCBalance = async () => {
      const walletAddress = getWalletAddress();
      if (walletAddress) {
        try {
          setIsLoadingBalance(true);
          const connection = new Connection('https://solxar.mainnet.rpcpool.com/efba4db1-e231-40f6-a16f-6e24e8f72b5c', 'confirmed');
          const ownerPublicKey = new PublicKey(walletAddress);
          const usdcMintPublicKey = new PublicKey(USDC_MINT_ADDRESS);
          
          // Get associated token account address
          const associatedTokenAddress = await getAssociatedTokenAddress(
            usdcMintPublicKey,
            ownerPublicKey
          );
          
          // Fetch token account balance
          const tokenAccountInfo = await connection.getTokenAccountBalance(associatedTokenAddress);
          
          if (tokenAccountInfo && tokenAccountInfo.value) {
            // USDC has 6 decimals, uiAmount is already formatted
            const usdcBalance = tokenAccountInfo.value.uiAmount || 0;
            setBalance(usdcBalance.toFixed(2));
          }
        } catch (error) {
          console.error('Error fetching USDC balance:', error);
          // If token account doesn't exist, balance is 0
          setBalance('0.00');
        } finally {
          setIsLoadingBalance(false);
        }
      }
    };
    fetchUSDCBalance();
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleMaxAmount = () => {
    setAmount(balance);
  };

  const handleSend = () => {
    const amountValue = parseFloat(amount);
    if (!amount || amountValue <= 0) {
      Alert.alert('Invalid Amount', 'Please enter an amount greater than 0');
      return;
    }
    if (amountValue > parseFloat(balance)) {
      Alert.alert('Insufficient Balance', 'You don&apos;t have enough USDC');
      return;
    }
    
    if (!recipientAddress) {
      Alert.alert('Error', 'Recipient address not found');
      return;
    }
    
    // Navigate to confirmation screen
    router.push({
      pathname: '/send-confirm',
      params: {
        recipient: recipient as string,
        address: recipientAddress,
        amount: amount,
        comment: comment
      }
    });
  };

  const getInitials = (name: string) => {
    if (name.length < 3) return name.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Send</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Recipient Card */}
      <View style={styles.recipientCard}>
        <View style={styles.recipientInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(recipient as string)}</Text>
          </View>
          <View>
            <Text style={styles.sendingToText}>↗ You&apos;re sending money to</Text>
            <Text style={styles.recipientName}>{recipient}</Text>
          </View>
        </View>
      </View>

      {/* Amount Display */}
      <View style={styles.amountContainer}>
        <Text style={styles.currencySymbol}>$</Text>
        <TextInput
          style={styles.amountInput}
          value={amount}
          onChangeText={handleAmountChange}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor="#CCCCCC"
          autoFocus
          returnKeyType="done"
          blurOnSubmit
        />
        <View style={styles.balanceRow}>
          {isLoadingBalance ? (
            <ActivityIndicator size="small" color="#666666" />
          ) : (
            <>
              <Text style={styles.balanceText}>Balance: ${balance} USDC</Text>
              <TouchableOpacity onPress={handleMaxAmount} style={styles.maxButton}>
                <Text style={styles.maxButtonText}>MAX</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Comment Input */}
      <View style={styles.commentContainer}>
        <TextInput
          style={styles.commentInput}
          placeholder="Comment"
          placeholderTextColor="#999999"
          value={comment}
          onChangeText={setComment}
          returnKeyType="done"
          blurOnSubmit
        />
        <Text style={styles.attachIcon}>📎</Text>
      </View>

      {/* Send Button */}
      <TouchableOpacity 
        style={[styles.sendButton, (isLoadingAddress || !recipientAddress) && styles.sendButtonDisabled]} 
        onPress={handleSend}
        disabled={isLoadingAddress || !recipientAddress}
      >
        {isLoadingAddress ? (
          <ActivityIndicator color="#000000" />
        ) : (
          <>
            <Text style={styles.sendIcon}>↗</Text>
            <Text style={styles.sendButtonText}>Send with Ca¢hin</Text>
          </>
        )}
      </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
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
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
  },
  placeholder: {
    width: 50,
  },
  recipientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    padding: 20,
    marginBottom: 30,
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFB380',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  sendingToText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  recipientName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  amountContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    padding: 30,
    marginBottom: 30,
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#666666',
    position: 'absolute',
    top: 30,
    left: 30,
  },
  amountInput: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#666666',
    textAlign: 'center',
    minWidth: 200,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  balanceText: {
    fontSize: 16,
    color: '#666666',
  },
  maxButton: {
    backgroundColor: '#E8B5E8',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#000000',
  },
  maxButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
  commentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 30,
  },
  commentInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  attachIcon: {
    fontSize: 20,
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendIcon: {
    fontSize: 24,
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
});
