import { StyleSheet, ScrollView, TouchableOpacity, Alert, View, Text, RefreshControl, Linking } from "react-native";
// import { useTurnkey } from "@turnkey/react-native-wallet-kit";
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Transaction } from '@/types/types';
import { getMergedTransactions, startTransactionPolling } from '@/utils/transactionListener';
import { clearTransactions } from '@/utils/transactionStorage';
import { getUsernameByAddress } from '@/services/firestoreService';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getUsername, saveUsername } from '@/utils/userStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchTokenPrices } from '@/utils/priceService';
import { fetchAllTokenBalances } from '@/utils/balanceService';
import Svg, { Path } from 'react-native-svg';
import { usePrivy, useEmbeddedSolanaWallet } from '@privy-io/expo';


// Icon components using LineIcons style
function SendIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M12 5l7 7-7 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ReceiveIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function WalletIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M17 9h4M17 15h4M17 9v6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function EyeIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function EyeOffIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M1 1l22 22" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CopyIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-2M16 4h2a2 2 0 012 2v2M16 4v4M16 4h-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { logout } = usePrivy();
  const { wallets: solanaWallets } = useEmbeddedSolanaWallet();
  // const [balance] = useState<string>('0.00');
  const [usdBalance, setUsdBalance] = useState<string>('0.00');
  // const [isLoadingBalance] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [username, setUsername] = useState<string>('User');
  const [addressToUsername, setAddressToUsername] = useState<{ [address: string]: string }>({});
  const [isBalanceVisible, setIsBalanceVisible] = useState<boolean>(true);
  
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['75%'], []);
  
  // Get full Solana address for username lookup
  const getFullSolanaAddressForUsername = () => {
    if (solanaWallets && solanaWallets.length > 0) {
      const wallet = solanaWallets[0];
      return wallet.publicKey || null;
    }
    return null;
  };
  
  // Load username on mount
  useEffect(() => {
    const loadUsername = async () => {
      const solanaAddress = getFullSolanaAddressForUsername();
      console.log('[Home] Loading username for address:', solanaAddress);
      
      // Check if there's a pending username save from registration
      const pendingSave = await AsyncStorage.getItem('pending_username_save');
      const pendingUsername = await AsyncStorage.getItem('user_username');
      
      if (pendingSave === 'true' && pendingUsername && solanaAddress) {
        console.log('[Home] Found pending username save:', pendingUsername);
        try {
          await saveUsername(pendingUsername, solanaAddress);
          console.log('[Home] ✅ Pending username saved to Firebase:', pendingUsername);
          await AsyncStorage.removeItem('pending_username_save');
          setUsername(pendingUsername);
          return;
        } catch {
          console.error('[Home] ❌ Error saving pending username');
        }
      }
      
      // Try to get username (will check AsyncStorage first, then Firestore)
      const storedUsername = await getUsername(solanaAddress || undefined);
      console.log('[Home] Retrieved username:', storedUsername);
      
      if (storedUsername && !storedUsername.startsWith('user-')) {
        setUsername(storedUsername);
        console.log('[Home] Username set to:', storedUsername);
      } else {
        console.log('[Home] No username found, using default "User"');
      }
    };
    loadUsername();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solanaWallets]);
  
  // Get the first Solana address
  const getSolanaAddress = () => {
    console.log('Solana Wallets:', solanaWallets);
    if (solanaWallets && solanaWallets.length > 0) {
      const wallet = solanaWallets[0];
      console.log('First Solana wallet:', wallet);
      if (wallet.publicKey) {
        const addr = wallet.publicKey;
        return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
      }
    }
    return null;
  };
  
  const solanaAddress = getSolanaAddress();
  console.log('Solana address to display:', solanaAddress);
  
  // Fetch all token balances and calculate USD value
  const fetchBalance = async (address: string, forceFresh: boolean = false) => {
    try {
      // Fetch token balances and prices in parallel
      const [balances, prices] = await Promise.all([
        fetchAllTokenBalances(address, forceFresh),
        fetchTokenPrices(forceFresh),
      ]);
      
      console.log('Token balances:', balances);
      console.log('Token prices:', prices);
      
      // Calculate total USD value
      const totalUsd = 
        (balances.sol * prices.sol) +
        (balances.usdc * prices.usdc) +
        (balances.usdt * prices.usdt);
      
      setUsdBalance(totalUsd.toFixed(2));
      console.log('Total USD balance:', totalUsd.toFixed(2));
    } catch (error) {
      console.error('Error fetching balance:', error);
      setUsdBalance('0.00');
    }
  };
  
  // Get full Solana address for balance fetch
  const getFullSolanaAddress = () => {
    if (solanaWallets && solanaWallets.length > 0) {
      const wallet = solanaWallets[0];
      return wallet.publicKey || null;
    }
    return null;
  };
  
  // Fetch transactions and resolve usernames
  const fetchTransactions = useCallback(async (address: string) => {
    try {
      setIsLoadingTransactions(true);
      const txs = await getMergedTransactions(address);
      setTransactions(txs);
      console.log(`Loaded ${txs.length} transactions`);
      
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
      setIsLoadingTransactions(false);
    }
  }, []);
  
  // Handle pull to refresh
  const onRefresh = useCallback(async () => {
    const fullAddress = getFullSolanaAddress();
    if (!fullAddress) return;
    
    setIsRefreshing(true);
    // Clear cache to force fresh fetch
    await clearTransactions();
    await Promise.all([
      fetchBalance(fullAddress, true), // Force fresh prices on manual refresh
      fetchTransactions(fullAddress),
    ]);
    setIsRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchBalance, fetchTransactions]);
  
  // Fetch balance and transactions when wallet address is available
  useEffect(() => {
    const fullAddress = getFullSolanaAddress();
    if (!fullAddress) return;
    
    // Initial fetch
    fetchBalance(fullAddress);
    fetchTransactions(fullAddress);
    
    // Start polling for new transactions
    const stopPolling = startTransactionPolling(
      fullAddress,
      120000, // Poll every 2 minutes to avoid rate limits
      (newTransaction) => {
        console.log('New transaction received:', newTransaction);
        // Refresh transactions list
        fetchTransactions(fullAddress);
      }
    );
    
    // Refresh balance every 2 minutes (less aggressive to avoid rate limits)
    const balanceInterval = setInterval(() => {
      fetchBalance(fullAddress);
    }, 120000); // 2 minutes
    
    return () => {
      clearInterval(balanceInterval);
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solanaWallets]);
  
  // Format transaction for display
  const formatTransaction = (tx: Transaction) => {
    // Check if we have a username for this address
    let addressDisplay = tx.address || 'Unknown';
    if (addressToUsername[tx.address]) {
      addressDisplay = addressToUsername[tx.address];
    } else if (tx.address && tx.address.length >= 12) {
      // Show shortened address if no username
      addressDisplay = `${tx.address.slice(0, 6)}...${tx.address.slice(-6)}`;
    }
    
    return {
      id: tx.id,
      type: tx.type,
      title: addressDisplay,
      subtitle: tx.type === 'send' ? 'Send' : 'Receive',
      amount: tx.type === 'send' ? `-${tx.amount.toFixed(2)}` : `+${tx.amount.toFixed(2)}`,
      currency: tx.currency || 'SOL',
      date: new Date(tx.timestamp).toLocaleDateString(),
    };
  };

  const handleAdd = () => {
    router.push('/deposit');
  };

  const handleWithdraw = () => {
    router.push('/withdraw');
  };

  const handleSend = () => {
    router.push('/send');
  };

  const handleBalance = () => {
    router.push('/balance');
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleCopyAddress = async () => {
    const fullAddress = getFullSolanaAddress();
    if (fullAddress) {
      await Clipboard.setStringAsync(fullAddress);
      Alert.alert('Copied!', 'Address copied to clipboard');
    }
  };

  const getActivityIcon = (type: string) => {
    switch(type) {
      case 'send':
        return <SendIcon size={24} color="#000" />;
      case 'receive':
        return <ReceiveIcon size={24} color="#000" />;
      default:
        return <WalletIcon size={24} color="#000" />;
    }
  };
  
  const handleTransactionPress = (tx: Transaction) => {
    setSelectedTransaction(tx);
    bottomSheetRef.current?.expand();
  };
  
  const handleCloseBottomSheet = () => {
    bottomSheetRef.current?.close();
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
  
  const shortenSignature = (sig: string) => {
    return `${sig.slice(0, 6)}...${sig.slice(-6)}`;
  };
  
  const copySignature = async (signature: string) => {
    await Clipboard.setStringAsync(signature);
    Alert.alert('Copied!', 'Transaction signature copied to clipboard');
  };
  
  const openExplorer = (signature: string) => {
    Linking.openURL(`https://explorer.solana.com/tx/${signature}`);
  };
  
  const getInitials = (address: string) => {
    return address.slice(0, 2).toUpperCase();
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.userProfile}
          onPress={() => router.push('/profile')}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{username.slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={styles.username}>{username}</Text>
          <Text style={styles.verifiedBadge}>✓</Text>
        </TouchableOpacity>
        {solanaAddress ? (
          <TouchableOpacity style={styles.addressBadge} onPress={handleCopyAddress}>
            <Text style={styles.addressText}>{solanaAddress}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.addressBadge}>
            <Text style={styles.addressText}>No wallet</Text>
          </View>
        )}
      </View>

      {/* Action Buttons Row 1 */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionButton} onPress={handleAdd}>
          <Text style={styles.actionIcon}>↓</Text>
          <Text style={styles.actionText}>Add</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleWithdraw}>
          <Text style={styles.actionIcon}>↑</Text>
          <Text style={styles.actionText}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      {/* Balance */}
      <View style={styles.balanceContainer}>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceCurrency}>$</Text>
          <Text style={styles.balanceAmount}>{isBalanceVisible ? usdBalance : '••••'}</Text>
        </View>
        <TouchableOpacity onPress={() => setIsBalanceVisible(!isBalanceVisible)}>
          {isBalanceVisible ? (
            <EyeIcon size={32} color="#000" />
          ) : (
            <EyeOffIcon size={32} color="#000" />
          )}
        </TouchableOpacity>
      </View>

      {/* Action Buttons Row 2 */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.primaryActionButton} onPress={handleSend}>
          <Text style={styles.primaryActionIcon}>↗</Text>
          <Text style={styles.primaryActionText}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryActionButton} onPress={handleBalance}>
          <Text style={styles.primaryActionIcon}>¢</Text>
          <Text style={styles.primaryActionText}>Balance</Text>
        </TouchableOpacity>
      </View>

      {/* Temporary Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout (Temp)</Text>
      </TouchableOpacity>

      {/* Activity Section */}
      <TouchableOpacity 
        style={styles.activityHeader}
        onPress={() => router.push('/activity')}
      >
        <Text style={styles.activityTitle}>Activity</Text>
        <Text style={styles.activityArrow}>›</Text>
      </TouchableOpacity>

      <ScrollView 
        style={styles.activityList}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#000000"
          />
        }
      >
        {transactions.length === 0 && !isLoadingTransactions ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No transactions yet</Text>
            <Text style={styles.emptyStateSubtext}>Your transactions will appear here</Text>
          </View>
        ) : (
          transactions.map((tx) => {
            const item = formatTransaction(tx);
            return (
              <TouchableOpacity 
                key={item.id} 
                style={styles.activityItem}
                onPress={() => handleTransactionPress(tx)}
              >
                <View style={styles.activityIcon}>
                  {getActivityIcon(item.type)}
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityItemTitle}>{item.title}</Text>
                  {item.subtitle && (
                    <Text style={styles.activitySubtitle}>
                      {item.type === 'send' ? '↗' : '↙'} {item.subtitle}
                    </Text>
                  )}
                  {item.date && (
                    <Text style={styles.activityDate}>{item.date}</Text>
                  )}
                </View>
                <View style={styles.activityRight}>
                  {item.amount && (
                    <Text style={[
                      styles.activityAmount,
                      item.amount.startsWith('+') && styles.activityAmountPositive
                    ]}>
                      {isBalanceVisible ? item.amount : '••••'}
                    </Text>
                  )}
                  {item.currency && (
                    <Text style={styles.activityCurrency}>{isBalanceVisible ? item.currency : ''}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
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
                  <View style={styles.detailAvatar}>
                    <Text style={styles.detailAvatarText}>
                      {getInitials(selectedTransaction.address)}
                    </Text>
                  </View>
                </View>
                <View style={styles.summaryCenter}>
                  <Text style={styles.summaryTitle}>
                    {selectedTransaction.type === 'send' ? '↗ Sent to ' : '↙ Received from '}
                    <Text style={styles.summaryAddressInline}>
                      {addressToUsername[selectedTransaction.address] || 
                       (selectedTransaction.address && selectedTransaction.address.length >= 12
                        ? `${selectedTransaction.address.slice(0, 6)}...${selectedTransaction.address.slice(-6)}`
                        : selectedTransaction.address || 'Unknown')}
                    </Text>
                  </Text>
                  <Text style={styles.detailAmount}>
                    {isBalanceVisible ? `$${selectedTransaction.amount.toFixed(2)}` : '$••••'}
                  </Text>
                </View>
                <View style={styles.summaryRight}>
                  <View style={[
                    styles.statusBadge,
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
                        {(selectedTransaction.fee / 1000000000).toFixed(6)} SOL
                      </Text>
                    </View>
                  </>
                )}

                {selectedTransaction.comment && (
                  <>
                    <View style={styles.detailDivider} />
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Comment</Text>
                      <Text style={styles.detailValue}>{selectedTransaction.comment}</Text>
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
    </GestureHandlerRootView>
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
    marginBottom: 20,
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#B8A5E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  verifiedBadge: {
    fontSize: 18,
    color: '#10b981',
  },
  addressBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addressText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'monospace',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#000000',
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginVertical: 15,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  balanceAmount: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#000000',
  },
  balanceCurrency: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#666666',
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: '#60A5FA',
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#000000',
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  primaryActionIcon: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  activityTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  activityArrow: {
    fontSize: 32,
    color: '#000000',
  },
  activityList: {
    flex: 1,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 15,
    marginBottom: 10,
  },
  activityIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFD580',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  activityDate: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
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
    backgroundColor: '#FFB380',
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
  statusBadge: {
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
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
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
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  closeSheetButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  activityAmountPositive: {
    color: '#10b981',
  },
  activityCurrency: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 10,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
});
