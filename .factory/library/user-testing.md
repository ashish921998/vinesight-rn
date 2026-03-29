# User Testing

## Validation Surface

This is a React Native/Expo mobile app. It cannot be tested visually in this environment (no device/emulator/simulator available).

### Available Surfaces
1. **CLI tools** — typecheck (`npm run typecheck`), lint (`npm run lint`), test (`npm test`), web smoke build (`npm run web:smoke`)
2. **Code review** — reading source files to verify design token usage, layout structure, and component styling matches wireframe specs

### Unavailable Surfaces
- No iOS Simulator or Android Emulator
- No browser-testable web version (Expo web exists but is not the primary target)
- No visual screenshot comparison possible

## Validation Concurrency

### CLI Surface
- Max concurrent: 5
- Rationale: CLI commands are lightweight (typecheck, lint, test). Machine has 16GB RAM, 10 cores. Each command uses ~200-500MB peak. Well within budget.

### Code Review Surface
- Max concurrent: 5
- Rationale: Code review only reads files, no resource-intensive processes.

## Wireframe Reference
All wireframes at: `~/.gstack/projects/ashish921998-vinesight-rn/designs/dashboard-20260329/`
- 27 wireframe HTML files (wireframe-*.html)
- Design tokens extracted in `.factory/library/architecture.md`

## Flow Validator Guidance: code-review

- Isolation boundary: read-only validation against the current working tree; do not modify application source files during flow validation.
- Use `Read`, `Grep`, and related repo inspection tools to verify exact token names, hex values, border usage, radius values, and dark-mode mappings.
- Record evidence with concrete file paths and line references when possible.
- Limit scope to the assigned assertions and their direct evidence files; theme-foundation assertions are expected to resolve primarily in `src/styles/theme.ts` and shared theme consumers.
- Write only the assigned flow report under `.factory/validation/<milestone>/user-testing/flows/` and evidence notes under the provided mission evidence directory.
