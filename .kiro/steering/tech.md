# Technology Stack

## Core Framework
- **React Native**: 0.81.5 with React 19.1.0
- **Expo SDK**: ~54.0.25 with custom dev client
- **TypeScript**: ~5.9.2 with strict mode enabled
- **Metro**: Custom configuration with package exports handling

## Key Dependencies

### Blockchain & Wallet
- **@privy-io/expo**: Authentication and embedded wallet management
- **@solana/web3.js**: Solana blockchain interactions
- **viem**: Ethereum/EVM chain interactions (v2.32.0)
- **react-native-passkeys**: Passkey authentication support

### Navigation & UI
- **expo-router**: File-based routing with typed routes
- **@react-navigation/native**: Navigation foundation
- **react-native-reanimated**: Animations and gestures
- **@gorhom/bottom-sheet**: Modal and sheet components

### Storage & Services
- **@react-native-async-storage/async-storage**: Local data persistence
- **expo-secure-store**: Secure credential storage
- **firebase**: Backend services integration

## Build System

### Development Commands
```bash
# Start development server
npm start

# Run on specific platforms
npm run ios
npm run android

# Linting
npm run lint
```

### Configuration Files
- **app.json**: Expo configuration with Privy credentials
- **tsconfig.json**: TypeScript with path aliases (`@/*`)
- **babel.config.js**: Standard Expo preset
- **metro.config.js**: Custom resolver for package exports

### Platform-Specific Settings
- **iOS**: Deployment target 17.5, Apple Sign-In enabled
- **Android**: Compile SDK 35, deep linking configured
- **Associated Domains**: auth.kevan.ar for passkey support

## Architecture Patterns

### File Structure
- Path aliases using `@/*` for clean imports
- Expo Router file-based routing in `/app`
- Shared components in `/components` with feature folders
- Utilities in `/utils` with service-oriented architecture
- Type definitions in `/types`

### State Management
- React hooks for local state
- Privy SDK for authentication state
- AsyncStorage for persistence
- Firebase for backend synchronization