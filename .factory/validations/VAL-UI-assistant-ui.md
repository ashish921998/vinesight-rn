# Assistant UI — Validation Contract Assertions

## Tab Navigation

### VAL-UI-001: AI Assistant tab is present in bottom navigation
The bottom tab bar MUST display exactly five tabs in order: Dashboard, Explore, Workers, Tools, AI Assistant. The former "Settings" tab MUST NOT appear in the tab bar. The AI Assistant tab MUST use a recognisable AI/chat icon (e.g., `sparkles` or `bubble.left.and.bubble.right`) and render its label from the `tabs.aiAssistant` i18n key.
Evidence: Screenshot of tab bar on iOS and Android showing all five tabs with correct labels and icons; automated UI test asserting `Tabs.Screen` / `NativeTabs.Trigger` names and order.

### VAL-UI-002: Settings accessible from Dashboard header
The Dashboard screen header MUST render a profile/settings icon button (e.g., gear or avatar) in the trailing position. Tapping it MUST navigate to the existing settings screen (`/settings` or equivalent route). The button MUST be keyboard-focusable and carry an `accessibilityLabel` matching `a11y.openSettings` i18n key.
Evidence: Screenshot of Dashboard header with icon button visible; navigation log or route assertion confirming navigation to settings screen on press.

### VAL-UI-003: AI Assistant tab navigates to AI chat screen
Tapping the AI Assistant tab MUST render the AI chat screen component. The screen MUST mount without errors and display either the empty-state view (VAL-UI-025) or the last-open conversation.
Evidence: Route assertion showing the AI chat screen path is active after tab press; no red-box errors on mount.

## New Conversation Creation

### VAL-UI-004: New conversation can be started from chat screen
The AI chat screen MUST expose a clearly visible "New Chat" affordance (button or menu item). Tapping it MUST clear the current message list, generate a new `conversationId`, reset input text and attachments, and display the empty-state / welcome view.
Evidence: Tap "New Chat" → assert `conversationId` changes, `messages` array length is 0, and welcome view or suggestion chips are displayed.

### VAL-UI-005: New conversation can be started from history sidebar
Inside the conversation history sidebar/modal, a "New Chat" button MUST be rendered at the top. Tapping it MUST close the sidebar, create a new conversation (same behaviour as VAL-UI-004), and focus the input bar.
Evidence: Open sidebar → tap "New Chat" → sidebar closes, new empty conversation is active.

## Conversation History

### VAL-UI-006: History sidebar opens and lists past conversations
A sidebar toggle button (e.g., `sidebar.left` icon) MUST be present on the chat screen header. Tapping it MUST open a slide-in modal/drawer listing previously saved conversations, each showing a preview of the last message and a formatted date. The list MUST be scrollable.
Evidence: Screenshot of sidebar open with ≥2 conversation items visible; scroll assertion if list exceeds viewport.

### VAL-UI-007: History sidebar shows loading state
While conversation summaries are being fetched, the sidebar MUST display an `ActivityIndicator` (or equivalent loading spinner) instead of the conversation list. No empty-state text MUST be shown during loading.
Evidence: Mock slow network → open sidebar → assert spinner is visible and conversation list is not rendered.

### VAL-UI-008: History sidebar shows empty state
When the user has no previous conversations, the sidebar MUST display a localised empty-state message (from `ai.chat.noPreviousChats` i18n key) centred in the list area. No spinner MUST be visible.
Evidence: Clear all conversations → open sidebar → assert empty-state text is rendered.

### VAL-UI-009: Switching conversations loads correct messages
Tapping a conversation item in the sidebar MUST close the sidebar, set the active `conversationId`, and load that conversation's full message history into the message list. The previously displayed messages MUST be replaced entirely.
Evidence: Open sidebar → tap different conversation → assert `conversationId` matches selected item and `messages` reflect the stored turns for that conversation.

### VAL-UI-010: Deleting a conversation from sidebar
Each conversation item MUST display a delete button (trash icon). Tapping it MUST prompt a confirmation dialog. On confirmation, the conversation MUST be removed from the list and from persistent storage. If the deleted conversation was active, the screen MUST transition to a new empty conversation.
Evidence: Tap delete → confirm → assert conversation removed from `visibleConversationSummaries`; if active, assert new conversation created.

## Message Sending

