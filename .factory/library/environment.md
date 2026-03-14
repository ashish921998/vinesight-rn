# Environment

Environment variables, external dependencies, and setup notes.

**What belongs here:** Required env vars, external API keys/services, dependency quirks, platform-specific notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

## Client-Side Environment Variables

Set in `.env` (already configured):
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — Google Maps
- `EXPO_PUBLIC_POSTHOG_KEY` / `EXPO_PUBLIC_POSTHOG_HOST` — Analytics
- `EXPO_PUBLIC_SENTRY_DSN` — Error tracking

## Server-Side Environment Variables (Supabase Function Secrets)

Set via Supabase dashboard or CLI — NOT in .env:
- `OPENAI_API_KEY` — OpenAI API access
- `SARVAM_API_KEY` — Sarvam AI API access (STT, TTS)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Auto-provided by Supabase runtime

## Sarvam AI Configuration

- **API Base URL:** `https://api.sarvam.ai`
- **Auth Header:** `api-subscription-key: {SARVAM_API_KEY}`
- **STT Model:** `saaras:v3` (upgraded from saarika:v2.5)
- **TTS Model:** `bulbul:v3`
- **STT Endpoint:** `POST /speech-to-text` (multipart form: file + model + language_code)
- **TTS Endpoint:** `POST /text-to-speech` (JSON: text, target_language_code, speaker, model, pace)
- **Supported audio formats for STT:** WAV, MP3, AAC, OGG, OPUS, FLAC, M4A, AMR, WMA, WebM, PCM (16kHz)
- **TTS output:** MP3 base64, max 2500 chars input
- **Auto language detection:** Set language_code to "unknown" for auto-detect (supports 23 Indian languages + English)
- **Code-mixing support:** Saaras v3 handles Hindi-English, Marathi-English mixing natively

## OpenAI Configuration

- **LLM Model:** `gpt-4o-mini` (primary for advisory)
- **Extraction Model:** `gpt-4o-mini` (for intent extraction, JSON mode)
- **Embedding Model:** `text-embedding-3-small` (1536 dimensions)
- **TTS Fallback Model:** `gpt-4o-mini-tts` (voice: alloy)
- **STT Fallback Model:** `whisper-1`

## Platform Notes

- iOS: Records WAV (16kHz mono) via expo-audio — optimal for Sarvam STT
- Android: Records AAC via expo-audio — compatible with both Sarvam and OpenAI STT
- expo-speech-recognition may not work in Expo Go; only in dev client builds
