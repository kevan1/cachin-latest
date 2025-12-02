# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

# Project Overview

This is a React Native project using Expo and Privy for authentication and embedded wallets. It serves as a starter or example for integrating Privy into an Expo application.

## Tech Stack

- **Framework:** React Native with Expo (Managed Workflow)
- **Navigation:** Expo Router (`app/` directory)
- **Authentication & Wallets:** Privy (`@privy-io/expo`)
- **Language:** TypeScript
- **Styling:** React Native StyleSheet / Themed Components

# Commands

- **Install Dependencies:**
  ```bash
  npm install
  ```

- **Start Development Server:**
  ```bash
  npm start
  ```
  This runs `expo start --dev-client`.
  - Press `i` for iOS simulator
  - Press `a` for Android emulator

- **Run on Android/iOS:**
  ```bash
  npm run android
  npm run ios
  ```

- **Linting:**
  ```bash
  npm run lint
  ```

# Architecture

## Entry Point & Polyfills
The application entry point is `entrypoint.js` (defined in `package.json`). This file is crucial as it loads necessary polyfills for crypto functionality (`react-native-get-random-values`, `@ethersproject/shims`, `buffer`) *before* importing `expo-router`.

## Navigation & Routing
- Uses **Expo Router** with file-based routing in the `app/` directory.
- **`app/_layout.tsx`**: The root layout file. It wraps the application in:
  - `ThemeProvider`
  - `ErrorBoundary`
  - `PrivyProvider` (Auth context)
- **Auth Guard**: The `AppNavigator` component inside `app/_layout.tsx` handles client-side redirection based on the user's authentication state (`usePrivy`).
  - Unauthenticated users are redirected to `/` (Login).
  - Authenticated users are redirected to `/(main)` (Protected routes).

## Configuration
- **`app.json`**: Contains Expo configuration.
  - Privy credentials (`privyAppId`, `privyClientId`) and configuration are located in `expo.extra`.
  - Deep linking schemes and associated domains (for Passkeys) are configured here.

## Key Directories
- **`app/`**: Application routes.
  - `(main)/`: Route group for authenticated screens.
  - `index.tsx`: Login/Landing screen.
- **`components/`**: UI components.
  - `userManagement/`: Components for managing user settings and wallets.
  - `walletActions/`: Components for blockchain interactions (signing, sending transactions).
- **`hooks/`**: Custom React hooks.
- **`services/`**: Business logic and API services.
- **`utils/`**: Utility functions.

# Development Guidelines

- **Polyfills**: Ensure `entrypoint.js` remains the main entry point and polyfills are loaded before other imports to avoid issues with crypto libraries.
- **Privy Integration**:
  - `PrivyProvider` must wrap the app in the root layout.
  - `<PrivyElements />` must be rendered in the root layout to support Privy modals.
  - Use `usePrivy()` hook to access user session state.
- **Routing**: When adding new protected routes, place them within the `app/(main)/` directory or ensure the auth guard logic in `app/_layout.tsx` accounts for them.
