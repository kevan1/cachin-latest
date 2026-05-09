# Implementacion Tecnica: P2P ARS en Cachin (Solo Solana de entrada, sin Avalanche)

## 1. Alcance actualizado

Esta version reemplaza el alcance anterior y asume:

- No se utiliza Avalanche/Fuji en la nueva implementacion de pagos ARS.
- El rail de deposito principal sigue siendo Solana.
- Se integra `@p2pdotme/sdk` para el lifecycle P2P en ARS.
- Se agrega lectura de QR argentino (MercadoPago) usando `@p2pdotme/sdk/qr-parsers`.

## 2. Estado actual del proyecto (base real)

- Scanner QR actual parsea:
  - `cachin.app/<username>`
  - `solana:<address>?...` (Solana Pay)
  - address Solana directa
  Archivo: `utils/qrScan.ts`
- Pantalla scanner:
  Archivo: `app/(main)/scanner.tsx`
- Flujo de deposito cripto actual:
  Archivo: `app/crypto-deposit.tsx`
- Flujo de retiro ARS existente en UI (todavia mock/parcial):
  Archivo: `app/withdraw-bank.tsx`
- Hay partes multi-chain con Avalanche, pero fuera de este alcance nuevo.

## 3. Decision de arquitectura (sin Avalanche)

### 3.1 Railes

- Entrada de fondos: Solana (USDC/SOL, preferente USDC).
- Settlement P2P: red EVM donde corra el stack P2P (`diamond + usdc + subgraph`) en entorno de prueba.

Nota: aunque Cachin no use Avalanche, `@p2pdotme/sdk/orders` requiere backend EVM operativo para order flow.

### 3.2 Flujo end-to-end

1. Usuario deposita en Solana.
2. Backend confirma deposito y crea `deposit_event`.
3. Orquestador bridgea (o simula bridge en dev) al rail EVM de settlement.
4. Backend acredita saldo interno.
5. Backend crea orden P2P ARS con `@p2pdotme/sdk/orders`.
6. En `accepted`, se setea destino ARS cifrado (`setSellOrderUpi`), usando alias/CBU/CVU valido.
7. App consulta estado de orden y muestra lifecycle.

## 4. Feature nueva: lectura QR Argentina con P2P SDK

## 4.1 Objetivo

Extender scanner para soportar QR MercadoPago/EMV ARS.

## 4.2 Implementacion recomendada

1. Agregar dependencia en app:

```bash
npm i @p2pdotme/sdk
```

2. Crear parser dedicado, por ejemplo:
`utils/qrArs.ts`

3. Usar `parseQR` del SDK:
- `currency: "ARS"`
- `sellPrice`: traer desde backend o `fetchArsPrice()`

4. Integrar en `parseQrScanData()`:
- intentar primero parseo actual (Cachin + Solana)
- si no matchea, intentar parser ARS
- devolver nuevo tipo:
  - `kind: "arsMercadoPago"`
  - `paymentAddress`
  - `amountFiat?`

5. En `app/(main)/scanner.tsx`:
- manejar `arsMercadoPago` y navegar a flujo ARS (por ejemplo `withdraw-bank` o una nueva pantalla `ars-pay-request`).

## 4.3 Importante sobre el parser ARS del SDK

En el SDK actual, el parser ARS prioriza `paymentAddress` (merchant name/tag 59) y no siempre entrega monto estructurado.

Por eso:
- usar `paymentAddress` como dato principal,
- y resolver monto/quote por backend cuando el QR no lo provea de forma confiable.

## 5. Cambios concretos por archivo (prioridad)

## 5.1 Fase A - Solo Solana en runtime

1. `utils/balanceService.ts`
- eliminar hardcode RPC mainnet
- usar `getSolanaRpcUrl()`

2. `utils/transactionListener.ts`
- mismo ajuste de RPC

3. `utils/privySponsorship.ts` y `backend/api/privy-solana-sponsor.ts`
- no depender de `SOLANA_CAIP2` hardcodeado a mainnet
- parametrizar por entorno

## 5.2 Fase B - Integracion P2P ARS backend

Crear servicio backend nuevo (sugerido):
- `backend/api/p2p/order-create.ts`
- `backend/api/p2p/order-status.ts`
- `backend/api/p2p/order-set-payment-address.ts`

Responsabilidades:
- inicializar `createOrders/createProfile/createPrices`
- ejecutar `approveUsdc` + `placeOrder` (cuando corresponda)
- exponer polling de estado a app
- validar alias/CBU/CVU antes de `setSellOrderUpi`

## 5.3 Fase C - Scanner QR ARS

1. `utils/qrScan.ts`
- agregar union type `arsMercadoPago`
- fallback parse usando SDK QR parser

2. `app/(main)/scanner.tsx`
- manejar `kind === "arsMercadoPago"`
- routing a pantalla ARS correspondiente

3. `app/withdraw-bank.tsx`
- validar input con regla ARS real (alias y CBU/CVU)
- disparar endpoint backend P2P en vez de flujo placeholder

## 6. Modelo de datos minimo (Firestore o DB)

Colecciones/tablas nuevas:

- `deposit_events`
  - `id`, `userId`, `solanaTx`, `mint`, `amount`, `status`, `createdAt`
