# Project Structure

## Root Directory Organization

```
/
├── app/                    # Expo Router pages (file-based routing)
├── components/             # Reusable UI components
├── constants/              # App constants and configuration
├── utils/                  # Business logic and services
├── types/                  # TypeScript type definitions
├── hooks/                  # Custom React hooks
├── assets/                 # Static assets (images, fonts)
├── config/                 # Configuration files (Firebase, etc.)
├── services/               # External service integrations
└── auth-kevan-ar/          # Separate auth service deployment
```

## Key Directories

### `/app` - Routing & Pages
- **File-based routing** using Expo Router
- **Route groups**: `(main)/` for authenticated routes
- **Layout files**: `_layout.tsx` for nested layouts
- **Modal routes**: `modal.tsx` for overlay screens

### `/components` - UI Components
- **Feature-based organization**: `auth/`, `login/`, `walletActions/`
- **UI primitives**: `ui/` folder for reusable components
- **Themed components**: Follow light/dark theme patterns

### `/utils` - Business Logic
- **Service pattern**: Each utility handles specific domain logic
- **Multi-chain support**: Separate services for different blockchains
- **Storage abstractions**: Consistent interfaces for data persistence

### `/constants` - Configuration
- **Chain definitions**: Blockchain network configurations
- **Theme system**: Color palettes and design tokens
- **Type enums**: Shared enumeration types

## Naming Conventions

### Files & Folders
- **PascalCase**: React components (`LoginScreen.tsx`)
- **camelCase**: Utilities and services (`balanceService.ts`)
- **kebab-case**: Route files when needed
- **Descriptive names**: Clear purpose indication

### Code Patterns
- **Hook prefix**: Custom hooks start with `use`
- **Service suffix**: Business logic files end with `Service`
- **Type definitions**: Interfaces and types in dedicated files
- **Constants**: UPPER_SNAKE_CASE for static values

## Import Patterns
- **Path aliases**: Use `@/` for root-relative imports
- **Barrel exports**: Index files for clean imports
- **Feature grouping**: Related imports grouped together
- **External first**: Third-party imports before local ones

## Authentication Flow Structure
- **Unauthenticated**: `/index.tsx`, `/username.tsx`
- **Authenticated**: `/(main)/` route group
- **Shared**: `/profile.tsx`, `/modal.tsx` accessible from both states
- **Redirect logic**: Handled in root `_layout.tsx`