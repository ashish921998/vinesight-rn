# Environment

**What belongs here:** Required env vars, external dependencies, setup notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

## Stack
- React Native 0.81.5 with Expo SDK 54
- Expo Router 6 (file-based routing)
- TypeScript 5.9
- Zustand for state management
- TanStack Query for data fetching
- Supabase backend
- i18n via react-i18next

## Environment Variables
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- Various other EXPO_PUBLIC_* keys for PostHog, Sentry, etc.

## Platform Notes
- macOS (darwin 25.2.0), 16GB RAM, 10 CPU cores
- Node via Homebrew
- No emulator/simulator available in this environment
- Web builds via `expo export --platform web`
