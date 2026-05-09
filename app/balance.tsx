import { useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchSolanaUsdcBalance } from '@/utils/balanceService';
import { formatTokenAmountDisplay } from '@/utils/numberFormat';
import { getSponsoredSolanaWallet } from '@/utils/sponsoredWalletStorage';

type AssetLogo = 'sol' | 'usdc' | 'usdt' | 'avalanche-usdc' | 'avax' | 'arsc';

type AssetBalance = {
  key: string;
  logo: AssetLogo;
  name: string;
  amount: string;
  isActive?: boolean;
  isSoon?: boolean;
};

function formatBalanceAmount(value: number | null | undefined, isLoading: boolean) {
  if (isLoading) return '...';

  return formatTokenAmountDisplay(value ?? 0, {
    context: 'detailed',
    tokenPriceUsd: 1,
    tokenDecimals: 6,
  });
}

function TokenIcon({ logo }: { logo: AssetLogo }) {
  switch (logo) {
    case 'sol':
      return (
        <View style={[styles.logo, styles.solanaLogo]}>
          <LinearGradient
            colors={['#35F0D0', '#7D5CFF']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.solanaBar}
          />
          <LinearGradient
            colors={['#7D5CFF', '#36E1C9']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.solanaBar}
          />
          <LinearGradient
            colors={['#35F0D0', '#7D5CFF']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.solanaBar}
          />
        </View>
      );
    case 'usdc':
      return (
        <View style={[styles.logo, styles.usdcLogo]}>
          <Text maxFontSizeMultiplier={1.05} style={styles.usdcGlyph}>$</Text>
        </View>
      );
    case 'usdt':
      return (
        <View style={[styles.logo, styles.usdtLogo]}>
          <Text maxFontSizeMultiplier={1.05} style={styles.usdtGlyph}>T</Text>
          <View style={styles.usdtCrossbar} />
        </View>
      );
    case 'avalanche-usdc':
      return (
        <View style={[styles.logo, styles.avalancheLogo]}>
          <View style={styles.avalanchePeak} />
          <View style={styles.avalancheUsdcBadge}>
            <Text maxFontSizeMultiplier={1.05} style={styles.avalancheUsdcGlyph}>$</Text>
          </View>
        </View>
      );
    case 'avax':
      return (
        <View style={[styles.logo, styles.avalancheLogo]}>
          <View style={styles.avalanchePeak} />
          <View style={styles.avalanchePeakSmall} />
        </View>
      );
    case 'arsc':
      return (
        <View style={[styles.logo, styles.argentinaLogo]}>
          <View style={styles.argentinaStripeTop} />
          <View style={styles.argentinaStripeMiddle} />
          <View style={styles.argentinaStripeBottom} />
          <View style={styles.argentinaSun} />
        </View>
      );
  }
}

function AssetRow({ item, index }: { item: AssetBalance; index: number }) {
  const textStyle = item.isActive ? styles.activeText : styles.inactiveText;

  return (
    <View style={[styles.assetRow, index > 0 ? styles.assetRowDivider : null]}>
      <View style={styles.assetIdentity}>
        <TokenIcon logo={item.logo} />
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={1.05}
          style={[styles.assetName, textStyle]}
        >
          {item.name}
        </Text>
      </View>
      {item.isSoon ? (
        <View style={styles.soonBadge}>
          <Text maxFontSizeMultiplier={1.05} style={styles.soonText}>
            Soon
          </Text>
        </View>
      ) : (
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={1.05}
          style={[styles.assetAmount, textStyle]}
        >
          {item.amount}
        </Text>
      )}
    </View>
  );
}

