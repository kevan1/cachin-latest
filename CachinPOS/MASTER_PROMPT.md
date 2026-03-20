# CachinPOS Master Prompt

Build a minimal Expo app called **CachinPOS** (Point of Sale) that runs on **Android 6.0 (API 23)**.

## Product Requirements

- Primary flow: user enters an amount (USDC) and the app generates a **Solana Pay** QR code.
- Currency: **USDC on Solana** (SPL token mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`).
- Output: Solana Pay URI using the `solana:` scheme with query params:
  - `amount=<decimal>`
  - `spl-token=<usdc_mint>`
  - optional: `label`, `message`, `memo`
- The main Cachin app can scan the QR and pay.

## UI Requirements

- POS-style interface (not the same UI as Cachin).
- Focused layout:
  - merchant address (editable, persisted)
  - amount input
  - large QR code
  - actions: Copy link, Clear amount

## Technical Constraints

- Target Android 6.0 (API 23):
  - set `minSdkVersion: 23` via `expo-build-properties`.
  - use an Expo SDK that supports API 23 (likely SDK ~51).
- Avoid SDK 55-only modules (`@expo/ui`, `expo-glass-effect`, `expo-symbols`, `unstable-native-tabs`).
- Keep dependencies minimal; avoid wallet/auth in POS app. Merchant address is a plain Solana address string.

## Acceptance Criteria

- App launches and shows a working QR code when amount + address are set.
- QR encodes a valid `solana:` Solana Pay link for USDC.
- Merchant address persists across app restarts.

