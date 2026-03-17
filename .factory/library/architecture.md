# Architecture

Architectural decisions, patterns discovered, and module structure.

**What belongs here:** System architecture, module boundaries, data flow patterns, key design decisions.

---

## App Architecture

- **Framework:** React Native (Expo SDK 54) with New Architecture enabled
- **Routing:** Expo Router v6 (file-based routing)
- **Backend:** Supabase (hosted) — Auth, Postgres + pgvector, Edge Functions (Deno), Storage
- **State:** Zustand (client state) + React Query (server state with offline persistence)
- **Theming:** Material Design 3 (M3) via custom `useThemeTokens()` / `useM3()` hooks
- **i18n:** react-i18next with 3 locales: en (English), hi (Hindi), mr (Marathi)

## AI Assistant Architecture (Redesigned)

### Client Side
```
app/(tabs)/assistant.tsx  →  AI tab (entry point)
  ├── src/components/assistant/
  │   ├── ChatScreen.tsx          (main chat container, <500 lines)
  │   ├── MessageList.tsx         (message rendering with auto-scroll)
  │   ├── MessageBubble.tsx       (user/assistant message with Markdown)
  │   ├── InputBar.tsx            (text input + voice toggle + attachments)
  │   ├── ConversationSidebar.tsx (history drawer)
  │   ├── SuggestionChips.tsx     (quick query suggestions)
  │   ├── ActivityConfirmCard.tsx (voice log confirmation UI)
  │   └── VoiceMode/
  │       ├── VoiceModeModal.tsx  (full-screen voice overlay)
  │       ├── AnimatedOrb.tsx     (orb with state animations)
  │       └── VoiceThread.tsx     (voice conversation thread)
  ├── src/services/
  │   ├── assistant-gateway.ts    (refactored: API client for ai-gateway)
  │   ├── assistant-memory.ts     (conversation persistence)
  │   ├── voice-output.ts         (TTS playback via expo-audio)
  │   └── speech-recognition.ts   (expo-speech-recognition wrapper)
  └── src/hooks/
      ├── use-assistant.ts        (text chat state, retries, attachments, conversation sync)
      ├── use-voice-mode.ts       (voice mode state machine, STT/TTS loop, voice thread)
      └── use-voice-recorder.ts   (expo-audio recording + base64 file reads)
```

Current voice mode ownership in the client is split across dedicated hooks rather than living inside `use-assistant.ts`:

- `use-assistant.ts` manages the main text chat thread, sidebar interactions, retries, attachments, and `voiceLogAction` cards.
- `use-voice-mode.ts` manages the full-screen voice modal state machine, transcript/assistant thread, backend audio round-trips, and TTS playback loop.
- `use-voice-recorder.ts` owns recording lifecycle details and reads captured audio as base64 via `expo-file-system/legacy`.

### Backend (Supabase Edge Functions)

Current modular layout introduced during the backend refactor:

```
supabase/functions/ai-gateway/
  ├── index.ts              (entry point, request router target: <200 lines)
  ├── handlers/
  │   ├── advisory.ts       (LLM advisory flow)
  │   ├── farm-query.ts     (farm data query handler)
  │   ├── voice-log.ts      (activity logging handler)
  │   └── clarify.ts        (route clarification handler)
  ├── providers/
  │   ├── stt.ts            (Sarvam Saaras v3 + OpenAI Whisper fallback)
  │   ├── tts.ts            (Sarvam Bulbul v3 + OpenAI TTS fallback)
  │   ├── llm.ts            (OpenAI chat completion)
  │   └── embeddings.ts     (OpenAI text-embedding-3-small)
  ├── context/
  │   ├── assembler.ts      (context assembly: farm + memory + RAG + weather)
  │   ├── farm-data.ts      (top-level farm context orchestrator)
  │   ├── farm-details.ts   (farm ownership + metadata lookup)
  │   ├── farm-records.ts   (core farm activity record queries)
  │   ├── farm-extra-records.ts (additional farm record queries)
  │   ├── farm-workers.ts   (workers + attendance queries)
  │   ├── farm-weather.ts   (weather enrichment)
  │   └── memory.ts         (memory search + write)
  ├── routing/
  │   ├── intent.ts         (LLM-based intent extraction)
  │   ├── router.ts         (top-level route orchestration)
  │   ├── farm-query-routing.ts
  │   ├── voice-log-routing.ts
  │   └── intent-patterns.ts
  ├── safety/
  │   └── checker.ts        (spray/fertigation safety guardrails)
  └── utils/
      ├── circuit-breaker.ts
      ├── cost-tracker.ts
      └── telemetry.ts
```

Current repo state is much closer to that target after the scrutiny fix rounds:

- Legacy `supabase/functions/ai-gateway/voice-routing.ts` has been removed.
- The live request path in `handlers/main.ts` now imports and dispatches `handleFarmQuery()` for `farm_query` routes.
- `handlers/main.ts` is currently 399 lines, `context/farm-data.ts` is 237 lines, and `routing/router.ts` is 75 lines.
- Remaining over-limit backend modules still violating the mission's `<500 lines` rule are `context/farm-records.ts` (525 lines) and `routing/voice-log-routing.ts` (501 lines).

Automated coverage still does **not** include a backend test that exercises the live `ai-gateway` dispatch path in `handlers/main.ts`; existing green routing-related tests mostly cover client-side helpers or response mapping. The current `__tests__/stt-provider.test.ts` suite also still does not import `transcribeAudio()` or `processStt()`, so the real STT empty-transcript path can regress while Jest still passes.

### Data Flow: Text Chat
```
User types message
  → InputBar sends to use-assistant hook
  → assistant-gateway.ts POST to ai-gateway
  → ai-gateway: auth → routing → context assembly → LLM → safety → memory write
  → Response: { assistant_text, citations, safety_flags, suggestions }
  → MessageBubble renders Markdown with citations
```

- Assistant requests should preserve the currently selected farm context when a farm is active. "No farms exist" and "no active farm is selected" are different UI states and should be handled separately.
- Image attachments only support image-aware responses when the backend forwards actual multimodal content (bytes, file handle, or URL). Replacing an attachment with a text placeholder like `image attached by user` is not sufficient for model reasoning.

### Data Flow: Voice Mode
```
User taps orb
  → expo-audio starts recording
  → use-voice-recorder reads captured audio via expo-file-system/legacy
  → User stops (manual or auto-detect)
  → Audio base64 sent to ai-gateway
  → ai-gateway: auth → STT (Sarvam v3) → routing → context → LLM → TTS (Sarvam v3) → memory
  → Response: { assistant_text, assistant_audio_b64, transcript }
  → VoiceModeModal: display transcript, play audio, show text, auto-listen
```

### Data Flow: Activity Logging
```
User says "log 2 hours irrigation"
  → STT transcribes → intent extraction → route: voice_log
  → Extract activity fields (type, duration, farm)
  → If incomplete: return clarification prompt
  → If complete: return prefill payload (NOT written to DB)
  → Client shows ActivityConfirmCard
  → User confirms → navigates to add-entry form with prefill
  → User submits form → activity written to DB
```

## Tab Navigation (Redesigned)

```
Bottom Tabs: Dashboard | Explore | Workers | Tools | AI Assistant
                                                        ↑ replaces Settings
Dashboard header → profile/settings icon → navigates to /settings
```

- Expo Router NativeTabs currently omits `headerRight` from `NativeTabOptions` typings in this repo's setup. The working pattern is to spread a separately typed object into the trigger options instead of trying to assign `headerRight` directly on the typed options object.
