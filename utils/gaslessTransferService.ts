/**
 * Gasless Transfer Service (User-Signed)
 * 
 * User signs the transaction on their device, then backend adds paymaster signature.
 * This is a non-custodial model where users control their keys.
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, u64 } from '@solana/spl-token';

export interface GaslessTransferRequest {
  userAddress: string;
  recipientAddress: string;
  amount: number; // in smallest units (e.g., USDC has 6 decimals, so 1000000 = 1 USDC)
  tokenMint?: string; // defaults to USDC if not provided
  createRecipientAccount?: boolean; // whether recipient needs token account created
  paymasterPublicKey: string; // paymaster who will pay fees
  rpcUrl: string; // Solana RPC URL
}

export interface GaslessTransferResponse {
  success: boolean;
  signature: string;
  message: string;
}

/**
 * Execute a gasless transfer
 * 
 * 1. Create transaction with paymaster as fee payer
 * 2. User signs on frontend
 * 3. Send to backend for paymaster signature
 * 4. Backend broadcasts
 * 
 * @param backendUrl URL of your auth-proxy backend
 * @param request Transfer parameters
 * @param signTransaction Function to sign transaction (from useTurnkey hook)
 * @returns Transaction signature
 */
export async function executeGaslessTransfer(
  backendUrl: string,
  request: GaslessTransferRequest,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<GaslessTransferResponse> {
  try {
    console.log('[Gasless Service] Starting gasless transfer');
    console.log('[Gasless Service] User:', request.userAddress);
    console.log('[Gasless Service] Recipient:', request.recipientAddress);
    console.log('[Gasless Service] Amount:', request.amount);

    // Connect to Solana
    const connection = new Connection(request.rpcUrl, 'confirmed');

    // Create public keys
    const userPubkey = new PublicKey(request.userAddress);
    const recipientPubkey = new PublicKey(request.recipientAddress);
    const paymasterPubkey = new PublicKey(request.paymasterPublicKey);
    const mintPubkey = new PublicKey(
      request.tokenMint || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    ); // Default to USDC

    // Get token accounts
    const userTokenAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mintPubkey,
      userPubkey
    );
    const recipientTokenAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mintPubkey,
      recipientPubkey
    );

    console.log('[Gasless Service] User token account:', userTokenAccount.toString());
    console.log('[Gasless Service] Recipient token account:', recipientTokenAccount.toString());

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    // Create transaction with paymaster as fee payer
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: paymasterPubkey,
    });

    // If recipient needs token account, create it
    if (request.createRecipientAccount) {
      console.log('[Gasless Service] Adding create token account instruction');
      const createAccountIx = Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        mintPubkey,
        recipientTokenAccount,
        recipientPubkey,
        paymasterPubkey // payer
      );
      transaction.add(createAccountIx);
    }

    // Add transfer instruction
    // Ensure amount is a valid integer and convert to BigInt
    if (!Number.isFinite(request.amount) || request.amount < 0) {
      throw new Error(`[Gasless Service] Invalid amount: ${request.amount}`);
    }
    
    console.log('[Gasless Service] Creating transfer instruction with amount:', request.amount);
    
    const transferIx = Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      userTokenAccount,
      recipientTokenAccount,
      userPubkey,
      [],
      new u64(request.amount.toString())
    );
    transaction.add(transferIx);

    console.log('[Gasless Service] Transaction created, requesting user signature...');

    // User signs the transaction
    const signedTransaction = await signTransaction(transaction);
    console.log('[Gasless Service] User signature added');

    // Serialize transaction
    const serializedTransaction = signedTransaction.serialize({
      requireAllSignatures: false, // Paymaster hasn't signed yet
    }).toString('base64');

    console.log('[Gasless Service] Sending to backend for paymaster signature...');

    // Send to backend
    const response = await fetch(`${backendUrl}/execute-gasless-transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ serializedTransaction }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Backend error: ${errorData.error || response.statusText}`);
    }

    const result = await response.json();

    console.log('[Gasless Service] ✅ Transfer successful');
    console.log('[Gasless Service] Signature:', result.signature);

    return result;
  } catch (error) {
    console.error('[Gasless Service] Error:', error);
    throw error;
  }
}

/**
 * Check if recipient needs a token account created
 */
export async function checkRecipientTokenAccount(
  connection: any, // Connection from @solana/web3.js
  recipientAddress: string,
  tokenMint: string = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // Default: USDC
): Promise<boolean> {
  try {
    const { PublicKey } = await import('@solana/web3.js');
    const { Token, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');

    const recipientPubkey = new PublicKey(recipientAddress);
    const mintPubkey = new PublicKey(tokenMint);

    const tokenAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mintPubkey,
      recipientPubkey
    );
    const accountInfo = await connection.getAccountInfo(tokenAccount);

    return accountInfo === null; // true if account needs to be created
  } catch (error) {
    console.error('[Gasless Service] Error checking token account:', error);
    return true; // assume needs creation if check fails
  }
}
