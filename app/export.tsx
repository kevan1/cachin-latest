import { StyleSheet, View, Text, TouchableOpacity, Alert, Linking, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import Svg, { Path } from 'react-native-svg';

// Icon components
function LockIcon({ size = 60, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function WarningIcon({ size = 20, color = '#D97706' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ExportPrivateKeyScreen() {
  const router = useRouter();
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  
  const [isExporting, setIsExporting] = useState(false);

  // Replace with your actual export page URL
  // Example: const exportUrl = `https://yourapp.com/export?address=${wallet?.publicKey}`;
  const exportUrl = useMemo(() => {
    if (!wallet?.publicKey) return null;
    return `https://auth.kevan.ar/export?address=${encodeURIComponent(wallet.publicKey)}`;
  }, [wallet?.publicKey]);

  const handleBack = () => {
    router.back();
  };

  const handleExport = async () => {
    if (!wallet?.publicKey) {
      Alert.alert('Error', 'No wallet found');
      return;
    }

    if (exportUrl) {
      setIsExporting(true);
      Linking.openURL(exportUrl).catch(err => {
        console.error('Failed to open URL:', err);
        Alert.alert('Error', 'Could not open web page');
      }).finally(() => setIsExporting(false));
      return;
    }

    Alert.alert(
      'Export via Web',
      'Private key export is only available through your app’s web experience for security reasons. Your wallet address:\n' + wallet.publicKey,
      [
        {
          text: 'OK',
          style: 'default',
        },
      ]
    );
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Text style={styles.backIcon}>‹</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconContainer}>
          <LockIcon size={60} color="#000" />
        </View>
        <Text style={styles.headerTitle}>Export Private Key</Text>
        <Text style={styles.headerSubtitle}>
          Securely export your wallet&apos;s private key to use with other wallet clients
        </Text>
      </View>

      {/* Info Sections */}
      <View style={styles.infoSection}>
        <View style={styles.warningCard}>
          <View style={styles.warningTitleContainer}>
            <WarningIcon size={20} color="#D97706" />
            <Text style={styles.warningTitle}>Important Security Notes</Text>
          </View>
          <Text style={styles.warningText}>
            • Private key export is only available via web for security reasons{'\n'}
            • Never share your private key with anyone{'\n'}
            • Anyone with your private key has complete control of your wallet{'\n'}
            • Store exported keys securely (written down, not digitally){'\n'}
            • Use a secure, private device when exporting
          </Text>
        </View>
        
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Export via Web Only</Text>
          <Text style={styles.infoText}>
            Private key export runs only in your web browser for maximum safety:{'\n'}
            • The key is assembled on a separate domain{'\n'}
            • Neither Privy nor this app can access your key{'\n'}{'\n'}
            To export:{'\n'}
            1) Open https://auth.kevan.ar/export{'\n'}
            2) Log in with this account{'\n'}
            3) Use the export feature
          </Text>
        </View>
      </View>

      {/* Export Button */}
      <TouchableOpacity 
        style={[styles.exportButton, isExporting && styles.exportButtonDisabled]} 
        onPress={handleExport}
        disabled={isExporting}
      >
        <LockIcon size={20} color="#000" />
        <Text style={styles.exportButtonText}>
          {exportUrl ? 'Open Web Export' : 'View Export Instructions'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingBottom: 40,
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
    margin: 20,
  },
  backIcon: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
  },
  header: {
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 30,
  },
  headerIconContainer: {
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
  infoSection: {
    marginHorizontal: 20,
    gap: 15,
  },
  infoCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 15,
    color: '#333333',
    lineHeight: 22,
  },
  infoBullet: {
    fontSize: 15,
    color: '#333333',
    lineHeight: 24,
    marginLeft: 5,
  },
  warningCard: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFA500',
    padding: 20,
  },
  warningTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  warningText: {
    fontSize: 15,
    color: '#333333',
    lineHeight: 24,
  },
  linkText: {
    fontSize: 14,
    color: '#B8A5E8',
    fontFamily: 'monospace',
    marginTop: 8,
  },
  exportButton: {
    flexDirection: 'row',
    backgroundColor: '#B8A5E8',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    paddingVertical: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 30,
    boxShadow: '4px 4px 0px rgba(0, 0, 0, 1)',
  },
  exportButtonDisabled: {
    backgroundColor: '#E5E5E5',
    opacity: 0.6,
  },
  exportButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  keySection: {
    marginHorizontal: 20,
    marginTop: 30,
  },
  keyCard: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#FFA500',
    padding: 20,
  },
  keyTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  keyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  keyWarningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  keyWarning: {
    fontSize: 14,
    color: '#D97706',
    fontWeight: '600',
    flex: 1,
  },
  keyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 15,
    marginBottom: 15,
  },
  keyText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#000000',
    minHeight: 100,
  },
  copyButton: {
    flexDirection: 'row',
    backgroundColor: '#B8A5E8',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
});
