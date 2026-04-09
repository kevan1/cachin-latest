import { StyleSheet, View, Text, TouchableOpacity, useColorScheme, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/theme';
import { GlassView } from '@/components/ui/GlassView';

export default function DepositScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const handleBack = () => {
    router.back();
  };

  const handleCrypto = () => {
    router.push('/crypto-deposit');
  };

  const handleBank = () => {
    router.push('/fiat-deposit');
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: 'transparent' }]}
      contentContainerStyle={styles.containerContent}
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
        <Text style={[styles.headerTitle, { color: palette.primaryText }]}>Deposit</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={[styles.headline, { color: palette.primaryText }]}>Choose deposit method</Text>

      <View style={styles.optionsContainer}>
        <TouchableOpacity style={styles.optionPressable} onPress={handleCrypto} activeOpacity={0.78}>
          <GlassView
            style={[
              styles.optionItem,
              {
                borderColor:
                  colorScheme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.52)',
              },
            ]}
            intensity={30}
            interactive
          >
            <View style={styles.optionLeft}>
              <GlassView style={styles.iconCircle} intensity={24} interactive>
                <MaterialIcons name="account-balance-wallet" size={24} color={palette.primaryText} />
              </GlassView>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: palette.primaryText }]}>Crypto</Text>
                <Text style={[styles.optionSubtitle, { color: palette.secondaryText }]}>
                  Receive assets via wallet address
                </Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={palette.secondaryText} />
          </GlassView>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionPressable} onPress={handleBank} activeOpacity={0.78}>
          <GlassView
            style={[
              styles.optionItem,
              {
                borderColor:
                  colorScheme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.52)',
              },
            ]}
            intensity={30}
            interactive
          >
            <View style={styles.optionLeft}>
              <GlassView style={styles.iconCircle} intensity={24} interactive>
                <MaterialIcons name="account-balance" size={24} color={palette.primaryText} />
              </GlassView>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: palette.primaryText }]}>Bank</Text>
                <Text style={[styles.optionSubtitle, { color: palette.secondaryText }]}>
                  Receive assets via virtual bank account
                </Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={palette.secondaryText} />
          </GlassView>
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
    paddingBottom: 28,
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
  iconButtonPressable: {
    borderRadius: 20,
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
  optionPressable: {
    borderRadius: 16,
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
