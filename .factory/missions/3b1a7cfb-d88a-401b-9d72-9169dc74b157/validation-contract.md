# Validation Contract — AI Farming Assistant Complete Redesign

## Area: Backend Refactor

### VAL-BE-001: STT — Sarvam Saaras v3 primary transcription
When a user sends an audio message, the backend calls Sarvam Saaras v3 as the primary STT provider and returns a non-empty transcript. The response field `stt_provider_used` equals `"sarvam"`.
Evidence: Gateway response JSON with `stt_provider_used === "sarvam"`, non-empty `assistant_text`.

### VAL-BE-002: STT — auto language detection
When a user records audio in Hindi, Marathi, or English (or code-mixed), Sarvam Saaras v3 produces a transcript without requiring the client to pre-specify the spoken language. Code-mixing (Hinglish, Marathi-English) is handled correctly.
Evidence: Send audio containing code-mixed speech. Verify transcript contains tokens from both languages and LLM response is coherent.

### VAL-BE-003: STT — fallback to OpenAI Whisper on Sarvam failure
When Sarvam STT fails and `provider_fallback_enabled` is `true`, the backend falls back to OpenAI Whisper and still returns a valid transcript. The response contains `stt_provider_used === "openai_fallback"`.
Evidence: Simulate Sarvam STT failure. Verify fallback provider used and transcript is non-empty.

### VAL-BE-004: STT — circuit breaker opens after repeated Sarvam failures
After 5 consecutive Sarvam STT failures, the circuit breaker opens and subsequent requests route directly to OpenAI Whisper until reset timeout elapses.
Evidence: Trigger 5 consecutive failures. Verify 6th request uses OpenAI directly with circuit-open reason.

### VAL-BE-005: STT — minimum audio size validation
When the audio payload is below minimum size threshold, the backend returns HTTP 400 with error code `INVALID_AUDIO`.
Evidence: Send request with tiny audio payload. Verify HTTP 400 response with `INVALID_AUDIO` error.

### VAL-BE-006: Context assembly — full farm context in LLM prompt
When a farm is selected, the backend includes farm_id, farm_name, crop_variety, area, region, growth_stage, days_since_pruning in the LLM system prompt.
Evidence: Send advisory request with farm context. Verify LLM prompt includes farm context block.

### VAL-BE-007: Context assembly — memory context retrieval
When `memory_enabled` is `true`, the backend generates an embedding, searches `match_assistant_memories`, and injects matching memory blocks into LLM context.
Evidence: Create a memory entry, then send related query. Verify memory search executes and results appear in context.

### VAL-BE-008: Context assembly — RAG agronomy KB retrieval
When `rag_enabled` is `true`, the backend searches `match_agronomy_chunks` with the query embedding and locale, injecting KB blocks into LLM context.
Evidence: Send agronomy question. Verify RAG search executes and citations in response reference KB docs.

### VAL-BE-009: Context assembly — comprehensive data access (harvest, warehouse, workers, tasks, tests, notes)
The backend can query ALL farm data types: irrigation_records, spray_records, fertigation_records, expense_records, harvest_records, warehouse_items, workers/worker_attendance, task_reminders, soil_test_records, petiole_test_records, daily_notes. Each data type is accessible when the user asks about it.
Evidence: For each data type, send a relevant query and verify the backend returns data from the correct table.

### VAL-BE-010: LLM advisory — GPT-4o-mini responses
Advisory route responses use GPT-4o-mini (or configured model). Response field `model_used` reflects the configured model.
Evidence: Send advisory question. Verify `model_used` matches configuration.

### VAL-BE-011: LLM advisory — language-correct response
When `locale` is `hi`, the response is in Hindi. When `mr`, in Marathi. When `en`, in English. The LLM system prompt includes the appropriate language instruction.
Evidence: Send identical questions with different locales. Verify each response is in the expected language.

