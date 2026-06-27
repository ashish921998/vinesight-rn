import { supabase } from '@/lib/supabase';
import type { FertilizerPlan } from '@/types/fertilizer-plan';

type PlanItemRow = {
  fertilizer_name: string | null;
  quantity: number | null;
  unit: string | null;
  sort_order: number | null;
};

type PlanRow = {
  farm_id: number;
  title: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  // PostgREST returns an embedded resource as an object (or null when RLS hides it).
  organization: { name: string | null } | null;
  items: PlanItemRow[] | null;
};

/**
 * Fetch the most recent fertilizer plan a consultant has sent for a farm.
 *
 * Reads the real `fertilizer_plans` table (+ its `fertilizer_plan_items`). RLS
 * already restricts rows to the farm owner ("Farm owners can view their plans"),
 * so this runs with the farmer's own session — no service role needed. The
 * consultant label comes from the sending organization's name.
 */
export async function fetchFertilizerPlanForFarm(farmId: number): Promise<FertilizerPlan | null> {
  const { data, error } = await supabase
    .from('fertilizer_plans')
    .select(
      'farm_id,title,notes,created_at,updated_at,organization:organizations(name),items:fertilizer_plan_items(fertilizer_name,quantity,unit,sort_order)',
    )
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as PlanRow;

  const items: FertilizerPlan['items'] = (row.items ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((item) => ({
      name: item.fertilizer_name ?? '',
      quantity: item.quantity,
      unit: item.unit,
    }));

  return {
    farm_id: row.farm_id,
    title: row.title,
    consultant_name: row.organization?.name ?? null,
    updated_at: row.updated_at ?? row.created_at ?? null,
    notes: row.notes,
    items,
  };
}
