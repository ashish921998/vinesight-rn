---
name: backend-worker
description: Implements and tests Supabase Edge Function modules for the AI assistant backend
---

# Backend Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for features that involve:
- Supabase Edge Function code in `supabase/functions/ai-gateway/`
- STT/TTS provider integration (Sarvam, OpenAI)
- LLM integration (OpenAI GPT-4o-mini)
- Context assembly (farm data queries, memory search, RAG search)
- Intent routing and activity logging extraction
- Safety checking and cost tracking
- Backend API response format changes

## Work Procedure

### 1. Understand the Feature
- Read the feature description, preconditions, expectedBehavior, and verificationSteps carefully
- Read `AGENTS.md` for mission boundaries and conventions
- Read `.factory/library/environment.md` for Sarvam/OpenAI API details
- Read `.factory/library/architecture.md` for the target module structure

### 2. Explore Existing Code
- Read the current `supabase/functions/ai-gateway/index.ts` to understand the existing implementation
- Identify which parts to extract, refactor, or rewrite based on the feature scope
- Check for existing patterns (circuit breaker, error handling, cost tracking)

### 3. Write Tests First (TDD)
- Create test files in `__tests__/` for new modules
- Write failing tests covering the expected behavior from the feature description
- Tests should cover: happy path, error cases, edge cases, fallback behavior
- For Supabase Edge Function code, write unit tests that mock external API calls (Sarvam, OpenAI, Supabase DB)

### 4. Implement
- Create new modules in the target directory structure (see architecture.md)
- Each module file must be < 500 lines
- Export clean interfaces between modules
- Follow existing patterns: circuit breaker for external calls, cost tracking, telemetry
- For Sarvam API calls: use `api-subscription-key` header, base URL `https://api.sarvam.ai`
- For STT: use Saaras v3 model, support auto language detection (language_code: "unknown")
- For TTS: use Bulbul v3 model, locale-specific speakers, max 2500 chars
- Handle errors gracefully with proper HTTP status codes

### 5. Verify
- Run tests: `npm test -- --grep '<relevant pattern>'`
- Run typecheck: `npm run typecheck`
- Run lint: `npm run lint`
- Manually review the module for: proper error handling, no exposed secrets, correct API usage

### 6. Commit
- Stage and commit with conventional commit message: `feat: <description>` or `refactor: <description>`
- Ensure no secrets or API keys in committed code

## Example Handoff

```json
{
  "salientSummary": "Extracted STT provider module from monolithic ai-gateway into supabase/functions/ai-gateway/providers/stt.ts. Upgraded from Saarika v2.5 to Saaras v3 with auto language detection. Added circuit breaker and OpenAI Whisper fallback. 6 unit tests passing covering primary STT, fallback, circuit breaker, audio validation, and unsupported format handling.",
  "whatWasImplemented": "Created providers/stt.ts (180 lines) with transcribeAudio() function supporting Sarvam Saaras v3 primary and OpenAI Whisper fallback. Supports auto language detection via language_code='unknown'. Circuit breaker opens after 5 failures with 60s reset. Audio format validation rejects payloads below minimum size. Unsupported container formats (mp4/m4a/caf) bypass Sarvam and go directly to OpenAI.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "npm test -- --grep 'stt provider'", "exitCode": 0, "observation": "6 tests passing: primary Sarvam transcription, auto language detection, fallback to Whisper, circuit breaker after 5 failures, minimum audio size rejection, unsupported format bypass" },
      { "command": "npm run typecheck", "exitCode": 0, "observation": "No errors" },
      { "command": "npm run lint", "exitCode": 0, "observation": "No errors" }
    ],
    "interactiveChecks": []
  },
  "tests": {
    "added": [
      {
        "file": "__tests__/stt-provider.test.ts",
        "cases": [
          { "name": "transcribes audio via Sarvam Saaras v3", "verifies": "Primary STT provider calls Sarvam with correct model and returns transcript" },
          { "name": "auto-detects language for code-mixed speech", "verifies": "language_code=unknown passed to Sarvam, transcript returned regardless of language" },
          { "name": "falls back to OpenAI Whisper on Sarvam failure", "verifies": "When Sarvam throws, fallback to Whisper produces valid transcript" },
          { "name": "circuit breaker opens after 5 Sarvam failures", "verifies": "After 5 failures, requests skip Sarvam and go directly to OpenAI" },
          { "name": "rejects audio below minimum size", "verifies": "Audio < 700 bytes estimated throws INVALID_AUDIO error" },
          { "name": "bypasses Sarvam for unsupported formats", "verifies": "mp4/m4a/caf formats go directly to OpenAI without Sarvam attempt" }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Feature requires changes to database schema (new tables, columns, migrations)
- Feature depends on client-side changes not yet implemented
- Sarvam or OpenAI API behavior differs from documented expectations
- Cannot maintain backward compatibility with existing conversation data
- Feature scope is unclear or contradictory
