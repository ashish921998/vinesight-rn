export type Classification = 'green' | 'yellow' | 'red';

export interface PetioleTriage {
  id: string;
  petiole_test_id: number;
  farm_id: number;
  organization_id: string;
  classification: Classification;
  classification_reason: string | null;
  confidence_score: number | null;
  ai_draft_plan_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}
