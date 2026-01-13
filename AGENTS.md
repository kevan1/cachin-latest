# Repository Guidelines

## Project Structure & Module Organization
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
