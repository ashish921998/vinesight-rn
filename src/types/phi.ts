export type PhiStatus = 'verified' | 'legacy_unverified' | 'unknown';

export type DoseBasis = 'per_liter' | 'per_100_liter' | 'fixed_per_tank';
export type DoseUnit = 'gm' | 'ml';
export type CropType = 'grape' | string;
export type PhiLabelClaimReviewStatus = 'pending_review' | 'verified' | 'rejected' | 'superseded';
export type PhiComplianceStatus = 'allowed' | 'warning' | 'blocked' | 'unverified';

export interface PhiChemicalLabelClaimMrl {
  id: number;
  claim_id: number;
  market: string;
  residue_name: string;
  mrl_value: number | null;
  mrl_unit: string;
  no_mrl_required: boolean;
  source_note?: string | null;
}

export interface PhiChemicalLabelClaim {
  id: number;
  source_id: number;
  product_id: number;
  crop: CropType;
  source_page?: number | null;
  source_serial: string;
  formulation_name: string;
  active_ingredient?: string | null;
  target_problem: string;
  dose_value: number;
  dose_unit: string;
  dose_basis: 'per_liter_water' | 'per_acre' | 'total' | 'other';
  phi_min_days?: number | null;
  phi_max_days?: number | null;
  phi_note?: string | null;
  systemic_class?: string | null;
  restrictions?: string | null;
  resistance_markers?: string | null;
  max_applications_per_season?: number | null;
  min_application_interval_days?: number | null;
  max_application_interval_days?: number | null;
  application_interval_note?: string | null;
  stage_restrictions?: string | null;
  review_status: PhiLabelClaimReviewStatus;
  effective_from?: string | null;
  effective_to?: string | null;
  supersedes_claim_id?: number | null;
  is_active: boolean;
  mrls?: PhiChemicalLabelClaimMrl[];
}

export interface ChemicalProduct {
  id: number;
  name: string;
  manufacturer?: string | null;
  active_ingredient?: string | null;
  is_active: boolean;
}

export interface ChemicalMixComponent {
  id: number;
  mix_id: number;
  product_id: number;
  label_claim_id?: number | null;
  product_name: string;
  active_ingredient?: string | null;
  dose_value: number;
  dose_unit: DoseUnit;
  dose_basis: DoseBasis;
  base_tank_liters?: number | null;
  phi_days: number | null;
  phi_verified?: boolean;
  phi_source: string;
  label_claim?: PhiChemicalLabelClaim | null;
}

export interface ChemicalMix {
  id: number;
  name: string;
  target_problem?: string | null;
  application_mode?: 'preventive' | 'curative' | 'both' | 'unspecified' | null;
  source_page?: number | null;
  is_active: boolean;
  components: ChemicalMixComponent[];
}

export interface PhiRule {
  id: number;
  product_id: number;
  crop: CropType;
  phi_days: number;
  evidence_level?: 'label' | 'expert' | 'field' | string;
  source_note?: string | null;
  verified: boolean;
}

export interface PhiComputationResult {
  catalogMixId: number;
  sprayDate: string;
  governingPhiDays: number | null;
  safeHarvestDate: string | null;
  blockingComponentName: string | null;
  phiStatus: PhiStatus;
}

export interface SafeToSprayStatus {
  mixId: number;
  mixName: string;
  status: 'green' | 'yellow' | 'red' | 'unverified';
  latestSafeSprayDate: string | null;
  daysUntilWindowEnds: number | null;
  governingPhiDays: number | null;
  blockingComponentName: string | null;
}
