# Cachin Proof Pack

Generated: 2026-05-06

Purpose: this is the evidence checklist for claims that are strong but currently founder-provided. Use this before the hackathon submission, deck, demo video, grant application, or investor conversation.

## Rule

For every big claim, collect at least one of:

- public link
- dated screenshot
- short video
- transaction/order receipt
- GitHub repo
- signed/forwardable email
- letter of intent
- invoice/quote
- provider documentation
- merchant testimonial

Do not expose secrets, API keys, private customer data, merchant bank details, or private chat content without permission.

## Current Proof Status

| Area | Status | Next proof to add |
|------|--------|-------------------|
| Merchants | Founder-provided | Fill `docs/proof/merchants/merchant-list.md` with 3 merchants and one payment proof. |
| CachinPOS | Local repo and GitHub remote verified | Add physical device photo and POS -> QR -> Cachin payment video. |
| Card / cold wallet | Founder-provided white EAL6+ prototype context | Add repo link, card photo, technical note, and payment demo. |
| Fiserv/Clover | Active conversation only | Send follow-up email and capture written confirmation or pilot next step. |
| Manteca | Public site supports QR/API payments and regional availability; founder has one-day trial | Add trial screenshot, coverage screenshot/email, and $500/month quote/invoice/dashboard proof. |
| P2P.me | Backup rail, founder-provided / repo-oriented | Add supported-country docs and a demo order/payment proof. |
| Merchant economics | Founder-provided | Add merchant fee/settlement evidence and dated Argentina FX comparison. |
| Origin / prior art | Founder-provided previous public hackathon submission | Add submission URL, confirmation email, archived page, GitHub commits, or dated screenshots. |
| Support / refunds | Founder-provided Crisp support setup | Add support UI screenshot, failed/pending/refund explanation, and receipt support CTA. |

## 1. Merchant Acceptance

### Claim

Several local merchants already accept Cachin payments. This is an enhanced merchant layer, not required for the core LATAM QR user flow. The MVP proves the user flow in Argentina first.

### What Proves It

| Evidence | Strength | Notes |
|----------|----------|-------|
| Merchant list with name, category, city, country, status, and contact permission | High | Mark public/private. Do not publish private contacts. |
| Photo/video of the Cachin QR at the merchant location | High | Include date and merchant name if allowed. |
| Screen recording: customer scans QR -> payment submitted -> merchant sees accepted | Very high | Best proof for judges. |
| Receipt/order log with amount, timestamp, merchant, and status | Very high | Redact private IDs if needed. |
| Merchant quote/testimonial | High | One sentence is enough. |
| Discount proof | Medium/high | Show "5% off with Cachin" or similar if real. |

### Merchant List Template

| Merchant | City/Country | Category | Public? | Accepts Cachin? | Discount | Proof Link | Notes |
|----------|--------------|----------|---------|-----------------|----------|------------|-------|
| TBD | TBD | TBD | yes/no | live/pilot/test | TBD | TBD | TBD |

### Minimum For Hackathon

- 3 merchants listed.
- 1 public merchant or anonymized merchant proof.
- 1 video of a real or staged merchant payment.
- 1 screenshot of merchant-side confirmation.

## 2. Cachin POS

### Claim

Cachin has its own POS that generates QR and accepts Cachin payment/card flows. This proves the onboarded merchant upgrade layer, not the core tourist LATAM QR flow.

### Existing Local Evidence

- Local directory: `/Users/kevan/Development/CachinPOS`
- GitHub remote: `https://github.com/kevan1/CachinPOS.git`
- README states the POS goal: enter amount, generate Solana Pay QR for USDC, let the main Cachin app scan and pay.
- Physical device exists, founder-provided.

### What Proves It

| Evidence | Strength | Notes |
|----------|----------|-------|
| Public GitHub repo with README, setup, screenshots, and demo GIF/video | High | Make sure secrets are not committed. |
| Photo of the physical POS device running CachinPOS | High | Put next to a paper date/name if needed. |
| Video: POS enters amount -> QR generated -> Cachin app scans -> payment completes | Very high | This should be in the 3-minute demo or linked separately. |
| APK/TestFlight/build artifact or release | Medium/high | Useful for judges if they want to test. |
| Architecture diagram linking POS -> QR -> app -> settlement | Medium | Helps explain but does not replace video. |

### Minimum For Hackathon

- POS GitHub link.
- POS README updated with screenshots.
- 60-second POS demo video.
- Physical device photo.

## 3. Cachin Card / Cold-Wallet Card

### Claim

Cachin has a white EAL6+ card / cold-wallet-style card that can become a daily spending instrument. This is now treated as a separate product line / white-label opportunity being submitted separately with a partner. Cachin can be described as the first wallet implementation if that is true and demo-proven.