export default function BalanceScreen() {
  const insets = useSafeAreaInsets();
  const { user, isReady } = usePrivy();
  const { wallets: solanaWallets } = useEmbeddedSolanaWallet();
  const [solanaUsdcBalance, setSolanaUsdcBalance] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [sponsoredWalletAddress, setSponsoredWalletAddress] = useState<string | null>(null);

  const solanaAddress = sponsoredWalletAddress ?? solanaWallets?.[0]?.publicKey ?? null;

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
    const loadBalances = async () => {
      if (!isReady) return;

      if (!solanaAddress) {
        setSolanaUsdcBalance(0);
        setIsLoadingBalance(false);
        return;
      }

      try {
        setIsLoadingBalance(true);
        const nextBalance = await fetchSolanaUsdcBalance(solanaAddress);
        setSolanaUsdcBalance(nextBalance);
      } catch (error) {
        console.error('Failed to load balances', error);
        setSolanaUsdcBalance(0);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    void loadBalances();
  }, [isReady, solanaAddress]);

  const assetBalances = useMemo<AssetBalance[]>(() => {
    return [
      {
        key: 'solana-usdc',
        logo: 'usdc',
        name: 'Solana USDC',
        amount: `${formatBalanceAmount(solanaUsdcBalance, isLoadingBalance)} USDC`,
        isActive: solanaUsdcBalance > 0,
      },
    ];
  }, [isLoadingBalance, solanaUsdcBalance]);

  return (
    <ScrollView
      bounces={false}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      style={styles.sheet}
      contentContainerStyle={[
        styles.sheetContent,
        { paddingBottom: Math.max(insets.bottom, 0) + 28 },
      ]}
    >
      <Text maxFontSizeMultiplier={1.05} style={styles.title}>
        Balance
      </Text>
      <Text maxFontSizeMultiplier={1.05} style={styles.subtitle}>
        Your spendable USDC balance on Solana
      </Text>

      <View style={styles.assetCard}>
        {assetBalances.map((item, index) => (
          <AssetRow key={item.key} item={item} index={index} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: '#1F1F1F',
  },
  sheetContent: {
    paddingTop: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.58)',
    maxWidth: 360,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: 0,
    textAlign: 'center',
  },
  assetCard: {
    width: '100%',
    marginTop: 22,
    overflow: 'hidden',
    borderRadius: 30,
    borderCurve: 'continuous',
    backgroundColor: '#303030',
  },
  assetRow: {
    minHeight: 63,
    paddingHorizontal: 21,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  assetRowDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.075)',
  },
  assetIdentity: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  assetName: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: 0,
  },
  assetAmount: {
    maxWidth: 140,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  activeText: {
    color: '#FFFFFF',
  },
  inactiveText: {
    color: 'rgba(255,255,255,0.48)',
  },
  soonBadge: {
    minWidth: 58,
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  soonText: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  solanaLogo: {
    gap: 3,
    backgroundColor: '#020202',
  },
  solanaBar: {
    width: 22,
    height: 5,
    borderRadius: 2.5,
    transform: [{ skewX: '-18deg' }],
  },
  usdcLogo: {
    backgroundColor: '#2775CA',
  },
  usdcGlyph: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '900',
  },
  usdtLogo: {
    backgroundColor: '#26A17B',
  },
  usdtGlyph: {
    color: '#FFFFFF',
    fontSize: 21,
    lineHeight: 24,
    fontWeight: '900',
  },
  usdtCrossbar: {
    position: 'absolute',
    top: 11,
    width: 21,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  avalancheLogo: {
    backgroundColor: '#E84142',
  },
  avalanchePeak: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
  },
  avalanchePeakSmall: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
  },
  avalancheUsdcBadge: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 13,
    height: 13,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2775CA',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  avalancheUsdcGlyph: {
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 10,
    fontWeight: '900',
  },
  argentinaLogo: {
    backgroundColor: '#FFFFFF',
  },
  argentinaStripeTop: {
    position: 'absolute',
    top: 0,
    width: '100%',
    height: 11,
    backgroundColor: '#75AADB',
  },
  argentinaStripeMiddle: {
    position: 'absolute',
    top: 11,
    width: '100%',
    height: 12,
    backgroundColor: '#FFFFFF',
  },
  argentinaStripeBottom: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 11,
    backgroundColor: '#75AADB',
  },
  argentinaSun: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F6B40E',
  },
});
