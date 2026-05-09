import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Linking,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';

import { Transaction } from '@/types/types';
import { getTransactions } from '@/utils/transactionStorage';
import { formatAmount } from '@/utils/formatAmount';
import { formatTokenAmountDisplay } from '@/utils/numberFormat';
import { getExplorerUrl, getChainSymbol, ChainType } from '@/constants/chains';
import { Colors } from '@/constants/theme';
import { GlassView } from '@/components/ui/GlassView';

export default function TransactionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const cardBorder = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.52)';

  const transactionId = Array.isArray(params.transactionId)
    ? params.transactionId[0]
    : params.transactionId;

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTransaction = async () => {
      try {
        setIsLoading(true);
        const transactions = await getTransactions();
        const tx = transactions.find((item) => item.id === transactionId);
        if (tx) {
          setTransaction(tx);
        }
      } catch (error) {
        console.error('Error loading transaction:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadTransaction();
  }, [transactionId]);

  const formatDate = (timestamp: number) => {
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

  const shortenSignature = (sig: string) => `${sig.slice(0, 6)}...${sig.slice(-6)}`;

  const copySignature = async () => {
    if (!transaction?.signature) return;
    await Clipboard.setStringAsync(transaction.signature);
  };

  const openExplorer = () => {
    if (!transaction?.signature) return;
    void Linking.openURL(getExplorerUrl(transaction.chain, transaction.signature));
  };

  const getInitials = (address: string) => {
    if (!address || address.length < 2) return '??';
    return address.slice(0, 2).toUpperCase();
  };

  const statusLabel =
    transaction?.status === 'confirmed'
      ? 'Completed'
      : transaction?.status === 'pending'
        ? 'Pending'
        : 'Failed';
  const statusColor =
    transaction?.status === 'confirmed'
      ? '#22C55E'
      : transaction?.status === 'pending'
        ? '#F59E0B'
        : '#EF4444';

  const addressDisplay =
    transaction?.address && transaction.address.length >= 12
      ? `${transaction.address.slice(0, 6)}...${transaction.address.slice(-6)}`
      : transaction?.address || 'External wallet';
  const amountDisplay = transaction
    ? formatTokenAmountDisplay(transaction.amount, {
        context: 'detailed',
        tokenPriceUsd: transaction.currency === 'USDC' ? 1 : undefined,
        tokenDecimals: transaction.currency === 'USDC' ? 6 : undefined,
      })
    : '--';

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={styles.containerContent}
      showsVerticalScrollIndicator={false}
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

        <Text style={[styles.headerTitle, { color: palette.primaryText }]}>Transaction details</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="small" color={palette.secondaryText} />
          <Text style={[styles.loaderText, { color: palette.secondaryText }]}>Loading transaction...</Text>
        </View>
      ) : !transaction ? (
        <GlassView style={[styles.emptyCard, { borderColor: cardBorder }]} intensity={28}>
          <Text style={[styles.emptyTitle, { color: palette.primaryText }]}>Transaction not found</Text>
          <Text style={[styles.emptySubtitle, { color: palette.secondaryText }]}>The selected transaction is unavailable in local history.</Text>
        </GlassView>
      ) : (
        <>
          <GlassView style={[styles.summaryCard, { borderColor: cardBorder }]} intensity={30}>
            <View style={styles.summaryRow}>
              <View style={[styles.avatar, { backgroundColor: transaction.type === 'receive' ? '#059669' : '#2563EB' }]}>
                <Text style={styles.avatarText}>{getInitials(transaction.address)}</Text>
              </View>

              <View style={styles.summaryBody}>
                <Text style={[styles.summaryLabel, { color: palette.secondaryText }]}>
                  {transaction.type === 'send' ? 'Sent to' : 'Received from'}
                </Text>
                <Text style={[styles.summaryAddress, { color: palette.primaryText }]} numberOfLines={1}>
                  {addressDisplay}
                </Text>
              </View>
            </View>

            <Text style={[styles.amount, { color: palette.primaryText }]}>
              {transaction.type === 'send' ? '-' : '+'}
              {amountDisplay}{' '}
              {transaction.currency}
            </Text>

            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>{statusLabel}</Text>
            </View>
          </GlassView>

          <GlassView style={[styles.detailsCard, { borderColor: cardBorder }]} intensity={28}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: palette.secondaryText }]}>Created</Text>
              <Text style={[styles.detailValue, { color: palette.primaryText }]}>{formatDate(transaction.timestamp)}</Text>
            </View>

            <View style={[styles.divider, { backgroundColor: palette.borderSubtle }]} />

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: palette.secondaryText }]}>TX ID</Text>
              <TouchableOpacity style={styles.signatureRow} onPress={() => void copySignature()}>
                <Text style={[styles.detailValue, { color: palette.primaryText }]}>{shortenSignature(transaction.signature)}</Text>
                <MaterialIcons name="content-copy" size={16} color={palette.secondaryText} />
              </TouchableOpacity>
            </View>

            {transaction.fee ? (
              <>
                <View style={[styles.divider, { backgroundColor: palette.borderSubtle }]} />
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: palette.secondaryText }]}>Network fee</Text>
                  <Text style={[styles.detailValue, { color: palette.primaryText }]}>
                    {transaction.chain === ChainType.SOLANA
                      ? formatAmount(transaction.fee / 1_000_000_000, { maxFractionDigits: 6 })
                      : formatAmount(transaction.fee, { maxFractionDigits: 6 })}{' '}
                    {getChainSymbol(transaction.chain)}
                  </Text>
                </View>
              </>
            ) : null}

            {transaction.comment ? (
              <>
                <View style={[styles.divider, { backgroundColor: palette.borderSubtle }]} />
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: palette.secondaryText }]}>Comment</Text>
                  <Text style={[styles.detailValue, { color: palette.primaryText }]}>{transaction.comment}</Text>
                </View>
              </>
            ) : null}
          </GlassView>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: palette.actionPrimary }]}
            onPress={openExplorer}
            activeOpacity={0.86}
          >
            <MaterialIcons name="open-in-new" size={18} color={palette.actionPrimaryText} />
            <Text style={[styles.primaryButtonText, { color: palette.actionPrimaryText }]}>View on Explorer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: palette.actionSecondary }]}
            onPress={() => router.back()}
            activeOpacity={0.86}
          >
            <Text style={[styles.secondaryButtonText, { color: palette.actionSecondaryText }]}>Close</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 12,
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
  loaderWrap: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 10,
    fontSize: 13,
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
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryBody: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  summaryAddress: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  amount: {
    fontSize: 25,
    fontWeight: '700',
    marginTop: 14,
    fontVariant: ['tabular-nums'],
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  detailsCard: {
    borderWidth: 1,
    borderRadius: 18,
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
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  divider: {
    height: 1,
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
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
