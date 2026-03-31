import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useEmbeddedEthereumWallet, useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo';

import { ChainType } from '@/constants/chains';
import { type ChainFilter } from '@/utils/chainStorage';
import {
  fetchMultiChainBalances,
  type MultiChainBalances,
} from '@/utils/multiChainBalanceService';
import { getSponsoredSolanaWallet } from '@/utils/sponsoredWalletStorage';
import {
  loadAvalancheWalletSource,
  loadSatochipAvalancheAddress,
  type AvalancheWalletSource,
} from "@/utils/satochipStorage";

const EMPTY_BALANCES: MultiChainBalances = {
  solana: null,
  avalanche: null,
  totalUsd: 0,
};

export default function BalanceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, isReady } = usePrivy();
  const { wallets: solanaWallets } = useEmbeddedSolanaWallet();
  const { wallets: ethereumWallets } = useEmbeddedEthereumWallet();

  const chainParam = Array.isArray(params.chain) ? params.chain[0] : params.chain;
  const selectedChain: ChainFilter =
    chainParam === ChainType.SOLANA ||
    chainParam === ChainType.AVALANCHE ||
    chainParam === 'all'
      ? chainParam
      : 'all';

  const [balances, setBalances] = useState<MultiChainBalances>(EMPTY_BALANCES);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [sponsoredWalletAddress, setSponsoredWalletAddress] = useState<string | null>(null);
  const [avalancheWalletSource, setAvalancheWalletSource] =
    useState<AvalancheWalletSource>("privy");
  const [satochipAvalancheAddress, setSatochipAvalancheAddress] = useState<string | null>(null);

  const solanaAddress = sponsoredWalletAddress ?? solanaWallets?.[0]?.publicKey ?? null;
  const avalancheAddress =
    avalancheWalletSource === "satochip"
      ? satochipAvalancheAddress
      : ethereumWallets?.[0]?.address ?? null;

  useEffect(() => {
    if (!isReady) return;

    if (!user?.id) {
      setSponsoredWalletAddress(null);
      return;
    }

    getSponsoredSolanaWallet(user.id)
      .then(({ address }) => {
        setSponsoredWalletAddress(address);
      })
      .catch(() => {
        setSponsoredWalletAddress(null);
      });
  }, [isReady, user?.id]);

  useEffect(() => {
    Promise.all([loadAvalancheWalletSource(), loadSatochipAvalancheAddress()])
      .then(([source, address]) => {
        setAvalancheWalletSource(source);
        setSatochipAvalancheAddress(address);
      })
      .catch((error) => {
        console.error("Failed to load Avalanche wallet source", error);
      });
  }, []);

  useEffect(() => {
    const loadBalances = async () => {
      if (!solanaAddress && !avalancheAddress) {
        setBalances(EMPTY_BALANCES);
        setIsLoadingBalance(false);
        return;
      }

      try {
        setIsLoadingBalance(true);
        const nextBalances = await fetchMultiChainBalances(solanaAddress, avalancheAddress);
        setBalances(nextBalances);
      } catch (error) {
        console.error('Failed to load balances', error);
        setBalances(EMPTY_BALANCES);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    void loadBalances();
  }, [avalancheAddress, solanaAddress]);

  const totalUsd = useMemo(() => {
    if (selectedChain === ChainType.SOLANA) {
      return balances.solana?.totalUsd ?? 0;
    }

    if (selectedChain === ChainType.AVALANCHE) {
      return balances.avalanche?.totalUsd ?? 0;
    }

    return balances.totalUsd;
  }, [balances, selectedChain]);

  const rows = useMemo(() => {
    const nextRows: { label: string; amount: string; color: string; icon: string }[] = [];

    if (selectedChain !== ChainType.AVALANCHE && balances.solana) {
      nextRows.push({
        label: 'Solana (SOL)',
        amount: balances.solana.nativeBalance.toFixed(4),
        color: '#7C3AED',
        icon: '◎',
      });
      nextRows.push({
        label: 'USD Coin (USDC)',
        amount: balances.solana.usdcBalance.toFixed(2),
        color: '#2563EB',
        icon: 'Ⓢ',
      });
      nextRows.push({
        label: 'Tether (USDT)',
        amount: balances.solana.usdtBalance.toFixed(2),
        color: '#059669',
        icon: '₮',
      });
    }

    if (selectedChain !== ChainType.SOLANA && balances.avalanche) {
      nextRows.push({
        label: 'Avalanche Fuji USDC',
        amount: balances.avalanche.usdcBalance.toFixed(2),
        color: '#2563EB',
        icon: 'Ⓢ',
      });
      nextRows.push({
        label: 'Avalanche Fuji (AVAX)',
        amount: balances.avalanche.nativeBalance.toFixed(4),
        color: '#DC2626',
        icon: 'A',
      });
    }

    return nextRows;
  }, [balances, selectedChain]);

  const arsRate = 1500;
  const arsValue = totalUsd * arsRate;
  const handleBack = () => router.back();

  const title =
    selectedChain === ChainType.SOLANA
      ? 'Solana balance'
      : selectedChain === ChainType.AVALANCHE
        ? 'Avalanche Fuji balance'
        : 'Balance';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={{ flex: 1 }}>
        <View style={styles.list}>
          {isLoadingBalance ? (
            <View style={[styles.item, styles.lastItem]}>
              <Text style={styles.emptyText}>Loading balances...</Text>
            </View>
          ) : rows.length === 0 ? (
            <View style={[styles.item, styles.lastItem]}>
              <Text style={styles.emptyText}>No wallet connected for this chain yet.</Text>
            </View>
          ) : (
            <>
              {rows.map((row) => (
                <View
                  key={row.label}
                  style={styles.item}
                >
                  <View style={styles.left}>
                    <View style={[styles.iconCircle, { backgroundColor: row.color }]}>
                      <Text style={styles.iconText}>{row.icon}</Text>
                    </View>
                    <Text style={styles.name}>{row.label}</Text>
                  </View>
                  <Text style={styles.amount}>{row.amount}</Text>
                </View>
              ))}
              <View style={[styles.item, styles.lastItem]}>
                <View style={styles.left}>
                  <View style={[styles.iconCircle, { backgroundColor: '#60A5FA' }]}>
                    <Text style={styles.iconText}>🇦🇷</Text>
                  </View>
                  <Text style={styles.name}>Argentine Peso (ARS)</Text>
                </View>
                <Text style={styles.amount}>{arsValue.toFixed(2)}</Text>
              </View>
            </>
          )}
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
    textTransform: 'capitalize',
  },
  placeholder: {
    width: 50,
  },
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
  lastItem: {
    borderBottomWidth: 0,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
});
