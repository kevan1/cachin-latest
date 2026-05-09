# Cachin Product Context V2

Generated: 2026-05-06

## Executive Summary

Cachin is a LATAM payment app for travelers, foreigners, digital nomads, freelancers, Seeker users, and regular consumers who need to pay like locals without understanding crypto. The product scope is supported local QR rails across LATAM. The MVP and first proof wedge are in Argentina: users fund Cachin through crypto, card, SWIFT, or IBAN, then scan local QR codes such as Mercado Pago or MODO. The merchant can receive through the normal local QR/payment experience without needing to know Cachin exists. If the merchant is onboarded into Cachin, they unlock extra benefits like lower fees, faster settlement, discounts, and POS flows.

This version treats `docs/proof/` as the evidence source of truth. Anything not yet backed by a repo, screenshot, video, provider doc, merchant artifact, or written confirmation should stay labeled as founder-provided or proof pending.

The strongest narrative is not "Argentina QR wallet." The corrected narrative is:

> Spend more effortlessly across LATAM. Scan, pay, done.

Argentina is the best proof wedge because the rate difference and QR behavior are easy to explain. The market is LATAM.

## Product Definition

| Field | V2 |
|-------|----|
| Product | Cachin |
| Category | LATAM payments / QR wallet / POS / stablecoin-funded consumer app |
| Primary users | Tourists, foreigners, digital nomads, freelancers paid in crypto, Seeker users, and regular consumers |
| Merchant users | Optional enhanced side: shops, supermarkets, and local merchants already accepting or willing to accept Cachin directly |
| Core pain for users | They arrive with foreign funds or crypto income, but local merchants prefer QR/local rails or do not accept cards because fees are high. |
| Core pain for merchants | Founder conversations indicate card fees can be 3-7%, and settlement can take 15-30 days unless merchants pay more; attach proof before using exact numbers publicly. |
| Core action | Fund Cachin, scan supported local QRs across LATAM, review FX/fees/merchant/payment details, pay like a local. The current MVP demonstrates this in Argentina. |
| Enhanced merchant action | Generate a Cachin QR through POS or merchant app, accept direct Cachin payments, unlock better fees/settlement/discount loops. |
| Geographic focus | LATAM-first; Argentina is the first sharp wedge. |
| Product promise | Fund globally. Pay locally. |
| Origin promise | Built from LATAM for the world. |

## Key V2 Corrections

1. **LATAM, not Argentina-only**: Argentina should be used for proof and examples, but the product is designed for broader LATAM rollout.
2. **The app is functioning**: treat it as an active working product, not just a scaffold.
3. **Merchant onboarding is not the core product**: the core product is letting tourists/foreigners scan local QR payments; onboarded merchants are an enhanced rail with better fees, instant settlement, discounts, and POS flows.
4. **Cachin has hardware/POS differentiation, but it is not required for the first wedge**: own POS and direct Cachin merchant flows are a growth and moat layer.
5. **Cachin abstracts crypto**: common users should be onboarded into crypto rails without noticing.
6. **Seeker readiness is strategic**: Seeker users traveling in LATAM are a native Solana distribution wedge.
7. **CacaoCash is a real threat**: they publicly position around paying local QR in Latin America, but Cachin can be more complete if it proves app + merchant + POS + card.

## Proof-Aware Claim Status

| Claim | Current status | Evidence file |
|-------|----------------|---------------|
| App is built and functioning | Founder-provided; should be shown in demo video/TestFlight/APK | `docs/cachin-hackathon-submission.html` |
| Several local merchants accept Cachin | Founder-provided; needs merchant list, photos, receipts, or video | `docs/proof/merchants/merchant-list.md` |
| CachinPOS exists | Local repo and GitHub remote verified; physical device founder-provided | `docs/proof/pos/cachinpos-proof.md` |
| Cachin card / cold-wallet prototype exists | Founder-provided; needs repo link, photo, technical note, and payment demo | `docs/proof/card/card-proof.md` |
| Manteca can support broad LATAM coverage | Public site supports QR/API payments and lists LATAM presence; exact 15-country and $500/month claims need provider proof | `docs/proof/providers/rails-proof.md` |
| P2P.me is a backup rail | Founder-provided / repo-oriented; needs country support and demo evidence | `docs/proof/providers/rails-proof.md` |
| Fiserv/Clover path exists | Active conversation only; not a partnership until written confirmation or LOI | `docs/proof/partnerships/fiserv-clover-proof.md` |
| Merchant economics beat cards | Founder-provided; needs fee schedule, merchant statement, invoice, or settlement proof | `docs/proof/metrics/merchant-economics.md` |
| Sumsub KYC for scanning supported local QRs | Founder-provided; needs app screenshot/config proof | `docs/proof/support/support-and-refunds.md` |
| Crisp immediate support | Founder-provided; needs support UI screenshot / help flow proof | `docs/proof/support/support-and-refunds.md` |

## User Personas

### Traveler / Foreigner

They come from the US or Europe, fund Cachin by SWIFT, IBAN, card, or crypto, and use Cachin during their stay because QR is common in LATAM and cards are often not accepted or are economically worse.

Message:

> Land in LATAM. Pay like a local.

### Digital Nomad

They move between countries and need a wallet that works across local payment cultures without opening a bank account in every country.

Message:

> One travel wallet for local QR payments.

### Freelancer Paid In Crypto

They earn in crypto or digital dollars and need to spend locally without repeated exchange/off-ramp friction.

Message:

> Crypto income, local payments.

### Regular Consumer

They do not care about crypto. They care about discounts, speed, and an easy payment flow.

Message:

> Scan, pay, done.

### Merchant