### VAL-BE-012: LLM advisory — farm-aware answers
When farm context and KB context are present, the LLM produces advice referencing the user's specific crop variety, growth stage, and region rather than generic advice.
Evidence: Send pest management query with specific farm context. Verify response references farm-specific details.

### VAL-BE-013: Safety — spray/fertigation guardrails
For spray or fertigation advisory queries, the safety system checks for dosage, PPE, uncertainty, and escalation sections. Missing sections elevate the risk level in `safety_flags`.
Evidence: Ask spray recommendation. Verify `safety_flags` present in response with appropriate risk assessment.

### VAL-BE-014: TTS — Sarvam Bulbul v3 primary
When `can_play_audio` is `true`, the backend generates speech via Sarvam Bulbul v3 and returns base64 audio with correct MIME type.
Evidence: Send request with audio playback enabled. Verify non-null audio response from Sarvam.

### VAL-BE-015: TTS — locale-specific speaker voices
TTS uses locale-specific speakers: different voices for English, Hindi, and Marathi content.
Evidence: Send TTS requests for each locale. Verify correct speaker selection per locale.

### VAL-BE-016: TTS — fallback to OpenAI TTS
When Sarvam TTS fails and fallback is enabled, the backend falls back to OpenAI TTS and returns audio.
Evidence: Simulate Sarvam TTS failure. Verify OpenAI fallback produces audio.

### VAL-BE-017: TTS — graceful degradation when both fail
When both Sarvam and OpenAI TTS fail, the backend returns the text response without audio. No error is thrown to the client.
Evidence: Simulate both TTS failures. Verify text response present, audio null, no HTTP error.

### VAL-BE-018: Memory — conversation turn persistence
Each user and assistant turn is written to `assistant_turns` with conversation_id, role, content, input_mode, trace_id, latency, citations, safety_flags.
Evidence: Send request. Query assistant_turns for trace_id. Verify both user and assistant turns exist.

### VAL-BE-019: Memory — summary written to assistant_memories
After an advisory response, a memory summary with embedding is written to `assistant_memories` with 180-day expiry.
Evidence: Send advisory request. Verify memory row and embedding row created with correct expiry.

### VAL-BE-020: Activity logging — intent extraction
When the user says something like "log 2 hours irrigation", the backend extracts structured activity data using the LLM and returns a `voice_log_action` with the correct activity type and fields.
Evidence: Send logging request. Verify route_decision is voice_log and extracted fields are correct.

### VAL-BE-021: Activity logging — confirmation before writing
The backend does NOT write activity records directly. It returns a prefill payload to the client for user confirmation. No database write occurs without explicit user confirmation on the client.
Evidence: Complete a voice log flow. Verify no new activity rows in database until client confirms.

### VAL-BE-022: Activity logging — all five types supported
The backend supports logging for: irrigation, spray, harvest, expense, fertigation. Each type extracts its specific required fields.
Evidence: For each type, send a logging request with complete data. Verify correct type-specific prefill returned.

### VAL-BE-023: Activity logging — cancellation
When the user says "cancel" during a voice log flow, the draft is cleared and the system returns to normal advisory mode.
Evidence: Start logging, then say "cancel". Verify draft cleared and next request routes normally.

### VAL-BE-024: Farm data query — aggregation queries
The backend correctly aggregates farm data (total irrigation hours, total expenses, spray count, harvest totals, etc.) and returns localized answers.
Evidence: Pre-populate records. Ask aggregation query. Verify correct totals in response.

### VAL-BE-025: Farm data query — farm-scoped queries
When farm_id is provided, all queries are scoped to that specific farm.
Evidence: Create records on two farms. Query with farm_id of farm A. Verify only farm A results returned.

### VAL-BE-026: Error handling — authentication required
Missing or invalid bearer token returns HTTP 401.
Evidence: Send request without auth header. Verify HTTP 401.

### VAL-BE-027: Error handling — text input exceeds limit
Text input exceeding 5000 characters returns HTTP 400.
Evidence: Send oversized text. Verify HTTP 400.

