import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

// Icon components
function CreditCardIcon({ size = 28, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M1 4h22v16H1zM1 8h22" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BankIcon({ size = 28, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M8 10v11M12 10v11M16 10v11M20 10v11" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function WithdrawScreen() {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  const handleCrypto = () => {
    router.push({
      pathname: '/withdraw-amount',
      params: { method: 'crypto' }
    });
  };

  const handleMercadoPago = () => {
    router.push({
      pathname: '/withdraw-amount',
      params: { method: 'mercadopago' }
    });
  };

  const handleBank = () => {
    router.push({
      pathname: '/withdraw-amount',
      params: { method: 'bank' }
    });
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

      {/* Section Title */}
      <Text style={styles.sectionTitle}>Choose withdrawing method</Text>

      {/* Options Container */}
      <View style={styles.optionsContainer}>
        {/* Crypto Option */}
        <TouchableOpacity 
          style={styles.optionItem}
          onPress={handleCrypto}
          activeOpacity={0.8}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.iconCircle, { backgroundColor: '#FFD700' }]}>
              <CreditCardIcon size={28} color="#000" />
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>Crypto</Text>
              <Text style={styles.optionSubtitle}>Withdraw to a wallet address</Text>
            </View>
          </View>
          <View style={styles.arrowButton}>
            <Text style={styles.arrowIcon}>›</Text>
          </View>
        </TouchableOpacity>

        {/* Mercado Pago Option */}
        <TouchableOpacity 
          style={styles.optionItem}
          onPress={handleMercadoPago}
          activeOpacity={0.8}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.iconCircle, { backgroundColor: '#00A8E1' }]}>
              <Image 
                source={require('../assets/images/mp.png')} 
                style={styles.mpImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>Mercado Pago</Text>
              <Text style={styles.optionSubtitle}>Instant transfers</Text>
            </View>
          </View>
          <View style={styles.arrowButton}>
            <Text style={styles.arrowIcon}>›</Text>
          </View>
        </TouchableOpacity>

        {/* To Bank Option */}
        <TouchableOpacity 
          style={[styles.optionItem, styles.lastOptionItem]}
          onPress={handleBank}
          activeOpacity={0.8}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.iconCircle, { backgroundColor: '#FFD700' }]}>
              <BankIcon size={28} color="#000" />
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>To Bank</Text>
              <Text style={styles.optionSubtitle}>Standard bank withdrawal</Text>
            </View>
          </View>
          <View style={styles.arrowButton}>
            <Text style={styles.arrowIcon}>›</Text>
          </View>
        </TouchableOpacity>
      </View>
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
  optionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  lastOptionItem: {
    borderBottomWidth: 0,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  mpImage: {
    width: 32,
    height: 32,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  arrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF69B4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowIcon: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
});
