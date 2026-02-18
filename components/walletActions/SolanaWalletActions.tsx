import { useEmbeddedSolanaWallet, usePrivy } from "@privy-io/expo";
import { View, Text, Button } from "react-native";
import { useState, useEffect, useCallback } from "react";

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { getSolanaRpcUrl } from "@/utils/solanaRpc";
import {
  getSolanaCaip2,
  sendSponsoredSolanaTransaction,
} from "@/utils/privySponsorship";

const DUMMY_BLOCKHASH = "11111111111111111111111111111111";

export default function SolanaWalletActions() {
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  const { user } = usePrivy();
  const [result, setResult] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!wallet?.publicKey) return;
    setLoadingBalance(true);
    try {
      const connection = new Connection(getSolanaRpcUrl());
      const balanceInLamports = await connection.getBalance(
        new PublicKey(wallet.publicKey)
      );
      setBalance(balanceInLamports / 1_000_000_000); // Convert lamports to SOL
    } catch (err: any) {
      console.error("Error fetching balance:", err);
    } finally {
      setLoadingBalance(false);
    }
  }, [wallet?.publicKey]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const signMessage = async () => {
    try {
      if (!wallet?.getProvider) return;
      const provider = await wallet.getProvider?.();
      if (!provider) return;
      const message = "Hello world";
      const { signature } = await provider.request({
        method: "signMessage",
        params: { message },
      });
      setResult(signature);
    } catch (err: any) {
      setResult(err?.message ?? String(err));
    }
  };

  const signTransaction = async () => {
    try {
      if (!wallet?.getProvider) return;
      const provider = await wallet.getProvider?.();
      if (!provider) return;

      const transaction = new Transaction();
      const connection = new Connection(getSolanaRpcUrl());
      transaction.recentBlockhash = (
        await connection.getLatestBlockhash("finalized")
      ).blockhash;
      transaction.feePayer = new PublicKey(wallet.publicKey);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(wallet.publicKey),
          toPubkey: new PublicKey(
            "So11111111111111111111111111111111111111112", // Replace with a valid recipient address
          ),
          lamports: 1000, // Amount in lamports (1 SOL = 1,000,000,000 lamports)
        }),
      );
      // Sign the transaction
      const { signedTransaction } = await provider.request({
        method: "signTransaction",
        params: { transaction },
      });
      setResult(JSON.stringify(signedTransaction));
    } catch (err: any) {
      setResult(err?.message ?? String(err));
    }
  };

  const signAndSendTransaction = async () => {
    try {
      if (!wallet?.publicKey) return;
      if (!user?.id) {
        setResult("User not available.");
        return;
      }
      const transaction = new Transaction();
      const connection = new Connection(getSolanaRpcUrl());
      transaction.recentBlockhash = DUMMY_BLOCKHASH;
      transaction.feePayer = new PublicKey(wallet.publicKey);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(wallet.publicKey),
          toPubkey: new PublicKey(
            "So11111111111111111111111111111111111111112", // Replace with a valid recipient address
          ),
          lamports: 1000, // Amount in lamports (1 SOL = 1,000,000,000 lamports)
        }),
      );
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      const { signature } = await sendSponsoredSolanaTransaction({
        userId: user.id,
        transactionBase64: serializedTransaction.toString("base64"),
        caip2: getSolanaCaip2(),
      });

      await connection.confirmTransaction(signature, "confirmed");
      setResult(signature);
    } catch (err: any) {
      setResult(err?.message ?? String(err));
    }
  };
  return (
    <View>
      <Text>Solana Wallet Actions</Text>
      {wallet?.publicKey && (
        <View style={{ marginVertical: 10 }}>
          <Text style={{ fontWeight: "bold" }}>Address:</Text>
          <Text style={{ fontSize: 10 }}>{wallet.publicKey}</Text>
          <Text style={{ fontWeight: "bold", marginTop: 5 }}>Balance:</Text>
          <Text>
            {loadingBalance
              ? "Loading..."
              : balance !== null
                ? `${balance} SOL`
                : "N/A"}
          </Text>
          <Button title="Refresh Balance" onPress={fetchBalance} />
        </View>
      )}
      <Button title="Sign Message" onPress={signMessage} />
      <Button title="Sign Transaction" onPress={signTransaction} />
      <Button
        title="Sign And Send Transaction"
        onPress={signAndSendTransaction}
      />
      {result && <Text>{result}</Text>}
    </View>
  );
}