### Current Status

Founder states there is another repo and a physical white card with no branding. This is not yet visible in the current app repo.

Do not make the card central to the Cachin hackathon pitch unless the separate card demo is ready.

### What Proves It

| Evidence | Strength | Notes |
|----------|----------|-------|
| Photo of the card next to phone/POS | Medium | Good visual, but not enough alone. |
| Public or private repo link showing card integration code | High | Can be private for investors, public for hackathon if safe. |
| Demo video: tap/insert/use card -> POS accepts payment -> app/activity reflects payment | Very high | This is the differentiator. |
| Technical one-pager: secure element, EAL6+, signing model, custody model, limits | High | Especially important for judges/security reviewers. |
| Threat model / safety model | High | Explains why users should not store large balances and how daily-spend limits work. |
| Visa BIN plan memo | Medium | Roadmap proof, not current product proof. |

### Minimum For Hackathon

- Photo of card.
- Short demo or technical explanation.
- Clear status label: `prototype`, `working prototype`, or `roadmap`.
- Do not overclaim Visa/global acceptance unless BIN path is confirmed.

## 4. Fiserv / Clover

### Claim

Founder is in conversation with Fiserv/Clover to enable Cachin on POS devices quickly.

### What Proves It

| Evidence | Strength | Notes |
|----------|----------|-------|
| Sanitized email screenshot showing sender domain, date, and topic | Medium/high | Blur names/emails if needed. |
| Meeting invite or calendar event | Medium | Shows active conversation, not commitment. |
| Follow-up email summarizing next steps | High | Best low-friction proof. |
| Letter of intent or pilot agreement | Very high | Strongest proof. |
| Partner integration notes / API requirements / ticket number | High | Shows concrete path beyond "we talked." |
| Intro source / warm contact proof | Medium | Useful for investor credibility. |

### How To Prove It More

Send a concise follow-up email:

```text
Subject: Cachin x Fiserv/Clover pilot next steps

Hi [Name],

Thanks again for discussing Cachin. My understanding is:

- Cachin is exploring enabling QR/POS payments for LATAM merchants through [Fiserv/Clover].
- The initial pilot would focus on [merchant type/country].
- Next technical step is [API/app marketplace/terminal integration step].
- Target demo/pilot timeline is [date].

Can you confirm this summary is accurate, and whether I can reference the conversation as an active pilot discussion in my hackathon materials?

Best,
Kevan
```

If they reply "yes," that is much stronger than a vague chat screenshot.

### Minimum For Hackathon

- Say "in active conversations" only.
- Do not say "partnership" unless signed.
- Include sanitized proof privately if judges/investors ask.

## 5. Manteca Coverage

### Claim

Manteca can help Cachin launch across 15 LATAM countries, but it costs roughly $500/month and you currently have a one-day trial for demo.

### Public Evidence

- Manteca public site: `https://manteca.dev/`
- Manteca pricing page: `https://manteca.dev/pricing`
- Manteca QR payments terms mention QR payment processing in enabled jurisdictions.
- Public site evidence checked on 2026-05-06: Manteca describes `API PAGOS / Pagos QR` with PIX, QR 3.0, Plin, Yape, QR Bolivia, and Colombia Bre-b, plus unified access to QR payment systems. The same public page lists LATAM/beyond presence including Argentina, Brazil, Chile, Colombia, Bolivia, Costa Rica, Guatemala, Panama, Paraguay, Peru, and Mexico. Treat exact "15 countries" as founder/provider-confirmed until you have a Manteca dashboard/email/doc screenshot listing all 15.
- Pricing page evidence checked on 2026-05-06: the public pricing page exposes API Payments docs/licensing links but did not visibly show the `$500/month` price in the crawl. Prove the $500/month claim with a quote, invoice, dashboard, or email.

### What Proves It

| Evidence | Strength | Notes |
|----------|----------|-------|
| Manteca docs/screenshot listing country coverage | High | Best proof for "15 countries." |
| Trial activation email or dashboard screenshot | High | Redact API keys. |
| Pricing page/screenshot showing paid plan or API Payments access | Medium/high | Supports funding ask. |
| Demo video using Manteca trial | Very high | Show it works, even if trial expires. |
| Email from Manteca confirming coverage and pricing | Very high | Best if public docs are unclear. |

### How To Phrase It

Good:

> Manteca gives Cachin a provider path to LATAM QR/payment coverage. I have a short trial for the demo; keeping the rail live requires paid access.

Avoid:

> Cachin is live in 15 countries.

Say that only after coverage, production access, and country-specific flows are proven.

## 6. P2P.me Backup Rail

### Claim

P2P.me is the second solution and works similarly in different countries.

### What Proves It

