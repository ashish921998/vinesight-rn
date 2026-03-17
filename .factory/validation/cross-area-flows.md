### VAL-CROSS-001: End-to-end text chat — question to rendered response
User navigates to the AI tab, types a farm-related question (e.g. "What is the best time to prune my vineyard?"), and receives a rendered Markdown response with citations within the configured LLM timeout. The response must be displayed using the `Markdown` renderer (`react-native-markdown-display`) and any RAG-sourced citations must be appended via `appendCitationsToMessage`. Pass condition: the response is non-empty, renders valid Markdown (headings, bold, links), and contains citation footnotes when the backend RAG tool fires.
Evidence: screenshot of rendered message; backend trace showing `agronomy_kb.search` tool call status; response body containing `citations` array; Markdown render tree snapshot.

### VAL-CROSS-002: End-to-end text chat — comprehensive farm data assembly
When a user sends a text question while a farm is selected, the backend `ai-gateway` must assemble the full `farm_context` payload (`farm_id`, `farm_name`, `crop_variety`, `area`, `region`, `growth_stage`, `days_since_pruning`) and pass it to the LLM system prompt. Pass condition: the gateway trace includes a `farm_context.get` tool call with status `ok` and the LLM prompt contains the farm context block.
Evidence: gateway trace JSON showing `farm_context` in request body; LLM prompt audit log containing `"Farm context:"` block; tool call array entry for `farm_context.get`.

### VAL-CROSS-003: End-to-end voice flow — speech to spoken response
User opens voice mode, speaks a question in Marathi, and receives a spoken Marathi response. The flow must traverse: audio capture → base64 encoding → `ai-gateway` with `input_mode: 'audio'` → Sarvam STT (model `saarika:v2.5`) transcription → LLM processing → Sarvam TTS (model `bulbul:v3`) synthesis → audio playback via `voiceOutputService`. Pass condition: the user hears a Marathi audio response and the transcript text appears in the chat view.
Evidence: gateway trace showing `stt.transcribe` tool call with `stt_provider: 'sarvam'`; TTS generation log with `language_code: 'mr-IN'`; audio playback completion callback; chat message list containing both user transcript and assistant response.

### VAL-CROSS-004: Voice STT provider fallback
When Sarvam STT fails or the circuit breaker trips (e.g. unsupported container format like `m4a`/`caf`), the gateway must fall back to OpenAI Whisper STT transparently. Pass condition: the user still receives a transcription and response without error; the trace shows `stt_provider: 'openai_fallback'` and `providerFallbackReason` is populated.
Evidence: gateway trace with `sttProviderUsed = 'openai_fallback'`; `providerFallbackReason` field in diagnostics; no user-facing error displayed.

### VAL-CROSS-005: Voice-to-activity logging — extraction and confirmation
User speaks "I irrigated field 2 for 3 hours" in Hindi via voice mode. The backend `extractActivityIntent` function returns `intent: 'log_activity'`, `activityType: 'irrigation'`, and `irrigation.durationHours: 3`. The client receives a form prefill via `buildVoiceLogFormPrefill` and presents the activity logging form. Pass condition: the extracted intent matches, the form prefill contains the correct activity type, farm, date, and duration, and the form opens with pre-populated values.
Evidence: gateway trace showing `extractActivityIntent` output with correct fields; client `voiceLogDraft` state snapshot; form prefill object logged by `buildVoiceLogFormPrefill`.

### VAL-CROSS-006: Voice-to-activity logging — missing field clarification loop
When voice activity extraction is missing a required field (e.g. `farm` or `duration`), the system must enter a clarification loop: `getVoiceLogMissingFields` identifies the gap → clarification prompt sent to user → user responds → `resolveVoiceLogTurn` updates the draft. Pass condition: the clarification prompt is displayed, the user's follow-up response fills the missing field, and the draft is updated without restarting the conversation. The loop must exhaust after the configured max attempts.
Evidence: `voiceLogExpectedField` state transitions; `voiceLogClarifyAttempts` counter progression; updated `voiceLogDraft` state after each clarification turn; clarification message rendered in chat.

### VAL-CROSS-007: Voice-to-activity logging — user confirms and activity is logged
After the voice log draft is complete and the user confirms, the activity must be persisted to the database. Pass condition: the activity appears in the farm's activity log, the AI sends a confirmation message acknowledging the logged activity, and the conversation continues normally.
Evidence: database row in the activity log table matching the draft values; confirmation message in the chat history; telemetry event for `activity_logged`.

