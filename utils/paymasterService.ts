import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import Constants from 'expo-constants';

/**
 * Paymaster Service
 * 
 * This service allows a designated paymaster wallet to pay gas fees on behalf of users.
 * The paymaster wallet must be pre-funded with SOL to cover transaction fees.
 * 
 * Flow:
 * 1. User builds transaction with their instruction (e.g., token transfer)
 * 2. Transaction fee payer is set to paymaster address
 * 3. User signs transaction (partial signature)
 * 4. Paymaster signs transaction (completes signature)
 * 5. Fully signed transaction is broadcast to Solana network
 */

export interface PaymasterConfig {
  /** Paymaster's public key (this wallet pays gas fees) */
  paymasterPublicKey: string;
  /** Solana RPC endpoint */
  rpcEndpoint: string;
  /** Whether paymaster is enabled */
  enabled: boolean;
}

export interface PaymasterTransaction {
  /** The transaction to be signed by paymaster */
  serializedTransaction: string;
  /** User's signature (partial) */
  userSignature?: string;
}

function getExtraConfig(): Record<string, any> {
  return (Constants.expoConfig?.extra as Record<string, any> | undefined) ?? {};
}

function parseEnabled(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
}

/**
 * Get default paymaster configuration from environment
 */
export function getPaymasterConfig(): PaymasterConfig {
  const extra = getExtraConfig();
  const enabledValue =
    process.env.EXPO_PUBLIC_PAYMASTER_ENABLED ??
    extra.paymasterEnabled ??
    extra.paymaster?.enabled;
  return {
    paymasterPublicKey:
      process.env.EXPO_PUBLIC_PAYMASTER_PUBLIC_KEY ||
      extra.paymasterPublicKey ||
      extra.paymaster?.publicKey ||
      '',
    rpcEndpoint:
      process.env.EXPO_PUBLIC_SOLANA_RPC ||
      extra.solanaRpc ||
      extra.paymaster?.rpcEndpoint ||
      'https://api.devnet.solana.com',
    enabled: parseEnabled(enabledValue),
  };
}

/**
 * Get the base URL for the paymaster API route.
 */
export function getPaymasterApiUrl(): string {
  const extra = getExtraConfig();
  return (
    process.env.EXPO_PUBLIC_PAYMASTER_API_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    extra.paymasterApiUrl ||
    extra.paymaster?.apiUrl ||
    ''
  );
}

/**
 * Check if paymaster is available and configured
 */
export function isPaymasterAvailable(): boolean {
  const config = getPaymasterConfig();
  return config.enabled && !!config.paymasterPublicKey;
}

/**
 * Prepare a transaction with paymaster as fee payer
 * 
 * @param connection Solana connection
 * @param instructions Transaction instructions to execute
 * @param userPublicKey User's wallet public key (signer of instructions)
 * @param paymasterPublicKey Paymaster's public key (pays fees)
 * @returns Transaction ready for user to sign
 */
export async function preparePaymasterTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  userPublicKey: PublicKey,
  paymasterPublicKey: PublicKey
): Promise<Transaction> {
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();

  // Create transaction with paymaster as fee payer
  const transaction = new Transaction({
    recentBlockhash: blockhash,
    feePayer: paymasterPublicKey, // Paymaster pays the fees!
  });

  // Add all instructions
  instructions.forEach(instruction => transaction.add(instruction));

  return transaction;
}

/**
 * Add user's partial signature to transaction
 * 
 * @param transaction Transaction to sign
 * @param userSignFunction User's sign function from Turnkey
 * @param userAccount User's wallet account
 * @returns Serialized transaction with user's signature
 */
export async function addUserSignature(
  transaction: Transaction,
  userSignFunction: any,
  userAccount: any
): Promise<string> {
  // Serialize transaction for signing
  const serializedTransaction = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  const unsignedTransaction = serializedTransaction.toString('hex');

  // Sign with user's key via Turnkey
  const signedTransactionHex = await userSignFunction({
    walletAccount: userAccount,
    unsignedTransaction: unsignedTransaction,
    transactionType: 'TRANSACTION_TYPE_SOLANA',
  });

  return signedTransactionHex;
}

/**
 * Verify transaction before broadcasting
 */
export function verifyTransaction(transaction: Transaction): boolean {
  try {
    // Check if transaction has signatures
    if (!transaction.signatures || transaction.signatures.length === 0) {
      console.error('[Paymaster] Transaction has no signatures');
      return false;
    }

    // Check if all required signatures are present
    const requiredSignatures = transaction.compileMessage().header.numRequiredSignatures;
    const providedSignatures = transaction.signatures.filter(sig => sig.signature !== null).length;

    if (providedSignatures < requiredSignatures) {
      console.error(`[Paymaster] Missing signatures: ${requiredSignatures} required, ${providedSignatures} provided`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Paymaster] Transaction verification failed:', error);
    return false;
  }
}

/**
 * Estimate transaction fee
 */
export async function estimateTransactionFee(
  connection: Connection,
  transaction: Transaction
): Promise<number> {
  try {
    const fee = await connection.getFeeForMessage(
      transaction.compileMessage(),
      'confirmed'
    );
    return fee.value || 5000; // Default to 5000 lamports if estimation fails
  } catch (error) {
    console.error('[Paymaster] Fee estimation failed:', error);
    return 5000; // Default fee
  }
}

/**
 * Format paymaster info for display
 */
export function formatPaymasterInfo(config: PaymasterConfig) {
  if (!config.enabled) {
    return 'Paymaster: Disabled (User pays fees)';
  }
  
  const shortKey = config.paymasterPublicKey.slice(0, 4) + '...' + config.paymasterPublicKey.slice(-4);
  return `Paymaster: ${shortKey}`;
}

/**
 * Send partially signed transaction to paymaster backend for completion
 * 
 * @param transaction Transaction with user's signature
 * @param backendUrl URL of the paymaster backend endpoint
 * @returns Fully signed transaction ready to broadcast
 */
export async function sendToPaymaster(
  transaction: Transaction,
  backendUrl: string
): Promise<string> {
  try {
    console.log('[Paymaster] Sending transaction to backend for paymaster signature');
    console.log('[Paymaster] Backend URL:', backendUrl);

    // Serialize transaction (with user's signature)
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    const base64Transaction = Buffer.from(serializedTransaction).toString('base64');

    // Send to backend
    const baseUrl = backendUrl.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/solana-paymaster`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: base64Transaction,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Paymaster backend error: ${errorData.error || response.statusText}`);
    }

    const { signature } = await response.json();

    if (!signature) {
      throw new Error('No signature returned from paymaster');
    }

    console.log('[Paymaster] Received fully signed transaction from backend');

    return signature;
  } catch (error) {
    console.error('[Paymaster] Error communicating with backend:', error);
    throw error;
  }
}
