import { StyleSheet, View, Text, TouchableOpacity, Image, useColorScheme, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/theme';

export default function WithdrawScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

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
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.containerContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={[styles.iconButton, { backgroundColor: palette.surfaceMuted, borderColor: palette.borderSubtle }]} 
          onPress={handleBack}
        >
          <MaterialIcons name="arrow-back" size={20} color={palette.primaryText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.primaryText }]}>Withdraw</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={[styles.headline, { color: palette.primaryText }]}>Choose withdrawing method</Text>

      {/* Options Container */}
      <View style={styles.optionsContainer}>
        {/* Crypto Option */}
        <TouchableOpacity 
          style={[styles.optionItem, { backgroundColor: palette.surface, borderColor: palette.borderSubtle }]}
          onPress={handleCrypto}
          activeOpacity={0.7}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.iconCircle, { backgroundColor: palette.surfaceMuted }]}>
              <MaterialIcons name="credit-card" size={24} color={palette.primaryText} />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: palette.primaryText }]}>Crypto</Text>
              <Text style={[styles.optionSubtitle, { color: palette.secondaryText }]}>Withdraw to a wallet address</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={palette.secondaryText} />
        </TouchableOpacity>

        {/* Mercado Pago Option */}
        <TouchableOpacity 
          style={[styles.optionItem, { backgroundColor: palette.surface, borderColor: palette.borderSubtle }]}
          onPress={handleMercadoPago}
          activeOpacity={0.7}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.iconCircle, { backgroundColor: palette.surfaceMuted }]}>
              <Image 
                source={require('../assets/images/mp.png')} 
                style={styles.mpImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: palette.primaryText }]}>Mercado Pago</Text>
              <Text style={[styles.optionSubtitle, { color: palette.secondaryText }]}>Instant transfers</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={palette.secondaryText} />
        </TouchableOpacity>

        {/* To Bank Option */}
        <TouchableOpacity 
          style={[styles.optionItem, { backgroundColor: palette.surface, borderColor: palette.borderSubtle }]}
          onPress={handleBank}
          activeOpacity={0.7}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.iconCircle, { backgroundColor: palette.surfaceMuted }]}>
              <MaterialIcons name="account-balance" size={24} color={palette.primaryText} />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: palette.primaryText }]}>To Bank</Text>
              <Text style={[styles.optionSubtitle, { color: palette.secondaryText }]}>Standard bank withdrawal</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={palette.secondaryText} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  optionsContainer: {
    gap: 12,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  mpImage: {
    width: 28,
    height: 28,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 13,
  },
});
