# Manteca QR 3.0 Test Plan

Status: implementation scaffold only. Manteca is not considered complete until API credentials, endpoint schema, sandbox evidence, and QA proof are available.

Owner correction: the staged app already has P2P.me-oriented ARS work, but Manteca was only represented by docs/config needs. QR 3.0 testing should keep the rails separated.

## User Flow

1. User scans an ARS/MercadoPago-compatible QR.
2. Scanner parses the QR and routes to `/qr-rail-select`.
3. Tester chooses one rail:
   - `P2P.me`: existing P2P ARS order flow.
   - `Manteca`: separated Manteca QR 3.0 test flow.
4. If the QR has no amount, the app asks for amount first.
5. The final submit screen calls only the selected backend rail.

## Manteca Server-Only Config

Set these in Vercel/backend runtime, not in the Expo client:

- `MANTECA_API_KEY`
- `MANTECA_API_BASE_URL`
- `MANTECA_QR_PAYMENT_URL`
- `MANTECA_QR_PAYMENT_PATH`

Use `MANTECA_QR_PAYMENT_URL` when Manteca provides the exact full QR payment endpoint. Otherwise use `MANTECA_API_BASE_URL` plus `MANTECA_QR_PAYMENT_PATH`.

## New Surfaces

- `app/qr-rail-select.tsx`: rail selection after ARS QR scan.
- `utils/mantecaOrders.ts`: Expo client call to Cachin backend.
- `lib/server/manteca.ts`: server-only Manteca adapter.
- `api/manteca/qr-payment.ts`: Vercel API endpoint.
- `backend/api/manteca/qr-payment.ts`: backend mirror endpoint.
- `app/api/manteca/qr-payment+api.ts`: Expo Router API endpoint form.

## Acceptance Criteria

- P2P.me and Manteca are selectable after QR scan.
- Choosing P2P.me does not call Manteca.
- Choosing Manteca does not call P2P.me.
- Manteca API key is never exposed in Expo public env or client bundle.
- Missing Manteca config returns a clear `MANTECA_NOT_CONFIGURED` server error.
- A sandbox QR payment can be submitted after Manteca credentials and exact endpoint/schema are confirmed.
- QA captures request/response status without logging secrets.

## Open Items

- Confirm exact Manteca authentication header requirements.
- Confirm exact QR payment endpoint path and request body schema from the Manteca dashboard/docs.
- Confirm whether a separate status/poll endpoint is required for QR payments.
- Confirm compliance/KYC ownership for Manteca-powered QR payments before launch.
