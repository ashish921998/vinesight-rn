# ADR 0001: No data-access / repository seam over Supabase

- Status: Accepted
- Date: 2026-07-17

## Context

The app calls the Supabase client (`src/lib/supabase.ts`) directly from ~36 modules:
React Query hooks (`src/hooks/use-*.ts`), plain service functions
(`src/services/*.ts`), and some features/components. Calls span `.from(table)`
CRUD, `.rpc(name)`, `.auth`, `.functions.invoke`, and `.storage`.

An architecture review proposed introducing a data-access seam — one repository
interface per domain aggregate (Farms, Records, Workers, ...) with a Supabase
adapter in production and an in-memory/fake adapter in tests — to remove the need
for every consumer to mock `supabase` individually.

We evaluated the concrete value of that seam in this codebase:

- **Performance:** no change. Same queries and round-trips, plus one indirection layer.
- **Backend flexibility:** no value. Single Supabase backend, no swap planned.
- **DRY:** negligible. The real duplication lives in domain logic
  (`submitEntryPendingLog` vs `buildDelegatedLogPayload`; `filterByDateRange` /
  `filterByDate` / `inRange`; repeated area-to-acres conversion), not in the
  data-access calls. A repository only dedupes where a table name is typed.
- **Testability:** the only real benefit — and even then, code where DB calls sit
  next to pure decision logic can be tested by extracting the pure function
  instead of introducing a seam. A repository seam only earns its keep where I/O
  and branching are genuinely interleaved and cannot be pulled apart.

## Decision

We will **not** introduce a repository / data-access seam over Supabase as a
general pattern. Consumers may continue to call the Supabase client directly.

For testability we prefer:

1. **Extracting pure functions** from hooks/services and testing those directly.
2. Removing **domain-logic duplication** at its source (see the reporting and
   log-write mapper work) rather than behind a data-access abstraction.

A narrow, local seam may still be introduced case-by-case if, and only if, a
specific piece of I/O-interleaved logic cannot be tested any other way. That is a
local exception, not a return to the app-wide repository pattern.

## Consequences

- No app-wide repository layer; the Supabase client stays the data-access surface.
- Tests that touch data access mock `supabase` (or the specific call) per module.
- Future architecture reviews should not re-propose an app-wide repository seam;
  reference this ADR.
- Duplication and testability are addressed through pure-function extraction and
  targeted de-duplication of domain logic instead.
