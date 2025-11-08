import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import Svg, { Path } from 'react-native-svg';

// Icon components
function CopyIcon({ size = 18, color = '#FFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-2M16 4h2a2 2 0 012 2v2M16 4v4M16 4h-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LightningIcon({ size = 16, color = '#FFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function CryptoDepositScreen() {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  const handleClose = () => {
    router.push('/(main)');
  };

  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];

  const getFullSolanaAddress = () => {
    if (wallet?.publicKey) {
      return wallet.publicKey;
    }
    return 'No address available';
  };

  const solanaAddress = getFullSolanaAddress();

  // Truncate address for display
  const getTruncatedAddress = (address: string) => {
    if (address.length > 20) {
      return `${address.slice(0, 12)}...${address.slice(-8)}`;
    }
    return address;
  };

  const handleCopyAddress = async () => {
    if (solanaAddress !== 'No address available') {
      await Clipboard.setStringAsync(solanaAddress);
      Alert.alert('Copied!', 'Address copied to clipboard');
    } else {
      Alert.alert('Wallet Not Found', 'No wallet is currently available. Please connect your wallet first.');
    }
  };

  const handleDepositViaEVM = () => {
    console.log('Deposit via EVM networks');
    // Navigate to EVM deposit options
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text style={styles.title}>My Solana address</Text>
      <Text style={styles.subtitle}>
        We only support <Text style={styles.highlightText}>USDC</Text> deposits on{' '}
        <Text style={styles.highlightText}>Solana</Text>.
      </Text>

      {/* QR Code Container */}
      <View style={styles.qrContainer}>
        <View style={styles.qrCodeWrapper}>
          <QRCode
            value={solanaAddress}
            size={250}
            color="#000000"
            backgroundColor="#A8A6FA"
            logo={require('../assets/images/icon.png')}
            logoSize={60}
            logoBackgroundColor="#ffffff"
            logoBorderRadius={15}
          />
        </View>

        {/* Address Display */}
        <TouchableOpacity 
          style={styles.addressContainer}
          onPress={handleCopyAddress}
        >
          <Text style={styles.addressText}>{getTruncatedAddress(solanaAddress)}</Text>
          <CopyIcon size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Minimum Deposit Info */}
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Min. deposit for Solana</Text>
        <Text style={styles.infoValue}>1 USDC</Text>
      </View>

      {/* Deposit via EVM Networks Button */}
      <TouchableOpacity 
        style={styles.evmButton}
        onPress={handleDepositViaEVM}
      >
        <View style={styles.evmButtonContent}>
          <View style={styles.networkIcons}>
            <View style={[styles.networkIcon, { backgroundColor: '#627EEA' }]}>
              <Text style={styles.networkIconText}>Ξ</Text>
            </View>
            <View style={[styles.networkIcon, { backgroundColor: '#8247E5', marginLeft: -10 }]}>
              <Text style={styles.networkIconText}>Ⓟ</Text>
            </View>
            <View style={[styles.networkIcon, { backgroundColor: '#F0B90B', marginLeft: -10 }]}>
              <Text style={styles.networkIconText}>B</Text>
            </View>
            <View style={[styles.networkIcon, { backgroundColor: '#2775CA', marginLeft: -10 }]}>
              <LightningIcon size={16} color="#FFF" />
            </View>
          </View>
          <Text style={styles.evmButtonText}>Deposit via EVM networks</Text>
        </View>
        <Text style={styles.arrowIcon}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  backButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  closeButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  highlightText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  qrCodeWrapper: {
    backgroundColor: '#A8A6FA',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#333333',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 10,
  },
  addressText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  infoLabel: {
    fontSize: 16,
    color: '#999999',
  },
  infoValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  evmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#333333',
    padding: 20,
  },
  evmButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  networkIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkIcon: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  networkIconText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  evmButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  arrowIcon: {
    fontSize: 28,
    color: '#FFFFFF',
  },
});