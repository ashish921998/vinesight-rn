# Product Roadmap

This document is for a coding agent working on the next iteration of the app.

The product goal is to tighten the core loop:

`activate -> log -> notice problems -> act faster every day`

The app already has broad feature coverage. The next phase should improve focus, activation, and daily usefulness before adding more surface area.

## Product Thesis

- The app should feel like a daily operating system for a grower or farm manager.
- The first session should end with a real operational outcome, not just setup.
- The dashboard should be a triage surface, not a passive KPI screen.
- The farm detail screen should become the main operating center.
- The assistant should help complete operational jobs, not just answer open-ended questions.

## Principles

- Prefer workflow compression over feature expansion.
- Prefer exceptions and actions over raw counts.
- Prefer farm-scoped experiences over global generic screens.
- Prefer trustable assistant outputs over broad assistant behavior.
- Prefer offline-safe capture for field work.

## Phase 1: Activation And Daily Triage

Target window: 1 to 2 weeks

### Epic 1: Onboarding To First Real Value

Problem:
Users can complete onboarding after creating a farm, but the stronger activation event is completing the first real log, task, or note.

Goal:
End onboarding only after the user has created a farm and completed one meaningful operational action.

Scope:
- Update onboarding flow so success is:
  - first farm created
  - first log completed, first task created, or first note created/completed
- Route the user directly into the shortest action flow after farm creation, whether that is a log, task, or note
- Preserve guided tour support
- Track activation events in telemetry

Suggested implementation areas:
- [src/features/onboarding/onboarding-screen.tsx](../src/features/onboarding/onboarding-screen.tsx)
- first-farm slide components under [src/features/onboarding](../src/features/onboarding)
- guided tour logic under [src/features/guided-tour](../src/features/guided-tour)

Tasks:
1. Define activation completion state in onboarding store.
2. Add a post-farm action step that routes to `add-entry`, `add-note`, or `add-task`.
3. Mark onboarding complete only after action success.
4. Add telemetry for:
   - onboarding_farm_created
   - onboarding_first_action_started
   - onboarding_first_action_completed
   - onboarding_completed
5. Ensure returning users resume safely if onboarding is interrupted mid-flow.

Acceptance criteria:
- A new user cannot reach the normal home state without creating a farm.
- A new user is strongly guided to complete one real action after farm creation.
- Completing the first action marks activation complete.
- Interrupting or closing the app does not corrupt onboarding state.

### Epic 2: Dashboard As Triage Screen

Problem:
The current dashboard leans on generic counts. Counts are weak compared to actionable exceptions.

Goal:
The dashboard should answer: what needs my attention now, and what should I do next?

Scope:
- Replace or demote generic stat cards
- Add actionable sections driven by urgency
- Keep one-tap navigation into the correct farm or workflow

Suggested implementation areas:
- [app/(tabs)/index.tsx](../app/(tabs)/index.tsx)
- [src/hooks/use-dashboard-stats.ts](../src/hooks/use-dashboard-stats.ts)
- tasks, logs, weather, and farm hooks under [src/hooks](../src/hooks)

Tasks:
1. Add a `todayNeedsAttention` model for the dashboard.
2. Create sections for:
   - overdue tasks
   - farms with no recent logs
   - low water alerts
   - upcoming spray or PHI deadlines
3. Keep recent activity, but make it secondary.
4. Make every alert card open the exact farm or exact task flow.
5. Add empty states that push the user toward logging work, not browsing.

Acceptance criteria:
- The first visible content on the dashboard is action-oriented.
- Each dashboard module supports a direct next step.
- A user can go from home screen to the relevant farm or task in one tap.

### Epic 3: Assistant Narrowed To Operational Jobs

Problem:
A broad assistant is harder to trust and easier to underuse.

Goal:
The assistant should be optimized for a handful of repeat, high-value jobs.

