/**
 * Consultant review services.
 *
 * These call the web-owned Supabase RPCs and tables described in
 * `docs/consultant-mobile-plan.md`. No RN migration is required; the schema
 * and RPCs already exist in the `vinesight-web` project.
 */

import { supabase } from '@/lib/supabase';
import type { PetioleTriage, PetioleTriageInsert, FertilizerPlanItem } from '@/types/database';

export async function fetchPetioleTriage(
  organizationId: string,
  farmId: number,
): Promise<PetioleTriage[]> {
  const { data, error } = await supabase
    .from('petiole_triage')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('farm_id', farmId)
    .in('status', ['pending', 'in_review'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as PetioleTriage[];
}

export interface CreatePetioleTriageInput {
  organizationId: string;
  farmId: number;
  petioleTestId: number;
  clientUserId: string;
}

export async function createPetioleTriage(input: CreatePetioleTriageInput): Promise<PetioleTriage> {
  const insert: PetioleTriageInsert = {
    organization_id: input.organizationId,
    farm_id: input.farmId,
    petiole_test_id: input.petioleTestId,
    client_user_id: input.clientUserId,
    status: 'pending',
    severity: null,
    classification: null,
    summary: null,
    recommendation: null,
    review_notes: null,
    reviewed_by: null,
    reviewed_at: null,
  };

  const { data, error } = await supabase.from('petiole_triage').insert(insert).select().single();

  if (error) throw error;
  return data as PetioleTriage;
}

export interface SendFertilizerPlanInput {
  reviewId: string;
  title: string;
  notes: string | null;
  items: FertilizerPlanItem[];
}

export async function sendFertilizerPlan(
  input: SendFertilizerPlanInput,
): Promise<{ plan_id: string }> {
  const { data, error } = await supabase.rpc('send_fertilizer_plan', {
    p_review_id: input.reviewId,
    p_title: input.title,
    p_notes: input.notes ?? '',
    p_items: input.items,
  });

  if (error) throw error;
  return { plan_id: data as string };
}