### VAL-BE-028: Multi-language — Hindi intent detection
Hindi-language utterances correctly route to the appropriate handler (voice_log, farm_query, advisory).
Evidence: Send Hindi utterance. Verify correct routing.

### VAL-BE-029: Multi-language — Marathi intent detection
Marathi-language utterances correctly route to the appropriate handler.
Evidence: Send Marathi utterance. Verify correct routing.

### VAL-BE-030: Modular backend structure
The ai-gateway edge function is organized into clean, separate modules (not a single monolithic file). Each module (STT, TTS, LLM, context, routing, memory, safety) is in its own file with clear interfaces.
Evidence: Verify file structure has separate modules. No single file exceeds 500 lines.

### VAL-BE-031: Weather data accessible for advisory
When a user asks a weather-dependent question (e.g., "Should I spray today?"), the backend can include relevant weather context in the LLM prompt.
Evidence: Send weather-dependent advisory query. Verify weather data referenced in response or available in context.

### VAL-BE-032: Audio maximum size validation
Audio payloads exceeding the maximum size limit (10MB) are rejected with an appropriate HTTP error.
Evidence: Send oversized audio. Verify HTTP 400/413 with clear error message.

### VAL-BE-033: Empty/whitespace text input rejection
When input_mode is text and input_text is empty or whitespace-only, the backend returns HTTP 400.
Evidence: Send empty text. Verify HTTP 400 response.

### VAL-BE-034: Conversation creation on first message
When conversation_id is null, the backend creates a new conversation and returns the new conversation_id in the response.
Evidence: Send request with null conversation_id. Verify new conversation_id returned.

---

## Area: Assistant UI

### VAL-UI-001: AI Assistant tab in bottom navigation
The bottom tab bar displays exactly five tabs: Dashboard, Explore, Workers, Tools, AI Assistant. The former "Settings" tab is NOT in the tab bar.
Evidence: screenshot of tab bar showing all five tabs with correct labels and icons.

### VAL-UI-002: Settings accessible from Dashboard header
The Dashboard screen header renders a profile/settings icon button. Tapping it navigates to the settings screen.
Evidence: screenshot of Dashboard header with icon button; navigation to settings confirmed.

### VAL-UI-003: AI Assistant tab navigates to chat screen
Tapping the AI Assistant tab renders the AI chat screen without errors.
Evidence: route assertion showing chat screen active after tab press.

### VAL-UI-004: New conversation creation
A "New Chat" button is visible. Tapping it clears messages, generates a new conversationId, and shows the welcome/empty state.
Evidence: tap New Chat → verify new conversationId, empty message list, welcome view displayed.

### VAL-UI-005: Conversation history sidebar
A sidebar toggle button opens a slide-in drawer listing past conversations with preview text and dates. The list is scrollable.
Evidence: screenshot of sidebar open with conversation items visible.

### VAL-UI-006: Switching conversations loads correct messages
Tapping a conversation in the sidebar loads that conversation's full message history.
Evidence: tap conversation → verify messages match the selected conversation's stored turns.

### VAL-UI-007: Text input sends message
Typing text enables a send button. Tapping send appends a user message, clears input, triggers assistant request, and shows loading indicator.
Evidence: type text → send → user message in list, input cleared, loading indicator visible.

### VAL-UI-008: Assistant messages render with Markdown
Assistant messages render Markdown (bold, italic, lists, code blocks) correctly using the M3 theme colors.
Evidence: response with markdown content renders correctly in both themes.

### VAL-UI-009: Citation display on RAG responses
When assistant messages include citations, citation markers are visible and reference source material.
Evidence: response with citations → citation markers rendered in message.

### VAL-UI-010: Suggestion chips after assistant response
After an assistant response, suggestion chips are displayed. Tapping a chip sends that suggestion as a message.
Evidence: chips rendered after response; tap chip → message sent.

