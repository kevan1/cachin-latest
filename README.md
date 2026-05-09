# Privy + Expo Starter

This example showcases how to get started using Privy's Expo SDK inside an Expo React Native application.

## Getting Started

### 1. Clone the Project

```bash
mkdir -p privy-expo-starter && curl -L https://github.com/privy-io/privy-examples/archive/main.tar.gz | tar -xz --strip=2 -C privy-expo-starter examples-main/privy-expo-starter && cd privy-expo-starter
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Update the `app.json` file with your Privy app credentials:

```json
{
  "expo": {
    "extra": {
      "privyAppId": "your_app_id_here",
      "privyClientId": "your_client_id_here",
      "passkeyAssociatedDomain": "https://your-associated-domain.com"
    },
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp",
      "associatedDomains": ["webcredentials:your-associated-domain.com"]
    },
    "android": {
      "package": "com.yourcompany.yourapp"
    }
  }
}
```

**Important:**

- Configure an app client in your [Privy Dashboard](https://dashboard.privy.io/apps?page=settings&setting=clients)
- Add 'exp' to Allowed app URL schemas in the mobile client in your [Privy Dashboard](https://dashboard.privy.io/apps?page=settings&setting=clients)
- For Expo Go development, add `host.exp.Exponent` to Allowed app identifiers in your Dashboard
- For iOS passkey support, configure the `associatedDomains` and `passkeyAssociatedDomain`
- For mobile key export in WebView, configure `EXPO_PUBLIC_PRIVY_EXPORT_PAGE_URL=https://export.cachin.app`
- For web export, set a dedicated **web** client id: `EXPO_PUBLIC_PRIVY_EXPORT_CLIENT_ID=<privy_web_client_id>`
- Add `https://export.cachin.app` to Allowed origins in your Privy client settings

### 4. Start Development Server

```bash
npm start
```

This will start the Expo development server. You can then:

- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on your device

## Core Functionality

### 1. Login with Privy

Login or sign up using Privy's pre-built modals optimized for mobile.

[`app/index.tsx`](./app/index.tsx)

```tsx
import { usePrivy } from "@privy-io/expo";
const { user } = usePrivy();
// User is automatically shown LoginScreen if not authenticated
```

### 2. Create Multi-Chain Wallets

Programmatically create embedded wallets for multiple blockchains. Supports Ethereum, Solana, Bitcoin, and more.

[`components/userManagement/Wallets.tsx`](./components/userManagement/Wallets.tsx)

```tsx
import {
  useEmbeddedEthereumWallet,
  useEmbeddedSolanaWallet,
} from "@privy-io/expo";
import { useCreateWallet } from "@privy-io/expo/extended-chains";

const { create: createEthereumWallet } = useEmbeddedEthereumWallet();
const { create: createSolanaWallet } = useEmbeddedSolanaWallet();
const { createWallet } = useCreateWallet();

// Create Ethereum wallet
createEthereumWallet({ createAdditional: true });

// Create Solana wallet
createSolanaWallet({ createAdditional: true, recoveryMethod: "privy" });

// Create Bitcoin/other chain wallets
createWallet({ chainType: "bitcoin-segwit" });
```

### 3. Send Transactions

Send transactions on EVM-compatible chains with native mobile UX.

[`components/walletActions/EVMWalletActions.tsx`](./components/walletActions/EVMWalletActions.tsx)

```tsx
import { useEmbeddedEthereumWallet } from "@privy-io/expo";

const { wallets } = useEmbeddedEthereumWallet();
const wallet = wallets?.[0];
const provider = await wallet?.getProvider?.();

// Sign and send transaction
const response = await provider.request({
  method: "eth_sendTransaction",
  params: [
    {
      from: wallet.address,
      to: "0x0000000000000000000000000000000000000000",
      value: "1",
    },
  ],
});
```

## Relevant Links

