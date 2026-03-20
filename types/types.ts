import { ChainType } from '@/constants/chains';

export enum OtpType {
  Email = "OTP_TYPE_EMAIL",
  Sms = "OTP_TYPE_SMS",
}

export interface Transaction {
  id: string;
  signature: string;
  type: 'send' | 'receive';
  amount: number; // in token units (SOL, USDC, USDT, etc)
  currency: 'SOL' | 'USDC' | 'USDT'; // Currency type
  chain: ChainType; // Which blockchain this transaction is on
  recipient?: string; // for send transactions
  sender?: string; // for receive transactions
  address: string; // recipient address for send, sender address for receive
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  comment?: string;
  blockTime?: number;
  fee?: number; // in lamports
  currencyEquivalent?: string; // For display purposes (e.g., "ARS 1,000")
}
