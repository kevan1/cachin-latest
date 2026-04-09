import { StyleSheet, View, Text, TouchableOpacity, Alert, useColorScheme, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/theme';
import { GlassView } from '@/components/ui/GlassView';

type FiatCurrency = 'usd' | 'eur';

export default function FiatDepositScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [fiatCurrency, setFiatCurrency] = useState<FiatCurrency>('usd');

  const handleBack = () => {
    router.back();
  };

  const handleCreate = () => {
    Alert.alert('Coming soon', 'Fiat account creation will be available soon.');
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
        <Text style={[styles.headerTitle, { color: palette.primaryText }]}>Receive</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={[styles.subtitle, { color: palette.secondaryText }]}>
        Receive stablecoins via Virtual Bank Account
      </Text>

      <View style={styles.fiatToggleRow}>
        <TouchableOpacity
          style={styles.togglePressable}
          onPress={() => setFiatCurrency('usd')}
          activeOpacity={0.78}
        >
          <GlassView style={[styles.fiatToggleChip, fiatCurrency === 'usd' && styles.fiatToggleChipActive]} intensity={24} interactive>
            <MaterialIcons
              name="attach-money"
              size={16}
              color={fiatCurrency === 'usd' ? '#111827' : '#6B7280'}
            />
            <Text style={[styles.fiatToggleText, fiatCurrency === 'usd' && styles.fiatToggleTextActive]}>USD</Text>
          </GlassView>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.togglePressable}
          onPress={() => setFiatCurrency('eur')}
          activeOpacity={0.78}
        >
          <GlassView style={[styles.fiatToggleChip, fiatCurrency === 'eur' && styles.fiatToggleChipActive]} intensity={24} interactive>
            <MaterialIcons
              name="euro-symbol"
              size={16}
              color={fiatCurrency === 'eur' ? '#111827' : '#6B7280'}
            />
            <Text style={[styles.fiatToggleText, fiatCurrency === 'eur' && styles.fiatToggleTextActive]}>EUR</Text>
          </GlassView>
        </TouchableOpacity>
      </View>

      <GlassView style={styles.fiatCard} intensity={28} interactive>
        <View style={styles.fiatCardHeader}>
          <View style={styles.fiatFlagCircle}>
            <MaterialIcons
              name={fiatCurrency === 'usd' ? 'attach-money' : 'euro-symbol'}
              size={20}
              color="#111827"
            />
          </View>
          <View>
            <Text style={styles.fiatCardTitle}>
              {fiatCurrency === 'usd' ? 'Virtual US Bank Account' : 'Virtual EU Bank Account'}
            </Text>
            <Text style={styles.fiatCardSubtitle}>
              {fiatCurrency === 'usd' ? 'Accept ACH Payments' : 'Accept SEPA Payments'}
            </Text>
          </View>
        </View>

        <View style={styles.fiatDivider} />

        <View style={styles.fiatBulletRow}>
          <MaterialIcons name="check-circle" size={14} color="#22c55e" />
          <Text style={styles.fiatBulletText}>
            Get paid in {fiatCurrency === 'usd' ? 'USD' : 'EUR'} and automatically receive USDC in your wallet.
          </Text>
        </View>
        <View style={styles.fiatBulletRow}>
          <MaterialIcons name="check-circle" size={14} color="#8b5cf6" />
          <Text style={styles.fiatBulletText}>
            Receive payments from anyone with a bank account.
          </Text>
        </View>
        <View style={styles.fiatBulletRow}>
          <MaterialIcons name="check-circle" size={14} color="#fb923c" />
          <Text style={styles.fiatBulletText}>
            Quick setup through Bridge with standard KYC verification.
          </Text>
        </View>
      </GlassView>

      <Text style={styles.fiatFootnote}>Unavailable for NY residents.</Text>

      <TouchableOpacity style={styles.ctaPressable} onPress={handleCreate} activeOpacity={0.78}>
        <GlassView style={styles.fiatCta} intensity={24} interactive>
          <Text style={styles.fiatCtaText}>Create with Fuse+</Text>
        </GlassView>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
    fontSize: 20,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 6,
  },
  fiatToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  togglePressable: {
    borderRadius: 999,
  },
  fiatToggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  fiatToggleChipActive: {
    borderColor: 'rgba(224,231,255,0.9)',
  },
  fiatToggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  fiatToggleTextActive: {
    color: '#111827',
  },
  fiatFlag: {
    fontSize: 16,
  },
  fiatCard: {
    width: '100%',
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
    padding: 16,
    gap: 12,
  },
  fiatCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fiatFlagCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fiatCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  fiatCardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  fiatDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  fiatBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fiatBulletIcon: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  fiatBulletText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
  },
  fiatFootnote: {
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
  },
  ctaPressable: {
    borderRadius: 999,
  },
  fiatCta: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fiatCtaText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
});
