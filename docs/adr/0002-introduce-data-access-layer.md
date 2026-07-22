# ADR 0002: Introduce a Data Access Layer

- Status: Accepted
- Date: 2026-07-21
- Supersedes: [ADR 0001](./0001-no-data-access-repository-seam.md)

## Context

The app imports the Supabase client (`src/lib/supabase.ts`) directly from ~38
production modules: React Query hooks (`src/hooks/use-*.ts`), services
(`src/services/*.ts`), features, components, auth stores, and lib/util modules.

This has resulted in several architectural problems:

- Every test mocks Supabase differently (21 test files `jest.mock` Supabase).
- Query logic is duplicated across modules.
- Business logic depends directly on persistence.
- Storage cannot be replaced or faked.
- Future offline implementations become more difficult.

ADR 0001 previously decided against an app-wide data-access seam. This ADR
supersedes that decision.

## Decision

Introduce a **Data Access Layer** using a Ports and Adapters architecture.

Application code depends on a narrow `DataAccess` interface instead of the
Supabase SDK.

- Production provides a `SupabaseDataAccess` implementation.
- Tests provide an `InMemoryDataAccess` implementation.
- Future adapters (offline, mock, local database) can implement the same
  interface.

```
Hooks / Services
        │
        ▼
 DataAccess Interface
        │
 ┌──────┴──────────┐
 ▼                 ▼
SupabaseAdapter  InMemoryAdapter
```

## Rationale

This creates a single persistence boundary for the application:

- One persistence interface, one place to mock.
- Centralized query logic; reduced coupling.
- Enables offline implementations without changing feature code.

## Alternatives Considered

- **Continue using Supabase directly** — no testing seam, tight coupling,
  query duplication. Rejected.
- **Repository per feature** (`FarmRepository`, `WorkerRepository`, ...) —
  many interfaces, higher boilerplate, premature abstraction. Rejected in
  favor of a single interface that can later evolve into repositories.
- **Generic `Repository<T>`** — leaks database semantics, weak domain
  boundaries, hard to express complex queries. Rejected.

## Migration Plan

1. Create `src/data-access/` containing `DataAccess.ts`,
   `SupabaseDataAccess.ts`, `InMemoryDataAccess.ts`.
2. Move queries into the adapter; replace
   `import { supabase } from "@/lib/supabase"` with `getDataAccess()`.
3. Convert hooks incrementally (`use-farms`, `use-records`,
   `use-dashboard-stats`, `use-reports`, ...).
4. Delete direct Supabase imports outside the adapter.

### Injection mechanism

The adapter is injected via a module-level singleton (`getDataAccess()` /
`setDataAccess()`), not React context. This is deliberate: many call sites
are non-React modules (services, stores, lib utilities) that cannot use
hooks. Tests swap the adapter with `setDataAccess()` and restore it in
teardown via the returned function. A React context provider was considered
but rejected because it would create a disconnect between React and non-React
consumers — all consumers must share the same adapter instance.

## Success Criteria

- No feature imports `@/lib/supabase`.
- Tests mock `DataAccess` instead of Supabase.
- Query logic exists only inside adapters.
- Offline implementation becomes possible without changing feature code.

## Consequences

- Positive: simpler testing, replaceable persistence, foundation for future
  architecture work (report service decomposition, unified log mapping, pure
  dashboard logic, auth consolidation).
- Negative: ~38 call sites to touch, initial migration effort, slight
  increase in abstraction.