### VAL-CROSS-008: Voice-to-activity logging — user cancels
When the user says "cancel" or "no" during the voice log flow, `isRouteClarificationCancelResponse` returns `true`, the draft is cleared (`voiceLogDraft` set to `null`), and a cancellation message is displayed. Pass condition: no activity is logged, the conversation returns to normal advisory mode, and `clearedVoiceLogDraft` is set for undo capability.
Evidence: `isRouteClarificationCancelResponse` returning `true`; `voiceLogDraft` reset to `null`; `clearedVoiceLogDraft` containing the abandoned draft; cancellation message rendered.

### VAL-CROSS-009: Conversation persistence — save and resume
User has a multi-turn conversation, closes the app, reopens the AI tab, taps a conversation from the history sidebar, and sees the full message history restored. The flow must use `assistantMemoryService.loadRecentMessages(conversationId, 50)` to restore messages. Pass condition: all previous messages (user and assistant) are displayed in order, with correct Markdown rendering and any voice log state cleared on resume.
Evidence: `loadRecentMessages` call with correct `conversationId`; restored `messages` array matching persisted data; sidebar list containing the conversation summary; message timestamps preserved.

### VAL-CROSS-010: Conversation persistence — new conversation creation
When a user starts a new conversation (no existing `conversationId`), the system must generate a new conversation ID, persist the first turn, and the conversation must appear in the sidebar on next load. Pass condition: a new conversation row exists in the database, the sidebar lists it with a summary/title, and tapping it restores the single-turn history.
Evidence: new `conversation_id` generated; database row created; sidebar `AssistantConversationSummary` entry; `loadRecentMessages` returns the first turn.

### VAL-CROSS-011: Tab navigation — AI tab accessible from bottom navigation
The AI chat screen is accessible from the tab bar. The tab layout (`app/(tabs)/_layout.tsx`) includes an AI/assistant tab that routes to the chat interface. Pass condition: tapping the AI tab navigates to the chat screen without errors, the tab icon reflects selected state, and back-navigation returns to the previous tab.
Evidence: tab bar rendered with AI tab icon; navigation event logged; screen component mounted; `useRouter` navigation trace.

### VAL-CROSS-012: Tab navigation — profile to settings flow
From the Dashboard tab, the user taps the profile button and is navigated to the Settings screen (`app/(tabs)/settings.tsx`). Pass condition: the Settings screen renders correctly with user profile data, theme toggle, and all sections visible. No navigation errors or blank screens.
Evidence: navigation event from dashboard to settings; Settings screen mounted; profile data populated; all section headers visible in layout snapshot.

### VAL-CROSS-013: Language consistency — Hindi end-to-end
User sets locale to `hi`, sends a voice message in Hindi. The entire pipeline must maintain Hindi: STT transcribes with `language_code: 'hi-IN'`, LLM system prompt includes Hindi language instruction (`"Always reply in Hindi (Devanagari script)"`), TTS synthesizes with `target_language_code: 'hi-IN'` and Hindi speaker. Pass condition: transcript text is in Hindi, response text is in Hindi, TTS audio is in Hindi, and conversation history displays Hindi text.
Evidence: STT request with `language_code: 'hi-IN'`; LLM system prompt containing Hindi instruction; TTS request with `target_language_code: 'hi-IN'`; persisted messages with Hindi content.

### VAL-CROSS-014: Language consistency — Marathi end-to-end
Same as VAL-CROSS-013 but for Marathi (`mr`). STT uses `language_code: 'mr-IN'`, LLM system prompt includes Marathi instruction, TTS uses Marathi speaker config (`SARVAM_TTS_MR_SPEAKER`). Pass condition: all pipeline stages produce Marathi output.
Evidence: STT/TTS requests with `mr-IN` language codes; LLM prompt with Marathi instruction; Marathi text in response and persisted history.

### VAL-CROSS-015: Language consistency — locale resolution fallback
When an unsupported or missing locale is provided, `resolveLocale` must default to `'en'`. Pass condition: English is used throughout the pipeline, no errors thrown.
Evidence: `resolveLocale` returning `'en'` for undefined/null/unsupported input; LLM response in English; TTS with `'en-IN'` language code.

### VAL-CROSS-016: First-time user experience — empty state
A new user with no conversation history opens the AI tab. The chat screen must display an empty state (no messages, no sidebar entries). The user can type or speak to start a new conversation. Pass condition: the message list is empty, the sidebar shows no conversations, the text input and voice button are enabled and functional.
Evidence: `messages` array is empty; `assistantMemoryService` returns empty conversation list; input field is interactive; voice button responds to press.

