import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function DepositScreen() {
  const router = useRouter();

  const handleClose = () => {
    router.back();
  };

  const handleCryptoDeposit = () => {
    router.push('/crypto-deposit');
  };

  const handleFiatDeposit = () => {
    console.log('Fiat deposit selected');
    // Navigate to fiat deposit screen or handle fiat deposit
  };

  return (
    <View style={styles.container}>
      {/* Close Button */}
      <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
        <Text style={styles.closeIcon}>✕</Text>
      </TouchableOpacity>

      {/* Title */}
      <Text style={styles.title}>What would you like to deposit?</Text>

      {/* Options Container */}
      <View style={styles.optionsContainer}>
        {/* Crypto Option */}
        <TouchableOpacity 
          style={styles.optionCard}
          onPress={handleCryptoDeposit}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: '#60A5FA' }]}>
              <Text style={styles.iconText}>$</Text>
            </View>
            <View style={[styles.iconCircle, { backgroundColor: '#10b981', marginLeft: -15 }]}>
              <Text style={styles.iconText}>₮</Text>
            </View>
          </View>
          <Text style={styles.optionTitle}>Crypto</Text>
          <Text style={styles.optionSubtitle}>USDC, USDT</Text>
        </TouchableOpacity>

        {/* Fiat Option */}
        <TouchableOpacity 
          style={styles.optionCard}
          onPress={handleFiatDeposit}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: '#60A5FA' }]}>
              <Text style={styles.flagEmoji}>🇦🇷</Text>
            </View>
          </View>
          <Text style={styles.optionTitle}>Fiat</Text>
          <Text style={styles.optionSubtitle}>Pesos Argentinos (ARS)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 20,
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeIcon: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 60,
    paddingHorizontal: 20,
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 10,
  },
  optionCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#333333',
    padding: 30,
    alignItems: 'flex-start',
    minHeight: 250,
  },
  iconContainer: {
    flexDirection: 'row',
    marginBottom: 30,
    height: 60,
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  flagEmoji: {
    fontSize: 32,
  },
  optionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  optionSubtitle: {
    fontSize: 16,
    color: '#999999',
    lineHeight: 24,
  },
});