### VAL-UI-011: Text input accepts and sends a message
The input bar MUST contain a multi-line `TextInput`. Typing text MUST enable a send button (arrow-up icon). Tapping send MUST: (a) append a user message bubble to the message list, (b) clear the input field, (c) trigger an assistant request, (d) show the loading/typing indicator (VAL-UI-020).
Evidence: Type "Hello" → tap send → assert user message with "Hello" in list, input field is empty, loading indicator visible.

### VAL-UI-012: Send via keyboard return key
Pressing the keyboard "Send" / return key (`returnKeyType="send"`) MUST behave identically to tapping the send button (VAL-UI-011) when input text is non-empty. It MUST NOT send when input is empty or whitespace-only.
Evidence: Focus input → type text → press return → assert message sent; focus input → press return with empty text → assert no message sent.

### VAL-UI-013: Send button visibility rules
The send button inside the input pill MUST be visible only when `inputText.trim()` is non-empty OR there are attachments. Otherwise the voice-mode toggle button MUST be visible in its place. During loading (`isLoading === true`), the send button MUST NOT be rendered.
Evidence: Empty input → assert mic button visible, send button absent; type text → assert send button visible, mic button absent; during loading → assert send button absent.

### VAL-UI-014: Voice mode toggle button opens voice modal
When no text is entered and no attachments are present, a microphone button MUST be displayed. Tapping it MUST open the voice mode modal. The button MUST carry `accessibilityLabel` matching `ai.chat.openVoiceModeA11y`.
Evidence: Assert mic button rendered; tap → assert voice mode modal becomes visible.

### VAL-UI-015: Attachment picker opens and adds attachments
An attachment button (plus icon) MUST be present in the input bar. Tapping it MUST open a picker allowing image or document selection. Selected files MUST appear as removable chips/thumbnails above the input field. At least one attachment MUST enable the send button even with empty text.
Evidence: Tap attachment → select image → assert attachment chip rendered; assert send button visible with empty text.

## Message Rendering

### VAL-UI-016: User messages render correctly
User messages MUST be displayed as right-aligned bubbles with the user's text. The bubble background MUST use the primary color at reduced opacity (consistent with M3 theme). Messages MUST support multi-line content.
Evidence: Send multi-line message → screenshot asserting right-alignment, correct background colour, full text visible.

### VAL-UI-017: Assistant messages render with Markdown
Assistant messages MUST be rendered using a Markdown renderer (react-native-markdown-display). Bold, italic, lists, code blocks, and links MUST render with appropriate styling. The markdown styles MUST respect the current theme (dark/light).
Evidence: Mock assistant response with markdown content (bold, list, code) → screenshot verifying correct rendering; toggle theme → verify colours adapt.

### VAL-UI-018: Citation display on RAG responses
When an assistant message includes `citations` array, citation markers or footnotes MUST be appended to the message content (via `appendCitationsToMessage`). Each citation MUST be tappable/visible and clearly reference the source material.
Evidence: Mock response with 2+ citations → assert citation markers rendered in message; verify each citation text/source is present.

### VAL-UI-019: Suggestion chips displayed after assistant response
After an assistant response, suggestion chips MUST be rendered below the message list / above the input bar. Each chip MUST display localised suggestion text. Tapping a chip MUST populate the input bar with the suggestion text and trigger a send (or pre-fill for user confirmation).
Evidence: Assert suggestion chips rendered after response; tap chip → assert input populated and/or message sent.

## Activity Log Confirmation Flow

### VAL-UI-020: AI proposes activity log — confirmation card rendered
When the assistant determines a voice-log draft is ready (`serverReadyDraft` present), a confirmation card MUST be rendered showing the draft details (activity type, farm, date, relevant fields). The card MUST include "Confirm" and "Cancel" action buttons.
Evidence: Mock assistant response with `serverReadyDraft` → assert confirmation card rendered with correct field values and two action buttons.

### VAL-UI-021: User confirms activity log — navigates to add-entry
Tapping "Confirm" on the activity log card MUST navigate to the `/add-entry` screen with correct prefilled parameters (`farmId`, `initialLogType`, `initialTab: 'log'`, `entrySource: 'voice_ai'`, and type-specific fields like `initialIrrigationDurationHours`). The `useModalStore` MUST be updated with `voiceLogPrefill`.
Evidence: Tap Confirm → assert router navigated to `/add-entry` with correct params; assert `useModalStore` state includes `voiceLogPrefill`.

