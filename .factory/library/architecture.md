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
      └── use-assistant.ts        (main hook orchestrating chat + voice state)
```

### Backend (Supabase Edge Functions)

Target modular layout introduced during the backend refactor:

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
  │   ├── farm-data.ts      (comprehensive farm data queries)
  │   └── memory.ts         (memory search + write)
  ├── routing/
  │   ├── intent.ts         (LLM-based intent extraction)
  │   └── router.ts         (route decision logic)
  ├── safety/
  │   └── checker.ts        (spray/fertigation safety guardrails)
  └── utils/
      ├── circuit-breaker.ts
      ├── cost-tracker.ts
      └── telemetry.ts
```

Current repo state still only partially meets that target: `context/farm-data.ts`, `routing/router.ts`, and legacy `voice-routing.ts` remain >500 lines, and the live request flow still keeps significant routing/handler logic inside `handlers/main.ts`.

### Data Flow: Text Chat
```
User types message
  → InputBar sends to use-assistant hook
  → assistant-gateway.ts POST to ai-gateway
  → ai-gateway: auth → routing → context assembly → LLM → safety → memory write
  → Response: { assistant_text, citations, safety_flags, suggestions }
  → MessageBubble renders Markdown with citations
```

### Data Flow: Voice Mode
```
User taps orb
  → expo-audio starts recording
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