- [Privy Dashboard](https://dashboard.privy.io)
- [Privy Documentation](https://docs.privy.io)
- [Expo SDK](https://www.npmjs.com/package/@privy-io/expo)
- [Expo Documentation](https://docs.expo.dev/)

## Vercel Backend for Sponsored Solana Transactions

This repo includes production-ready Vercel API routes in a dedicated backend app:

- `POST /api/privy-solana-wallet`
- `POST /api/privy-solana-sponsor`
- `POST /api/solana-paymaster`
- `POST /api/identity-verification-link`
- `POST /api/push/register`
- `POST /api/push/unregister`
- `POST /api/push/helius-webhook`
- `POST /api/push/helius-sync`

They live in:

- [`backend/api/privy-solana-wallet.ts`](./backend/api/privy-solana-wallet.ts)
- [`backend/api/privy-solana-sponsor.ts`](./backend/api/privy-solana-sponsor.ts)
- [`backend/api/solana-paymaster.ts`](./backend/api/solana-paymaster.ts)
- [`backend/api/identity-verification-link.ts`](./backend/api/identity-verification-link.ts)
- [`backend/api/push/[action].ts`](./backend/api/push/[action].ts)

### Deploy

1. Create/link a Vercel project from `./backend`.
2. Add custom domain `api.cachin.app` to that project.
3. Configure these Vercel Environment Variables (Production and Preview):
   - `PRIVY_APP_ID`
   - `PRIVY_APP_SECRET`
   - `PRIVY_AUTHORIZATION_KEY`
   - `PRIVY_KEY_QUORUM_ID`
   - `PRIVY_GAS_SPONSOR_POLICY_IDS` (optional but recommended)
   - `SOLANA_CAIP2` (optional; defaults to mainnet value in code)
   - `PRIVY_DEBUG` (optional, set `true` only for troubleshooting)
   - `PAYMASTER_SECRET_KEY` (required for `/api/solana-paymaster`)
   - `PAYMASTER_PUBLIC_KEY` (recommended safety check against wrong key)
   - `SOLANA_RPC` (optional, defaults to `EXPO_PUBLIC_SOLANA_RPC` or Solana mainnet)
   - `P2P_EVM_RPC` (required for `/api/p2p/*`; `P2P_ENV_RPC` is also accepted as a legacy alias)
   - `P2P_EVM_CHAIN` (optional; `base` for mainnet, otherwise Base Sepolia is used)
   - `P2P_EVM_CHAIN_ID` (optional; `8453` selects Base mainnet)
   - `P2P_DIAMOND_ADDRESS` (required for `/api/p2p/*`)
   - `P2P_USDC_ADDRESS` (required for `/api/p2p/*`)
   - `P2P_SUBGRAPH_URL` (required for `/api/p2p/*`)
   - `P2P_RELAYER_PRIVATE_KEY` (required for `/api/p2p/*`)
   - `P2P_BRIDGE_SIM_FEE_BPS` (optional)
   - `MANTECA_API_KEY` / `MANTECA_API_BASE_URL` / `MANTECA_QR_PAYMENT_URL` / `MANTECA_QR_PAYMENT_PATH` (required only for `/api/manteca/*`)
   - `SUMSUB_APP_TOKEN` / `SUMSUB_SECRET_KEY` / `SUMSUB_LEVEL_NAME` (required for `/api/identity-verification-link`)
   - `SUMSUB_WEBSDK_TTL` / `SUMSUB_CALLBACK_URL` (optional for `/api/identity-verification-link`)
   - `PRIVY_JWT_VERIFICATION_KEY` (required for `/api/push/register` and `/api/push/unregister`)
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (required for push registration state; JSON or base64-encoded JSON)
   - `HELIUS_API_KEY` / `HELIUS_WEBHOOK_ID` / `HELIUS_WEBHOOK_AUTH_HEADER` (required for Helius receive push notifications)
   - `HELIUS_WEBHOOK_URL` (optional; defaults to `https://api.cachin.app/api/push/helius-webhook`)
   - `PUSH_ADMIN_SECRET` (required for `/api/push/helius-sync`)
4. Deploy from `backend/`:

```bash
cd backend
vercel deploy --prod --public
```

### Mobile App Configuration

Set `EXPO_PUBLIC_API_URL=https://api.cachin.app` for app builds.  
This is already configured in `eas.json` build profiles.

### Quick Test

```bash
curl -X POST https://api.cachin.app/api/privy-solana-wallet \
  -H "Content-Type: application/json" \
  -d '{"userId":"<privy-user-id>"}'
```

```bash
curl -X POST https://api.cachin.app/api/solana-paymaster \
  -H "Content-Type: application/json" \
  -d '{"transaction":"<base64-serialized-transaction-with-user-signature>"}'
```

```bash
curl -X POST https://api.cachin.app/api/push/helius-sync \
  -H "Authorization: Bearer <PUSH_ADMIN_SECRET>"
```
