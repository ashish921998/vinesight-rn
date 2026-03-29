---
name: ui-worker
description: Implements Cellar Ledger visual redesign for VineSight screens
---

# UI Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Any feature that involves updating VineSight screen files, shared components, or theme tokens to match the Cellar Ledger wireframe designs.

## Required Skills

None.

## Work Procedure

### Step 1: Understand the Assignment
1. Read the feature description carefully. Note which screen(s)/file(s) to update.
2. Read `AGENTS.md` for mission boundaries and coding conventions.
3. Read `.factory/library/architecture.md` for the complete Cellar Ledger token map.

### Step 2: Study the Wireframe
1. Read BOTH the light AND dark wireframe HTML files for the assigned screen at `~/.gstack/projects/ashish921998-vinesight-rn/designs/dashboard-20260329/`:
   - Light: `wireframe-{name}.html`
   - Dark: `wireframe-{name}-dark.html`
2. Extract: layout structure, section ordering, component patterns, specific colors (both light and dark), spacing, border radius values, typography sizes.
3. Note any design elements that differ from the current implementation. Ensure colors are applied through theme tokens (not hardcoded) so both light and dark modes render correctly.

### Step 3: Read Current Code
1. Read the current screen file(s) to understand the existing structure.
2. Identify which theme tokens and components are currently used.
3. Note data fetching hooks, i18n keys, accessibility props, and navigation patterns that must be preserved.

### Step 4: Implement Changes
1. **For theme features**: Update `src/styles/theme.ts` with new token values. Ensure both light and dark mode tokens are updated. Update `commonStyles` to match new patterns (borders not shadows).
2. **For screen features**: Update the screen file to match the wireframe layout. Use the Cellar Ledger tokens from the theme. Key changes typically include:
   - Replace background colors with warm neutrals (mist-0 for bg, mist-1 for cards)
   - Replace shadows with 1px borders (borderWidth: 1, borderColor matching stone-3 token)
   - Update section headers to uppercase 11px/600 style
   - Add category-colored left strips where wireframe shows them
   - Update icon container sizes and shapes to match wireframe
   - Update typography sizes and weights to match wireframe
3. **For shared component features**: Update components in `src/components/` to match new patterns across all usage.
4. **CRITICAL**: Do NOT modify data fetching, navigation, i18n keys, or business logic. Visual changes only.

### Step 5: Verify
1. Run `npm run typecheck` — must exit 0. Fix any type errors.
2. Run `npm run lint` — fix auto-fixable issues with `npm run lint -- --fix`, then verify exit 0.
3. Run `npm test -- --passWithNoTests` — must exit 0.
4. Spot-check the changed file(s) to verify:
   - No old M3 color values remain (e.g., #408059, #f2f2f7, #ffffff as card bg)
   - Borders are used instead of shadows on cards
   - All accessibility props preserved
   - All i18n t() calls preserved

### Step 6: Commit
1. Stage all changed files.
2. Commit with a descriptive message (e.g., "Redesign dashboard to Cellar Ledger design").

## Example Handoff

```json
{
  "salientSummary": "Redesigned the dashboard screen (app/(tabs)/index.tsx) to match wireframe-D.html. Updated hero block to primary green with rounded bottom corners and alert badge. Replaced stats grid with 2x2 metric tiles using tinted icon circles. Added amber left strips to attention cards. Updated quick actions to 44x44 tinted icons in bordered card. Ran typecheck (0 errors), lint (0 errors), test (0 failures).",
  "whatWasImplemented": "Dashboard hero section with primary bg and Today/alert badge. 2x2 metric grid with 36x36 tinted icon circles and uppercase labels. Attention cards with 3px amber left strip, icon wrap, farm name, reason, chevron. Quick actions row with 44x44 category-tinted icons inside bordered card. Recent activity list with colored dots. All using Cellar Ledger tokens from theme.ts.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "npm run typecheck", "exitCode": 0, "observation": "No type errors" },
      { "command": "npm run lint", "exitCode": 0, "observation": "No lint errors" },
      { "command": "npm test -- --passWithNoTests", "exitCode": 0, "observation": "All tests pass" }
    ],
    "interactiveChecks": [
      { "action": "Reviewed app/(tabs)/index.tsx hero section", "observed": "backgroundColor uses primary token (#355847), borderBottomLeftRadius: 24, borderBottomRightRadius: 24, Today label and alert badge present" },
      { "action": "Reviewed metric grid section", "observed": "2-column layout with flexDirection row + flexWrap, icon circles 36x36 borderRadius 10 with colorWithOpacity tints, values fontSize 24 fontWeight 700, labels uppercase" },
      { "action": "Reviewed attention cards", "observed": "3px left strip View with warning color, 36x36 icon wrap, farm name bold, reason muted, chevron right" },
      { "action": "Checked for old color values", "observed": "No references to #408059, #f2f2f7, or old M3 surface values. All use new theme tokens." }
    ]
  },
  "tests": {
    "added": []
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Theme token changes break many screens and typecheck has more than 20 errors to fix across multiple files
- A wireframe references a component or pattern that doesn't exist in the codebase
- A screen file is extremely large (>2000 lines) and the redesign requires restructuring beyond visual changes
- Existing tests fail due to component structure changes (not just styling)
