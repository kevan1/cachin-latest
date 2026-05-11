import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Linking,
  Alert,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';

import { Transaction } from '@/types/types';
import { getMergedTransactions } from '@/utils/transactionListener';
import { getUsernameByAddress } from '@/services/firestoreService';
import { formatAmount } from '@/utils/formatAmount';
import { formatTokenAmountDisplay } from '@/utils/numberFormat';
import { getExplorerUrl, getChainSymbol, ChainType } from '@/constants/chains';
import { Colors } from '@/constants/theme';
import { GlassView } from '@/components/ui/GlassView';
import { useActiveSolanaWallet } from '@/hooks/useActiveSolanaWallet';

export default function ActivityScreen() {
  const router = useRouter();
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const palette = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const cardBorder = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.52)';

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [addressToUsername, setAddressToUsername] = useState<{ [address: string]: string }>({});

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['75%'], []);

  const activeSolanaWallet = useActiveSolanaWallet();

  const getFullSolanaAddress = useCallback(() => {
    return activeSolanaWallet.address;
  }, [activeSolanaWallet.address]);

  const fetchTransactions = useCallback(async (address: string) => {
    try {
      setIsLoading(true);
      const txs = await getMergedTransactions(address);
      setTransactions(txs);

      const uniqueAddresses = [...new Set(txs.map((tx) => tx.address))].filter(
        (addr) => Boolean(addr && addr.trim() !== '')
      );
      const usernameMap: { [address: string]: string } = {};

      await Promise.all(
        uniqueAddresses.map(async (addr) => {
          try {
            const username = await getUsernameByAddress(addr);
            if (username) {
              usernameMap[addr] = username;
            }
          } catch {
            // Ignore individual lookup errors.
          }
        })
      );

      setAddressToUsername(usernameMap);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    const fullAddress = getFullSolanaAddress();
    if (!fullAddress) return;

    setIsRefreshing(true);
    await fetchTransactions(fullAddress);
    setIsRefreshing(false);
  }, [fetchTransactions, getFullSolanaAddress]);

  useEffect(() => {
    const fullAddress = getFullSolanaAddress();
    if (fullAddress) {
      void fetchTransactions(fullAddress);
    }
  }, [fetchTransactions, getFullSolanaAddress]);

  const handleTransactionPress = (tx: Transaction) => {
    setSelectedTransaction(tx);
    bottomSheetRef.current?.expand();
  };

  const handleCloseBottomSheet = () => {
    bottomSheetRef.current?.close();
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDetailDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return (
      date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }) +
      ' - ' +
      date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  };

  const shortenAddress = (address: string) => {
    if (!address) return 'External wallet';
    if (address.length >= 12) {
      return `${address.slice(0, 6)}...${address.slice(-6)}`;
    }
    return address;
  };

  const getDisplayName = (address: string) => {
    if (addressToUsername[address]) {
      return addressToUsername[address];
    }
    return shortenAddress(address);
  };

  const shortenSignature = (sig: string) => `${sig.slice(0, 6)}...${sig.slice(-6)}`;

  const getInitials = (address: string) => {
    if (!address) return '??';
    return address.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (type: Transaction['type']) => {
    if (type === 'receive') return '#059669';
    return '#2563EB';
  };

  const getActivityIcon = (type: Transaction['type']) => {
    if (type === 'receive') return 'south-west';
    return 'north-east';
  };

  const getStatusMeta = (status: Transaction['status']) => {
    if (status === 'confirmed') return { label: 'Completed', color: '#22C55E' };
    if (status === 'pending') return { label: 'Pending', color: '#F59E0B' };
    return { label: 'Failed', color: '#EF4444' };
  };

  const formatTransactionAmount = (tx: Transaction, context: 'compact' | 'detailed') =>
    formatTokenAmountDisplay(tx.amount, {
      context,
      tokenPriceUsd: tx.currency === 'USDC' ? 1 : undefined,
      tokenDecimals: tx.currency === 'USDC' ? 6 : undefined,
    });

  const copySignature = async (signature: string) => {
    await Clipboard.setStringAsync(signature);
    Alert.alert('Copied', 'Transaction signature copied to clipboard');
  };

  const openExplorer = (signature: string) => {
    const chain = selectedTransaction?.chain ?? ChainType.SOLANA;
    void Linking.openURL(getExplorerUrl(chain, signature));
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    []
  );

  const groupedTransactions = useMemo(
    () =>
      transactions.reduce((groups: { [key: string]: Transaction[] }, tx) => {
        const date = formatDate(tx.timestamp);
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(tx);
        return groups;
      }, {}),
    [transactions]
  );

  const walletAddress = getFullSolanaAddress();

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={styles.container}
        contentContainerStyle={styles.containerContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={palette.secondaryText}
          />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconButtonPressable}
            onPress={() => router.back()}
            activeOpacity={0.78}
          >
            <GlassView style={[styles.iconButton, { borderColor: cardBorder }]} intensity={26} interactive>
              <MaterialIcons name="arrow-back" size={20} color={palette.primaryText} />
            </GlassView>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: palette.primaryText }]}>Activity</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={[styles.subtitle, { color: palette.secondaryText }]}>
          Your latest on-chain transactions
        </Text>

        {!walletAddress ? (
          <GlassView style={[styles.emptyCard, { borderColor: cardBorder }]} intensity={28}>
            <Text style={[styles.emptyTitle, { color: palette.primaryText }]}>Wallet not connected</Text>
            <Text style={[styles.emptySubtitle, { color: palette.secondaryText }]}>Connect your Solana wallet to view activity.</Text>
          </GlassView>
        ) : null}

        {Object.entries(groupedTransactions).map(([date, txs]) => (
          <View key={date} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.secondaryText }]}>{date}</Text>

            {txs.map((tx) => {
              const status = getStatusMeta(tx.status);
              return (
                <TouchableOpacity
                  key={tx.id}
                  onPress={() => handleTransactionPress(tx)}
                  activeOpacity={0.82}
                  style={styles.rowPressable}
                >
                  <GlassView
                    style={[styles.rowCard, { borderColor: cardBorder }]}
                    intensity={28}
                    interactive
                  >
                    <View style={[styles.rowAvatar, { backgroundColor: getAvatarColor(tx.type) }]}>
                      <MaterialIcons name={getActivityIcon(tx.type)} size={17} color="#FFFFFF" />
                    </View>

                    <View style={styles.rowBody}>
                      <Text style={[styles.rowTitle, { color: palette.primaryText }]} numberOfLines={1}>
                        {getDisplayName(tx.address)}
                      </Text>
                      <Text style={[styles.rowSubtitle, { color: palette.secondaryText }]}>
                        {tx.type === 'send' ? 'Sent' : 'Received'}
                      </Text>
                    </View>

                    <View style={styles.rowRight}>
                      <Text
                        style={[
                          styles.rowAmount,
                          { color: tx.type === 'receive' ? palette.success : palette.primaryText },
                        ]}
                      >
                        {tx.type === 'send' ? '-' : '+'}
                        {formatTransactionAmount(tx, 'compact')}
                      </Text>
                      <Text style={[styles.rowCurrency, { color: palette.secondaryText }]}>
                        {tx.currency}
                      </Text>
                      <View style={styles.statusInline}>
                        <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                        <Text style={[styles.statusInlineText, { color: palette.secondaryText }]}>
                          {status.label}
                        </Text>
                      </View>
                    </View>
                  </GlassView>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {transactions.length === 0 && !isLoading && walletAddress ? (
          <GlassView style={[styles.emptyCard, { borderColor: cardBorder }]} intensity={28}>
            <Text style={[styles.emptyTitle, { color: palette.primaryText }]}>No activity yet</Text>
            <Text style={[styles.emptySubtitle, { color: palette.secondaryText }]}>Your transfers will appear here once they confirm.</Text>
          </GlassView>
        ) : null}
      </ScrollView>

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: palette.background,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
        handleIndicatorStyle={{ backgroundColor: palette.secondaryText, width: 40, height: 5 }}
      >
        <BottomSheetView style={styles.sheetContent}>
          {selectedTransaction ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <GlassView style={[styles.detailSummaryCard, { borderColor: cardBorder }]} intensity={30}>
                <View style={[styles.detailAvatar, { backgroundColor: getAvatarColor(selectedTransaction.type) }]}>
                  <Text style={styles.detailAvatarText}>{getInitials(selectedTransaction.address)}</Text>
                </View>

                <View style={styles.detailSummaryBody}>
                  <Text style={[styles.detailSummaryLabel, { color: palette.secondaryText }]}>
                    {selectedTransaction.type === 'send' ? 'Sent to' : 'Received from'}
                  </Text>
                  <Text style={[styles.detailSummaryAddress, { color: palette.primaryText }]} numberOfLines={1}>
                    {getDisplayName(selectedTransaction.address)}
                  </Text>
                  <Text style={[styles.detailSummaryAmount, { color: palette.primaryText }]}>
                    {selectedTransaction.type === 'send' ? '-' : '+'}
                    {formatTransactionAmount(selectedTransaction, 'detailed')}{' '}
                    {selectedTransaction.currency}
                  </Text>
                </View>
              </GlassView>

              <GlassView style={[styles.detailCard, { borderColor: cardBorder }]} intensity={28}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: palette.secondaryText }]}>Created</Text>
                  <Text style={[styles.detailValue, { color: palette.primaryText }]}>
                    {formatDetailDate(selectedTransaction.timestamp)}
                  </Text>
                </View>

                <View style={[styles.detailDivider, { backgroundColor: palette.borderSubtle }]} />

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: palette.secondaryText }]}>TX ID</Text>
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={() => {
                      void copySignature(selectedTransaction.signature);
                    }}
                  >
                    <Text style={[styles.detailValue, { color: palette.primaryText }]}>
                      {shortenSignature(selectedTransaction.signature)}
                    </Text>
                    <MaterialIcons name="content-copy" size={16} color={palette.secondaryText} />
                  </TouchableOpacity>
                </View>

                {selectedTransaction.fee ? (
                  <>
                    <View style={[styles.detailDivider, { backgroundColor: palette.borderSubtle }]} />
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: palette.secondaryText }]}>Network fee</Text>
                      <Text style={[styles.detailValue, { color: palette.primaryText }]}>
                        {selectedTransaction.chain === ChainType.SOLANA
                          ? formatAmount(selectedTransaction.fee / 1_000_000_000, { maxFractionDigits: 6 })
                          : formatAmount(selectedTransaction.fee, { maxFractionDigits: 6 })}{' '}
                        {getChainSymbol(selectedTransaction.chain)}
                      </Text>
                    </View>
                  </>
                ) : null}

                {selectedTransaction.comment ? (
                  <>
                    <View style={[styles.detailDivider, { backgroundColor: palette.borderSubtle }]} />
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: palette.secondaryText }]}>Comment</Text>
                      <Text style={[styles.detailValue, { color: palette.primaryText }]}>
                        {selectedTransaction.comment}
                      </Text>
                    </View>
                  </>
                ) : null}
              </GlassView>

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: palette.actionPrimary }]}
                onPress={() => openExplorer(selectedTransaction.signature)}
                activeOpacity={0.86}
              >
                <MaterialIcons name="open-in-new" size={18} color={palette.actionPrimaryText} />
                <Text style={[styles.primaryButtonText, { color: palette.actionPrimaryText }]}>View on Explorer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: palette.actionSecondary }]}
                onPress={handleCloseBottomSheet}
                activeOpacity={0.86}
              >
                <Text style={[styles.secondaryButtonText, { color: palette.actionSecondaryText }]}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : null}
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  containerContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  iconButtonPressable: {
    borderRadius: 20,
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
  subtitle: {
    fontSize: 13,
    marginTop: 8,
    marginBottom: 14,
    textAlign: 'center',
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  rowPressable: {
    borderRadius: 16,
    marginBottom: 10,
  },
  rowCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rowBody: {
    flex: 1,
    marginRight: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  rowCurrency: {
    fontSize: 12,
    marginTop: 1,
  },
  statusInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusInlineText: {
    fontSize: 11,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  detailSummaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  detailAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  detailSummaryBody: {
    flex: 1,
  },
  detailSummaryLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  detailSummaryAddress: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  detailSummaryAmount: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  detailCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  detailRow: {
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  detailDivider: {
    height: 1,
  },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  primaryButton: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
