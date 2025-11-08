import { StyleSheet, View, Text, TouchableOpacity, Alert, TextInput, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { useState } from 'react';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path } from 'react-native-svg';

// Icon components
function LockIcon({ size = 60, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function KeyIcon({ size = 20, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function CopyIcon({ size = 16, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-2M16 4h2a2 2 0 012 2v2M16 4v4M16 4h-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ExportPrivateKeyScreen() {
  const router = useRouter();
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportedKey, setExportedKey] = useState<string>('');

  const handleBack = () => {
    router.back();
  };

  const handleCopyKey = async () => {
    if (exportedKey) {
      await Clipboard.setStringAsync(exportedKey);
      Alert.alert(
        'Copied', 
        'Seed phrase copied to clipboard.\n\nRemember: Clear your clipboard after storing it securely!'
      );
    }
  };

  const handleExport = async () => {
    if (!wallet?.publicKey) {
      Alert.alert('Error', 'No wallet found');
      return;
    }

    // TODO: Replace with your actual web export URL
    // For example: const exportUrl = `https://export.yourapp.com?address=${wallet.publicKey}`;
    const exportUrl = null; // Set this to your web export page URL

    if (exportUrl) {
      // If you have a web export page, open it
      Alert.alert(
        'Export via Web',
        'You will be redirected to a secure web page to export your wallet.\n\nYour wallet address:\n' + wallet.publicKey,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Open Web Page',
            style: 'default',
            onPress: () => {
              Linking.openURL(exportUrl).catch(err => {
                console.error('Failed to open URL:', err);
                Alert.alert('Error', 'Could not open web page');
              });
            },
          },
        ]
      );
    } else {
      // If no web export page is set up, show instructions
      Alert.alert(
        'Export via Web',
        'Due to security requirements, wallet private key export is only available through Privy\'s web interface.\n\nTo export your wallet:\n\n1. Visit your app\'s web version\n2. Log in with the same account\n3. Use the export wallet feature\n\nThis ensures maximum security through browser security guarantees.\n\nYour wallet address:\n' + wallet.publicKey,
        [
          {
            text: 'OK',
            style: 'default',
          },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
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

        {/* Info Sections - Only show warning before export */}
        {!exportedKey && (
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
                Due to security requirements, private key export is only available through a web browser. This is because:
                {'\n'}{'\n'}• Web browsers provide strict security guarantees
                {'\n'}• The private key is assembled on a separate domain
                {'\n'}• Neither Privy nor this app can access your key
                {'\n'}{'\n'}To export, you'll need to:
                {'\n'}1. Access your app's web version
                {'\n'}2. Log in with your same account
                {'\n'}3. Use the web export feature
              </Text>
            </View>
          </View>
        )}

        {/* Exported Key Display */}
        {exportedKey && (
          <View style={styles.keySection}>
            <View style={styles.keyCard}>
              <View style={styles.keyTitleContainer}>
                <KeyIcon size={20} color="#000" />
                <Text style={styles.keyTitle}>Your Recovery Phrase</Text>
              </View>
              <View style={styles.keyWarningContainer}>
                <WarningIcon size={16} color="#D97706" />
                <Text style={styles.keyWarning}>
                  Write this down and keep it secure. Anyone with this phrase can access your wallet.
                </Text>
              </View>
              
              <View style={styles.keyContainer}>
                <TextInput
                  style={styles.keyText}
                  value={exportedKey}
                  multiline
                  editable={false}
                  selectTextOnFocus
                />
              </View>
              
              <TouchableOpacity style={styles.copyButton} onPress={handleCopyKey}>
                <CopyIcon size={16} color="#000" />
                <Text style={styles.copyButtonText}>Copy Seed Phrase</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Export Button */}
        {!exportedKey && (
          <TouchableOpacity 
            style={[styles.exportButton, isExporting && styles.exportButtonDisabled]} 
            onPress={handleExport}
            disabled={isExporting}
          >
            <LockIcon size={20} color="#000" />
            <Text style={styles.exportButtonText}>
              View Export Instructions
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
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
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
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