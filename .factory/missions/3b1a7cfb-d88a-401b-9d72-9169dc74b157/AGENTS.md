# AGENTS.md — AI Farming Assistant Redesign

## Mission Boundaries (NEVER VIOLATE)

**Port Range:** Use default Expo ports (8081). Do not start additional servers.

**External Services:**
- USE existing Supabase (remote, hosted) — do not modify auth, existing tables unrelated to AI assistant, or RLS policies for non-AI tables
- The Supabase Edge Functions are the backend — deploy by editing files in `supabase/functions/`
- DO NOT touch local Postgres on port 5432 (unrelated to this app)

**Off-limits:**
- Do not modify non-AI-related screens (analytics, weather, logs, tasks, warehouse, reports, soil-profiling, etc.) unless they have a navigation link to the old AI chat that needs updating
- Do not modify the auth flow, user profiles, or farm CRUD operations
- Do not modify widget code, calculator code, or storybook configuration
- Do not modify or delete existing database migration files in `supabase/migrations/`
- Port 5000, 7000 (system services)

## Coding Conventions

- **TypeScript strict mode** — no `any` types, use `unknown` with type guards
- **Functional components with hooks** — no class components
- **File size limit** — no single file should exceed 500 lines. Break into modules.
- **Naming**: camelCase for variables/functions, PascalCase for components/types, kebab-case for filenames
- **Imports**: use `@/` path alias for `src/`, type-only imports with `import type { ... }`
- **State management**: Zustand for client state, React Query for server state
- **Styling**: use `useThemeTokens()` and `useM3()` for M3 theme tokens — NEVER hardcode colors
- **i18n**: all user-facing strings must use `t('key')` from react-i18next. Add keys to all 3 locales (en, hi, mr)
- **Conventional commits**: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`
- **Tests first**: write failing tests before implementation (TDD)

## Architecture Patterns

- **Expo Router file-based routing** with typed routes
- **Supabase Edge Functions** for backend (Deno runtime)
- **Sarvam AI** for STT (Saaras v3) and TTS (Bulbul v3) — called server-side from Edge Functions
- **OpenAI** for LLM (GPT-4o-mini) and embeddings (text-embedding-3-small) — called server-side
- **pgvector** for memory and RAG vector search
- **Circuit breaker pattern** for external API calls (Sarvam, OpenAI)
- **expo-audio** for recording on client, NOT expo-speech-recognition for STT (STT is server-side via Sarvam)
- **react-native-reanimated** for animations (voice mode orb)

## Key Libraries Already Installed

- `openai` ^6.16.0, `@supabase/supabase-js` ^2.90.1
- `expo-audio` ~1.1.1, `expo-speech` ^14.0.8, `expo-speech-recognition` ^3.1.0
- `react-native-reanimated` ~4.1.1, `react-native-gesture-handler` ~2.28.0
- `react-native-markdown-display` ^7.0.2
- `zustand` ^5.0.10, `@tanstack/react-query` ^5.90.19
- `i18next` ^25.8.0, `react-i18next` ^15.7.4
- `expo-haptics`, `expo-blur`, `expo-linear-gradient`

## Backend (Supabase Edge Functions)

- Edge Functions are in `supabase/functions/` and use Deno runtime
- The main AI function is `supabase/functions/ai-gateway/`
- Server-side env vars (set as Supabase secrets): `OPENAI_API_KEY`, `SARVAM_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- API keys must NEVER be exposed client-side
- Use `api-subscription-key` header for Sarvam API calls (not `Authorization`)
- Sarvam API base URL: `https://api.sarvam.ai`

## Testing & Validation Guidance

**Automated tests:**
- Run `npm run typecheck` — must pass with 0 errors
- Run `npm test` — baseline: 298/305 passing (7 pre-existing AsyncStorage mock failures in theme-store tests)
- Run `npm run lint` — must pass with 0 errors
- New features must include unit tests

**Pre-existing test failures (DO NOT FIX):**
- 7 tests fail due to AsyncStorage mock issues in theme-store related tests. These are pre-existing and unrelated to this mission.

**User testing:**
- User will test each milestone on their physical device via Expo dev client
- Workers should ensure typecheck/test/lint all pass before marking features complete

## Known Pre-Existing Issues (Do Not Fix)

The following 11 test suites / 7 test failures are PRE-EXISTING (verified at commit 0f7a224 before any mission changes). They are NOT caused by this mission and must NOT block validation:

- `__tests__/phi-service.test.ts` — computePhiForMix() date calculation mismatch
- `__tests__/phone-auth-store.test.ts` — auth error string and resend behavior mismatch
- `__tests__/phone-number-hint.test.tsx` — jest.mock() out-of-scope variable (View)
- `__tests__/farm-safe-harvest-card.test.tsx` — AsyncStorage is null
- `__tests__/entry-form.integration.test.tsx` — AsyncStorage is null
- `__tests__/fertigation-form.test.tsx` — AsyncStorage is null
- `__tests__/location-picker.test.tsx` — AsyncStorage is null
- `components/widgets/dashboard/WeatherWidget/WeatherWidget.test.tsx` — AsyncStorage is null
- `components/widgets/dashboard/VineyardHealthWidget/VineyardHealthWidget.test.tsx` — AsyncStorage is null
- `components/widgets/dashboard/QuickStatsWidget/QuickStatsWidget.test.tsx` — AsyncStorage is null
- `components/widgets/dashboard/TaskSummaryWidget/TaskSummaryWidget.test.tsx` — AsyncStorage is null

**Baseline: 43 test suites total, 11 fail, 32 pass. 597 tests total, 7 fail, 590 pass.**

Validators: test pass criteria is that NO NEW failures are introduced beyond the 11 pre-existing failing suites. If the number of failing suites increases or new test files fail, that is a regression.

- `expo-speech-recognition` may not work in Expo Go (only dev client) — this is expected
