# Cachin

Spend more effortlessly across LATAM.

Cachin is a LATAM-first payments app that helps tourists, foreigners, digital nomads, and crypto-paid freelancers fund globally and pay locally by scanning supported local QR payments. The MVP starts in Argentina with Mercado Pago/MODO-style QR flows, then expands toward broader LATAM QR rails.

The user experience is intentionally simple: fund, scan, confirm FX/fees, pay. Crypto is abstracted behind the scenes through stablecoin/Solana rails, wallet abstraction, provider integrations, KYC where required, and a support layer.

## What Cachin Does

- Lets users fund from crypto or external rails and pay local QR payments.
- Starts with an Argentina MVP, where QR payments are common and foreign users often cannot pay like locals.
- Shows a pre-payment confirmation before the user pays: amount, merchant/destination, FX/rate, fee, discount if any, and final total.
- Uses Sumsub KYC for supported local QR payments.
- Uses Crisp for immediate 1:1 support.
- Includes an optional onboarded merchant upgrade layer with lower-friction direct Cachin payments, discounts, POS tools, and merchant-side confirmation.
- Includes a separate CachinPOS project for onboarded merchant QR generation and payment acceptance.

## Why Solana

Cachin uses Solana/stablecoin rails where they improve the product:

- global funding for travelers and freelancers paid in crypto,
- fast settlement paths for merchant payments,
- low-cost payment infrastructure,
- Seeker/Solana Mobile distribution,
- composable payment primitives for Cachin-owned merchant and POS flows.

Users should not need to understand crypto to use Cachin.

## Current Hackathon Scope

For the Frontier submission, the core demo should show:

1. Open Cachin with a funded balance.
2. Scan a supported local QR in the Argentina MVP.
3. Confirm amount, destination, FX/rate, fee, discount if any, and final total.
4. Pay.
5. Show receipt/activity state.
6. Show the Crisp support entry point.

Optional secondary proof:

- CachinPOS generates a QR.
- Cachin scans and pays it.
- Merchant-side confirmation appears.

## Tech Stack

- Expo / React Native
- Expo Router
- Privy embedded wallet and passkey-style authentication
- Solana / USDC rails
- `@p2pdotme/sdk` for P2P rail integration work
- Sumsub identity verification
- Crisp support
- Firebase / push notification infrastructure
- Vercel backend API routes

## Project Structure

- `app/` - Expo Router screens and flows
- `components/` - shared UI components
- `hooks/` - reusable hooks
- `services/` - API, wallet, payment, and provider helpers
- `utils/` - small utilities
- `backend/api/` - Vercel API routes for wallet, paymaster, identity, push, P2P, and provider flows
- `docs/` - product, validation, pitch, submission, and proof-pack documents
- `docs/proof/` - evidence checklist for hackathon claims

## Setup

Install dependencies:

```bash
npm install
```

Create an environment file:

```bash
cp .env.example .env
```

Fill only the values needed for the flow you are testing. Do not commit real secrets.

Run the dev client:

```bash
npm start
```

Run on a simulator/device:

```bash
npm run ios
npm run android
```

Lint:

```bash
npm run lint
```

## Backend Setup

The backend lives in `backend/api/` and is intended for Vercel.

Important environment groups:

- Privy: `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_AUTHORIZATION_KEY`, `PRIVY_KEY_QUORUM_ID`
- Paymaster: `PAYMASTER_SECRET_KEY`, `PAYMASTER_PUBLIC_KEY`
- Solana: `SOLANA_RPC`, `SOLANA_CAIP2`
- P2P: `P2P_EVM_RPC`, `P2P_DIAMOND_ADDRESS`, `P2P_USDC_ADDRESS`, `P2P_SUBGRAPH_URL`, `P2P_RELAYER_PRIVATE_KEY`
- Manteca: `MANTECA_API_KEY`, `MANTECA_API_BASE_URL`, `MANTECA_QR_PAYMENT_URL`, `MANTECA_QR_PAYMENT_PATH`
- Sumsub: `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `SUMSUB_LEVEL_NAME`
- Crisp/mobile: `EXPO_PUBLIC_CRISP_WEBSITE_ID`
- Push: `FIREBASE_SERVICE_ACCOUNT_JSON`, `HELIUS_API_KEY`, `HELIUS_WEBHOOK_ID`, `HELIUS_WEBHOOK_AUTH_HEADER`

Deploy backend:

```bash
cd backend
vercel deploy --prod --public
```

Set the mobile app API URL:

```bash
EXPO_PUBLIC_API_URL=https://api.cachin.app
```

## Proof Pack

Hackathon claims should be backed by artifacts in `docs/proof/`:

- `docs/proof/providers/rails-proof.md` - QR/payment rail demo, Manteca/P2P proof
- `docs/proof/support/support-and-refunds.md` - Sumsub/Crisp/refund proof
- `docs/proof/merchants/merchant-list.md` - merchant proof
- `docs/proof/pos/cachinpos-proof.md` - POS proof
- `docs/proof/metrics/merchant-economics.md` - fee, settlement, and FX evidence
- `docs/proof/partnerships/fiserv-clover-proof.md` - Fiserv/Clover conversation proof

## Submission Notes

- Product scope: LATAM QR payments.
- MVP proof market: Argentina.
- Merchant onboarding: upgrade layer, not required for the basic user value.
- Card/cold-wallet: separate product line; mention only if the demo is ready.
- Competitors: use as validation, not accusations.
