# Add Monad (EVM) Support to Cachin
## Problem Statement
Cachin is currently a Solana-only wallet app using Privy. We need to add Monad (EVM-compatible blockchain) support to enable users to manage both Solana and Monad assets within the same app.
## Current State
* Privy-based embedded wallet (`@privy-io/expo`) with Solana support via `useEmbeddedSolanaWallet`
* Already has `viem` installed (v2.31.6) for EVM interactions
* Balance service (`utils/balanceService.ts`) handles SOL, USDC, USDT on Solana
* Transaction service (`utils/transactionListener.ts`) fetches and parses Solana transactions
* Home screen displays single-chain (Solana) balances and transactions
* Privy automatically creates both Solana AND EVM wallets on user registration
* No chain selection or multi-chain architecture currently
## Proposed Changes
### 1. Configure Monad Chain in Privy
Update `app/_layout.tsx` to add Monad to supported chains:
* Import `defineChain` from `viem`
* Define Monad testnet/mainnet chain configs
* Add `supportedChains` prop to `PrivyProvider` with Monad
* Note: `viem` already installed, no new dependencies needed
### 2. Create Chain Configuration Constants
Create `constants/chains.ts` to define:
* Chain type enum (Solana, Monad)
* Chain metadata (name, native currency, RPC URLs, block explorers)
* Monad Testnet: Chain ID 41454, RPC: [https://testnet.monad.xyz](https://testnet.monad.xyz)
* Helper functions to get chain info
### 3. Access EVM Wallet via Privy
Update `app/(main)/index.tsx`:
* Import `useEmbeddedWallet` hook from Privy
* Access EVM wallet address alongside Solana wallet
* Privy auto-creates both wallets on registration
### 4. Create EVM Balance Service
Create `utils/evmBalanceService.ts`:
* Use `viem` to create public client for Monad
* Fetch native MON balance
* Fetch ERC-20 token balances (USDC, USDT on Monad)
* Similar caching strategy as `balanceService.ts`
* Handle rate limiting and retries
### 5. Create EVM Transaction Service
Create `utils/evmTransactionService.ts`:
* Fetch transaction history from Monad RPC using `viem`
* Parse native and ERC-20 transfers
* Cache transactions locally (similar to `transactionStorage.ts`)
* Determine transaction type (send/receive)
* Format for unified Transaction type
### 6. Add Multi-Chain Balance Aggregation
Create `utils/multiChainBalanceService.ts`:
* Aggregate balances from Solana and Monad
* Fetch both chains in parallel
* Calculate total USD value across all chains
* Return chain-specific and total balances
### 7. Add Chain Selection UI
Update `app/(main)/index.tsx`:
* Add chain selector tabs (All, Solana, Monad)
* Filter balances and transactions by selected chain
* Show appropriate address based on selected chain
* Store selected chain in state
### 8. Update Transaction Display
Update transaction UI components:
* Add chain property to Transaction type
* Show chain badge/icon for each transaction
* Use chain-specific block explorers (Solscan vs Monad explorer)
* Format addresses based on chain (Solana vs Ethereum format)
### 9. Update Send/Receive Flows
Update send/receive screens:
* `app/send.tsx`: Add chain selector
* `app/send-amount.tsx`: Pass selected chain
* `app/send-confirm.tsx`: Use appropriate signing method
* `app/crypto-deposit.tsx`: Show correct address based on chain
* Validate addresses based on chain type
### 10. Add EVM Transaction Signing
Create `utils/evmTransactionSigning.ts`:
* Use Privy's `signTransaction` for EVM
* Handle gas estimation with `viem`
* Support native MON transfers
* Support ERC-20 token transfers
* Broadcast transactions to Monad network
### 11. Update Price Service
Update `utils/priceService.ts`:
* Add MON token price fetching (use CoinGecko or similar)
* Support multi-chain price aggregation
* Cache prices appropriately
### 12. Add Chain Storage Preferences
Create `utils/chainStorage.ts`:
* Save user's selected chain preference to AsyncStorage
* Load on app start
* Provide hooks for chain selection
## Implementation Order
1. Configure Monad chain in Privy (step 1)
2. Create chain configuration constants (step 2)
3. Access EVM wallet via Privy hooks (step 3)
4. Create EVM balance service (step 4)
5. Create EVM transaction service (step 5)
6. Add multi-chain aggregation (step 6)
7. Update home screen UI for chain selection (step 7)
8. Update transaction display (step 8)
9. Update send/receive flows (step 9)
10. Add EVM transaction signing (step 10)
11. Update price service (step 11)
12. Add chain storage (step 12)
## Testing Approach
* Test Monad testnet connectivity
* Verify balance fetching for MON and ERC-20 tokens
* Test transaction history fetching
* Test sending transactions on Monad testnet
* Verify UI displays both chains correctly
