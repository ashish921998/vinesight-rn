---
name: cleanup-worker
description: Removes legacy code and ensures clean codebase after AI assistant redesign
---

# Cleanup Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for features that involve:
- Removing legacy files (old AI chat screen, legacy services, stores, hooks)
- Updating imports and exports after file removal
- Cleaning up i18n dictionaries
- Removing dead navigation routes
- Ensuring no broken references after cleanup
- Final validation passes (typecheck, test, lint)

## Work Procedure

### 1. Understand What to Remove
- Read the feature description carefully — it lists specific files and references to remove
- Read `AGENTS.md` for off-limits areas
- Before removing anything, trace ALL imports and references to each target file
- Use grep extensively: `grep -rn "filename" src/ app/ __tests__/` to find all references

### 2. Map Dependencies
- For each file to remove, identify:
  - What imports it (direct and barrel exports)
  - What it imports (to check if those become unused)
  - What routes/navigation reference it
  - What tests test it
  - What i18n keys it uses exclusively
- Document this dependency map before making any changes

### 3. Remove Files and Update References
- Delete the target files
- Update barrel exports (e.g., `src/stores/index.ts`, `src/hooks/index.ts`)
- Update or remove imports in surviving files
- Update or remove navigation routes in `app/_layout.tsx`
- If navigation links pointed to removed screens, update to new routes or remove

### 4. Clean Up i18n
- Identify keys used ONLY by removed code (grep each key against surviving code)
- Remove orphaned keys from all 3 locale files (en, hi, mr)
- Verify new keys from the redesign exist in all 3 locales

### 5. Remove Legacy Tests
- Delete test files that ONLY test removed code
- Update test files that reference removed routes or modules

### 6. Verify — This is Critical
- Run `npm run typecheck` — must be 0 errors
- Run `npm test` — must match or exceed baseline (298 passing, 7 pre-existing failures)
- Run `npm run lint` — must be 0 errors
- Run `grep -rn "removed-module-name" src/ app/` for each removed module — must return 0 results
- If any verification fails, investigate and fix before committing

### 7. Commit
- Single commit with message: `chore: remove legacy AI assistant code`
- Ensure the commit ONLY contains removals and reference updates, no new functionality

## Example Handoff

```json
{
  "salientSummary": "Removed all legacy AI assistant code: ai-chat.tsx (152KB), farm-assistant-service.ts, voice-log-assistant.ts, ai-service.ts, farm-assistant-store.ts, use-farm-assistant.ts, voice-patterns.ts. Updated 8 import sites, removed 3 barrel exports, updated 2 navigation routes, deleted 3 test files, removed 47 orphaned i18n keys from all 3 locales. Typecheck, test (298 passing), and lint all clean.",
  "whatWasImplemented": "Removed 7 legacy files totaling ~275KB of code. Updated barrel exports in src/stores/index.ts (removed farm-assistant-store), src/hooks/index.ts (removed use-farm-assistant). Updated app/_layout.tsx (removed ai-chat Stack.Screen). Updated app/(tabs)/index.tsx (FloatingAssistantButton now navigates to new assistant). Updated app/farm/[id].tsx (AI link points to new route). Deleted 3 test files. Removed 47 orphaned i18n keys from en.ts, hi.ts, mr.ts. Verified assistant-gateway.ts no longer imports ai-service.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "npm run typecheck", "exitCode": 0, "observation": "0 errors" },
      { "command": "npm test", "exitCode": 0, "observation": "298 passing, 7 failing (pre-existing)" },
      { "command": "npm run lint", "exitCode": 0, "observation": "0 errors" },
      { "command": "grep -rn 'farm-assistant-service\\|voice-log-assistant\\|ai-service\\|farm-assistant-store\\|voice-patterns' src/ app/", "exitCode": 1, "observation": "No matches — all references cleaned" },
      { "command": "grep -rn 'ai-chat' app/", "exitCode": 1, "observation": "No navigation references to old ai-chat route" }
    ],
    "interactiveChecks": []
  },
  "tests": {
    "added": []
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Removing a file would break functionality that should still exist
- A surviving file has a hard dependency on removed code that can't be easily resolved
- Test count drops significantly after cleanup (more than the removed test files would explain)
- Discovered that some "legacy" code is actually still used by the new implementation