### VAL-CROSS-017: Theme consistency — dark mode in AI chat
With dark mode enabled (`isDark = true`), the AI chat screen must render with dark theme colors from the M3 color scheme: `m3.colorScheme.surface` for backgrounds, `m3.colorScheme.onSurface`/`onBackground` for text, `m3.colorScheme.primary` for accents. Markdown content must use themed styles via `markdownStyles(colors)`. Pass condition: no hardcoded light-mode colors visible, all text is legible against dark backgrounds.
Evidence: computed style values from `useM3()`/`useThemeColors()` in dark mode; Markdown style object using `m3.colorScheme.onBackground`; no white/light backgrounds; screenshot comparison.

### VAL-CROSS-018: Theme consistency — dark mode in voice mode overlay
The full-screen voice mode overlay must respect dark theme: animated orb, transcript text, and control buttons all use M3 dark color tokens. The `voiceModeMarkdown` styles must override body background/color with `m3.colorScheme.background`/`onBackground`. Pass condition: voice mode is visually consistent with dark theme, no light-mode artifacts.
Evidence: `voiceModeMarkdown` computed styles showing dark colors; orb animation using themed opacity via `colorWithOpacity`; screenshot of voice mode in dark theme.

### VAL-CROSS-019: Theme consistency — dark mode in conversation sidebar
The conversation history sidebar must render with dark theme colors. Conversation titles, timestamps, and the sidebar background must use M3 dark tokens. Pass condition: sidebar is legible and consistent with the rest of the dark-themed UI.
Evidence: sidebar component styles derived from M3 dark color scheme; no hardcoded colors; visual consistency with chat area.

### VAL-CROSS-020: Cross-flow — voice mode to text mode seamless transition
User starts in voice mode, speaks a question, receives a response, then switches to text mode and continues the same conversation by typing. Pass condition: the conversation continues with the same `conversationId`, previous voice turns are visible in the text chat, and the text response appends correctly.
Evidence: `conversationId` unchanged across mode switch; message history includes both voice and text turns; no duplicate or lost messages.

### VAL-CROSS-021: Cross-flow — route decision dispatching
The `decideChatRoute` function correctly classifies user input into routes (`advisory`, `log_activity`, `query_history`, etc.) and the gateway dispatches to the appropriate handler. For activity logging intents, the voice log flow activates; for advisory intents, the LLM chat flow activates. Pass condition: route classification matches user intent, and the correct downstream handler processes the request.
Evidence: `decideChatRoute` return value; `routing.decide` tool call in gateway trace; correct handler activation (voice log vs. LLM chat); `routeDecision` field in diagnostics.

### VAL-CROSS-022: Cross-flow — audio validation gates
When audio input is too short (`< MIN_AUDIO_BASE64_LENGTH`) or too small (`< MIN_AUDIO_ESTIMATED_BYTES`), the gateway returns a 400 error with `INVALID_AUDIO` code and a user-friendly message. The client must display this error gracefully without crashing. Pass condition: appropriate error message shown to user, no unhandled exceptions, voice mode remains functional for retry.
Evidence: gateway 400 response with `error: 'INVALID_AUDIO'`; client error handling in `sendAssistantTurn`; error message displayed in chat or alert; voice mode state reset to `idle`.

### VAL-CROSS-023: Cross-flow — telemetry spans across milestones
Every assistant turn must emit telemetry events that span the full flow: `ai_gateway_request_started` at entry, tool call traces for STT/LLM/TTS, and completion telemetry with cost breakdown (`stt_cost_usd`, `tts_cost_usd`, `llm_cost_usd`). Pass condition: a complete telemetry trail exists for each turn, enabling end-to-end latency analysis.
Evidence: `trackTelemetry` calls with `event_name: 'ai_gateway_request_started'`; tool call array with timing data; cost computation via `computeTurnCost`; `traceId` propagated through all events.

### VAL-CROSS-024: Cross-flow — concurrent request cancellation
When the user sends a new message while a previous request is in flight, `cancelPendingAssistantTurnRequest` must abort the pending request. The cancelled request must not produce a visible response or corrupt conversation state. Pass condition: only the latest request's response is rendered, no duplicate messages, no race condition errors.
Evidence: `cancelPendingAssistantTurnRequest` invoked before new `sendAssistantTurn`; AbortController signal propagated; no orphaned messages in state; conversation integrity verified.

### VAL-CROSS-025: Safety — blocked advice rendering
When the safety guardrail flags a response (e.g. chemical dosage advice), `buildBlockedAdviceMessage` generates a locale-appropriate warning. This message must render correctly in the chat UI in all three languages (en/hi/mr) and in both light and dark themes. Pass condition: blocked advice message is displayed instead of the unsafe response, localized correctly, and themed appropriately.
Evidence: `safety.check_advice` tool call with flagged status; `buildBlockedAdviceMessage` output for each locale; rendered message in chat view; no unsafe content leaked.
