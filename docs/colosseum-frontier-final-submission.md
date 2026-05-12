# Colosseum Frontier Final Submission

Generated: 2026-05-11

Official context checked:

- Frontier runs April 6 through May 11, 2026.
- Submissions are due May 11, 2026 at 11:59pm PT.
- There are no tracks or bounties for Frontier; judging is focused on product impact.
- Official judging criteria: functionality, potential impact, novelty, UX, open-source/composability, and business plan.

## Submission Blockers

Do not submit until these are filled:

- Demo video URL: `TODO`
- Public GitHub repo URL: `https://github.com/kevan1/cachin-latest` (confirmed public via GitHub API on 2026-05-11)
- Public README status: `TODO push local README` - GitHub `main` still showed the old "Privy + Expo Starter" README on 2026-05-11.
- App demo/TestFlight URL: `https://testflight.apple.com/join/atKvfkTp`
- APK URL: `TODO` - founder will add APK to the directory later.
- Seeker dApp version: `TODO` - uploading to dApps for Seeker version.
- POS repo visibility: `TODO` - `https://github.com/kevan1/CachinPOS` returned 404 from GitHub's public API on 2026-05-11, so omit or make public before linking.

## Project Name

Cachin

## Tagline

Spend more effortlessly across LATAM.

## One-Liner

Cachin lets tourists and foreigners fund globally, scan supported local QRs across LATAM, confirm FX and fees, and pay like locals. The MVP starts in Argentina.

## Short Description

Cachin is a LATAM-first payment app for tourists, foreigners, digital nomads, and crypto-paid freelancers who need to pay like locals. Users fund globally, scan supported local QR payments, review the FX and fees, and pay. The MVP starts in Argentina, where QR payments are everywhere but foreign users often cannot use local rails.

## Full Project Description

Latin America is QR-first, but foreign money is not. Tourists, foreigners, digital nomads, and crypto-paid freelancers often arrive with dollars, euros, cards, or stablecoins while local merchants expect QR payments. Cards are frequently expensive for merchants, cash is inconvenient for users, and local wallets are often inaccessible to visitors.

Cachin lets users fund a mobile wallet globally and pay locally across supported LATAM QR rails. The MVP starts in Argentina: a user can fund Cachin, scan a supported local QR such as a Mercado Pago/MODO-style QR, review the amount, destination, FX/rate, fees, discount if any, and final total, then pay like a local. For the basic user flow, the merchant does not need to change behavior. If a merchant onboards into Cachin, they unlock the enhanced layer: direct Cachin QR/POS flows, lower-friction settlement, discounts, and merchant-side confirmation.

Solana matters because Cachin is built around global stablecoin funding, low-cost settlement, and a user experience where crypto disappears behind a normal payment flow. Users should not need to understand wallets, gas, or tokens. They should just fund, scan, confirm, and pay. Behind the scenes, Cachin uses embedded wallet infrastructure, Solana/stablecoin rails, provider integrations, Sumsub KYC where required, and Crisp support for trust.

The product is built from LATAM for the world. Cachin is not a generic crypto wallet and not an Argentina-only app. Argentina is the MVP proof market because QR usage, foreigner payment friction, and FX differences are highly visible. The broader goal is to help global users pay across LATAM like locals, while giving onboarded merchants a better economic path than traditional card rails.

For Frontier, the most important proof is the working product: mobile app, QR scan, payment confirmation, receipt, KYC/support path, and optional CachinPOS merchant demo. The next month is about hardening provider rails, expanding merchant proof, improving refund/support flows, and turning the Argentina MVP into a repeatable LATAM rollout.

## What Was Built

- Expo/React Native mobile app for iOS and Android.
- Embedded wallet and passkey-style onboarding through Privy.
- QR payment flow for supported local payments.
- Argentina MVP path for Mercado Pago/MODO-style QR flows.
- Pre-payment confirmation pattern: amount, merchant/destination, FX/rate, fee, discount, final total.
- Sumsub KYC path for supported local QR payments.
- Crisp 1:1 support entry point.
- P2P/Manteca-style provider rail integration work.
- Optional onboarded merchant flow for Cachin-owned QR payments.
- Separate CachinPOS project for merchant QR generation and confirmation.
- Proof-pack documentation for merchants, POS, provider rails, support, origin, and economics.

## Why This Is Different

Several products are now attacking foreign funds into local payments. Cachin's wedge is not "another LATAM QR wallet." The wedge is:

- Argentina MVP proof first.
- LATAM QR scope after proof.
- Local founder execution from inside LATAM.
- Solana/Seeker-native distribution.
- Merchant/POS upgrade rails.
- Trust layer with Sumsub KYC, clear payment confirmation, receipt, and Crisp support.

