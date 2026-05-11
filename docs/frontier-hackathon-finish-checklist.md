# Frontier Hackathon Finish Checklist

Generated: 2026-05-11

Source: the "How to Win Frontier Hackathon" image, adapted to Cachin.

## Current Best Positioning

> Cachin lets tourists and foreigners fund globally, scan supported local QRs across LATAM, confirm the FX, and pay like locals. The MVP starts in Argentina.

Use this exact framing:

- **LATAM scope**: supported local QR payments across LATAM.
- **Argentina proof**: MVP/demo market with Mercado Pago/MODO-style flows.
- **Merchant onboarding**: upgrade layer, not the core product.
- **Card/cold-wallet**: separate product line; mention only if demo-ready.
- **Competitors**: validation and urgency, not copying accusations.

## Finish Priority

### P0: Must Finish Before Submission

These are the things that can make or break the submission.

1. **Record the main product demo**
   - Target length: under 2 minutes if possible.
   - First 10 seconds: show the pain and hook.
   - Required flow:
     - Open Cachin with funded balance.
     - Scan supported local QR in the Argentina MVP.
     - Show pre-payment confirmation: amount, merchant/destination, FX/rate, fee, discount if any, final total.
     - Pay.
     - Show receipt/activity state.
     - Show Crisp support entry point.
   - File proof target: `docs/proof/providers/rails-proof.md`.

2. **Add a real demo link**
   - Add one of:
     - Loom video.
     - YouTube unlisted video.
     - TestFlight link.
     - APK link.
     - Expo preview if reliable.
   - Then update `docs/cachin-hackathon-submission.html`.

3. **Test every submission link**
   - App demo link.
   - GitHub repo link.
   - CachinPOS repo link.
   - Proof videos.
   - Deck link.
   - Any website/waitlist link.
   - Broken links make the demo look fake.

4. **Fill the proof pack enough to stop relying on founder claims**
   - `docs/proof/merchants/merchant-list.md`: add 3 merchants, even if anonymized.
   - `docs/proof/support/support-and-refunds.md`: add Crisp screenshot and refund/pending/failure explanation.
   - `docs/proof/providers/rails-proof.md`: add Manteca trial proof or P2P.me fallback proof.
   - `docs/proof/metrics/merchant-economics.md`: add dated FX comparison and merchant fee/settlement evidence.

5. **Create the final deck**
   - Structure:
     - Problem.
     - Solution.
     - Demo.
     - Team.
   - Keep text light.
   - Use screenshots and demo frames, not abstract crypto graphics.
   - First slide hook:
     - "LATAM pays by QR. Foreign money does not."
   - Demo slide:
     - Show Cachin actually working.

6. **Finalize submission copy**
   - Use `docs/cachin-hackathon-submission.html` as the source.
   - Keep claims safe:
     - "active conversations with Fiserv/Clover", not "partnership."
     - "Manteca provider path", not "live in 15 countries."
     - "Sumsub KYC for supported local QR payments", not broad "no KYC."
     - "Built from LATAM for the world", not competitor accusations.

## P1: Strongly Recommended

These improve credibility and judge memory.

1. **Record a secondary POS demo**
   - POS enters amount.
   - POS generates QR.
   - Cachin app scans and pays.
   - Merchant-side confirmation appears.
   - Add proof to `docs/proof/pos/cachinpos-proof.md`.

2. **Add founder/team proof**
   - Solo Argentine founder.
   - SMB holder.
   - solxAR member.
   - Superteam Germany member.
   - Link real work:
     - GitHub.
     - Cachin app.
     - CachinPOS.
     - Prior hackathon submission if available.

3. **Create the "why us" slide**
   - Built from LATAM for the world.
   - Local founder with lived payment friction.
   - Working mobile app.
   - Merchant/POS upgrade path.
   - Seeker-ready direction.
   - Crisp support and Sumsub KYC trust layer.

4. **Create competitor slide**
   - Mention CacaoCash, SurfCash, SQRIL, MiniPay, Offramp as validation.
   - Do not accuse anyone of copying.
   - Differentiation:
     - Argentina MVP proof.
     - Merchant/POS upgrade.
     - Solana/Seeker-native angle.
     - Local founder execution.

5. **Post progress publicly**
   - One X post with demo clip.
   - One X post with founder story.
   - One X post with merchant/POS proof.
   - One X post after submission.

## P2: Optional / Do Not Let This Block Submission

These are useful, but not required to submit Cachin well.

- Full LATAM provider coverage proof for every country.
- Final Fiserv/Clover partnership.
- Visa BIN / card story.
- Private rails implementation.
- Full merchant dashboard.
- Perfect website.
- Perfect brand system.
- Long investor deck.

Mention these only as roadmap or separate product line unless the demo is already strong.

## Image Checklist Mapped To Cachin

### Foundation

- [x] Specific problem: tourists/foreigners cannot pay like locals across LATAM QR rails.
- [x] Specific audience: tourists/foreigners first, then nomads, freelancers, Seeker users.
- [x] Working MVP: founder states app is functioning.
- [ ] Actual implementation proof: needs final demo video and working links.

### During The Hackathon

- [x] Build exists.
- [ ] Polish the payment confirmation flow: amount, merchant, FX, fee, discount, final total.
- [ ] Document everything in `docs/proof/`.
- [ ] Test every link before submitting.

### Deck

- [ ] Loom/demo video under 2 minutes.
- [ ] First 10 seconds hook.
- [ ] Less text, more product proof.
- [ ] Slides: Problem -> Solution -> Demo -> Team.
- [ ] Show the product working, not just architecture.

### Team

- [ ] Add founder slide with why you matter.
- [ ] Link GitHub and shipped work.
- [ ] Highlight local founder advantage: built from LATAM for the world.

### After Submission

- [ ] Keep posting progress on X.
- [ ] Keep onboarding merchants.
- [ ] Keep improving the QR demo.
- [ ] Keep collecting proof artifacts.

## Final 24-Hour Execution Order

1. Record the main Cachin QR payment demo.
2. Add the demo link to the submission doc.
3. Fill minimum proof pack rows.
4. Create or polish the deck.
5. Record Loom using the deck and live product proof.
6. Test every link.
7. Submit.
8. Post the demo thread on X.

## Final Submission One-Liner

> Cachin helps tourists and foreigners pay supported local QRs across LATAM like locals. They fund globally, scan locally, confirm FX and fees, and pay. The MVP starts in Argentina.
