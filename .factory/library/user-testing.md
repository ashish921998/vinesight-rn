# User Testing

Testing surface, validation approach, and resource cost classification.

**What belongs here:** How to validate the mission output, testing tools, concurrency limits.

---

## Validation Surface

- **Primary surface:** iOS/Android device via Expo dev client
- **Testing approach:** User tests each milestone manually on their device
- **Automated validation:** TypeScript typecheck, Jest unit tests, ESLint

## Validation Concurrency

- **Surface:** Mobile device (manual testing by user)
- **Max concurrent validators:** 1 (user tests manually on their device)
- **Automated validators:** typecheck, jest, lint can run in parallel (max 4 jest workers on 10-core machine)

## Resource Cost Classification

- Machine: 16 GB RAM, 10 CPU cores (macOS)
- Jest max workers: 4 (conservative for 10 cores)
- No local services to manage (Supabase is remote)
- Expo dev server: ~200 MB RAM when running

## Testing Notes

- The Expo dev server must be running for user testing: `npx expo start`
- User connects their device via Expo dev client app
- Voice mode testing requires a physical device with microphone (not simulator)
- STT/TTS testing requires network connectivity to Sarvam AI and OpenAI APIs
- Backend changes to Edge Functions require deployment to Supabase (or local Supabase CLI)
