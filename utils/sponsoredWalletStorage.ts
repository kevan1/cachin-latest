import AsyncStorage from "@react-native-async-storage/async-storage";

const SPONSORED_SOLANA_WALLET_ID_KEY = "sponsored_solana_wallet_id_v2";
const SPONSORED_SOLANA_WALLET_ADDRESS_KEY = "sponsored_solana_wallet_address_v2";

type SponsoredWallet = {
  id: string | null;
  address: string | null;
};

export async function getSponsoredSolanaWallet(): Promise<SponsoredWallet> {
  const [id, address] = await Promise.all([
    AsyncStorage.getItem(SPONSORED_SOLANA_WALLET_ID_KEY),
    AsyncStorage.getItem(SPONSORED_SOLANA_WALLET_ADDRESS_KEY),
  ]);

  return { id, address };
}

export async function setSponsoredSolanaWallet(wallet: SponsoredWallet) {
  const ops: Promise<void>[] = [];

  if (wallet.id) {
    ops.push(AsyncStorage.setItem(SPONSORED_SOLANA_WALLET_ID_KEY, wallet.id));
  } else {
    ops.push(AsyncStorage.removeItem(SPONSORED_SOLANA_WALLET_ID_KEY));
  }

  if (wallet.address) {
    ops.push(
      AsyncStorage.setItem(SPONSORED_SOLANA_WALLET_ADDRESS_KEY, wallet.address)
    );
  } else {
    ops.push(AsyncStorage.removeItem(SPONSORED_SOLANA_WALLET_ADDRESS_KEY));
  }

  await Promise.all(ops);
}