### VAL-UI-022: User rejects activity log — log cancelled
Tapping "Cancel" on the activity log card MUST dismiss the card, optionally append a system message indicating cancellation, and return the user to normal chat input. No navigation to `/add-entry` MUST occur.
Evidence: Tap Cancel → assert card dismissed, no navigation event fired, chat input is focusable.

## Loading States

### VAL-UI-023: Typing/loading indicator while awaiting response
After sending a message, a loading indicator MUST appear in the message list (e.g., `ActivityIndicator` or animated dots) representing the assistant "thinking". The indicator MUST remain until the assistant response is appended or an error occurs. The send button MUST be disabled during this period.
Evidence: Send message → assert loading indicator visible in message area; assert send button not rendered or disabled; on response → indicator removed.

### VAL-UI-024: History sidebar loading indicator
When the sidebar is opened and conversation history is being fetched, a centred `ActivityIndicator` MUST be displayed. It MUST disappear once data arrives or an error is handled.
Evidence: Open sidebar with slow fetch → assert spinner visible; data arrives → spinner removed, list rendered.

## Empty States

### VAL-UI-025: Empty state for new/no conversations
When the AI chat screen loads with no active conversation (first launch or after "New Chat"), a welcome/empty-state view MUST be shown. This MUST include: (a) a greeting or brief description of assistant capabilities, (b) suggestion chips for first queries. No message bubbles MUST be visible.
Evidence: Open AI tab for first time → assert welcome view rendered, suggestion chips present, message list empty.

### VAL-UI-026: Empty state in conversation history sidebar
When conversation history has zero entries, the sidebar MUST show the `ai.chat.noPreviousChats` localised text. The "New Chat" button MUST still be visible and functional.
Evidence: Assert empty-state text rendered; tap "New Chat" → new conversation created (same as VAL-UI-005).

## Error States

### VAL-UI-027: Network error during message send
If the assistant request fails due to a network error, a failed-request banner MUST appear above the input bar showing `ai.chat.failedRequest` localised text, a "Retry" button, and a dismiss (✕) button. The original user message MUST remain in the list. No assistant bubble MUST be appended.
Evidence: Simulate network failure → assert banner visible with retry and dismiss controls; assert user message present, no assistant message added.

### VAL-UI-028: Retry failed request
Tapping "Retry" on the failed-request banner MUST re-send the exact same payload (text, source, voice payload, attachments) to the assistant gateway. On success, the banner MUST disappear and the assistant response MUST be appended normally.
Evidence: Tap Retry → assert same request payload sent; on success → banner removed, assistant message appended.

### VAL-UI-029: Dismiss failed request banner
Tapping the dismiss (✕) button on the failed-request banner MUST remove the banner without retrying. The `failedRequest` state MUST be set to `null`. The user MUST be able to compose and send new messages.
Evidence: Tap ✕ → assert banner removed; type new message and send → assert normal flow.

### VAL-UI-030: Backend/gateway error with message
If the assistant gateway returns a non-network error (e.g., 500, rate limit), an `Alert` dialog MUST be shown with the error message. The loading state MUST be cleared, and the user MUST be able to send a new message afterward.
Evidence: Mock 500 response → assert Alert shown with error text; after dismissing alert → assert `isLoading` is false and input bar is interactive.

### VAL-UI-031: Voice recording too short error
If the voice payload fails audio validation (`AUDIO_VALIDATION_FAILED`), an Alert MUST be shown with `ai.voice.recordingTooShortTitle` and `ai.voice.recordingTooShortBody` localised text. Voice mode MUST exit, and mic MUST be disabled. No failed-request banner MUST appear.
Evidence: Simulate short recording → assert Alert with correct title/body; assert voice mode closed, no retry banner.

## Dark / Light Theme Rendering

### VAL-UI-032: Chat screen renders correctly in light theme
With light theme active (`isDark === false`), all chat screen elements MUST use M3 light colour scheme tokens: surface backgrounds, onSurface text colours, primary accents, outlineVariant borders. No hardcoded dark-mode colours MUST be visible.
Evidence: Set light theme → full-screen screenshot → visual inspection or pixel-colour assertions against M3 light palette values.

