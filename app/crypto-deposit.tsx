import { StyleSheet, View, Text, TouchableOpacity, Alert, Switch, ScrollView, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import Svg, { Path } from 'react-native-svg';
import { buildSolanaPayUri, createSolanaPayReferences, SOLANA_USDC_MINT } from '@/utils/solanaPay';
import { GlassView } from '@/components/ui/GlassView';
import { Colors } from '@/constants/theme';
import { useActiveSolanaWallet } from '@/hooks/useActiveSolanaWallet';

function CopyIcon({ size = 18, color = '#111' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-2M16 4h2a2 2 0 012 2v2M16 4v4M16 4h-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function CryptoDepositScreen() {
  const router = useRouter();
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const palette = Colors[colorScheme];
  const { address } = useActiveSolanaWallet();
  const [hideWallet, setHideWallet] = useState(false);
  const [receiveAsset, setReceiveAsset] = useState<'usdc' | 'sol'>('usdc');

  const solanaAddress = useMemo(() => {
    if (address) return address;
    return '';
  }, [address]);

  const solanaPayReferences = useMemo(
    () => (solanaAddress ? createSolanaPayReferences(1) : []),
    [solanaAddress]
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

  const handleCopyWallet = async () => {
    if (solanaAddress) {
      await Clipboard.setStringAsync(solanaAddress);
      Alert.alert('Copied!', 'Wallet address copied to clipboard');
    } else {
      Alert.alert('Wallet Not Found', 'No wallet is currently available. Please connect your wallet first.');
    }
  };

  const handleBack = () => {
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
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButtonPressable} onPress={handleBack} activeOpacity={0.78}>
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
        <Text style={[styles.title, { color: palette.primaryText }]}>Receive</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={[styles.subtitle, { color: '#111827' }]}>Scan with a Solana Pay wallet. USDC is preferred, SOL is supported.</Text>

      <GlassView style={styles.assetToggle} intensity={24} interactive>
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
      </GlassView>

      <GlassView style={styles.qrCard} intensity={30} interactive>
        <View style={styles.qrFrame}>
          <QRCode
            value={solanaPayUri || solanaAddress || 'No wallet'}
            size={240}
            color="#000000"
            backgroundColor="#ffffff"
          />
        </View>
        <Text selectable style={styles.addressLines}>{getWrappedAddress()}</Text>
      </GlassView>

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

      <TouchableOpacity style={styles.copyButtonPressable} onPress={handleCopyWallet} activeOpacity={0.78}>
        <GlassView style={styles.copyButton} intensity={24} interactive>
          <CopyIcon size={18} color="#111827" />
          <Text style={styles.copyButtonText}>Copy wallet address</Text>
        </GlassView>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: 'continuous',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 8,
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
  headerSpacer: {
    width: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    marginBottom: 24,
    textAlign: 'center',
  },
  assetToggle: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
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
    backgroundColor: 'rgba(255,255,255,0.85)',
    boxShadow: '0 3px 6px rgba(0, 0, 0, 0.06)',
  },
  assetToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  assetToggleTextActive: {
    color: '#111827',
  },
  qrCard: {
    width: '100%',
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
    paddingVertical: 14,
    paddingHorizontal: 12,
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
    color: '#111827',
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
    color: '#111827',
  },
  toggleHelpIcon: {
    fontWeight: '700',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  copyButtonPressable: {
    width: '100%',
    borderRadius: 16,
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
});
