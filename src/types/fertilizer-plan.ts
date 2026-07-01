/**
 * Shapes for consultant fertilizer plans. Mirrors the shared Supabase schema
 * (`fertilizer_plans` → many `fertilizer_plan_items`), which is owned by the web
 * app. Plans are scoped to a farm + organization; there is no season link, so a
 * farm's "history" is simply its plans ordered newest-first by `created_at`.
 *
 * These types describe rows as loaded from the DB — every plan and item is a
 * persisted row, so `id` is always present. Nullable columns are `T | null`
 * (present but possibly null), never optional.
 */
export interface FertilizerPlanItem {
  /** Row id (uuid). */
  id: string;
  /** Maps from the DB column `fertilizer_name`. Kept as `name` for the entry-form quick-add consumers. */
  name: string;
  quantity: number | null;
  unit: string | null;
  application_date: string | null;
  application_method: string | null;
  application_frequency: number | null;
  notes: string | null;
  sort_order: number | null;
}

export interface FertilizerPlan {
  /** Plan id (uuid). */
  id: string;
  farm_id: number;
  organization_id: string | null;
  /** Authoring user id. Not selected/loaded today (always null), kept for schema parity. */
  created_by: string | null;
  /** Plan title (DB column, NOT NULL in schema). */
  title: string | null;
  /** Name of the sending organization (resolved from `organization_id` → organizations). */
  consultant_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  notes: string | null;
  items: FertilizerPlanItem[];
}
