# Frontier Submission Runbook

Generated: 2026-05-11

Use this as the final operating guide for the Colosseum Frontier submission. The longer docs stay as source material; this file is the execution order.

## Official Constraints To Respect

- Frontier runs April 6 through May 11, 2026.
- Official rules list the contest end as May 11, 2026 at 11:59pm PT.
- Colosseum says Frontier has no tracks or bounties; submit for product impact.
- Judging criteria: functionality, potential impact, novelty, UX, open-source/composability, and business plan.
- The project submission, deck, video, and repository content must be in English.

If the Arena portal is still accepting submissions, submit immediately after the P0 items below. Treat the portal as the source of truth if the countdown differs from local docs.

## Verified In This Workspace

- `npm run lint` passes locally on 2026-05-11.
- Public app repo `https://github.com/kevan1/cachin-latest` is visible.
- Public app code on `main` contains the QR pre-payment confirmation fields: amount, merchant/destination, FX rate, fee, discount, and final total.
- TestFlight link provided: `https://testflight.apple.com/join/atKvfkTp`.
- Public app repo README still needs the local Cachin README pushed before submission.
- POS repo `https://github.com/kevan1/CachinPOS` is not publicly accessible at that URL.

## P0 Submission Order

1. Record and upload the main demo video.
   - Target: 2-3 minutes, never over 3 minutes.
   - First line: "LATAM pays by QR. Foreign money does not."
   - Show: funded Cachin balance, QR scan, pre-payment confirmation, pay, receipt/activity state, Crisp support.
   - Use Loom or unlisted YouTube. Make sure judges can open it in an incognito/private browser.

2. Confirm the public repository links.
   - Main app: `https://github.com/kevan1/cachin-latest` is confirmed public.
   - Public `main` README still showed the old "Privy + Expo Starter" copy on 2026-05-11; push the local Cachin README before submitting.
   - POS app: `https://github.com/kevan1/CachinPOS` returned 404 from GitHub's public API on 2026-05-11.
   - Omit the POS repo from the public submission unless you make it public or provide a different public URL.

3. Add the real demo/app links.
   - Minimum: the uploaded demo video URL.
   - TestFlight is available: `https://testflight.apple.com/join/atKvfkTp`.
   - APK is pending until the APK is placed in the directory.
   - Seeker dApp link is pending until the dApps upload is complete.
   - If the app needs private provider keys, say that judges should watch the demo first and can run the local app with env placeholders.

4. Fill the blocker fields in `docs/colosseum-frontier-final-submission.md` and `docs/cachin-hackathon-submission.html`.
   - Demo video URL.
   - Public GitHub repo URL.
   - App demo/TestFlight/APK URL.
   - POS repo visibility.

5. Add minimum proof to `docs/proof/`.
   - `docs/proof/merchants/merchant-list.md`: add 3 merchants, anonymized if needed.
   - `docs/proof/providers/rails-proof.md`: add demo URL, Manteca/P2P proof, and any provider screenshot links.
   - `docs/proof/support/support-and-refunds.md`: add Crisp screenshot/video and a short failed/pending/refund explanation.
   - `docs/proof/metrics/merchant-economics.md`: add dated fee/settlement/FX evidence, or keep exact numbers out of public copy.

6. Export/share the final deck.
   - Source draft: `docs/cachin-pitch-deck-draft.html`
   - Keep slides: Problem, Solution, Demo, Team.
   - Replace abstract slides with screenshots/demo frames if you have them.

7. Test every link in an incognito/private browser.
   - Demo video.
   - App repo.
   - POS repo.
   - Deck.
   - App/TestFlight/APK/Expo preview.
   - Any proof videos or website links.

8. Submit on Colosseum Arena.

## What I Can Do In This Workspace

- Update all submission copy and HTML artifacts.
- Turn your screenshots/videos/merchant facts into safe proof-pack entries.
- Tighten the README and setup instructions for judges.
- Check the app code for the exact demo flow.
- Run lint/type checks where available.
- Prepare the deck copy and slide structure.
- Draft the 3-minute pitch script, technical demo script, and X posts.
- Help build an APK or Expo preview if EAS/Expo credentials and env are configured locally.

## What You Need To Provide

- Final demo video URL.
- APK file/link after you place it in the directory.
- Seeker dApp listing/link after upload.
- Final pushed commit for `kevan1/cachin-latest` if you want me to verify the exact code judges will see.
- Permission to commit/push the local Cachin README if the public repo should be fixed from this workspace.
- Confirmation that `kevan1/CachinPOS` should be made public, or permission to omit the POS repo link.
- 3 merchant rows: name or anonymized label, city, category, status, public permission, discount if real.
- Proof assets: screenshots/videos for QR payment, Crisp support, Manteca/P2P, merchant/POS, and FX/fee evidence.
- Founder links you want public: GitHub, X, prior hackathon, Superteam/solxAR proof if available.

## Safe Public Positioning

Use:

> Cachin lets tourists and foreigners fund globally, scan supported local QRs across LATAM, confirm FX and fees, and pay like locals. The MVP starts in Argentina.

Use:

> Manteca gives Cachin a provider path for LATAM QR/payment coverage. I have a short demo trial; keeping the rail live after the demo requires paid access.

Use:

> Cachin is in active conversations with Fiserv/Clover.

Avoid until proven:

- "Live in 15 countries."
- "Fiserv/Clover partnership."
- "No KYC."
- "Production-ready POS."
- Public accusations that competitors copied Cachin.
- Exact card fee, settlement, or FX numbers without attached evidence.

## Portal Copy Pack

Project name:

```text
Cachin
```

Tagline:

```text
Spend more effortlessly across LATAM.
```

Short description:

```text
Cachin helps tourists and foreigners fund globally, scan supported local QR payments across LATAM, confirm FX and fees, and pay like locals. The MVP starts in Argentina, where QR payments are everywhere but foreign users often cannot access local rails.
```

One-liner:

```text
Cachin turns global funding into supported local QR payments across LATAM, starting with an Argentina MVP.
```

Demo opening:

```text
LATAM pays by QR. Foreign money does not. Cachin lets users fund globally, scan supported local QRs, confirm FX and fees, and pay like locals.
```

Technical summary:

```text
Cachin is an Expo/React Native mobile app with Privy embedded wallet onboarding, Solana/stablecoin funding rails, provider integrations for supported local QR payments, Sumsub KYC where required, and Crisp support. The app hides crypto complexity behind a normal payment flow: fund, scan, confirm, pay.
```

Judge setup note:

```text
The recommended review path is to watch the demo video first. Provider credentials, KYC/payment keys, and production payment rails are not published in the repo. The repository includes setup instructions and env placeholders so judges can inspect and run the app locally.
```