| Evidence | Strength | Notes |
|----------|----------|-------|
| Existing repo code paths and backend endpoints | Medium/high | Already visible in this repo. |
| Provider docs showing supported countries/currencies | High | Needed for country claims. |
| Demo transaction/order with status | Very high | Best proof. |
| Comparison table: Manteca vs P2P.me | Medium | Helps judges understand fallback. |

### Recommended Positioning

> Cachin is rail-agnostic. Manteca is the preferred provider path for the polished demo; P2P.me is the backup/secondary rail for similar flows in supported countries.

## 7. Funding Need

### Claim

You need funding to keep Manteca live after the one-day trial.

### What Proves It

| Evidence | Strength | Notes |
|----------|----------|-------|
| Pricing screenshot / invoice / plan quote | High | Redact account details. |
| Trial expiry screenshot | High | Shows urgency. |
| Budget line in deck | Medium | "$500/month Manteca license keeps LATAM rail active." |

### How To Use In Pitch

This is a good, concrete ask:

> $500/month keeps the Manteca rail online after the demo trial. With that, Cachin can continue testing merchant payments beyond the hackathon demo window.

## 8. Origin / Prior Art

### Claim

Cachin was built from LATAM for the world, and the founder states the idea was already public in a previous hackathon submission in November 2025.

### What Proves It

| Evidence | Strength | Notes |
|----------|----------|-------|
| Previous hackathon submission URL | Very high | Best public proof. |
| Submission confirmation email | High | Redact private data if needed. |
| GitHub commits/tags from before the current hackathon | High | Shows implementation timeline. |
| Demo video or screenshots from the old submission | High | Good for judges/investors. |
| Archive/Wayback link | Medium/high | Useful if the old page changed. |

### How To Phrase It

Good:

> Cachin is built from LATAM for the world, based on lived local payment friction and prior public work.

Avoid:

> CacaoCash copied Cachin.

Use that only if you have legal-grade evidence and actually want to escalate.

## 9. Support / Refund / Trust Layer

### Claim

Cachin uses Crisp for immediate 1:1 support and should educate users about pending payments, failed payments, refunds, and wrong QR scans.

### What Proves It

| Evidence | Strength | Notes |
|----------|----------|-------|
| Screenshot of Crisp support entry point | High | Show in app and/or website. |
| Receipt screen with support CTA | High | Gives tourists confidence. |
| Failed/pending payment support flow | Very high | Best proof for trust. |
| FAQ/help page explaining support and refunds | High | Needed before public launch. |

### How To Phrase It

Good:

> Every payment has a clear receipt and direct support. If something goes wrong, Cachin support is available through Crisp.

Avoid:

> Payments can never fail.

## Proof Folder Structure

This structure now exists locally. Add safe public artifacts or private/redacted links into these files and folders:

```text
docs/proof/
  merchants/
    merchant-list.md
    merchant-payment-demo.mp4
    merchant-confirmation-screenshots/
  pos/
    cachinpos-github-link.md
    physical-device-photo.jpg
    pos-demo.mp4
  card/
    card-photo.jpg
    card-demo.mp4
    card-technical-note.md
  providers/
    manteca-coverage.md
    manteca-trial-proof-redacted.png
    p2pme-coverage.md
  partnerships/
    fiserv-clover-summary-redacted.md
  metrics/
    fee-settlement-comparison.md
    argentina-rate-example.md
  origin/
    origin-timeline.md
  support/
    support-and-refunds.md
```

## Priority Order

1. Record the app payment demo: funded balance -> scan QR -> payment confirmation -> activity.
2. Add 3 merchants to `docs/proof/merchants/merchant-list.md`.
3. Record the CachinPOS demo: amount entry -> QR -> Cachin scan -> payment complete.
4. Photograph the physical POS and white EAL6+ card.
5. Capture Manteca trial and pricing/coverage proof.
6. Send the Fiserv/Clover confirmation email and store the reply redacted.
7. Add P2P.me backup rail evidence.
8. Add previous public hackathon submission proof.
9. Add Crisp support/refund/trust proof.

Only commit files that are safe to make public. Keep sensitive proof private and reference it as "available on request."

## Pitch Language

Use this now:

> Cachin has a working app that lets tourists and foreigners fund globally and scan supported local QRs across LATAM. The MVP proves the flow in Argentina. Sumsub handles KYC for supported local QR payments, and Crisp provides immediate 1:1 support. Merchant onboarding is the upgrade layer: lower fees, instant settlement, discounts, POS tools, and direct confirmation. The card/cold-wallet product is a separate white-label product line where Cachin can be the first wallet implementation.

Avoid this until fully proven:

> Cachin is partnered with Fiserv/Clover.
> Cachin is live in 15 countries.
> Cachin works globally with Visa.
