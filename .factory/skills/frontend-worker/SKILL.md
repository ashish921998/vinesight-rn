---
name: frontend-worker
description: Implements and tests React Native UI components and hooks for the AI assistant
---

# Frontend Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for features that involve:
- React Native components in `src/components/assistant/`
- Expo Router screens and tab navigation in `app/`
- Custom hooks in `src/hooks/`
- Client-side services (assistant-gateway client, voice-output, etc.)
- Zustand store changes
- i18n string additions
- UI/UX for the AI chat screen, voice mode, conversation sidebar

## Work Procedure

### 1. Understand the Feature
- Read the feature description, preconditions, expectedBehavior, and verificationSteps
- Read `AGENTS.md` for conventions (M3 theming, i18n, file size limits)
- Read `.factory/library/architecture.md` for target component structure
- Check existing components for patterns to follow (look at `src/components/` for style conventions)

### 2. Explore Existing Code
- Check the current tab layout: `app/(tabs)/_layout.tsx`
- Check existing UI components for theming patterns: `useThemeTokens()`, `useM3()`
- Check i18n setup: `src/i18n/locales/en.ts`, `hi.ts`, `mr.ts`
- Check existing assistant services: `src/services/assistant-gateway.ts`, `assistant-memory.ts`
- Look at how other screens handle loading, error, empty states

### 3. Write Tests First (TDD)
- Create test files in `__tests__/` for new components and hooks
- Write failing tests covering: rendering, user interactions, state changes, error handling
- Use `@testing-library/react-native` for component tests
- Mock Supabase, navigation, and external services

### 4. Implement
- Create components in `src/components/assistant/` following target structure
- Each component file must be < 500 lines
- Use `useThemeTokens()` for ALL colors — never hardcode
- Add i18n keys to ALL 3 locale files (en, hi, mr)
- Use `react-native-reanimated` for animations (voice orb)
- Use `expo-haptics` for haptic feedback
- Follow the single-responsibility principle — one component, one job
- For the voice mode: use `expo-audio` for recording, NOT expo-speech-recognition for STT

### 5. Verify
- Run tests: `npm test -- --grep '<relevant pattern>'`
- Run typecheck: `npm run typecheck`
- Run lint: `npm run lint`
- Review for: theme correctness (no hardcoded colors), i18n completeness, accessibility labels

### 6. Commit
- Stage and commit with conventional commit: `feat: <description>`
- Ensure all 3 locale files are updated if new i18n keys were added

## Example Handoff

```json
{
  "salientSummary": "Built the AI chat InputBar component with text input, send button, voice mode toggle, and attachment picker. Supports theme switching, keyboard avoidance, and i18n in all 3 locales. 8 tests passing covering send, voice toggle, attachment, empty state, loading state, and keyboard behavior.",
  "whatWasImplemented": "Created src/components/assistant/InputBar.tsx (280 lines). Features: multi-line TextInput with maxHeight 120, send button (visible when text entered), mic button (visible when empty), attachment picker button, loading state (send disabled), keyboard avoidance. All text uses i18n keys. Colors from useThemeTokens(). Haptic feedback on send. Added i18n keys to en.ts, hi.ts, mr.ts for placeholder, send button a11y label, and voice mode a11y label.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "npm test -- --grep 'InputBar'", "exitCode": 0, "observation": "8 tests passing" },
      { "command": "npm run typecheck", "exitCode": 0, "observation": "No errors" },
      { "command": "npm run lint", "exitCode": 0, "observation": "No errors" }
    ],
    "interactiveChecks": []
  },
  "tests": {
    "added": [
      {
        "file": "__tests__/input-bar.test.tsx",
        "cases": [
          { "name": "renders mic button when input is empty", "verifies": "Voice toggle visible when no text" },
          { "name": "shows send button when text is entered", "verifies": "Send button replaces mic when text present" },
          { "name": "calls onSend with text and clears input", "verifies": "Send callback fires, input cleared" },
          { "name": "disables send during loading", "verifies": "Send button not rendered when isLoading" },
          { "name": "opens attachment picker on button press", "verifies": "Attachment flow triggers" },
          { "name": "renders in dark theme", "verifies": "Dark theme colors applied correctly" },
          { "name": "renders in light theme", "verifies": "Light theme colors applied correctly" },
          { "name": "shows Hindi placeholder in hi locale", "verifies": "i18n placeholder text in Hindi" }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Feature requires backend API changes not yet implemented
- Existing navigation structure prevents the planned UI layout
- Theme system limitations prevent the desired visual design
- i18n key structure needs reorganization affecting other features
- Feature requires installing new npm packages not already in package.json
- Cannot test a component because required mocks are too complex to set up
