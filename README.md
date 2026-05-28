# Vinesight-RN

React Native mobile application built with Expo SDK 54 for vineyard management. This is an Android port of the existing iOS Vinesight app.

## Tech Stack

- **Framework**: [Expo 54](https://expo.dev/) + [React Native 0.81.5](https://reactnative.dev/)
- **Navigation**: [Expo Router](https://docs.expo.dev/router/introduction/) (file-based routing)
- **Backend**: [Supabase](https://supabase.com/)
- **Data Fetching**: [TanStack React Query](https://tanstack.com/query/latest)
- **Styling**: Inline styles + theme tokens (`src/styles/theme.ts`)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Maps**: [React Native Maps](https://github.com/react-native-maps/react-native-maps) + [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)

## Getting Started

### Prerequisites

- Node.js (Latest LTS)
- npm or yarn
- Expo Go app on your mobile device or an emulator

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example` and fill in your Supabase credentials.

### Running the App

```bash
# Start development server
npm start

# Run on specific platform
npm run ios
npm run android
npm run web
```

## Project Structure

```text
vinesight-rn/
├── app/                    # Expo Router pages (Navigation)
│   ├── (auth)/             # Auth screens
│   ├── (tabs)/             # Main tab screens (Dashboard, Farms, etc.)
│   └── _layout.tsx         # Root layout
├── src/
│   ├── components/         # Reusable UI components
│   ├── hooks/              # Custom React hooks
│   ├── i18n/               # Localization strings (EN, HI, MR)
│   ├── lib/                # Library configurations (Supabase client)
│   ├── stores/             # Zustand stores
│   ├── types/              # TypeScript types
│   ├── utils/              # Utility functions
│   └── styles/             # Design system tokens
├── __tests__/              # Jest unit tests (components, i18n)
├── supabase/
│   └── migrations/         # Supabase SQL migration files
├── assets/                 # Static assets
└── metro.config.js         # Metro bundler config
```

## Features

- **AI Chat Assistant**: Farming advice powered by OpenAI GPT-4o.
- **Weather Tracking**: Agricultural weather data per farm.
- **Activity Logs**: Comprehensive view of farming activities.
- **Attendance Tracking**: Worker attendance management.
- **Task Management**: Farm-specific tasks and scheduling.
- **Monitoring**: Water level monitoring and lab test tracking.
- **Explore Screen**: Dedicated Farms and Warehouse panes with per-tab filter chips and animated search expansion. Farm cards show a visual pruning-to-harvest timeline with milestone dots, day counter, harvest estimate, and urgency accent when water balance is low. Farms needing attention sort to the top.
- **Seasonal Water Use**: Farm detail screen shows running water total vs. season budget for the active season.
- **Farm Ordering**: Farms can be manually reordered and the order persists across sessions.

## Development

- **Linting**: `npm run lint`
- **Type Checking**: `npm run typecheck`
- **Testing**: `npm run test`
- **Version**: Current version is tracked in `VERSION` (semver format `X.Y.Z.W`).

## Further Reading

- [CONTEXT.md](./CONTEXT.md) — Core concepts (Activity stack, rollback semantics)
- [TODOS.md](./TODOS.md) — Open work items and backlog
- [docs/product-roadmap.md](./docs/product-roadmap.md) — Product phases and epics
- [CHANGELOG.md](./CHANGELOG.md) — Release history

## Chemical Catalog Data

- Source of truth is now Supabase tables (`chemical_mixes`, `chemical_mix_components`, `chemical_phi_rules`, `chemical_products`).
- Local JSON master files and seed/validation scripts were removed from this repo.
- For fresh local/CI/staging environments, load a catalog snapshot into Supabase before running the app.
- If you do not have a snapshot, request one from the team owning the production catalog data.