### VAL-UI-011: Activity log confirmation card
When the AI proposes an activity log (voice_log_action ready), a confirmation card shows draft details with Confirm and Cancel buttons.
Evidence: mock ready draft → confirmation card rendered with correct fields and action buttons.

### VAL-UI-012: User confirms activity log — navigates to form
Tapping Confirm on the activity log card navigates to the add-entry screen with prefilled parameters.
Evidence: tap Confirm → navigation to add-entry with correct params.

### VAL-UI-013: User rejects activity log
Tapping Cancel on the activity log card dismisses it without navigating. Chat returns to normal.
Evidence: tap Cancel → card dismissed, no navigation, input available.

### VAL-UI-014: Loading indicator while awaiting response
After sending a message, a loading indicator appears until response or error. Send button is disabled during loading.
Evidence: send message → loading indicator visible; send button disabled; on response → indicator removed.

### VAL-UI-015: Empty state for new conversations
When no conversation is active, a welcome view with assistant description and suggestion chips is shown.
Evidence: first open or new chat → welcome view, suggestion chips, empty message list.

### VAL-UI-016: Network error with retry
If the request fails due to network error, a failed-request banner with Retry and Dismiss buttons appears. Retry re-sends the same payload.
Evidence: simulate failure → banner visible; tap Retry → same request re-sent; on success → banner removed.

### VAL-UI-017: Dark theme rendering
In dark mode, all chat screen elements use M3 dark color tokens. Text is legible, no hardcoded light colors.
Evidence: screenshot in dark mode showing correct theming.

### VAL-UI-018: Light theme rendering
In light mode, all chat screen elements use M3 light color tokens.
Evidence: screenshot in light mode showing correct theming.

### VAL-UI-019: i18n — Hindi labels
With locale `hi`, all static labels render in Hindi without fallback to English.
Evidence: set locale to hi → verify labels are Hindi.

### VAL-UI-020: i18n — Marathi labels
With locale `mr`, all static labels render in Marathi without fallback to English.
Evidence: set locale to mr → verify labels are Marathi.

### VAL-UI-021: Voice mode toggle button
When no text is entered, a microphone button is displayed in the input bar. Tapping it opens the voice mode modal.
Evidence: assert mic button visible when input empty; tap → voice mode opens.

### VAL-UI-022: Message list auto-scrolls to latest
When a new message is added (user or assistant), the message list scrolls to show the latest message.
Evidence: send message when scrolled up → list scrolls to bottom.

### VAL-UI-023: Keyboard handling
When the keyboard opens, the input bar remains visible above it. The message list is still scrollable.
Evidence: focus input → keyboard opens → input bar visible above keyboard.

### VAL-UI-024: Delete conversation from sidebar
Each conversation in the sidebar has a delete option. Deleting prompts confirmation, then removes the conversation.
Evidence: delete conversation → confirmation → conversation removed from list and storage.

### VAL-UI-025: No farm selected — graceful degradation
When no farm is selected, the assistant handles general questions normally and guides the user to select a farm for farm-specific queries.
Evidence: open AI chat with no farm selected → general query works; farm-specific query shows guidance.

### VAL-UI-026: Image attachment support
Users can attach images via the input bar attachment button. Images are sent to the backend as part of the message. The assistant can reference image content in responses.
Evidence: attach image → send → backend receives attachment; response acknowledges image.

---

## Area: Voice Mode

### VAL-VM-001: Voice mode activation from chat screen
Tapping the microphone button on the chat input bar opens a full-screen voice mode modal with an animated orb in idle state.
Evidence: screenshot of full-screen voice mode modal with orb visible.

### VAL-VM-002: Voice mode idle state
When voice mode opens, the orb is in idle state with a "Tap to speak" prompt. Close button is accessible.
Evidence: screenshot showing idle orb, prompt text, close button.

