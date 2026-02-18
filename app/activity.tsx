import { StyleSheet, View, Text, TouchableOpacity, ScrollView, RefreshControl, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Transaction } from '@/types/types';
import { getMergedTransactions } from '@/utils/transactionListener';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Clipboard from 'expo-clipboard';
import { getUsernameByAddress } from '@/services/firestoreService';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import Svg, { Path } from 'react-native-svg';
import { formatAmount } from '@/utils/formatAmount';

// Icon components
function SendIcon({ size = 24, color = '#FFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M12 5l7 7-7 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ReceiveIcon({ size = 24, color = '#FFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function UploadIcon({ size = 24, color = '#FFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function WalletIcon({ size = 24, color = '#FFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M17 9h4M17 15h4M17 9v6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CopyIcon({ size = 18, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-2M16 4h2a2 2 0 012 2v2M16 4v4M16 4h-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ActivityScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [addressToUsername, setAddressToUsername] = useState<{ [address: string]: string }>({});
  
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['75%'], []);

  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];

  const getFullSolanaAddress = () => {
    if (wallet?.publicKey) {
      return wallet.publicKey;
    }
    return null;
  };

  // Fetch transactions and resolve usernames
  const fetchTransactions = useCallback(async (address: string) => {
    try {
      setIsLoading(true);
      const txs = await getMergedTransactions(address);
      setTransactions(txs);
      
      // Fetch usernames for all unique addresses in transactions
      const uniqueAddresses = [...new Set(txs.map(tx => tx.address))]
        .filter(addr => addr && addr.trim() !== ''); // Filter out empty/invalid addresses
      const usernameMap: { [address: string]: string } = {};
      
      await Promise.all(
        uniqueAddresses.map(async (addr) => {
          try {
            const username = await getUsernameByAddress(addr);
            if (username) {
              usernameMap[addr] = username;
            }
          } catch {
            // Ignore errors for individual lookups
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

  // Handle pull to refresh
  const onRefresh = useCallback(async () => {
    const fullAddress = getFullSolanaAddress();
    if (!fullAddress) return;
    
    setIsRefreshing(true);
    await fetchTransactions(fullAddress);
    setIsRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTransactions]);

  // Load transactions on mount
  useEffect(() => {
    const fullAddress = getFullSolanaAddress();
    if (fullAddress) {
      fetchTransactions(fullAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTransactions]);

  const handleBack = () => {
    router.back();
  };

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
      year: 'numeric' 
    });
  };

  const formatDetailDate = (timestamp: number) => {
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

  const shortenAddress = (address: string) => {
    if (address.length >= 12) {
      return `${address.slice(0, 6)}...${address.slice(-6)}`;
    }
    return address;
  };

  const getDisplayName = (address: string) => {
    // Check if we have a username for this address
    if (addressToUsername[address]) {
      return addressToUsername[address];
    }
    // Otherwise show shortened address
    return shortenAddress(address);
  };

  const shortenSignature = (sig: string) => {
    return `${sig.slice(0, 6)}...${sig.slice(-6)}`;
  };

  const getInitials = (address: string) => {
    return address.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (type: string) => {
    if (type === 'withdraw') return '#FFD966';
    return '#FFB380';
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'send':
        return <SendIcon size={24} color="#FFF" />;
      case 'receive':
        return <ReceiveIcon size={24} color="#FFF" />;
      case 'withdraw':
        return <UploadIcon size={24} color="#FFF" />;
      default:
        return <WalletIcon size={24} color="#FFF" />;
    }
  };

  const copySignature = async (signature: string) => {
    await Clipboard.setStringAsync(signature);
    Alert.alert('Copied!', 'Transaction signature copied to clipboard');
  };

  const openExplorer = (signature: string) => {
    Linking.openURL(`https://explorer.solana.com/tx/${signature}`);
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    []
  );

  // Group transactions by date
  const groupedTransactions = transactions.reduce((groups: { [key: string]: Transaction[] }, tx) => {
    const date = formatDate(tx.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(tx);
    return groups;
  }, {});

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={styles.rootScroll}
        contentContainerStyle={styles.rootContent}
        scrollEnabled={false}
      >
        <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Activity</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Transaction List */}
        <ScrollView 
          style={styles.transactionList}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#000000"
            />
          }
        >
          {Object.entries(groupedTransactions).map(([date, txs]) => (
            <View key={date} style={styles.dateSection}>
              <Text style={styles.dateHeader}>{date}</Text>
              
              {txs.map((tx) => (
                <TouchableOpacity
                  key={tx.id}
                  style={styles.transactionItem}
                  onPress={() => handleTransactionPress(tx)}
                >
                  <View style={[styles.avatar, { backgroundColor: getAvatarColor(tx.type) }]}>
                    {getIcon(tx.type)}
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusIcon}>✓</Text>
                    </View>
                  </View>
                  
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionTitle}>
                      {getDisplayName(tx.address)}
                    </Text>
                    <Text style={styles.transactionSubtitle}>
                      {tx.type === 'send' ? '↗ Send' : tx.type === 'receive' ? '↙ Receive' : '↑ Withdraw'}
                    </Text>
                  </View>

                  <View style={styles.transactionRight}>
                    <Text style={[
                      styles.transactionAmount,
                      tx.type === 'receive' && styles.transactionAmountPositive
                    ]}>
                      {tx.type === 'send' ? '-' : '+'}
                      {formatAmount(tx.amount, {
                        maxFractionDigits: tx.currency === 'USDC' ? 2 : 4,
                      })}
                    </Text>
                    <Text style={styles.transactionCurrency}>{tx.currency || 'SOL'}</Text>
                    {tx.type === 'send' && tx.currencyEquivalent && (
                      <Text style={styles.equivalentAmount}>≈ {tx.currencyEquivalent}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {transactions.length === 0 && !isLoading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No transactions yet</Text>
              <Text style={styles.emptyStateSubtext}>Your transactions will appear here</Text>
            </View>
          )}
        </ScrollView>

        {/* Transaction Detail Bottom Sheet */}
        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose
          backdropComponent={renderBackdrop}
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.bottomSheetIndicator}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            {selectedTransaction && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Transaction Summary Card */}
                <View style={styles.summaryCard}>
                  <View style={styles.summaryLeft}>
                    <View style={[styles.detailAvatar, { backgroundColor: getAvatarColor(selectedTransaction.type) }]}>
                      <Text style={styles.detailAvatarText}>
                        {getInitials(selectedTransaction.address)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.summaryCenter}>
                    <Text style={styles.summaryTitle}>
                      {selectedTransaction.type === 'send' ? '↗ Sent to ' : '↙ Received from '}
                      <Text style={styles.summaryAddressInline}>
                        {getDisplayName(selectedTransaction.address)}
                      </Text>
                    </Text>
                    <Text style={styles.detailAmount}>
                      {formatAmount(selectedTransaction.amount, {
                        maxFractionDigits:
                          selectedTransaction.currency === 'USDC' ? 2 : 4,
                      })}{' '}
                      {selectedTransaction.currency || 'SOL'}
                    </Text>
                  </View>
                  <View style={styles.summaryRight}>
                    <View style={[
                      styles.statusBadgeDetail,
                      selectedTransaction.status === 'confirmed' && styles.statusBadgeConfirmed,
                      selectedTransaction.status === 'pending' && styles.statusBadgePending,
                    ]}>
                      <Text style={styles.statusText}>
                        {selectedTransaction.status === 'confirmed' ? 'Completed' : 
                         selectedTransaction.status === 'pending' ? 'Pending' : 'Failed'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Details Card */}
                <View style={styles.detailsCard}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Created</Text>
                    <Text style={styles.detailValue}>{formatDetailDate(selectedTransaction.timestamp)}</Text>
                  </View>

                  <View style={styles.detailDivider} />

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>TX ID</Text>
                    <TouchableOpacity 
                      style={styles.signatureRow} 
                      onPress={() => copySignature(selectedTransaction.signature)}
                    >
                      <Text style={styles.detailValue}>{shortenSignature(selectedTransaction.signature)}</Text>
                      <CopyIcon size={18} color="#000" />
                    </TouchableOpacity>
                  </View>

                  {selectedTransaction.fee && (
                    <>
                      <View style={styles.detailDivider} />
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Network fee</Text>
                        <Text style={styles.detailValue}>
                          {formatAmount(selectedTransaction.fee / 1000000000, {
                            maxFractionDigits: 6,
                          })}{' '}
                          SOL
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                {/* Action Buttons */}
                <TouchableOpacity 
                  style={styles.explorerButton} 
                  onPress={() => openExplorer(selectedTransaction.signature)}
                >
                  <Text style={styles.explorerIcon}>↗</Text>
                  <Text style={styles.explorerButtonText}>View on Explorer</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.closeSheetButton} onPress={handleCloseBottomSheet}>
                  <Text style={styles.closeSheetButtonText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </BottomSheetView>
        </BottomSheet>
        </View>
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  rootScroll: {
    flex: 1,
    backgroundColor: '#F5E6D3',
  },
  rootContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F5E6D3',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
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
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
  },
  placeholder: {
    width: 50,
  },
  transactionList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  dateSection: {
    marginBottom: 20,
  },
  dateHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    padding: 15,
    marginBottom: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  statusIcon: {
    fontSize: 10,
    color: '#FFFFFF',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 2,
  },
  transactionSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 2,
  },
  transactionAmountPositive: {
    color: '#10b981',
  },
  transactionCurrency: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  equivalentAmount: {
    fontSize: 12,
    color: '#666666',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666666',
  },
  bottomSheetBackground: {
    backgroundColor: '#F5E6D3',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomSheetIndicator: {
    backgroundColor: '#000000',
    width: 40,
    height: 5,
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 10,
  },
  summaryLeft: {
    marginRight: 16,
  },
  summaryCenter: {
    flex: 1,
  },
  summaryRight: {
    marginLeft: 8,
  },
  detailAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailAvatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  summaryTitle: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 4,
  },
  summaryAddressInline: {
    color: '#000000',
    fontWeight: '600',
  },
  detailAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  statusBadgeDetail: {
    backgroundColor: '#999999',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  statusBadgeConfirmed: {
    backgroundColor: '#10b981',
  },
  statusBadgePending: {
    backgroundColor: '#f59e0b',
  },
  statusText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 16,
    marginBottom: 15,
  },
  detailRow: {
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '600',
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 8,
  },
  explorerButton: {
    flexDirection: 'row',
    backgroundColor: '#E8B5E8',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    boxShadow: '3px 3px 0px rgba(0, 0, 0, 1)',
  },
  explorerIcon: {
    fontSize: 18,
  },
  explorerButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  closeSheetButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    boxShadow: '3px 3px 0px rgba(0, 0, 0, 1)',
  },
  closeSheetButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
});
