import { supabase } from '@/lib/supabase';
import type { PetioleTriage, Classification } from '@/types/petiole-triage';

export async function getTriageForFarm(farmId: number): Promise<PetioleTriage | null> {
  const { data, error } = await supabase
    .from('petiole_triage')
    .select(
      `
      *,
      fertilizer_plans:ai_draft_plan_id (
        id,
        title,
        notes,
        fertilizer_plan_items (*)
      )
    `,
    )
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as PetioleTriage | null;
}

export function getClassificationBadge(classification: Classification) {
  switch (classification) {
    case 'red':
      return { emoji: '🔴', label: 'Urgent', color: '#FF4444' };
    case 'yellow':
      return { emoji: '🟡', label: 'Watch', color: '#FFAA00' };
    case 'green':
      return { emoji: '🟢', label: 'Normal', color: '#00AA00' };
    default:
      return { emoji: '⚪', label: 'Unknown', color: '#888888' };
  }
}
