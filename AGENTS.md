# Repository Guidelines

This file is for **human contributors and AI coding agents** working in this repository. If you are reviewing the project for the Frontier Hackathon submission, start with [`README.md`](README.md) and [`docs/cachin-hackathon-submission.html`](docs/cachin-hackathon-submission.html) instead.

## Hackathon Context

Cachin is submitted to the Solana Frontier Hackathon. The submission's claim-safe language and source of truth are documented in:

- [`docs/cachin-hackathon-submission.html`](docs/cachin-hackathon-submission.html) — the submission document itself.
- [`docs/frontier-hackathon-finish-checklist.md`](docs/frontier-hackathon-finish-checklist.md) — what was prioritized and why.
- [`docs/proof/`](docs/proof/) — evidence index for every public claim.

When editing public-facing text (README, marketing copy, deck, submission HTML), follow the claim-safe rules:

- "Active conversations with Fiserv/Clover" — **not** "partnership".
- "P2P.me is the live demo rail; Manteca is the scale-up path subject to funding" — **not** "live in 15 countries via Manteca".
- "Cachin cold-wallet is a separate product line" — **not** "global Visa card / production-ready".
- "Sumsub KYC for supported local QR payments" — **not** "no KYC".
- "Built from LATAM for the world" — **not** competitor copying accusations.

## Project Structure & Module Organization

This is an Expo (React Native) mobile app with a Vercel backend, plus two adjacent products in the same repo (`cachin_card/` cold-wallet spec, `cachin_landing/` Next.js landing). See [`README.md`](README.md#project-structure) for the full layout.

- `app/` contains Expo Router screens and navigation flows (auth, wallet actions, transfers). Keep screen-specific logic here.
- `components/` holds shared UI and primitives (`components/ui`). Reuse before adding new variants.
- `hooks/`, `services/`, `utils/`, and `constants/` house typed logic, API/wallet helpers, small utilities, and theme/chain metadata. Keep side effects in hooks/services, not components.
- `config/firebase.ts`, `assets/`, `scripts/`, and native projects (`ios/`, `android/`) round out the platform; root configs (`app.json`, `eas.json`, `babel.config.js`, `metro.config.js`, `tsconfig.json`, `entrypoint.js`) drive builds and tooling.

## Build, Test, and Development Commands
- `npm start` — runs `expo start --dev-client`; press `i`/`a` to launch iOS/Android simulators.
- `npm run ios` / `npm run android` — build and run the dev client on a simulator/device.
- `npm run lint` — ESLint via the Expo preset; resolve all issues before committing.
- Optional: `npx expo start --web` for quick layout checks in the browser.

## Coding Style & Naming Conventions
- TypeScript-first, functional components, 2-space indent. Follow eslint-config-expo defaults.
- Screens/components use `PascalCase` file names; helpers, hooks, and variables use `camelCase`. Hooks must start with `use*`.
- Keep styling co-located with components; prefer theme tokens from `constants/theme.ts` or `constants/Colors.ts` over ad-hoc hex values.
- Favor small, typed helpers in `utils/` and extend shared constants instead of duplicating literals.

## Testing Guidelines
- Automated tests are not set up yet; run `npm run lint` and manually verify core flows (login, wallet creation, send/withdraw).
- If you add tests, mirror screen/component names under `__tests__/` or `*.test.tsx`, and cover hooks/services with unit tests. Include setup steps in your PR when introducing new tooling.

## Commit & Pull Request Guidelines
- Use short, imperative commit messages, matching existing history (`fix: adjust wallet polling`, `chore: update deps`). One topic per commit.
- PRs should include a concise summary, screenshots or recordings for UI changes, testing notes (simulators/devices), and any config updates (`app.json`, `eas.json`, native bundle IDs).
- Link issues/tasks when available, and flag breaking changes or new environment requirements explicitly.

## Security & Configuration Tips
- Do not commit real Privy app IDs, Firebase secrets, or passkey domains. Keep placeholders in `app.json`; load secrets via env-backed `app.config.js` if needed.
- Document any new client IDs or associated domains in PRs so reviewers can reproduce builds locally and on EAS.

## Imported Claude Cowork project instructions
