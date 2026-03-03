export type PhiStatus = 'verified' | 'legacy_unverified' | 'unknown';

export type DoseBasis = 'per_liter' | 'per_100_liter' | 'fixed_per_tank';
export type DoseUnit = 'gm' | 'ml';
export type CropType = 'grape' | string;

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
  product_name: string;
  active_ingredient?: string | null;
  dose_value: number;
  dose_unit: DoseUnit;
  dose_basis: DoseBasis;
  base_tank_liters?: number | null;
  phi_days: number;
  phi_source: string;
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
  governingPhiDays: number;
  safeHarvestDate: string;
  blockingComponentName: string;
  phiStatus: PhiStatus;
}

export interface SafeToSprayStatus {
  mixId: number;
  mixName: string;
  status: 'green' | 'yellow' | 'red';
  latestSafeSprayDate: string;
  daysUntilWindowEnds: number;
  governingPhiDays: number;
  blockingComponentName: string;
}
