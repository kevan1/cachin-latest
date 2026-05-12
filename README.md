# Cachin

> **Spend more effortlessly across LATAM.**

Cachin is a LATAM-first payments app that helps tourists, foreigners, digital nomads, and crypto-paid freelancers fund globally and pay locally by scanning supported local QR payments. The MVP starts in Argentina with two routes: direct Cachin merchant QR for onboarded locations, and normal Mercado Pago/MODO-style QR coverage through supported provider rails.

The user experience is intentionally simple: fund, scan, confirm FX/fees, pay. Crypto is abstracted behind the scenes through stablecoin/Solana rails, wallet abstraction, provider integrations, KYC where required, and a support layer. Direct Cachin QR proves the controlled end-to-end payment experience; provider-routed QR is the coverage layer that lets Cachin expand without requiring every merchant to adopt a new QR first.

---

## Quick Links for Judges & Reviewers

| What | Where |
|------|-------|
| **Hackathon submission summary** | [`docs/cachin-hackathon-submission.html`](docs/cachin-hackathon-submission.html) — open in browser |
| **Pitch deck (11 slides)** | [`docs/cachin-pitch-deck-draft.html`](docs/cachin-pitch-deck-draft.html) — open in browser |
| **iOS TestFlight build** | https://testflight.apple.com/join/atKvfkTp |
| **Android APK** | See submission summary (link added at submission time) |
| **Walkthrough video (Loom)** | See submission summary (link added at submission time) |
| **2-minute demo script** | [`docs/cachin-demo-script-2min.md`](docs/cachin-demo-script-2min.md) |
| **Proof pack (evidence index)** | [`docs/proof/`](docs/proof/) — see [Proof Pack](#proof-pack) section below |
| **Claim-safe language reference** | See [submission HTML, "Claim-Safe Language" section](docs/cachin-hackathon-submission.html) |
| **CachinPOS (separate merchant POS repo)** | https://github.com/kevan1/CachinPOS |

If you are an AI agent or reviewer scanning this repo for the first time, also read [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md). They explain how the repository is laid out and what each subdirectory is for.

## Table of Contents

- [What Cachin Does](#what-cachin-does)
- [Why Solana](#why-solana)
- [Current Hackathon Scope](#current-hackathon-scope)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup](#setup)
- [Backend Setup](#backend-setup)
- [Proof Pack](#proof-pack)
- [Submission Notes](#submission-notes)

## What Cachin Does

- Lets users fund from crypto or external rails and pay local QR payments.
- Starts with an Argentina MVP, where QR payments are common and foreign users often cannot pay like locals.
- Supports two QR paths: direct Cachin merchant QR for a controlled, already-onboarded merchant flow, and supported normal local QR rails through provider/payment partners.
- Shows a pre-payment confirmation before the user pays: amount, merchant/destination, FX/rate, fee, discount if any, and final total.
- Uses Sumsub KYC for supported local QR payments.
- Uses Crisp for immediate 1:1 support.
- Uses onboarded merchants as the reliability layer: lower-friction direct Cachin payments, discounts, POS tools, and merchant-side confirmation.
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
2. Scan a supported local QR in the Argentina MVP: direct Cachin merchant QR where available, or provider-routed normal QR where supported.
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

### Mobile app (React Native / Expo)

- `app/` — Expo Router screens and flows (auth, wallet actions, transfers, send/receive, balance, card setup).
- `components/` — shared UI components and primitives (`components/ui`).
- `hooks/` — reusable hooks (wallet polling, KYC state, etc.).
- `services/` — API, wallet, payment, and provider helpers.
- `utils/` — small typed utilities.
- `constants/` — theme tokens, chain metadata, and shared literals.
- `assets/` — static images and brand assets used by the mobile app.

### Native and build

- `android/` — native Android project for `eas build` and local Gradle builds.
- `eas.json`, `app.config.ts`, `app.json` — Expo / EAS build configuration.
- `metro.config.js`, `babel.config.js`, `tsconfig.json`, `entrypoint.js` — bundler and TypeScript wiring.

### Backend (Vercel API routes)

- `backend/api/` — wallet, paymaster, identity, push, P2P, Manteca, Sumsub, and provider routes. See [Backend Setup](#backend-setup).

### Adjacent products (in this monorepo for evidence)

- `cachin_card/` — Cachin cold-wallet card: public APDU interface spec and JavaCard applet source. NXP secure element, Ed25519 on-chip, NFC + PIN. This is a separate product line documented here for moat / defensibility evidence.
- `cachin_landing/` — Next.js landing site with brand assets and product copy. Independent build (`cd cachin_landing && npm run dev`).
- `export-cachin-app/` — Privy wallet export flow.
- `auth-kevan-ar/` — auth domain assets.

### Documentation

- `docs/` — product, validation, pitch, submission, and proof-pack documents.
- `docs/proof/` — evidence index for every hackathon claim (see [Proof Pack](#proof-pack)).
- `AGENTS.md` — repository guidelines (coding style, build commands, commit etiquette).
- `CLAUDE.md` — instructions for AI coding agents working in this repo.

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

Every hackathon claim is backed by an artifact in [`docs/proof/`](docs/proof/). Each file is the **single source of truth** for what is proven, what is founder-stated, and what is pending. If a reviewer wants to challenge any claim in the submission, the corresponding file in this folder is the place to look.

| Topic | File | What it covers |
|-------|------|----------------|
| Provider rails | [`docs/proof/providers/rails-proof.md`](docs/proof/providers/rails-proof.md) | P2P.me live demo rail; Manteca scale-up path (subject to funding) |
| Support / refunds / trust | [`docs/proof/support/support-and-refunds.md`](docs/proof/support/support-and-refunds.md) | Crisp 1:1 support, failed-payment language, refund education |
| Merchants | [`docs/proof/merchants/merchant-list.md`](docs/proof/merchants/merchant-list.md) | Anonymized live merchant status; public disclosure pending merchant permission |
| POS | [`docs/proof/pos/cachinpos-proof.md`](docs/proof/pos/cachinpos-proof.md) | CachinPOS repo verification, physical device status, POS demo plan |
| Merchant economics | [`docs/proof/metrics/merchant-economics.md`](docs/proof/metrics/merchant-economics.md) | Card fee ranges, settlement delays, Argentina FX example |
| Partnerships | [`docs/proof/partnerships/fiserv-clover-proof.md`](docs/proof/partnerships/fiserv-clover-proof.md) | Fiserv/Clover active conversation status (not partnership) |
| Origin / prior work | [`docs/proof/origin/origin-timeline.md`](docs/proof/origin/origin-timeline.md) | Founder-built-from-LATAM positioning; competitor commentary stays internal |
| Card / cold wallet | [`docs/proof/card/card-proof.md`](docs/proof/card/card-proof.md) | Separate product line; references `cachin_card/` APDU spec and applet |

## Submission Notes

- Product scope: LATAM QR payments.
- MVP proof market: Argentina.
- Merchant onboarding: reliability layer and proof path, not a requirement for every merchant in the expansion strategy.
- Provider rails: coverage layer for normal local QRs; claims should stay limited to supported rails and proven countries.
- Card/cold-wallet: separate product line; mention only if the demo is ready.
- Competitors: use as validation, not accusations.

## Known Limitations (Frontier submission window)

This section is intentionally explicit. The Frontier submission is for the **LATAM QR payment flow** (Argentina MVP). Some adjacent flows in this codebase are in demo / sandbox mode and should not be presented as production behavior. They are documented here so reviewers, judges, and AI agents reading the repo can evaluate the submission fairly.

- **EVM bridge (P2P)** — `lib/server/p2p.ts` returns `mode: "simulated-devnet"` for the bridge step (source chain `solana:devnet`). This is intentional during the hackathon window; the simulated mode is surfaced to the client and should be visible in the UI rather than hidden.
- **Withdraw-to-crypto confirmation** — `app/withdraw-crypto-review.tsx` creates a local transaction record marked as `confirmed` immediately after the user confirms. This is a known stub for the withdraw-to-external-wallet flow. The submission demo focuses on the QR payment flow, not on this withdrawal path.
- **Merchant economics figures** — the 3-7% card fee range, 15-30 day settlement delay, and the Argentina 1365/1470 rate example are founder-stated ranges. Dated public proof is pending; see [`docs/proof/metrics/merchant-economics.md`](docs/proof/metrics/merchant-economics.md).
- **Live FX rate** — the QR parser (`utils/qrArs.ts`) and the withdraw screens (`app/withdraw-amount.tsx`, `app/withdraw-bank.tsx`) refuse to convert and show a loading state when the live FX feed is unavailable, rather than falling back to a stale or fake rate. There is no hardcoded fallback rate in the payment path.
- **Merchant disclosure** — some merchants are live with Cachin in Argentina; the public list is anonymized (`docs/proof/merchants/merchant-list.md`) until each merchant grants explicit disclosure permission. Names are available to judges under NDA on request.

These limitations will be closed iteratively post-submission. The submission stands on the demonstrated QR payment flow, not on these adjacent paths.
