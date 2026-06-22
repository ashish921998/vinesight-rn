# Consultant mobile — fertilizer plans & lab reports (plan)

Bringing the web consultant workflow (petiole review → fertilizer plan, lab comparison)
to the RN app. See `CONTEXT.md` → **Language › Consultant workflow** for the terms used here.

## Locked decisions

1. **Triage-anchored.** A fertilizer plan is always the response to a pending **petiole
   review**. No free-form "author a plan for a farm anytime" path. Reuses the web RPC as-is.
2. **Farm screen IA** = single scroll + drill-in. The farm screen stays log-focused
   (condensed status chips, a pending-reviews CTA, a Lab-reports entry, then the logs feed).
   Heavy work happens on a dedicated **Review & Plan** screen.
3. **Ranges** = port web's `farm-config.ts` for the consultant view. Web and RN currently
   use **different** petiole ranges and key spellings; the consultant mobile view must match
   the web consultant product, not RN's farmer-side ranges.
4. **Soil** = petiole gets a full comparison grid; soil shows as a latest-report baseline panel.

## The existing server API (web-owned — RN only calls it)

Schema + RPCs live in `vinesight-web/supabase/migrations`. **No RN migration needed.**

**Reads (RLS — a logged-in org member can `select` directly for their clients' farms):**
- `soil_test_records`, `petiole_test_records` — policies "Org members can view client soil/petiole tests" (`202606040002`).
- `petiole_triage` — policies "Org members can view/insert/update client triage" (`202606040003`).
- `farms` — policy "Org members can view client farms".

**RPCs:**
- `send_fertilizer_plan(p_review_id uuid, p_title text, p_notes text, p_items jsonb) → uuid`
  Creates the plan + items against a petiole review and flips the review to `reviewed`.
  Guards: authed; review exists; caller authorized; review not already completed; review has no plan yet.
- `update_fertilizer_plan(p_plan_id uuid, p_title text, p_notes text, p_items jsonb) → uuid`
- `get_farmer_recommendations(p_farm_id bigint default null) → table(...)`
  Farmer-callable; returns reviews with the structured `fertilizer_plan` jsonb embedded (`202606200001`).
- Item validation (server-side, mirror client-side): name required, quantity > 0, frequency a whole number ≥ 1.

**Plan item shape (jsonb):**
`{ fertilizer_name, quantity, unit, application_method?, application_frequency?, notes?, application_date?, sort_order? }`
Units: `['kg/acre','g/acre','L/acre','ml/acre','ppm']`.

**Petiole triage row:** `id, organization_id, farm_id, petiole_test_id, client_user_id,
status('pending'|'in_review'|'reviewed'|'escalated'|'resolved'), severity, classification,
summary, recommendation, review_notes, reviewed_by, reviewed_at, created_at, updated_at`.
Auto-created by a trigger when a farmer inserts a petiole test — one row per managing org.

**Config to port from `vinesight-web/.../components/farm-config.ts`:**
`PETIOLE_RANGES`, `PETIOLE_PARAM_GROUPS`, `PLAN_ITEM_UNIT_OPTIONS`, `NUTRIENT_RECOMMENDATIONS`.

---

## Slice A — condense status (DONE)

`app/professional/farm/[farmId].tsx`: the two `StatsCard` tiles → a slim chip row
(`Safe to harvest <date>`, `<n> kg harvested`). Logs are now the focus.

## Slice B — farmer reads real plans

**Goal:** the farmer-side Fertilizer Plans screen shows the consultant's actual sent plan(s),
not the mock.

- **Start by reading** `get_farmer_recommendations` fully (`vinesight-web` migration
  `202606200001` + `202606160001`) to map its exact return columns.
- Replace `src/services/fertilizer-plan.ts` `fetchFertilizerPlanForFarm` (mock) with a real
  `supabase.rpc('get_farmer_recommendations', { p_farm_id })` call.
- Realign `src/types/fertilizer-plan.ts` to the real shape: a plan has `title`, `notes`
  (message to farmer), a sent date, the org/consultant attribution, and **normalized items**
  (`fertilizer_name`, `quantity`, `unit`, `application_method`, `application_frequency`).
- Fix `app/fertilizer-plans.tsx`: drop the **fake "Week N"** label (items aren't weekly — render
  product · qty/unit · method · frequency). A farm can have a **history** of plans (one per
  review) → show the latest prominently + older ones collapsed.
- Gate is already correct (`profile.consultant_organization_id`).
- **Independent of C/D — ship first for immediate farmer value.**

## Slice C — consultant lab comparison (read-only)

**Goal:** from the consultant farm screen, open a petiole comparison grid + soil baseline.

- Port `farm-config.ts` (ranges, groups, unit options, nutrient recommendations) into
  `src/constants/` (consultant-scoped — keep separate from RN's farmer-side `lab-test-parameters.ts`).
- Consultant fetch hooks: the existing `useSoilTests(farmId)` / `usePetioleTests(farmId)` use a
  direct `select` that RLS already permits for org members. Confirm they work unchanged when the
  caller is the consultant (they should). **Watch parameter-key spelling** — the comparison must
  read the keys as stored (web spellings: `ammonical_nitrogen`, `sulphur`) and color against the
  ported `PETIOLE_RANGES`.
- New component `PetioleComparison` (RN) — nutrients as rows grouped by `PETIOLE_PARAM_GROUPS`,
  report dates as columns, RAG cells vs ranges. Mirror web `PetioleComparison.tsx`. Mobile: lead
  with the latest report, horizontal-scroll older columns.
- New `SoilBaselinePanel` — latest soil report, read-only.
- Add a **"Lab reports"** entry row on the farm screen → opens these read-only.
- **Feeds D** (D reuses the comparison component).

## Slice D — review queue + plan authoring

**Goal:** the consultant clears a pending petiole review by authoring & sending a plan.

- **Pending-reviews section** on the farm screen: `select` from `petiole_triage` where
  `organization_id = workspace.org`, `farm_id = farm`, `status in ('pending','in_review')`.
  Render as a CTA card (severity, summary, date).
- **Review & Plan screen** (`app/professional/farm/[farmId]/review/[reviewId].tsx` or similar):
  - Top: the `PetioleComparison` (current review's test highlighted) + `SoilBaselinePanel` (from C).
  - `PlanEditorPanel`: editable item rows (product, quantity, unit, method, frequency) + a
    "message to farmer" field. Quick-fill chips from `NUTRIENT_RECOMMENDATIONS` when a flagged
    nutrient is tapped (seed a row; consultant edits). Client-side item validation mirrors the RPC.
  - `PreviousPlanPanel`: prior plan for reference (collapsible).
  - Send → `send_fertilizer_plan(reviewId, title, notes, items)`; edit existing →
    `update_fertilizer_plan(planId, …)`. Handle both states (pending → author+send; reviewed → view/edit).
- Invalidate the farmer-recommendations + workspace/activity query keys on success.
- **Depends on C.**

---

## Risks / open questions

- **`get_farmer_recommendations` return shape** — must be read in full before B (drives the type).
- **Parameter-key normalization** — petiole `parameters` JSONB keys are written by whichever app
  recorded the test; the consultant comparison must align keys with web's `PETIOLE_RANGES`. Verify
  against real rows before trusting the RAG colors.
- **Plan history** — one plan per review ⇒ multiple plans per farm over a season. Both farmer (B)
  and consultant (D) UIs must handle a list, not a single plan.
- **Petiole tests are farmer-entered** — reviews only exist once farmers log petiole tests. There is
  no consultant petiole-entry path (consistent with web). Seed test data accordingly when dogfooding.
- **Web↔RN farmer-side range divergence** is pre-existing and out of scope here; flag separately.
- **Cross-repo coupling** — any change to the plan/review schema or RPC signatures happens in
  `vinesight-web`. RN is a pure client of that contract.

## Sequencing

`A (done) → B (farmer value, independent) → C (lab comparison) → D (authoring, needs C)`.
Each is independently shippable as its own reviewed PR.
