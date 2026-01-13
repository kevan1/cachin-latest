import { StyleSheet, View, Text, TouchableOpacity, Alert, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo, useState } from 'react';
import Svg, { Path } from 'react-native-svg';
import { buildSolanaPayUri, createSolanaPayReferences, SOLANA_USDC_MINT } from '@/utils/solanaPay';

function CopyIcon({ size = 18, color = '#111' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-2M16 4h2a2 2 0 012 2v2M16 4v4M16 4h-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function CryptoDepositScreen() {
  const router = useRouter();
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  const [hideWallet, setHideWallet] = useState(false);
  const [receiveAsset, setReceiveAsset] = useState<'usdc' | 'sol'>('usdc');

  const solanaAddress = useMemo(() => {
    if (wallet?.publicKey) return wallet.publicKey;
    return '';
  }, [wallet]);

  const solanaPayReferences = useMemo(
    () => (solanaAddress ? createSolanaPayReferences(1) : []),
    [solanaAddress, receiveAsset]
  );

  const solanaPayUri = useMemo(() => {
    if (!solanaAddress) return '';
    return buildSolanaPayUri({
      recipient: solanaAddress,
      splToken: receiveAsset === 'usdc' ? SOLANA_USDC_MINT : undefined,
      references: solanaPayReferences,
      label: 'Cachin',
      message: receiveAsset === 'usdc' ? 'Pay with USDC' : 'Pay with SOL',
      memo: receiveAsset === 'usdc' ? 'cachin-usdc' : 'cachin-sol',
    });
  }, [receiveAsset, solanaAddress, solanaPayReferences]);

  const handleCopyPaymentLink = async () => {
    if (solanaPayUri) {
      await Clipboard.setStringAsync(solanaPayUri);
      Alert.alert('Copied!', 'Payment link copied to clipboard');
    } else if (solanaAddress) {
      await Clipboard.setStringAsync(solanaAddress);
      Alert.alert('Copied!', 'Address copied to clipboard');
    } else {
      Alert.alert('Wallet Not Found', 'No wallet is currently available. Please connect your wallet first.');
    }
  };

  const handleClose = () => {
    router.back();
  };

  const handleToggleHideWallet = (value: boolean) => {
    setHideWallet(value);
    Alert.alert(
      'Hide My Wallet',
      value
        ? 'Hide My Wallet enabled. Incoming transfers will use a masked address if supported.'
        : 'Hide My Wallet disabled. Transfers will use your primary address.'
    );
  };

  const getWrappedAddress = () => {
    if (!solanaAddress) return 'No address available';
    // Split address roughly in half for multi-line display
    const midpoint = Math.ceil(solanaAddress.length / 2);
    return `${solanaAddress.slice(0, midpoint)}\n${solanaAddress.slice(midpoint)}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.handle} />
      <TouchableOpacity style={styles.closeButton} onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.closeIcon}>✕</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Receive</Text>
        <Text style={styles.subtitle}>Scan with a Solana Pay wallet. USDC is preferred, SOL is supported.</Text>

        <View style={styles.assetToggle}>
          <TouchableOpacity
            style={[styles.assetToggleButton, receiveAsset === 'usdc' && styles.assetToggleButtonActive]}
            onPress={() => setReceiveAsset('usdc')}
          >
            <Text style={[styles.assetToggleText, receiveAsset === 'usdc' && styles.assetToggleTextActive]}>
              USDC
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.assetToggleButton, receiveAsset === 'sol' && styles.assetToggleButtonActive]}
            onPress={() => setReceiveAsset('sol')}
          >
            <Text style={[styles.assetToggleText, receiveAsset === 'sol' && styles.assetToggleTextActive]}>
              SOL
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.qrCard}>
          <View style={styles.qrFrame}>
            <QRCode
              value={solanaPayUri || solanaAddress || 'No wallet'}
              size={240}
              color="#000000"
              backgroundColor="#ffffff"
            />
          </View>
          <Text selectable style={styles.addressLines}>{getWrappedAddress()}</Text>
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Receive with Hide My Wallet</Text>
            <TouchableOpacity onPress={() => Alert.alert('Hide My Wallet', 'Hide My Wallet routes deposits through a masked address. Turn it on if you want extra privacy.')}>
              <Text style={styles.toggleHelp}>How it works? <Text style={styles.toggleHelpIcon}>?</Text></Text>
            </TouchableOpacity>
          </View>
          <Switch
            value={hideWallet}
            onValueChange={handleToggleHideWallet}
            trackColor={{ false: '#E5E7EB', true: '#2563EB' }}
            thumbColor="#ffffff"
          />
        </View>

        <TouchableOpacity style={styles.copyButton} onPress={handleCopyPaymentLink}>
          <CopyIcon size={18} color="#111827" />
          <Text style={styles.copyButtonText}>Copy payment link</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 60,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    marginTop: 12,
    marginBottom: 12,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 12,
    padding: 8,
  },
  closeIcon: {
    fontSize: 22,
    color: '#9CA3AF',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    marginBottom: 24,
    textAlign: 'center',
  },
  assetToggle: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    backgroundColor: '#F3F4F6',
    padding: 6,
    borderRadius: 999,
    width: '100%',
  },
  assetToggleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  assetToggleButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  assetToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  assetToggleTextActive: {
    color: '#111827',
  },
  qrCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    alignItems: 'center',
    marginBottom: 28,
  },
  qrFrame: {
    backgroundColor: '#f5f5f7',
    padding: 16,
    borderRadius: 24,
  },
  addressLines: {
    marginTop: 14,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  toggleHelp: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  toggleHelpIcon: {
    fontWeight: '700',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: '#EFEFF4',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
});