- `bridge_jobs`
  - `id`, `depositEventId`, `sourceChain`, `targetChain`, `status`, `targetTx`
- `p2p_orders`
  - `id`, `userId`, `orderIdOnChain`, `currency`, `status`, `meta`, `txHash`
- `ledger_entries`
  - `id`, `userId`, `type`, `amount`, `asset`, `referenceId`, `createdAt`

Estados sugeridos:
- `DETECTED_SOLANA`
- `CONFIRMED_SOLANA`
- `BRIDGED_OR_SIMULATED`
- `CREDITED`
- `ORDER_PLACED`
- `ORDER_ACCEPTED`
- `ORDER_COMPLETED` / `ORDER_FAILED`

## 7. Configuracion de entornos (dev)

### App (Expo)

- `EXPO_PUBLIC_SOLANA_RPC=<devnet rpc>`
- `EXPO_PUBLIC_API_URL=<backend dev>`

### Backend

- `SOLANA_RPC=<devnet rpc>`
- `SOLANA_CAIP2=<devnet caip2>`
- `P2P_EVM_RPC=<settlement rpc>`
- `P2P_DIAMOND_ADDRESS=<dev>`
- `P2P_USDC_ADDRESS=<dev>`
- `P2P_SUBGRAPH_URL=<dev>`
- `P2P_RELAYER_PRIVATE_KEY=<dev>`

## 8. Criterios de aceptacion

1. Deposito Solana en devnet se refleja en balance interno sin usar Avalanche.
2. Scanner acepta:
- QR Solana/Cachin existentes
- QR ARS MercadoPago via parser P2P
3. Retiro ARS crea orden P2P real en backend.
4. Alias/CBU/CVU invalido bloquea envio.
5. Activity refleja estado de orden P2P hasta completion.

## 9. Orden de ejecucion sugerido

1. Parametrizacion Solana-only (RPC/CAIP2/env).
2. Backend P2P ARS endpoints.
3. Integracion UI retiro ARS contra backend.
4. Integracion QR ARS en scanner.
5. Telemetria + alertas + pruebas E2E.

## 10. Estado implementado (Fase B + C + bridge devnet)

Implementado en este proyecto:

- Lógica compartida de backend:
  - `lib/server/p2p.ts`
- Endpoints backend Vercel:
  - `backend/api/p2p/order-create.ts`
  - `backend/api/p2p/order-status.ts`
  - `backend/api/p2p/order-set-payment-address.ts`
  - `backend/api/p2p/bridge-solana.ts`
- Endpoints Expo API routes (paridad local):
  - `app/api/p2p/order-create+api.ts`
  - `app/api/p2p/order-status+api.ts`
  - `app/api/p2p/order-set-payment-address+api.ts`
  - `app/api/p2p/bridge-solana+api.ts`
- Integracion app:
  - `utils/p2pOrders.ts`
  - `app/withdraw-bank.tsx` (submit real a backend)

### 10.1 Comportamiento actual de `order-create`

- Valida `paymentAddress` con `validateArgentinePaymentId`.
- Carga `sellPrice` ARS on-chain via `createPrices`.
- Resuelve montos:
  - si input `ARS`: calcula USDC con `sellPrice`.
  - si input `USD/USDC`: calcula ARS con `sellPrice`.
- Verifica allowance USDC (`createProfile.getUsdcAllowance`).
- Si falta allowance: ejecuta `approveUsdc`.
- Crea orden SELL ARS (`placeOrder`).
- Si la orden ya esta `accepted` y hay pubkey de merchant: ejecuta `setSellOrderUpi`.
- Si no esta aceptada: responde `nextAction = SET_PAYMENT_ADDRESS_WHEN_ACCEPTED`.

### 10.2 Comportamiento actual de `bridge-solana`

- Valida firma Solana y la consulta en `SOLANA_RPC`.
- Si la tx no existe o fallo: responde error.
- Si confirma: ejecuta bridge simulado de devnet (`mode = simulated-devnet`) y devuelve:
  - `sourceAmountUsdc`
  - `bridgedAmountUsdc`
  - `simulatedTargetTxHash`
  - `status = BRIDGED_OR_SIMULATED`

Nota: esta implementacion es intencionalmente simulada para devnet y permite luego reemplazar por proveedor real de bridge sin cambiar contrato API.

### 10.3 Nuevas variables recomendadas

- `P2P_EVM_CHAIN=base-sepolia` (o `base` en prod)
- `P2P_EVM_CHAIN_ID=84532` (opcional; `8453` para base mainnet)
- `P2P_BRIDGE_SIM_FEE_BPS=20` (opcional)

### 10.4 Payload de referencia

`POST /api/p2p/order-create`

```json
{
  "userId": "did:privy:...",
  "amount": "15000",
  "currency": "ARS",
  "paymentAddress": "mi.alias.mp",
  "method": "mercadopago",
  "solanaTxSignature": "5f...abc"
}
```

`POST /api/p2p/order-status`

```json
{
  "orderId": "12345"
}
```

`POST /api/p2p/order-set-payment-address`

```json
{
  "orderId": "12345",
  "paymentAddress": "mi.alias.mp"
}
```

`POST /api/p2p/bridge-solana`

```json
{
  "userId": "did:privy:...",
  "solanaTxSignature": "5f...abc",
  "amountUsdc": "10.0"
}
```
