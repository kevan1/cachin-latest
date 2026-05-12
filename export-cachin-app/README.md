# export.cachin.app

Static site for Privy `exportWallet` flow (web-only), intended to be deployed on Vercel.

## Deploy

1. Set Vercel project root to `export-cachin-app/`.
2. Assign custom domain `export.cachin.app`.
3. Add `https://export.cachin.app` to **Allowed origins** in your Privy Dashboard client settings.

## Runtime input

The page expects query params from the mobile app:

- `appId`
- `clientId`
- `chain` (`solana`)
- `address` (optional)

Example:

`https://export.cachin.app/?appId=...&clientId=...&chain=solana&address=...`
