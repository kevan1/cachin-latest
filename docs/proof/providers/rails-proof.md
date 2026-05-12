# Provider Rails Proof

Status: P2P.me is the live demo rail; Manteca is a planned scale-up subject to paid-license funding.
Last updated: 2026-05-12

## Strategy Summary

Cachin is **rail-agnostic by design**. For the Frontier Hackathon submission, the live demo rail is **P2P.me**, because it operates without a paid license and supports the LATAM QR flow Cachin needs for the Argentina MVP. **Manteca** is the planned scale-up provider once a paid `$500/month` minimum license is funded; it would unlock broader LATAM coverage. The hackathon submission does not depend on Manteca being live.

## P2P.me — Live Demo Rail

### Current Context

- P2P.me supports the LATAM QR / local-payment flow Cachin uses for the Argentina MVP: scan supported local QR -> confirm FX/fees/total -> pay -> receipt.
- This repo already includes P2P-oriented ARS/order work; see `docs/implementacion-p2p-ars-solo-solana.md` for the implementation context.
- No paid license is required for the demo footprint.

### Proof To Add

| Evidence | Status | Link / Location |
|----------|--------|-----------------|
| LATAM QR flow demo via P2P.me, Argentina MVP: scan -> confirm FX/fees/final total -> pay -> receipt | In submission Loom walkthrough | See submission HTML demo links |
| Supported countries / currencies docs | Public on P2P.me | https://p2p.me |
| Demo order/payment status screenshots | Pending public capture | Founder workspace |
| Sumsub KYC state for supported local QR payments | Required where the underlying rail requires it; documented in the app onboarding | App onboarding |

### Safe Wording

> Cachin's live demo rail is P2P.me. It supports the LATAM QR flow that Cachin's Argentina MVP demonstrates without requiring a paid provider license.

## Manteca — Planned Scale-Up Rail

### Current Context

- Public site: https://manteca.dev/
- Public pricing page: https://manteca.dev/pricing
- Founder explored a one-day Manteca trial for demo.
- License cost (founder-stated): roughly `$500/month` minimum.
- Manteca, once funded, would extend Cachin's LATAM coverage beyond the P2P.me demo footprint.
- Public Manteca pages checked on 2026-05-06 show QR/API payments and public country presence, but the exact "15 countries" claim and `$500/month` figure still need dashboard/email/quote proof.

### Proof To Add (post-funding)

| Evidence | Status | Link / Location |
|----------|--------|-----------------|
| Coverage screenshot/docs listing countries | Pending paid access | https://manteca.dev/ |
| Pricing/quote/invoice showing `$500/month` | Founder-stated; written quote pending | TBD |
| Email from Manteca confirming coverage/pricing | TBD | TBD |
| Demo using Manteca rail | Blocked on paid-license funding | N/A while on P2P.me demo rail |

### Safe Wording

> Manteca is Cachin's planned scale-up provider for LATAM coverage beyond the P2P.me demo footprint. Activation is contingent on funding the paid-license tier.

## LATAM QR Flow Demo Standard, Argentina MVP

Minimum video:

1. Open Cachin with funded balance.
2. Scan a supported local QR such as Mercado Pago or MODO.
3. Show pre-payment confirmation: amount, merchant/destination, FX/rate, fee, discount if any, final total.
4. Pay.
5. Show receipt/activity state and Crisp support entry point.
6. If possible, show what the merchant/local payment side sees.

## Summary One-Liner

> Cachin is rail-agnostic. P2P.me is the live demo rail for the Frontier Hackathon submission; Manteca is the scale-up path subject to funding.
