# Vinesight-RN

React Native mobile application for vineyard management.

## Tech Stack

- **Framework**: [Expo SDK 55](https://expo.dev/) + [React Native 0.83.2](https://reactnative.dev/)
- **Navigation**: [Expo Router](https://docs.expo.dev/router/introduction/) (file-based routing)
- **Backend**: [Supabase](https://supabase.com/)
- **Data Fetching**: [TanStack React Query](https://tanstack.com/query/latest)
- **Styling**: Inline styles + theme tokens (`src/styles/theme.ts`)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Maps**: [React Native Maps](https://github.com/react-native-maps/react-native-maps) + [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)

## Getting Started

### Prerequisites

- Node.js (latest LTS)
- npm
- Xcode (for iOS work)
- Android Studio (for Android work)

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` from `.env.example` and fill in required values.
4. For iOS widget target signing, set `EXPO_APPLE_TEAM_ID` in your shell (or CI secret):
   ```bash
   export EXPO_APPLE_TEAM_ID=YOUR_TEAM_ID
   ```

### Running the App

```bash
# Start development server
npm start

# Run on specific platform
npm run ios
npm run android
npm run web
```

## Push Notifications and Expo Go

- Remote push notification testing must be done in a development build, not Expo Go.
- Use:
  ```bash
  npx expo run:ios
  npx expo run:android
  ```
  or build with EAS development profile and install the app on device.

## iOS Widgets and Signing

This app uses iOS widget targets via `@bacons/apple-targets`.

- Keep `EXPO_APPLE_TEAM_ID` configured for local and CI builds.
- Ensure your Apple team has access to:
  - app identifier `com.vinesight.ios`
  - app group `group.com.vinesight.app`
- If iOS build/signing fails, first verify team ID, signing profiles, and app group entitlements.

## Project Structure

```text
vinesight-rn/
├── app/                    # Expo Router pages (navigation)
│   ├── (auth)/             # Auth screens
│   ├── (tabs)/             # Main tab screens (dashboard, farms, etc.)
│   └── _layout.tsx         # Root layout
├── src/
│   ├── components/         # Reusable UI components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Library configurations (Supabase client)
│   ├── stores/             # Zustand stores
│   ├── types/              # TypeScript types
│   ├── utils/              # Utility functions
│   └── styles/             # Design system tokens
├── assets/                 # Static assets
└── metro.config.js         # Metro bundler config
```

## Features

- **AI Chat Assistant**: Farming advice powered by OpenAI GPT models.
- **Weather Tracking**: Agricultural weather data per farm.
- **Activity Logs**: Comprehensive view of farming activities.
- **Attendance Tracking**: Worker attendance management.
- **Task Management**: Farm-specific tasks and scheduling.
- **Monitoring**: Water level monitoring and lab test tracking.

## Development

Run before pushing:

- `npm run typecheck`
- `npm run lint`
- `npm test`