They are not required for the core flow when the user scans an existing local QR such as Mercado Pago or MODO. If they are onboarded into Cachin, they get a better direct flow with lower fees, faster settlement, discounts, POS tools, and clearer confirmation.

Message:

> Optional upgrade: lower fees, faster settlement, more customers.

## Product Architecture Story

### Consumer App

- iOS and Android.
- Seeker-ready.
- Passkey/embedded wallet style onboarding.
- QR scanner.
- Users can scan supported local QR codes across LATAM. The MVP demonstrates this in Argentina with Mercado Pago/MODO-style flows.
- Sumsub KYC is required for the supported local QR flow.
- Onboarded merchant transfer/direct payment flows can be lower-friction, subject to limits/provider/legal review.
- Pre-payment confirmation should show amount, merchant/destination, FX/rate, fees, discount, and final total.
- Local payment routing.
- Balance/funding flow.
- Payment activity/status.
- Crisp immediate 1:1 support.

### Merchant Layer

- Merchant onboarding is an enhancement layer, not the core product.
- Several local merchants already accept the method, founder-provided.
- Onboarded merchants can receive direct Cachin flows with better fees and instant settlement.
- Merchant discounts are part of the go-to-market loop when the merchant is onboarded.
- Cachin-owned QR enables low-friction transfer/payment toward shops and supermarkets.
- Merchant confirmation exists in the POS and/or merchant app when the merchant is onboarded.

### Provider Layer

- Manteca is the preferred demo/provider rail.
- Public Manteca material supports QR/API payments and regional availability; exact "15 LATAM countries" and "$500/month" need a quote, invoice, dashboard, or email proof.
- P2P.me is the backup/secondary rail for similar flows in supported countries.
- Argentina example: founder states card dollar rate around 1365 vs crypto dollar around 1470.
- Provider coverage, production access, pricing, and exact rate examples need proof before final pitch.

### POS / Hardware Layer

- CachinPOS exists in a separate repo verified locally at `/Users/kevan/Development/CachinPOS`, with GitHub remote `https://github.com/kevan1/CachinPOS.git`.
- The founder states a physical POS device exists.
- POS is useful for onboarded merchants and proof of the full stack, but it is not required for the "scan supported local QRs across LATAM" user wedge.
- The card/cold-wallet product should be treated as a separate product line / white-label opportunity being submitted separately with a partner.
- Cachin can be framed as the first wallet to implement that card, not as a card company in the core pitch.
- The card angle is interesting because it points toward a 2-in-1 self-custodial cold wallet and Visa-enabled daily spending card, but it should stay out of the main Cachin story unless the demo is strong.

## Competitive Insight

CacaoCash publicly says "Pay any QR in Latin America like a local" and describes a traveler wallet that can be loaded from abroad and spent through Pix, Mercado Pago, Yape, and local QR rails. That validates Cachin's problem but also means the pitch cannot sound generic.

Founder context: Cachin was reportedly submitted publicly to a previous hackathon in November 2025, before the current CacaoCash concern. Treat this as origin proof pending until the old submission URL, screenshots, GitHub commits, or confirmation email are attached in `docs/proof/origin/origin-timeline.md`.

Cachin's stronger angle:

> CacaoCash is the travel QR wallet. Cachin should prove the sharper wedge: LATAM QR payments with Argentina MVP proof, Sumsub KYC, Crisp support, optional merchant upgrade rails, POS, Seeker readiness, and local founder execution. Built from LATAM for the world.

## Hard Truth

The product has too many strong angles for one simple pitch. The pitch order should be:

1. Tourist/foreigner scans a supported local QR across LATAM; the demo starts in Argentina with Mercado Pago/MODO-style flows.
2. Cachin handles funding, FX, routing, and settlement so the user pays like a local.
3. Merchant does not need to change behavior for the basic flow.
4. Onboarded merchants unlock better fees, instant settlement, discounts, POS, and direct Cachin confirmation.
5. Seeker, LATAM rails, and merchant onboarding create expansion.

Do not open with merchants, Visa BIN, cold wallet card, or POS. Use those as enhanced rails, moat, or separate product lines.

## Proof Pack Needed

Use these files as the working proof checklist:

- `docs/proof/merchants/merchant-list.md`: merchant names, status, discounts, permission, and proof links.
- `docs/proof/pos/cachinpos-proof.md`: POS repo, physical device photo, and POS -> QR -> Cachin payment video.
- `docs/proof/card/card-proof.md`: card repo, EAL6+ card photo, technical note, and payment demo.
- `docs/proof/providers/rails-proof.md`: Manteca trial/pricing/coverage proof and P2P.me fallback evidence.
- `docs/proof/partnerships/fiserv-clover-proof.md`: sanitized conversation, follow-up confirmation, LOI/pilot path.
- `docs/proof/metrics/merchant-economics.md`: card fees, settlement delay, discounts, and Argentina rate proof.
- `docs/proof/origin/origin-timeline.md`: previous hackathon submission, founder-origin proof, and competitor timing notes.
- `docs/proof/support/support-and-refunds.md`: Crisp support, refund/failed payment education, receipt/support CTA proof.

## Best Current Pitch

One-liner:

> Cachin lets tourists and foreigners fund globally, scan supported local QRs across LATAM, confirm the FX, and pay like locals. The MVP starts in Argentina.

Expanded:

> Cachin lets tourists and foreigners pay supported local QRs across LATAM like locals. They fund globally, scan local rails such as Mercado Pago, MODO, or onboarded Cachin merchant QRs in the Argentina MVP, review the FX and fees, and pay in seconds. Onboarded merchants unlock lower fees, instant settlement, discounts, and POS tools, but the user does not need merchants to change behavior to get value.