Priority jobs:
- Log an activity from text or voice
- Tell me what I should do today on this farm
- Check spray safety against recent history
- Summarize the last 7 to 14 days for a farm

Suggested implementation areas:
- [src/components/assistant/ChatScreen.tsx](../src/components/assistant/ChatScreen.tsx)
- [src/hooks/use-assistant.ts](../src/hooks/use-assistant.ts)
- assistant services under [src/services](../src/services)

Tasks:
1. Replace generic suggestion chips with task-oriented prompts.
2. Default the assistant to current farm context when launched from a farm.
3. Add explicit UI affordances for the top jobs.
4. Improve assistant failure states to request missing inputs.
5. Add structured response blocks where helpful, for example:
   - next actions
   - risk summary
   - draft activity confirmation

Acceptance criteria:
- Assistant entry points promote operational tasks, not generic chat.
- Farm context is visible and applied wherever possible.
- Common assistant failures are actionable and specific.

## Phase 2: Farm As The Operating Center

Target window: weeks 3 to 6

### Epic 4: Farm Cockpit

Problem:
The app has many workflows, but the farm screen should become the most important daily screen.

Goal:
Each farm page should operate like a cockpit for that farm.

Scope:
- Unify weather, recent logs, next tasks, alerts, and quick actions
- Reduce the need to jump across unrelated tabs

Suggested implementation areas:
- farm routes under [app/farm](../app/farm)
- farm hooks such as [src/hooks/use-farms.ts](../src/hooks/use-farms.ts)
- related weather, tasks, logs, and worker hooks in [src/hooks](../src/hooks)

Tasks:
1. Redesign farm detail as a single high-signal summary surface.
2. Add sections for:
   - weather and near-term weather risk
   - recent logs
   - next tasks
   - water status
   - spray safety or lab reminders where relevant
3. Add persistent quick actions:
   - log activity
   - add note
   - add task
   - ask assistant about this farm
4. Ensure all actions preserve farm context.

Acceptance criteria:
- A farm manager can handle most daily decisions from the farm screen.
- The farm screen makes recent history and next actions obvious.
- Quick actions are always available.

### Epic 5: Better Operating Metrics

Problem:
Raw counts are easier to compute than useful metrics, but less helpful for daily decisions.

Goal:
Use derived metrics that reflect operational rhythm and gaps.

Scope:
- Add metrics used by home and farm surfaces
- Keep computation efficient and query-safe

Suggested metrics:
- days since irrigation
- days since spray
- overdue task count
- days since any farm log
- spend this week vs last week
- worker activity trend
- missing expected logs

Suggested implementation areas:
- [src/hooks/use-dashboard-stats.ts](../src/hooks/use-dashboard-stats.ts)
- reporting and analytics hooks under [src/hooks](../src/hooks)
- analytics services under [src/services](../src/services)

Tasks:
1. Add a derived dashboard model instead of only count-based aggregates.
2. Add per-farm operating summaries.
3. Cache expensive aggregations carefully.
4. Add tests for metric correctness.

Acceptance criteria:
- Dashboard and farm screens use derived metrics, not only raw counts.
- Metrics are stable, tested, and understandable.

### Epic 6: Assistant Trust Layer

Problem:
An assistant that is powerful but opaque is hard to trust in operational settings.

Goal:
Make assistant outputs feel grounded, scoped, and safe to act on.

Scope:
- show context
- show why the answer applies
- ask for missing information when needed

Tasks:
1. Surface active farm context clearly in assistant UI.
2. Add citations or source labels for weather, uploaded docs, and historical records where possible.
3. Prefer structured blocks for operational recommendations.
4. Add better retry and missing-input UX.

Acceptance criteria:
- Users can tell what farm and what evidence the assistant is using.
- The assistant asks clarifying questions when inputs are missing.

## Phase 3: Hard To Replace

Target window: weeks 7 to 12

### Epic 7: Offline-First Field Work