### VAL-VM-003: Listening state — recording starts on tap
Tapping the orb starts audio recording via expo-audio. The orb transitions to a listening animation (pulsing). A "Listening..." label appears.
Evidence: screenshot of listening state; audio recorder active.

### VAL-VM-004: Audio recording captures speech
While listening, expo-audio records audio (WAV on iOS, compatible format on Android) for STT processing.
Evidence: audio file created with correct format and non-zero size.

### VAL-VM-005: Speech end detection and auto-stop
After the user stops speaking, voice mode automatically detects silence and stops recording, transitioning to processing state.
Evidence: recording stops automatically after silence; state transitions to processing.

### VAL-VM-006: Manual stop recording
User can tap the orb to manually stop recording. Recording stops and transitions to processing.
Evidence: tap during recording → recording stops, processing begins.

### VAL-VM-007: Processing state visual feedback
After recording, the orb shows a processing/thinking animation. A "Thinking..." label appears. Mic is disabled.
Evidence: screenshot of processing state with distinct animation.

### VAL-VM-008: STT auto language detection in voice mode
Voice mode uses Sarvam Saaras v3 with auto language detection. Hindi, Marathi, English, and code-mixed speech are transcribed without manual language selection.
Evidence: speak in different languages → transcript correct for each.

### VAL-VM-009: Transcript displayed in voice mode
After STT completes, the user's transcribed text appears in the voice mode conversation view.
Evidence: transcript text visible in voice mode before AI response arrives.

### VAL-VM-010: Speaking state — TTS playback with orb animation
When AI response arrives with audio, the orb shows a speaking animation (waveform). Audio plays through device speaker. Text response is also displayed.
Evidence: screenshot of speaking state with waveform; audio plays; text visible.

### VAL-VM-011: TTS uses native Sarvam voices
TTS audio uses Sarvam Bulbul v3 with locale-appropriate voices. Hindi responses use Hindi speaker, Marathi uses Marathi speaker.
Evidence: audio sounds natural in target language with correct speaker.

### VAL-VM-012: Auto-listen after response
After TTS playback completes, voice mode returns to listening state for continuous conversation.
Evidence: after playback ends, recording starts automatically.

### VAL-VM-013: Dismissal via close button
Close button dismisses voice mode modal and returns to text chat. Any in-progress recording stops.
Evidence: tap close → modal dismissed; recording stops; text chat visible.

### VAL-VM-014: Dismissal via swipe down
Swiping down on the voice mode modal dismisses it.
Evidence: swipe down → modal dismissed; text chat visible.

### VAL-VM-015: Interruption — tap while speaking
Tapping the orb while AI is speaking stops playback and transitions to listening state.
Evidence: tap during TTS → audio stops; listening state begins.

### VAL-VM-016: Error state — STT failure
If STT fails, voice mode displays an error message with option to retry.
Evidence: screenshot of error state with retry option.

### VAL-VM-017: Error state — network failure
Network failure during voice flow shows error message with retry. No crash.
Evidence: screenshot of network error; retry functional.

### VAL-VM-018: Error state — no microphone permission
If mic permission denied, voice mode shows informative error guiding to settings.
Evidence: permission denied → informative error shown.

### VAL-VM-019: Conversation thread visible in voice mode
Voice mode displays a scrollable thread of conversation turns (transcripts and responses).
Evidence: screenshot showing multiple turns; thread scrollable.

### VAL-VM-020: Voice messages persist to conversation
Messages from voice mode persist to the same conversation. Closing voice mode shows them in text chat.
Evidence: voice messages → close voice mode → messages visible in text chat.

### VAL-VM-021: iOS recording compatibility
On iOS, recording produces WAV format compatible with Sarvam STT.
Evidence: iOS recording produces WAV; Sarvam accepts and transcribes.

### VAL-VM-022: Android recording compatibility
On Android, recording produces format compatible with backend STT pipeline.
Evidence: Android recording works; backend processes audio.

