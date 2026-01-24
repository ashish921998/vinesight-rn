# AI Agent Guide - VineSight RN

Welcome! This guide provides the necessary context for autonomous agents to develop, test, and maintain the VineSight React Native application.

## Project Overview

VineSight is a vineyard management mobile application built with Expo SDK 54 and React Native. It uses Supabase for backend services and TanStack Query for data fetching.

## Tech Stack

- **Framework**: Expo (SDK 54), React Native 0.81.5
- **Language**: TypeScript (Strict mode enabled)
- **Navigation**: Expo Router (file-based routing)
- **Styling**: NativeWind v4 (TailwindCSS)
- **State Management**: Zustand
- **Backend**: Supabase
- **Data Fetching**: TanStack Query (React Query)
- **Maps**: React Native Maps + Expo Location
- **AI Integration**: OpenAI SDK

## Core Commands

- `npm start`: Start the Expo development server (Expo Go).
- `npm run ios`: Run on iOS simulator/device.
- `npm run android`: Run on Android emulator/device.
- `npm run web`: Run on web browser.
- `npm run lint`: Run ESLint to check for code quality issues.
- `npm run format`: Format the codebase using Prettier.
- `npm run typecheck`: Run TypeScript compiler to check for type errors.
- `npm run test`: Run unit tests using Jest.

## Project Structure

- `app/`: Expo Router file-based routing.
- `src/components/`: Reusable UI components (ui/, cards/, screens/).
- `src/hooks/`: Custom React hooks for business logic and data fetching.
- `src/services/`: Service layer for API calls (Supabase, OpenAI, Weather).
- `src/stores/`: Zustand store definitions for global state.
- `src/types/`: TypeScript type and interface definitions.
- `src/utils/`: Utility functions and constants.
- `src/lib/`: Library configurations (Supabase client).
- `src/constants/`: App constants.

```
vinesight-rn/
├── app/                    # Expo Router pages
│   ├── _layout.tsx         # Root layout with providers
│   ├── index.tsx           # Entry/splash screen
│   ├── (auth)/             # Authentication screens
│   ├── (tabs)/             # Main tab screens (Dashboard, Farms, Workers, Tools, Settings)
│   └── [id].tsx            # Dynamic routes
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── ui/             # Base UI components
│   │   ├── forms/          # Form components
│   │   └── screens/        # Screen-specific components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # Service layer for API calls
│   ├── lib/                # Library configurations
│   │   └── supabase.ts     # Supabase client
│   ├── stores/             # Zustand stores
│   ├── types/              # TypeScript types
│   │   ├── database.ts     # Database models (from iOS)
│   │   ├── auth.ts         # Auth types
│   │   └── index.ts        # Barrel exports
│   ├── utils/              # Utility functions
│   ├── constants/          # App constants
│   └── global.css          # Tailwind CSS
├── assets/                 # Static assets
├── tailwind.config.js      # Tailwind configuration
├── metro.config.js         # Metro bundler config
├── babel.config.js         # Babel config
└── app.json                # Expo configuration
```

## Architecture Details

### Expo Router

This project uses Expo Router for file-based navigation. Routes are in the `app/` directory:

- `app/_layout.tsx` - Root layout with providers
- `app/index.tsx` - Entry/splash screen
- `app/(tabs)/` - Tab-based navigation (Dashboard, Farms, Workers, Tools, Settings)
- `app/(auth)/` - Authentication screens
- `app/[id].tsx` - Dynamic routes

### NativeWind Setup

NativeWind v4 is configured with:

- `tailwind.config.js` - Custom Vinesight color palette
- `src/global.css` - Base Tailwind styles
- `metro.config.js` - NativeWind Metro config
- `babel.config.js` - NativeWind Babel preset

### Supabase Integration

- Client: `src/lib/supabase.ts`
- Uses `expo-secure-store` for secure token storage (native)
- Uses `@react-native-async-storage/async-storage` for web
- Environment variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### State Management Pattern

- **Server state**: TanStack React Query for API data caching
- **Client state**: Zustand for UI/app state

### iOS App Reference

The iOS codebase is at `/Users/ashishhuddar/Desktop/Vinesight/Vinesight/`
Key files for reference:

- `SupabaseModels.swift` - Data models (ported to `src/types/database.ts`)
- `SupabaseDataService.swift` - CRUD operations
- `AuthManager.swift` - Auth logic (ported to `src/types/auth.ts`)
- Views: `DashboardView.swift`, `FarmsView.swift`, `WorkersView.swift`, etc.

## Development Guidelines

- **Linting & Formatting**: ESLint and Prettier are enforced via pre-commit hooks (Husky + lint-staged). Always run `npm run lint` before submitting changes.
- **Environment Variables**: Required variables are documented in `.env.example`. Ensure you have a local `.env` file for development.
- **Styling**: Use Tailwind classes via NativeWind's `className` prop. Avoid inline styles where possible.
- **Types**: Use strict typing. Avoid `any` at all costs. Prefer interfaces over types for object definitions.
- **Data Fetching**: Always use TanStack Query hooks in `src/hooks/` for backend interactions.

## Agent-Specific Tips

- When adding new features, check `src/hooks/` and `src/services/` first to see if relevant logic already exists.
- Follow the existing pattern for Supabase queries: use service methods and wrap them in custom hooks.
- For UI components, refer to `src/components/ui/` for primitive elements (Button, Input, etc.).