Problem:
This is a field app. Connectivity will be unreliable in the exact places the app matters.

Goal:
Users can safely capture work offline and trust that it will sync later.

Scope:
- offline creation of logs, notes, tasks, and worker updates
- clear sync status
- conflict-safe recovery

Suggested implementation areas:
- query cache and storage in [src/lib/query-cache.ts](../src/lib/query-cache.ts)
- local stores under [src/stores](../src/stores)
- relevant hooks and submit utilities under [src/hooks](../src/hooks) and [src/utils](../src/utils)

Tasks:
1. Define which mutations support offline queueing first.
2. Add local persistence for pending creates.
3. Show sync state on affected records.
4. Add retry and conflict resolution UX.
5. Add tests for interrupted sync scenarios.

Acceptance criteria:
- A user can create critical records while offline.
- The app clearly shows pending and synced state.
- Failed syncs are visible and recoverable.

### Epic 8: Predictive Operations

Problem:
The app mostly reports what happened. The stronger product predicts what is likely to become a problem.

Goal:
Move from passive records to proactive operating guidance.

Examples:
- this farm has had no recent activity
- irrigation rhythm is drifting
- weather makes a planned action risky
- labor spending is unusually high this week

Tasks:
1. Define a rules-based alert layer before attempting anything more complex.
2. Add predictive warnings to home and farm surfaces.
3. Allow users to dismiss or snooze recommendations.
4. Measure whether predictive alerts lead to action.

Acceptance criteria:
- Alerts are specific, explainable, and actionable.
- Users can act or dismiss without confusion.

### Epic 9: Assistant Embedded In Workflows

Problem:
A separate assistant tab is weaker than an assistant woven into core workflows.

Goal:
Use the assistant inside farm, logging, spray safety, task, and report flows.

Tasks:
1. Add contextual assistant entry points in farm and log screens.
2. Preload task-specific prompts.
3. Preserve workflow context automatically.
4. Keep the separate assistant screen, but treat it as secondary.

Acceptance criteria:
- Users can invoke assistant help from the place where the work is happening.
- Assistant entry points inherit context without extra setup.

## Navigation And IA Cleanup

This should happen incrementally across phases.

Goals:
- Reduce top-level complexity
- Move generic tools into contextual locations
- Make farm and dashboard the primary destinations

Potential direction:
- Keep: Dashboard, Farms, Workers, Assistant
- Rework or demote: Tools
- Preserve settings as non-tab destination

Do not ship a large information architecture rewrite all at once unless usability evidence forces it.

## Instrumentation

Track these product metrics:

- percent of new users who create first farm
- percent of new users who complete first action in first session
- time from first launch to first completed action
- weekly active users
- logs per active farm per week
- percent of assistant sessions that produce an action
- percent of farms with overdue tasks
- percent of farms with no log in last N days
- percent of offline-created records that sync successfully

## Suggested Delivery Order

If the coding agent is executing this roadmap, work in this order:

1. Onboarding to first completed action
2. Dashboard triage model and UI
3. Assistant task narrowing and better prompts
4. Farm cockpit
5. Derived operating metrics
6. Assistant trust layer
7. Offline-first record creation
8. Predictive operations
9. Embedded assistant entry points

## Engineering Expectations

For each epic:

1. Write or update types first.
2. Add or update hooks/services next.
3. Update UI last.
4. Add tests for state transitions, metrics, and critical flows.
5. Keep telemetry changes aligned with product milestones.

## Non-Goals Right Now

Do not prioritize these ahead of the roadmap above:

- large visual redesign with no workflow gain
- broad new calculator surfaces
- more tabs
- more generic AI capabilities
- speculative backend rewrites without product lift

## Definition Of Done

An epic is done when:

- the workflow ships end to end
- telemetry exists for the new behavior
- empty and failure states are handled
- tests cover critical logic
- the change reduces time to action or improves daily usefulness
