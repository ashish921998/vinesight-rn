# Fertilizer Plan Data Model Notes

- Source types live in `src/types/fertilizer-plan.ts`.
- `FertilizerPlan` currently exposes `farm_id`, `consultant_name`, `updated_at`, `notes`, and `items`.
- `FertilizerPlanItem` currently exposes `name`, `quantity`, and `unit`.
- The current fertilizer-plan model does **not** expose:
  - item status such as completed / upcoming / overdue
  - category or strip-color metadata
  - schedule dates or progress fields
- When a wireframe asks for fertilizer-plan status badges or color-coded schedule states, preserve truthful data and document the gap instead of fabricating placeholder status from array order or other UI-only heuristics.