### VAL-UI-033: Chat screen renders correctly in dark theme
With dark theme active (`isDark === true`), all chat screen elements MUST use M3 dark colour scheme tokens. Text MUST be legible against dark backgrounds. The status bar style MUST be `'light'`. Conversation sidebar, input bar, message bubbles, and suggestion chips MUST all adapt.
Evidence: Set dark theme → full-screen screenshot → visual inspection or pixel-colour assertions against M3 dark palette values; assert `StatusBar style="light"`.

### VAL-UI-034: Theme transition does not break layout
Toggling between dark and light theme while the chat screen is mounted MUST NOT cause layout shifts, text truncation, missing elements, or crashes. All interactive elements MUST remain functional after the switch.
Evidence: Open chat → toggle theme twice → assert no crashes, all elements rendered, send a message successfully.

## i18n (Internationalisation)

### VAL-UI-035: All static labels render in English (en)
With locale set to `en`, all visible labels on the AI chat screen MUST match their English translations: tab label (`tabs.aiAssistant`), input placeholder (`ai.input.placeholder`), history title (`ai.chat.history`), "New Chat" (`ai.chat.newChat`), empty states, error messages, and accessibility labels.
Evidence: Set locale to `en` → screenshot and string-match assertions for at least 10 distinct i18n keys on the chat screen.

### VAL-UI-036: All static labels render in Hindi (hi)
With locale set to `hi`, every label verified in VAL-UI-035 MUST render in Hindi. No English fallback text MUST appear for keys that have Hindi translations. Text MUST not be truncated or overlapping due to longer Hindi strings.
Evidence: Set locale to `hi` → screenshot and string assertions; visual check for truncation or overflow.

### VAL-UI-037: All static labels render in Marathi (mr)
With locale set to `mr`, every label verified in VAL-UI-035 MUST render in Marathi. No English fallback text MUST appear for keys that have Marathi translations. Text MUST not be truncated or overlapping.
Evidence: Set locale to `mr` → screenshot and string assertions; visual check for truncation or overflow.

### VAL-UI-038: Language switch updates AI chat screen live
Changing the app language while the AI chat screen is mounted MUST immediately update all static labels without requiring navigation away and back. Already-rendered assistant and user messages MAY remain in their original language.
Evidence: Open chat → change language from `en` to `mr` → assert tab label, input placeholder, sidebar labels all updated without remount.

## Input Bar Behaviour

### VAL-UI-039: Keyboard handling — KeyboardAvoidingView pushes input up
When the software keyboard opens, the input bar MUST remain visible above the keyboard. The `KeyboardAvoidingView` MUST adjust layout so the input field and send/mic buttons are not obscured. The message list MUST remain scrollable.
Evidence: Focus input → keyboard opens → assert input bar visible above keyboard; scroll message list → assert scrollable.

### VAL-UI-040: Input cleared on successful send
After a message is successfully sent (user bubble appended), the `inputText` state MUST be reset to an empty string and the `TextInput` MUST display the placeholder text. Attachments MUST also be cleared.
Evidence: Send message → assert `inputText === ''`, placeholder visible, `attachments.length === 0`.

### VAL-UI-041: Input preserved on failed send
If sending fails (network error, gateway error), the original input text MUST be preserved in the `failedRequest` state for retry. The `TextInput` field itself is cleared (user message was appended), but the retry mechanism MUST use the preserved text.
Evidence: Type "Check soil pH" → simulate failure → assert `failedRequest.text === "Check soil pH"`; tap Retry → assert same text re-sent.

### VAL-UI-042: Multi-line input expands up to max height
The `TextInput` MUST support multi-line entry. As the user types more lines, the input area MUST grow vertically up to `maxHeight: 120`. Beyond that, the text MUST become internally scrollable. The input MUST never exceed the max height.
Evidence: Type 10+ lines → measure input height → assert ≤ 120; assert internal scroll works.

### VAL-UI-043: Message list auto-scrolls to bottom on new message
When a new user message is appended or an assistant response arrives, the message `ScrollView` MUST automatically scroll to the bottom so the latest message is visible. This MUST work for both text and voice message flows.
Evidence: Send message when scrolled up → assert scroll position moves to bottom; assistant responds → assert scroll at bottom.

### VAL-UI-044: Dismiss keyboard on scroll
The message list `ScrollView` MUST use `keyboardDismissMode="on-drag"` so that scrolling through messages dismisses the software keyboard, giving the user more screen space to read.
Evidence: Focus input (keyboard visible) → scroll message list → assert keyboard dismissed.
