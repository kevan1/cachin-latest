import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { fetchAllTokenBalances, type TokenBalances } from '@/utils/balanceService';
import { fetchTokenPrices, type TokenPrices } from '@/utils/priceService';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';

export default function BalanceScreen() {
  const router = useRouter();

  const [balances, setBalances] = useState<TokenBalances>({ sol: 0, usdc: 0, usdt: 0 });
  const [prices, setPrices] = useState<TokenPrices>({ sol: 0, usdc: 1, usdt: 1, mon: 0 });
  const [loading, setLoading] = useState(false);

  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];

  const getAddress = () => {
    if (wallet?.publicKey) {
      return wallet.publicKey;
    }
    return null;
  };

  useEffect(() => {
    const load = async () => {
      const address = getAddress();
      if (!address) return;
      try {
        setLoading(true);
        const [bals, prs] = await Promise.all([
          fetchAllTokenBalances(address),
          fetchTokenPrices(),
        ]);
        setBalances(bals);
        setPrices(prs);
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalUsd = balances.sol * prices.sol + balances.usdc * prices.usdc + balances.usdt * prices.usdt;
  const arsRate = 1500;
  const arsValue = totalUsd * arsRate;

  const handleBack = () => router.back();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Balance</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={{ flex: 1 }}>
        <View style={styles.list}>
          {/* SOL */}
          <View style={styles.item}>
            <View style={styles.left}>
              <View style={[styles.iconCircle, { backgroundColor: '#7C3AED' }]}>
                <Text style={styles.iconText}>◎</Text>
              </View>
              <Text style={styles.name}>Solana (SOL)</Text>
            </View>
            <Text style={styles.amount}>{balances.sol.toFixed(4)}</Text>
          </View>

          {/* USDC */}
          <View style={styles.item}>
            <View style={styles.left}>
              <View style={[styles.iconCircle, { backgroundColor: '#2563EB' }]}>
                <Text style={styles.iconText}>Ⓢ</Text>
              </View>
              <Text style={styles.name}>USD Coin (USDC)</Text>
            </View>
            <Text style={styles.amount}>{balances.usdc.toFixed(2)}</Text>
          </View>

          {/* USDT */}
          <View style={styles.item}>
            <View style={styles.left}>
              <View style={[styles.iconCircle, { backgroundColor: '#059669' }]}>
                <Text style={styles.iconText}>₮</Text>
              </View>
              <Text style={styles.name}>Tether (USDT)</Text>
            </View>
            <Text style={styles.amount}>{balances.usdt.toFixed(2)}</Text>
          </View>

          {/* ARS */}
          <View style={[styles.item, styles.lastItem]}>
            <View style={styles.left}>
              <View style={[styles.iconCircle, { backgroundColor: '#60A5FA' }]}>
                <Text style={styles.iconText}>🇦🇷</Text>
              </View>
              <Text style={styles.name}>Argentine Peso (ARS)</Text>
            </View>
            <Text style={styles.amount}>{arsValue.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>
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
  placeholder: { width: 50 },
  list: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  lastItem: { borderBottomWidth: 0 },
  left: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: { fontSize: 22 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#000000' },
  amount: { fontSize: 18, fontWeight: 'bold', color: '#000000' },
});