### VAL-VM-023: Voice mode respects theme
Voice mode renders correctly in both light and dark themes using M3 tokens.
Evidence: screenshots in both themes showing consistent theming.

### VAL-VM-024: Haptic feedback on interactions
Tapping the orb to start/stop triggers haptic feedback via expo-haptics.
Evidence: haptic felt on tap; expo-haptics called.

### VAL-VM-025: Android back button dismisses voice mode
On Android, pressing the hardware back button dismisses the voice mode modal.
Evidence: Android back button → voice mode dismissed; text chat visible.

### VAL-VM-026: Maximum recording duration with auto-stop
Voice mode has a maximum recording duration (e.g., 60 seconds) with auto-stop to prevent very long recordings.
Evidence: record for extended period → auto-stops at max duration; audio processed normally.

---

## Area: Cleanup & Polish

### VAL-CL-001: Legacy ai-chat.tsx removed
The file `app/ai-chat.tsx` (152KB monolith) does not exist. No routes reference it.
Evidence: file not found; grep for "ai-chat" in app/ returns no navigation references.

### VAL-CL-002: Legacy AI chat route removed from stack
The `<Stack.Screen name="ai-chat" />` declaration in `app/_layout.tsx` is deleted.
Evidence: grep for `name="ai-chat"` returns no matches.

### VAL-CL-003: All navigation links to legacy chat removed
All `router.push('/ai-chat')` calls are removed or replaced with new assistant route.
Evidence: grep for "ai-chat" in app/ returns zero navigation hits.

### VAL-CL-004: Legacy farm-assistant-service removed
The file `src/services/farm-assistant-service.ts` does not exist.
Evidence: file not found.

### VAL-CL-005: Legacy voice-log-assistant removed
The file `src/services/voice-log-assistant.ts` does not exist.
Evidence: file not found.

### VAL-CL-006: Legacy ai-service proxy paths removed
The file `src/services/ai-service.ts` does not exist. No imports reference it.
Evidence: file not found; grep for "ai-service" returns no import statements.

### VAL-CL-007: Legacy farm-assistant-store removed
The file `src/stores/farm-assistant-store.ts` does not exist. Its export from `src/stores/index.ts` is removed.
Evidence: file not found; grep for "farm-assistant-store" returns no matches.

### VAL-CL-008: Legacy voice-patterns constants removed
The file `src/constants/voice-patterns.ts` does not exist. No imports reference it.
Evidence: file not found; grep for "voice-patterns" returns no matches.

### VAL-CL-009: Legacy use-farm-assistant hook removed
The file `src/hooks/use-farm-assistant.ts` does not exist. Its export from `src/hooks/index.ts` is removed.
Evidence: file not found; grep for "use-farm-assistant" returns no matches.

### VAL-CL-010: Legacy test files removed or updated
Test files that exclusively test removed services are deleted. Test references to `/ai-chat` are updated.
Evidence: legacy test files not found; grep for "ai-chat" in tests returns no references to old route.

### VAL-CL-011: TypeScript compiles cleanly
`npx tsc --noEmit` completes with zero errors after all cleanup.
Evidence: TypeScript compiler output shows 0 errors, exit code 0.

### VAL-CL-012: All tests pass
Full test suite passes after cleanup. No `Cannot find module` errors from removed files.
Evidence: test runner shows all suites passing.

### VAL-CL-013: Lint passes
ESLint completes with zero errors after cleanup.
Evidence: lint output shows 0 errors, exit code 0.

### VAL-CL-014: i18n — orphaned keys removed
Legacy `farmAssistant` key namespace and old `ai.chat.*` keys used only by removed code are deleted from all 3 locale files.
Evidence: grep for orphaned keys returns no matches; remaining keys are used by surviving code.

### VAL-CL-015: i18n — new keys in all 3 locales
New i18n keys introduced by the redesigned assistant exist in en, hi, and mr locale files.
Evidence: key parity check across all 3 locales passes.

