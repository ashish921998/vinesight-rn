# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Vinesight RN is a React Native mobile application built with Expo SDK 54 (New Architecture enabled).
This is an Android port of the existing iOS Vinesight app.

## Tech Stack

- **Framework**: Expo 54 + React Native 0.81.5
- **Navigation**: Expo Router (file-based routing)
- **Backend**: Supabase
- **Data Fetching**: TanStack React Query
- **Styling**: NativeWind v4 (TailwindCSS)
- **State Management**: Zustand
- **Maps**: React Native Maps + Expo Location

## Commands

```bash
# Start development server (Expo Go)
npm start

# Run on specific platform
npm run ios
npm run android
npm run web

# TypeScript check
npm run typecheck
npx tsc --noEmit
```

## Architecture Notes

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

### Project Structure

```
vinesight-rn/
├── app/                    # Expo Router pages
│   ├── _layout.tsx         # Root layout
│   ├── index.tsx           # Entry screen
│   ├── (auth)/             # Auth screens
│   └── (tabs)/             # Main tab screens
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── ui/             # Base UI components
│   │   ├── forms/          # Form components
│   │   └── screens/        # Screen-specific components
│   ├── hooks/              # Custom React hooks
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

### iOS App Reference
The iOS codebase is at `/Users/ashishhuddar/Desktop/Vinesight/Vinesight/`
Key files for reference:
- `SupabaseModels.swift` - Data models (ported to `src/types/database.ts`)
- `SupabaseDataService.swift` - CRUD operations
- `AuthManager.swift` - Auth logic (ported to `src/types/auth.ts`)
- Views: `DashboardView.swift`, `FarmsView.swift`, `WorkersView.swift`, etc.
