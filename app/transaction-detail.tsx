import { StyleSheet, View, Text, TouchableOpacity, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { Transaction } from '@/types/types';
import { getTransactions } from '@/utils/transactionStorage';
import * as Clipboard from 'expo-clipboard';
import { formatAmount } from '@/utils/formatAmount';
import { getExplorerUrl, getChainSymbol, ChainType } from '@/constants/chains';

export default function TransactionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { transactionId } = params;
  
  const [transaction, setTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    loadTransaction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  const loadTransaction = async () => {
    try {
      const transactions = await getTransactions();
      const tx = transactions.find(t => t.id === transactionId);
      if (tx) {
        setTransaction(tx);
      }
    } catch (error) {
      console.error('Error loading transaction:', error);
    }
  };

  const handleClose = () => {
    router.back();
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    }) + ' - ' + date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const shortenSignature = (sig: string) => {
    return `${sig.slice(0, 6)}...${sig.slice(-6)}`;
  };

  const copySignature = async () => {
    if (transaction?.signature) {
      await Clipboard.setStringAsync(transaction.signature);
    }
  };

  const openExplorer = () => {
    if (transaction?.signature) {
      Linking.openURL(getExplorerUrl(transaction.chain, transaction.signature));
    }
  };

  const getInitials = (address: string) => {
    if (!address || address.length < 2) return '??';
    return address.slice(0, 2).toUpperCase();
  };

  if (!transaction) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  const addressDisplay = transaction.address && transaction.address.length >= 12
    ? `${transaction.address.slice(0, 6)}...${transaction.address.slice(-6)}`
    : transaction.address || 'Unknown Sender';

  return (
    <View style={styles.container}>
      {/* Drag Handle */}
      <View style={styles.dragHandle} />

      {/* Transaction Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(transaction.address)}</Text>
        </View>
        <Text style={styles.summaryTitle}>
          {transaction.type === 'send' ? '↗ Sent to' : '↙ Received from'}
        </Text>
        <Text style={styles.summaryAddress}>{addressDisplay}</Text>
        <Text style={styles.amount}>
          {transaction.type === 'send' ? '-' : '+'}$
          {formatAmount(transaction.amount, { maxFractionDigits: 2 })}
        </Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {transaction.status === 'confirmed' ? 'Completed' : 
             transaction.status === 'pending' ? 'Pending' : 'Failed'}
          </Text>
        </View>
      </View>

      {/* Details Card */}
      <View style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Created</Text>
          <Text style={styles.detailValue}>{formatDate(transaction.timestamp)}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>TX ID</Text>
          <TouchableOpacity 
            style={styles.signatureRow} 
            onPress={copySignature}
          >
            <Text style={styles.detailValue}>{shortenSignature(transaction.signature)}</Text>
            <Text style={styles.copyIcon}>📋</Text>
          </TouchableOpacity>
        </View>

        {transaction.fee && (
          <>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Network fee</Text>
              <Text style={styles.detailValue}>
                {transaction.chain === ChainType.SOLANA
                  ? formatAmount(transaction.fee / 1000000000, { maxFractionDigits: 6 })
                  : formatAmount(transaction.fee, { maxFractionDigits: 6 })}{" "}
                {getChainSymbol(transaction.chain)}
              </Text>
            </View>
          </>
        )}

        {transaction.comment && (
          <>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Comment</Text>
              <Text style={styles.detailValue}>{transaction.comment}</Text>
            </View>
          </>
        )}
      </View>

      {/* Action Buttons */}
      <TouchableOpacity style={styles.shareButton} onPress={openExplorer}>
        <Text style={styles.shareIcon}>↗</Text>
        <Text style={styles.shareButtonText}>View on Explorer</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.closeButtonBottom} onPress={handleClose}>
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5E6D3',
    padding: 20,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#000000',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#666666',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#000000',
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFB380',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  summaryTitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 5,
  },
  summaryAddress: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 15,
  },
  amount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 15,
  },
  statusBadge: {
    backgroundColor: '#10b981',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#000000',
    padding: 20,
    marginBottom: 20,
  },
  detailRow: {
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 5,
  },
  detailValue: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  copyIcon: {
    fontSize: 18,
    marginLeft: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 5,
  },
  shareButton: {
    flexDirection: 'row',
    backgroundColor: '#E8B5E8',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#000000',
    paddingVertical: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
    boxShadow: '4px 4px 0px rgba(0, 0, 0, 1)',
  },
  shareIcon: {
    fontSize: 20,
  },
  shareButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  closeButtonBottom: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#000000',
    paddingVertical: 18,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '4px 4px 0px rgba(0, 0, 0, 1)',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
});