### VAL-CL-016: No dead imports from removed modules
No surviving code imports from any removed module (farm-assistant-service, voice-log-assistant, ai-service, farm-assistant-store, voice-patterns, ai-chat).
Evidence: grep for removed module names in imports returns zero matches.

---

## Cross-Area Flows

### VAL-CROSS-001: End-to-end text chat flow
User navigates to AI tab → types farm question → backend assembles full farm context → LLM responds → response rendered with Markdown and citations.
Evidence: screenshot of rendered response; backend trace showing context assembly and LLM call.

### VAL-CROSS-002: End-to-end voice flow
User opens voice mode → speaks in Marathi → STT transcribes → LLM processes with farm context → TTS speaks Marathi response → transcript and response visible.
Evidence: backend trace showing STT/LLM/TTS chain; voice mode shows transcript and response; audio plays.

### VAL-CROSS-003: Voice-to-activity logging end-to-end
User speaks "I irrigated for 3 hours" → STT → backend extracts activity → confirmation card shown → user confirms → navigates to add-entry with prefilled data.
Evidence: confirmation card rendered with correct fields; navigation to add-entry with correct params.

### VAL-CROSS-004: Conversation persistence — save and resume
User has multi-turn conversation → closes app → reopens AI tab → taps conversation from sidebar → full history restored with correct Markdown rendering.
Evidence: messages restored in order; sidebar lists conversation; Markdown renders correctly.

### VAL-CROSS-005: Tab navigation — profile to settings
Dashboard shows profile button → tapping navigates to settings → settings page renders correctly.
Evidence: navigation from dashboard to settings; settings screen mounts without errors.

### VAL-CROSS-006: Language consistency — Hindi end-to-end
With Hindi locale: STT transcribes Hindi → LLM responds in Hindi → TTS speaks Hindi → all UI labels in Hindi.
Evidence: all pipeline stages produce Hindi output; UI labels match Hindi translations.

### VAL-CROSS-007: Language consistency — Marathi end-to-end
With Marathi locale: STT transcribes Marathi → LLM responds in Marathi → TTS speaks Marathi → all UI labels in Marathi.
Evidence: all pipeline stages produce Marathi output; UI labels match Marathi translations.

### VAL-CROSS-008: Voice mode to text mode transition
User starts in voice mode → speaks questions → switches to text mode → conversation continues with same conversationId → voice turns visible in text chat.
Evidence: conversationId unchanged; message history includes both voice and text turns.

### VAL-CROSS-009: First-time user experience
New user opens AI tab → sees welcome/empty state → can start typing or speaking → first conversation created and appears in sidebar.
Evidence: empty state shown; first message creates conversation; sidebar shows it.

### VAL-CROSS-010: Dark mode consistency across all screens
Dark mode renders correctly across: AI chat screen, voice mode modal, conversation sidebar, confirmation cards.
Evidence: screenshots of each component in dark mode; all use M3 dark tokens.

### VAL-CROSS-011: Request cancellation on new message
Sending a new message while a previous request is in flight cancels the pending request. Only the latest response is rendered.
Evidence: send during pending → pending cancelled; no duplicate messages; conversation state intact.

### VAL-CROSS-012: Safety warning rendering across languages
Blocked safety advice renders correctly in all three languages (en/hi/mr) and in both themes.
Evidence: blocked advice in each locale → correct localized warning displayed; themed correctly.

### VAL-CROSS-013: Farm switch mid-conversation
When a user switches the active farm during an ongoing conversation, subsequent messages use the new farm's context.
Evidence: start conversation about Farm A → switch to Farm B → ask farm question → response references Farm B.

### VAL-CROSS-014: Activity log confirmation for all 5 types renders correctly
Confirmation cards display type-specific fields for each of the 5 activity types (irrigation: duration; spray: chemicals/volume; harvest: quantity/grade; expense: cost/type; fertigation: fertilizers/volume).
Evidence: for each type, trigger confirmation card → verify type-specific fields displayed correctly.
