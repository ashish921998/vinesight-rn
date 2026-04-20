import { supabase } from '@/lib/supabase';
import type { FertilizerPlan } from '@/types/fertilizer-plan';

export async function fetchFertilizerPlanForFarm(farmId: number): Promise<FertilizerPlan | null> {
  const { data, error } = await supabase
    .from('fertilizer_plans')
    .select(
      `
      *,
      fertilizer_plan_items (*),
      profiles:created_by (full_name)
    `,
    )
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching fertilizer plan:', error);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    farm_id: data.farm_id,
    consultant_name: data.profiles?.full_name || 'Consultant',
    title: data.title,
    notes: data.notes,
    updated_at: data.updated_at,
    items: (data.fertilizer_plan_items || []).map(
      (item: { fertilizer_name: string; quantity: number; unit: string }) => ({
        name: item.fertilizer_name,
        quantity: item.quantity,
        unit: item.unit,
      }),
    ),
  };
}