Competitors validate the market. Cachin must win by showing the product actually working.

## Why Solana

Solana enables Cachin to offer fast, low-cost, stablecoin-funded payment flows that feel like normal local payments to the user. Cachin can use Solana payment primitives for app-owned merchant/POS flows, support crypto-paid freelancers directly, and build a Seeker-native travel payment experience. The blockchain is not the user-facing product; it is the settlement and funding infrastructure that makes the user-facing product possible.

## Technical Architecture

- Mobile: Expo, React Native, Expo Router.
- Wallet/auth: Privy embedded wallet and passkey-style auth.
- Chain/payment layer: Solana, USDC/stablecoin rails, SPL token primitives.
- Provider layer: P2P SDK and Manteca-style QR/payment rails.
- Identity: Sumsub KYC.
- Support: Crisp.
- Backend: Vercel API routes for wallet, paymaster, identity, provider, push, and payment orchestration.
- Optional merchant layer: CachinPOS, app-owned QR generation, merchant confirmation.

## Demo Video Script

Target length: 2:30-3:00.

### 0:00-0:15 Hook

"LATAM pays by QR. Foreign money does not. If you arrive in Argentina with a US card, crypto, or a foreign bank account, many local payment flows are still hard to use. Cachin lets you pay like a local."

### 0:15-0:35 Solution

"Cachin is a LATAM-first payment app. Users fund globally, scan supported local QRs, confirm FX and fees, and pay. The MVP starts in Argentina and expands across LATAM rails."

### 0:35-1:45 Main Demo

Show:

1. Cachin app open with funded balance.
2. QR scanner.
3. Scan supported Argentina MVP QR.
4. Confirmation screen with amount, merchant/destination, FX/rate, fee, discount if any, final total.
5. Payment confirmation.
6. Receipt/activity state.
7. Crisp support entry point.

### 1:45-2:15 Optional Merchant/POS Demo

Show:

1. CachinPOS enters amount.
2. POS generates QR.
3. Cachin scans and pays.
4. Merchant sees confirmation.

### 2:15-2:45 Technical / Solana

"Under the hood, Cachin abstracts crypto through embedded wallets, stablecoin rails, provider integrations, and Solana payment primitives. Users do not manage gas or seed phrases. They just scan, confirm, and pay."

### 2:45-3:00 Close

"Cachin is built from LATAM for the world. Spend more effortlessly. Scan, pay, done."

## Setup Instructions For Judges

Recommended path: watch the demo video first. The app depends on provider keys and KYC/payment rails that are not safe to publish.

Local setup:

```bash
git clone https://github.com/kevan1/cachin-latest.git
cd cachin-latest
npm install
cp .env.example .env
npm start
```

Run on device/simulator:

```bash
npm run ios
npm run android
```

Backend:

```bash
cd backend
vercel deploy --prod --public
```

Required env groups are documented in `README.md` and `.env.example`.

## Founder / Team

Kevan, solo founder from Argentina.

Relevant context:

- Built from LATAM for the world.
- Lived experience with QR payment behavior, foreigner payment friction, and merchant card-fee pain.
- SMB holder.
- solxAR member.
- Superteam Germany member.
- Built Cachin mobile app and CachinPOS.

## Business Plan

Cachin starts with tourists and foreigners paying supported local QRs across LATAM, beginning with Argentina. The first business path is payment spread / service fees where compliant and provider-supported. The second path is onboarded merchant economics: lower-friction direct Cachin payments, merchant discounts, POS tooling, and faster settlement. A separate card/cold-wallet product line can become a white-label revenue path, but it is not required for the core Cachin submission.

## Open-Source / Composability

Cachin is designed integration-first:

- use existing Solana/stablecoin payment primitives where possible,
- integrate provider rails instead of building unnecessary custom on-chain logic,
- expose a clear mobile/payment flow,
- keep optional merchant/POS flows composable with Solana payment standards.

## Final Checklist

- [ ] Paste final demo video URL.
- [x] Confirm public repo visibility for `https://github.com/kevan1/cachin-latest`.
- [ ] Push/confirm the Cachin README setup instructions are visible on GitHub.
- [x] Add TestFlight link: `https://testflight.apple.com/join/atKvfkTp`.
- [ ] Add APK link after the APK is placed in the directory.
- [ ] Add Seeker dApp listing/link after upload.
- [ ] Confirm POS repo visibility or omit POS repo link.
- [ ] Test every link in an incognito/private browser.
- [ ] Do not mention Visa BIN or card as core unless demo-ready.
- [ ] Do not say "live in 15 countries" unless provider proof is attached.
- [ ] Do not say "Fiserv/Clover partnership" unless written confirmation exists.
- [ ] Do not accuse CacaoCash or anyone else of copying in the public submission.
