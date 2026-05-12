# CLAUDE.md — Instructions for AI Agents in this Repository

> This file is auto-loaded by Claude Code, and is intended to give any AI agent (Claude, Cursor, Copilot Workspace, Aider, etc.) the minimum context needed to be useful in this repo without re-discovering everything from scratch.

## What this repo is

**Cachin** is a LATAM-first mobile payments app submitted to the **Solana Frontier Hackathon (Colosseum, 2026)**.

- **Product:** users fund globally, scan supported local QR payments (Mercado Pago, MODO), confirm FX/fees, and pay like locals. MVP starts in Argentina.
- **Stack:** Expo (React Native) + Expo Router + Privy embedded wallets + Solana/USDC rails + Vercel backend (`backend/api/`).
- **Adjacent products in this repo:**
  - `cachin_card/` — JavaCard cold-wallet applet + public APDU interface spec (Ed25519 on-chip, NXP secure element, NFC+PIN). Separate product line.
  - `cachin_landing/` — Next.js landing site with brand assets.
- **Separate repo:** [`CachinPOS`](https://github.com/kevan1/CachinPOS) — merchant-side POS app.

## Read these first

If you have any meaningful task to do in this repo, read these in order:

1. [`README.md`](README.md) — product overview, project structure, setup commands.
2. [`AGENTS.md`](AGENTS.md) — coding style, build commands, commit etiquette, security tips.
3. [`docs/cachin-hackathon-submission.html`](docs/cachin-hackathon-submission.html) — the canonical, claim-safe public framing of the project.
4. [`docs/frontier-hackathon-finish-checklist.md`](docs/frontier-hackathon-finish-checklist.md) — what was prioritized for submission and why.
5. [`docs/cachin-product-context.md`](docs/cachin-product-context.md) — deeper product context.

For evidence behind any specific claim in the submission, the file under [`docs/proof/`](docs/proof/) is the source of truth.

## What you should never do

- **Do not edit public-facing copy in ways that violate the claim-safe language** documented in `AGENTS.md` and at the bottom of `docs/cachin-hackathon-submission.html`. In particular, do not promote "active conversation" claims to "partnership" claims, do not promote Manteca from "scale-up path" to "live", and do not promote the card from "separate product line" to "production".
- **Do not commit secrets.** `.env`, any `*.env`, any `doc_*.env`, and anything under `~/cachin-secrets/` is off-limits. The `.gitignore` covers `.env` and `.env*.local`; if you find another secret-bearing filename, extend the `.gitignore` before touching it.
- **Do not invent merchants, screenshots, or proof artifacts.** When proof is missing, mark it as `pending` with status language, never fabricate.
- **Do not delete `cachin_card/` or `cachin_landing/`.** They are part of the submission's defensibility story, not stale code.

## Commands you can rely on

```bash
# Install
bun install            # preferred (a bun.lock is checked in)
# or
npm install

# Run dev client
npm start              # expo start --dev-client
npm run ios            # iOS simulator
npm run android        # Android emulator/device

# Lint
npm run lint

# Build APK / IPA via EAS
eas build --platform android --profile preview
eas build --platform ios --profile preview

# Backend (Vercel)
cd backend && vercel deploy --prod --public
```

## Conventions

- TypeScript-first. Functional components. 2-space indent. Follow `eslint-config-expo` defaults.
- Screen and component file names: `PascalCase`. Hooks, helpers, variables: `camelCase`. Hooks must start with `use`.
- Co-locate styles with components. Use tokens from `constants/theme.ts` or `constants/Colors.ts` before hex values.
- Keep side effects in `hooks/` and `services/`, not in components.

## If a judge or reviewer is reading the repo right now

The fastest path to "I understand this submission" is:

1. Read this file (`CLAUDE.md`) — ~2 minutes.
2. Open `docs/cachin-hackathon-submission.html` in a browser — ~5 minutes.
3. Click the TestFlight link in the submission, install the build, and try the QR payment flow — ~5 minutes.
4. If you want to check a specific claim, find the matching file in `docs/proof/` — each topic has its own file with status, safe wording, and evidence pointers.

Total: under 15 minutes to a fully grounded review.
