# Cachin Product Review V2

Generated: 2026-05-06

Scope: corrected product review using repo evidence plus founder-provided context. This version separates product strength from evidence readiness.

## Executive Summary

Cachin is strongest when framed as a LATAM QR payment app for tourists and foreigners, with Argentina as the MVP/proof market, not as a merchant network. Merchant onboarding is an upgrade layer: better fees, instant settlement, discounts, POS tools, and direct merchant confirmation when a merchant opts in. The remaining product risk is trust: users need clear KYC expectations, pre-payment confirmation, support/refund education, and proof that scanning a Mercado Pago/MODO-style QR works reliably in the Argentina MVP.

## Scorecard

| Dimension | Score | Summary |
|-----------|-------|---------|
| Onboarding Flow | 8/10 | Strong if the app keeps crypto abstracted and leads with "scan, pay, done." |
| Core Experience | 7.8/10 | Strong if the LATAM QR flow works live in the Argentina MVP: scan local QR, show FX/fees, pay, confirm. |
| Error Handling | 6.8/10 | Crisp support helps, but payment recovery, refunds, failed QR/provider states, and support copy still need clearer UX. |
| Information Architecture | 7.4/10 | Clearer now: supported local QR consumer core, onboarded merchant upgrade, separate card product line. |
| Visual Design & Polish | 8/10 | App polish appears strong; external brand should be travel/payment-first, not crypto-first. |
| Performance | 7/10 | Good enough for demo if the payment route is controlled and pre-tested. |
| Accessibility | 6/10 | Good mobile base; payment and QR flows need accessibility/i18n polish for mainstream users. |
| Feature Completeness | 7.4/10 | Strong for hackathon if supported local QR payment proof is captured; merchant/POS/card proof should be secondary. |
| Evidence Readiness | 6.2/10 | Proof structure exists, but the artifacts still need to be filled. |
| **Overall** | **7.0/10** | Strong hackathon candidate once the proof folder is populated. |

## Top 3 Strengths

1. **LATAM QR wedge**: tourists can scan supported local QRs without the merchant changing behavior; the MVP proves this in Argentina.
2. **Distribution wedge**: LATAM travel, freelancers, Seeker users, solxAR/Superteam network, and existing merchants.
3. **Upgrade path**: onboarded merchants create economic upside without being required for initial user value.
4. **Origin credibility**: "Built from LATAM for the world" is a credible authenticity wedge if prior public submission proof is attached.

## Top 3 Improvements

1. **Proof over claims**: fill `docs/proof/` and record the supported local QR payment demo first.
2. **Scope discipline**: open with tourists scanning local QRs; use merchant onboarding as upgrade and card as separate product line.
3. **Compliance-safe language**: say Sumsub KYC is required for supported local QR payments; describe onboarded merchant transfers carefully and subject to limits/compliance.

## Detailed Review

### Onboarding Flow (8/10)

**Working well**: passkey-style onboarding and crypto abstraction fit the mainstream user.

**Needs improvement**: the first screen should communicate "scan local QRs across LATAM, starting in Argentina" before wallet infrastructure.

**Fix**: "Spend more effortlessly across LATAM. Fund globally, scan locally."

### Core Experience (7.5/10)

**Working well**: QR scan and payment routing are the correct core. The correction is that the basic value does not require merchant onboarding.

**Needs improvement**: the demo must show a supported local QR payment in the Argentina MVP, not only an onboarded merchant/POS payment.

**Fix**: record an end-to-end supported local QR flow: scan Mercado Pago/MODO-style QR -> pre-payment confirmation with FX/fees/final total -> pay -> user receipt -> merchant/local confirmation where applicable.

### Error Handling (6/10)

**Working well**: validation and backend error surfacing exist in the app, and Crisp gives a concrete support layer.

**Needs improvement**: travelers need confidence around pending payments, failed payments, refunds, support, and wrong QR scans before they trust the app with a real trip payment.

**Fix**: add user-facing states and education: "Pending", "Paid", "Failed", "Refund requested", "Contact support", plus a Crisp support CTA on receipt and failed-payment screens.

### Information Architecture (7/10)

**Working well**: app/payment surfaces are broad enough.

**Needs improvement**: the pitch and product need separate layers: consumer supported local QR app, onboarded merchant upgrade, provider rails, support/refund layer, and separate card product line.

**Fix**: one architecture slide with five layers: user funding, supported local QR routing, confirmation/support, onboarded merchant upgrade, LATAM/provider expansion.

### Visual Design & Polish (8/10)

**Working well**: the app has strong native polish and onboarding feel.

**Needs improvement**: pitch visuals should show tourist payment anxiety, QR scan, pre-payment confirmation, receipt/support, optional merchant/POS confirmation, and Seeker context.

**Fix**: replace abstract crypto visuals with proof screenshots and merchant/POS footage linked from `docs/proof/`.

### Performance (7/10)

**Working well**: enough for a controlled hackathon demo.

**Needs improvement**: payment flows depend on provider/rate/network state and KYC state.

**Fix**: create a pre-tested supported local QR demo and fallback recording; add onboarded merchant/POS demo as a secondary clip.

### Accessibility (6/10)

**Working well**: mobile-native flows are a good base.

**Needs improvement**: mainstream LATAM users require language, contrast, clear amounts, and safe QR/payment confirmation.

**Fix**: localize the main payment path and make numbers/rates/discounts visually explicit.

### Feature Completeness (7.5/10)

**Working well**: app + LATAM QR + merchant upgrade direction is compelling. The card direction is compelling but should be treated as separate.

**Needs improvement**: the strongest features need artifacts, not just founder context.

**Fix**: populate `docs/proof/support/`, `docs/proof/providers/`, `docs/proof/metrics/`, and the supported local QR demo first. Then add merchant/POS/card proof.

## Roadmap

### Quick Wins (< 1 day)

- [ ] Update README to LATAM-first.
- [ ] Add merchant economics section.
- [ ] Add CacaoCash comparison in competition section.
- [ ] Add Seeker-ready note.
- [ ] Record one LATAM QR payment flow demonstrated in the Argentina MVP.
- [ ] Add Crisp support/refund explanation to website and onboarding.
- [ ] Add pre-payment confirmation checklist: amount, merchant/destination, FX/rate, fee, discount, final total.

### Medium Effort (1-3 days)

- [ ] Record onboarded merchant/POS QR generation and payment as secondary demo.
- [ ] Keep Cachin card/cold-wallet payment as separate project proof.
- [ ] Add merchant list/proof to `docs/proof/merchants/merchant-list.md`.
- [ ] Add country coverage/provider proof.
- [ ] Add P2P.me backup rail proof.
- [ ] Add previous public hackathon submission proof to `docs/proof/origin/origin-timeline.md`.
- [ ] Add refund/failed payment UX copy.

### Major Investment (1+ week)

- [ ] Fiserv/Clover integration proof-of-concept for merchant upgrade layer.
- [ ] Visa BIN/self-custodial card pitch as separate product with partner.
- [ ] Country-by-country compliance/risk matrix.
- [ ] Merchant dashboard/settlement proof.
