import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { FertilizerPlan, FertilizerPlanItem } from '@/types/fertilizer-plan';

// Row shapes as returned by the embedded select below. Kept narrow on purpose —
// only the columns this screen consumes are selected.
interface PlanItemRow {
  id: string;
  fertilizer_name: string;
  quantity: number | null;
  unit: string | null;
  application_date: string | null;
  application_method: string | null;
  application_frequency: number | null;
  notes: string | null;
  sort_order: number | null;
}

interface PlanRow {
  id: string;
  farm_id: number;
  organization_id: string | null;
  title: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  // PostgREST embeds the sending organization as an object (or null when RLS
  // hides it). The consultant label is the sending organization's name.
  organization: { name: string | null } | null;
  fertilizer_plan_items: PlanItemRow[] | null;
}

function mapItem(row: PlanItemRow): FertilizerPlanItem {
  return {
    id: row.id,
    name: row.fertilizer_name,
    quantity: row.quantity,
    unit: row.unit,
    application_date: row.application_date,
    application_method: row.application_method,
    application_frequency: row.application_frequency,
    notes: row.notes,
    sort_order: row.sort_order,
  };
}

/**
 * Fetch fertilizer plans for a farm, newest first — the farm's plan history.
 * Items are sorted by `sort_order` (nulls last) so the schedule renders in the
 * order the consultant intended. Row-level security scopes results to the farm
 * owner ("Farm owners can view their plans"), so no extra filtering is needed.
 * The consultant label comes from the sending organization's name.
 *
 * Pass `limit` when only the leading plans are needed (the current-plan callers
 * ask for 1) so we don't pull the whole history.
 */
export async function fetchFertilizerPlansForFarm(
  farmId: number,
  { limit }: { limit?: number } = {},
): Promise<FertilizerPlan[]> {
  if (!isSupabaseConfigured()) return [];

  let query = supabase
    .from('fertilizer_plans')
    .select(
      'id, farm_id, organization_id, title, notes, created_at, updated_at, organization:organizations(name), fertilizer_plan_items(id, fertilizer_name, quantity, unit, application_date, application_method, application_frequency, notes, sort_order)',
    )
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    if (__DEV__) console.warn('[fertilizer-plan] fetch plans failed:', error.message);
    throw error;
  }

  const rows = (data ?? []) as unknown as PlanRow[];

  return rows.map((row) => {
    const items = (row.fertilizer_plan_items ?? [])
      .slice()
      .sort((a, b) => {
        const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
        return ao - bo;
      })
      .map(mapItem);

    return {
      id: row.id,
      farm_id: row.farm_id,
      organization_id: row.organization_id,
      created_by: null,
      title: row.title,
      consultant_name: row.organization?.name ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at ?? row.created_at ?? null,
      notes: row.notes,
      items,
    };
  });
}

/**
 * Fetch the most recent fertilizer plan for a farm, or null. Used by callers that
 * only care about the current plan (e.g. the entry-form fertigation quick-add).
 */
export async function fetchFertilizerPlanForFarm(farmId: number): Promise<FertilizerPlan | null> {
  const plans = await fetchFertilizerPlansForFarm(farmId, { limit: 1 });
  return plans[0] ?? null;
}
