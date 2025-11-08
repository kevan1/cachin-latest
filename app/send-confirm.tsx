import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { saveTransaction } from '@/utils/transactionStorage';
import { Transaction as TransactionType } from '@/types/types';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';

// USDC Token Mint Address on Solana Mainnet
const USDC_MINT_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export default function SendConfirmScreen() {
const router = useRouter();
  const params = useLocalSearchParams();
  const { recipient, address, amount, comment } = params;
  
  const [isSending, setIsSending] = useState(false);
  const [transactionSent, setTransactionSent] = useState(false);
  const [txSignature, setTxSignature] = useState<string>('');

  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];

  const getWalletAddress = () => {
    if (wallet?.publicKey) {
      return wallet.publicKey;
    }
    return null;
  };

  const signTransaction = async (transaction: Transaction): Promise<Transaction> => {
    if (!wallet?.getProvider) {
      throw new Error('Wallet not available');
    }
    
    // Get the provider
    const provider = await wallet.getProvider();
    if (!provider) {
      throw new Error('Failed to get wallet provider');
    }

    // Sign the transaction
    const { signedTransaction } = await provider.request({
      method: 'signTransaction',
      params: { transaction }
    });

    return signedTransaction;
  };

  const handleClose = () => {
    router.push('/(main)');
  };

  const handleSendTransaction = async () => {
    try {
      setIsSending(true);

      // Get sender's wallet address
      const senderAddress = getWalletAddress();
      if (!senderAddress) {
        Alert.alert('Error', 'No wallet found');
        setIsSending(false);
        return;
      }

      const recipientAddress = address as string;
      
      // Validate and parse amount
      const amountString = amount as string;
      const parsedAmount = parseFloat(amountString);
      
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        Alert.alert('Invalid Amount', `Amount "${amountString}" is not valid. Please enter a valid number.`);
        setIsSending(false);
        return;
      }
      
      // USDC has 6 decimals
      const amountInUSDC = Math.floor(parsedAmount * 1000000);

      console.log('Sending USDC transaction:', {
        from: senderAddress,
        to: recipientAddress,
        amountString: amountString,
        parsedAmount: parsedAmount,
        amountInUSDC: amountInUSDC,
      });

      // Connect to Solana mainnet
      const connection = new Connection('https://solxar.mainnet.rpcpool.com/efba4db1-e231-40f6-a16f-6e24e8f72b5c', 'confirmed');
      
      // Create public keys
      const fromPubkey = new PublicKey(senderAddress);
      const toPubkey = new PublicKey(recipientAddress);
      const usdcMintPubkey = new PublicKey(USDC_MINT_ADDRESS);
      
      // Get associated token accounts for sender and recipient
      const fromTokenAccount = await getAssociatedTokenAddress(
        usdcMintPubkey,
        fromPubkey
      );
      
      const toTokenAccount = await getAssociatedTokenAddress(
        usdcMintPubkey,
        toPubkey
      );
      
      console.log('From token account:', fromTokenAccount.toString());
      console.log('To token account:', toTokenAccount.toString());
      
      // Check if sender has a USDC token account
      const senderAccountInfo = await connection.getAccountInfo(fromTokenAccount);
      if (senderAccountInfo === null) {
        Alert.alert(
          'No USDC Account',
          'Your wallet does not have a USDC account yet. You need to receive USDC first before you can send it.'
        );
        setIsSending(false);
        return;
      }
      
      // Check sender's USDC balance
      const senderTokenBalance = await connection.getTokenAccountBalance(fromTokenAccount);
      const senderBalance = senderTokenBalance.value.uiAmount || 0;
      console.log('Sender USDC balance:', senderBalance);
      
      if (senderBalance < parsedAmount) {
        Alert.alert(
          'Insufficient USDC',
          `You only have ${senderBalance.toFixed(2)} USDC but trying to send ${parsedAmount} USDC`
        );
        setIsSending(false);
        return;
      }
      
      // Check if recipient's token account exists
      const recipientAccountInfo = await connection.getAccountInfo(toTokenAccount);
      const needsTokenAccount = recipientAccountInfo === null;
      
      if (needsTokenAccount) {
        console.log('Recipient does not have a USDC token account. Creating one...');
      }
      
      // User pays the fees
      const feePayer = fromPubkey;
      
      // Check sender's SOL balance for transaction fees
      const senderSolBalance = await connection.getBalance(fromPubkey);
      const solBalanceInSol = senderSolBalance / 1e9;
      console.log('Sender SOL balance:', solBalanceInSol);
      
      if (needsTokenAccount) {
        const minSolRequired = 0.003; // 0.002 for account + 0.001 for transaction fee
        
        if (solBalanceInSol < minSolRequired) {
          Alert.alert(
            'Insufficient SOL',
            `You need at least ${minSolRequired} SOL for transaction fees and to create the recipient's USDC account. You have ${solBalanceInSol.toFixed(6)} SOL.`
          );
          setIsSending(false);
          return;
        }
      } else if (solBalanceInSol < 0.0001) {
        Alert.alert(
          'Insufficient SOL',
          `You need SOL for transaction fees. You have ${solBalanceInSol.toFixed(6)} SOL.`
        );
        setIsSending(false);
        return;
      }
      
      const { blockhash } = await connection.getLatestBlockhash();
      
      // Create transaction
      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: feePayer,
      });
      
      console.log('[Transaction] Fee payer:', feePayer.toString());
      
      // If recipient doesn't have a token account, create it first
      if (needsTokenAccount) {
        const createAccountInstruction = createAssociatedTokenAccountInstruction(
          feePayer, // fee payer pays for account creation
          toTokenAccount, // account to create
          toPubkey, // account owner (recipient)
          usdcMintPubkey // token mint (USDC)
        );
        transaction.add(createAccountInstruction);
        console.log('Added instruction to create recipient token account');
      }
      
      // Add USDC transfer instruction
      // Ensure amount is a valid number (not NaN, Infinity, or negative)
      if (!Number.isFinite(amountInUSDC) || amountInUSDC < 0) {
        throw new Error(`Invalid amount for transfer: ${amountInUSDC}`);
      }
      
      console.log('[Transaction] Creating transfer instruction with amount:', amountInUSDC);
      
      const transferInstruction = createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromPubkey,
        BigInt(amountInUSDC), // Explicitly convert to BigInt
        [],
        TOKEN_PROGRAM_ID
      );
      transaction.add(transferInstruction);
      
      console.log('[Transaction] Transfer instruction added successfully');
      
      // Sign and send transaction
      console.log('Signing transaction...');
      const signedTransaction = await signTransaction(transaction);
      const signedTransactionBuffer = signedTransaction.serialize();
      
      console.log('Broadcasting transaction to Solana...');
      const signature = await connection.sendRawTransaction(signedTransactionBuffer, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      
      console.log('Transaction broadcasted with signature:', signature);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('Transaction confirmed!');
      
      // Save transaction to local storage
      const newTransaction: TransactionType = {
        id: signature,
        signature,
        type: 'send',
        currency: 'USDC',
        amount: parseFloat(amount as string),
        recipient: recipient as string,
        address: recipientAddress,
        timestamp: Date.now(),
        status: 'confirmed',
        comment: comment as string | undefined,
      };
      
      await saveTransaction(newTransaction);
      console.log('Transaction saved to local storage');
      
      setTransactionSent(true);
      setTxSignature(signature);
      setIsSending(false);

    } catch (error) {
      console.error('Error sending transaction:', error);
      Alert.alert('Error', `Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSending(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name || name.length < 3) return name?.toUpperCase() || 'U';
    return name.slice(0, 2).toUpperCase();
  };

  if (transactionSent) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.placeholder} />
          <Text style={styles.title}>Send</Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Success Message */}
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
          <Text style={styles.successTitle}>You sent {recipient}</Text>
          <Text style={styles.successAmount}>${amount} USDC</Text>
        </View>

        {/* Back to Home Button */}
        <TouchableOpacity style={styles.homeButton} onPress={handleClose}>
          <Text style={styles.homeButtonText}>Back to home</Text>
        </TouchableOpacity>

        {/* See Receipt Button */}
        <TouchableOpacity style={styles.receiptButton}>
          <Text style={styles.receiptButtonText}>See receipt</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Send</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Recipient Card */}
      <View style={styles.recipientCard}>
        <View style={styles.recipientInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(recipient as string)}</Text>
          </View>
          <View>
            <Text style={styles.sendingToText}>↗ You&apos;re sending money to</Text>
            <Text style={styles.recipientName}>{recipient}</Text>
          </View>
        </View>
      </View>

      {/* Amount Display */}
      <View style={styles.amountContainer}>
        <Text style={styles.currencySymbol}>$</Text>
        <Text style={styles.amountText}>{amount}</Text>
      </View>

      {/* Comment Display */}
      {comment && (
        <View style={styles.commentCard}>
          <Text style={styles.commentLabel}>Comment</Text>
          <Text style={styles.commentText}>{comment}</Text>
        </View>
      )}

      {/* Send Button */}
      <TouchableOpacity 
        style={[styles.sendButton, isSending && styles.sendButtonDisabled]} 
        onPress={handleSendTransaction}
        disabled={isSending}
      >
        {isSending ? (
          <ActivityIndicator color="#000000" />
        ) : (
          <>
            <Text style={styles.sendIcon}>↗</Text>
            <Text style={styles.sendButtonText}>Send with Ca¢hin</Text>
          </>
        )}
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
  closeButton: {
    width: 50,
    height: 50,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 24,
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
  recipientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    padding: 20,
    marginBottom: 30,
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFB380',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  sendingToText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  recipientName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  amountContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    padding: 30,
    marginBottom: 30,
    alignItems: 'center',
    position: 'relative',
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#666666',
    position: 'absolute',
    top: 30,
    left: 30,
  },
  amountText: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#666666',
    textAlign: 'center',
  },
  commentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    padding: 20,
    marginBottom: 30,
  },
  commentLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 5,
  },
  commentText: {
    fontSize: 16,
    color: '#000000',
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendIcon: {
    fontSize: 24,
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 100,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  checkmark: {
    fontSize: 60,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 18,
    color: '#666666',
    marginBottom: 10,
  },
  successAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#000000',
  },
  homeButton: {
    backgroundColor: '#E8B5E8',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  homeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  receiptButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  receiptButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
});
