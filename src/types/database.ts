/**
 * Vinesight Database Types
 * TypeScript interfaces that match the Supabase database schema
 * Ported from iOS Swift models (SupabaseModels.swift)
 */

// ============================================================
// MARK: - Farm
// ============================================================

export interface Farm {
  id?: number;
  user_id?: string;
  name: string;
  region: string;
  area: number;
  crop: string;
  crop_variety: string;
  planting_date: string;
  vine_spacing?: number | null;
  row_spacing?: number | null;
  total_tank_capacity?: number | null;
  system_discharge?: number | null;
  remaining_water?: number | null;
  water_calculation_updated_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  elevation?: number | null;
  timezone?: string | null;
  location_name?: string | null;
  location_source?: string | null;
  location_updated_at?: string | null;
  bulk_density?: number | null;
  cation_exchange_capacity?: number | null;
  soil_water_retention?: number | null;
  soil_texture_class?: string | null;
  sand_percentage?: number | null;
  silt_percentage?: number | null;
  clay_percentage?: number | null;
  date_of_pruning?: string | null;
  first_season_start_date?: string | null;
  display_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** Create payload for Farm (excludes server-generated fields) */
export type FarmInsert = Omit<Farm, 'id' | 'created_at' | 'updated_at'>;

/** Update payload for Farm */
export type FarmUpdate = Partial<Omit<Farm, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

/** Check if water is critically low (below 30%) */
export function isLowWater(farm: Pick<Farm, 'remaining_water' | 'total_tank_capacity'>): boolean {
  if (
    typeof farm.remaining_water !== 'number' ||
    !Number.isFinite(farm.remaining_water) ||
    typeof farm.total_tank_capacity !== 'number' ||
    !Number.isFinite(farm.total_tank_capacity) ||
    farm.total_tank_capacity <= 0
  ) {
    return false;
  }
  const percentage = (farm.remaining_water / farm.total_tank_capacity) * 100;
  return percentage < 30;
}

// ============================================================
// MARK: - Farm Season
// ============================================================

export interface FarmSeason {
  id?: number;
  farm_id: number;
  user_id?: string;
  start_date: string;
  end_date: string | null;
  target_harvest_date?: string | null;
  season_name?: string | null;
  crop_type_snapshot?: string | null;
  template_key?: string | null;
  template_version?: number | null;
  config_json?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** Create payload for FarmSeason (excludes server-generated fields) */
export type FarmSeasonInsert = Omit<FarmSeason, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

/** Update payload for FarmSeason */
export type FarmSeasonUpdate = Partial<
  Omit<FarmSeason, 'id' | 'farm_id' | 'user_id' | 'created_at' | 'updated_at'>
>;

// ============================================================
// MARK: - Irrigation Record
// ============================================================

export interface IrrigationRecord {
  id?: number;
  farm_id: number;
  season_id?: number | null;
  date: string;
  duration: number;
  area: number;
  growth_stage: string;
  moisture_status: string;
  system_discharge: number;
  date_of_pruning?: string | null;
  notes?: string | null;
  created_at?: string | null;
  professional_creator_id?: string | null;
  acting_organization_id?: string | null;
  professional_creator_name?: string | null;
  acting_organization_name?: string | null;
}

export type IrrigationRecordInsert = Omit<IrrigationRecord, 'id' | 'created_at'>;
export type IrrigationRecordUpdate = Partial<
  Omit<IrrigationRecord, 'id' | 'farm_id' | 'created_at'>
>;

// ============================================================
// MARK: - Spray Record
// ============================================================

export type QuantityBasis = 'total' | 'per_acre' | 'per_liter_water';
export type NutrientCompositionBasis = 'declared';

export interface NutrientCompositionItem {
  nutrient_code: string;
  percent: number;
  basis?: NutrientCompositionBasis;
  notes?: string | null;
}

export interface SprayChemicalItem {
  name: string;
  unit: string;
  quantity: number;
  quantity_basis?: QuantityBasis;
  warehouse_item_id?: number | null;
  catalog_product_id?: number | null;
  /**
   * Active plan item (uuid) this chemical was picked from, when selected via
   * the plan section of the product picker. Items are JSONB-backed, so this is
   * an optional item-level field like `catalog_product_id` — no migration.
   */
  plan_item_id?: string | null;
  composition_snapshot?: NutrientCompositionItem[] | null;
  density_kg_per_l?: number | null;
}

export interface SprayRecord {
  id?: number;
  farm_id: number;
  season_id?: number | null;
  date: string;
  catalog_mix_id?: number | null;
  chemical: string;
  chemical_items?: SprayChemicalItem[] | null;
  dose: string;
  governing_phi_days?: number | null;
  safe_harvest_date?: string | null;
  phi_calc_version?: string | null;
  phi_blocking_component?: string | null;
  phi_status?: 'verified' | 'legacy_unverified' | 'unknown' | null;
  nutrient_totals_elemental?: Record<string, number> | null;
  nutrient_totals_elemental_per_acre?: Record<string, number> | null;
  nutrient_calc_coverage?: number | null;
  area: number;
  weather: string;
  operator: string;
  date_of_pruning?: string | null;
  notes?: string | null;
  created_at?: string | null;
  professional_creator_id?: string | null;
  acting_organization_id?: string | null;
  professional_creator_name?: string | null;
  acting_organization_name?: string | null;
}

export type SprayRecordInsert = Omit<SprayRecord, 'id' | 'created_at'>;
export type SprayRecordUpdate = Partial<Omit<SprayRecord, 'id' | 'farm_id' | 'created_at'>>;

// ============================================================
// MARK: - Chemical Label Claims
// ============================================================

export type LabelClaimReviewStatus = 'pending_review' | 'verified' | 'rejected' | 'superseded';
export type LabelSourceType = 'annexure' | 'label' | 'manual_review' | 'other';
export type LabelDoseBasis = 'per_liter_water' | 'per_acre' | 'total' | 'other';
// NOTE: per-spray compliance columns (and their status union) land with the
// Unit 4 write path (ARCH-3) — the evaluator outcome type lives in phi.ts as
// PhiComplianceStatus until then.

export interface ChemicalLabelSource {
  id?: number;
  source_type: LabelSourceType;
  /**
   * Stable document-family slug (e.g. 'annexure-5-grapes') that supersession
   * is scoped to. Nullable by design: rows without a family are never
   * auto-superseded (fail-closed) — the claims importer always writes it.
   */
  document_family?: string | null;
  issuing_body: string;
  source_document: string;
  source_title: string;
  source_url?: string | null;
  crop: string;
  revision_date: string;
  effective_from?: string | null;
  effective_to?: string | null;
  document_checksum?: string | null;
  edition_defaults?: Record<string, unknown>;
  review_status: LabelClaimReviewStatus;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type ChemicalLabelSourceInsert = Omit<
  ChemicalLabelSource,
  'id' | 'created_at' | 'updated_at'
>;
export type ChemicalLabelSourceUpdate = Partial<
  Omit<ChemicalLabelSource, 'id' | 'created_at' | 'updated_at'>
>;

export interface ChemicalLabelClaim {
  id?: number;
  source_id: number;
  product_id: number;
  crop: string;
  source_page?: number | null;
  source_serial: string;
  formulation_name: string;
  active_ingredient?: string | null;
  target_problem: string;
  dose_value: number;
  dose_unit: string;
  dose_basis: LabelDoseBasis;
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
  review_status: LabelClaimReviewStatus;
  effective_from?: string | null;
  effective_to?: string | null;
  supersedes_claim_id?: number | null;
  is_active: boolean;
  review_notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type ChemicalLabelClaimInsert = Omit<
  ChemicalLabelClaim,
  'id' | 'created_at' | 'updated_at'
>;
export type ChemicalLabelClaimUpdate = Partial<
  Omit<ChemicalLabelClaim, 'id' | 'created_at' | 'updated_at'>
>;

export interface ChemicalLabelClaimMrl {
  id?: number;
  claim_id: number;
  market: string;
  residue_name: string;
  mrl_value?: number | null;
  mrl_unit: string;
  no_mrl_required: boolean;
  source_note?: string | null;
  created_at?: string | null;
}

export type ChemicalLabelClaimMrlInsert = Omit<ChemicalLabelClaimMrl, 'id' | 'created_at'>;
export type ChemicalLabelClaimMrlUpdate = Partial<
  Omit<ChemicalLabelClaimMrl, 'id' | 'claim_id' | 'created_at'>
>;

// ============================================================
// MARK: - Fertigation Record
// ============================================================

export interface FertilizerItem {
  name: string;
  unit: 'kg/acre' | 'liter/acre' | string;
  quantity: number;
  /**
   * True when `unit` was not recognized by the quantity kernel at save time.
   * The unit string is stored verbatim (farmer testimony) and flagged for
   * review — never coerced to kg (issue #192). Absent on recognized units.
   */
  unit_unrecognized?: boolean;
  quantity_basis?: QuantityBasis;
  warehouse_item_id?: number | null;
  catalog_product_id?: number | null;
  /**
   * Active plan item (uuid) this fertilizer was picked from, when selected via
   * the plan section of the product picker. Items are JSONB-backed, so this is
   * an optional item-level field like `catalog_product_id` — no migration.
   */
  plan_item_id?: string | null;
  composition_snapshot?: NutrientCompositionItem[] | null;
  density_kg_per_l?: number | null;
}

export interface FertigationRecord {
  id?: number;
  farm_id: number;
  season_id?: number | null;
  date: string;
  fertilizers?: FertilizerItem[] | null;
  water_volume?: number | null;
  /** Set when these fertilizers were logged together with an irrigation record. */
  irrigation_record_id?: number | null;
  nutrient_totals_elemental?: Record<string, number> | null;
  nutrient_totals_elemental_per_acre?: Record<string, number> | null;
  nutrient_calc_coverage?: number | null;
  area: number;
  date_of_pruning?: string | null;
  notes?: string | null;
  created_at?: string | null;
  professional_creator_id?: string | null;
  acting_organization_id?: string | null;
  professional_creator_name?: string | null;
  acting_organization_name?: string | null;
}

export type FertigationRecordInsert = Omit<FertigationRecord, 'id' | 'created_at'>;
export type FertigationRecordUpdate = Partial<
  Omit<FertigationRecord, 'id' | 'farm_id' | 'created_at'>
>;

// ============================================================
// MARK: - Harvest Record
// ============================================================

export interface HarvestRecord {
  id?: number;
  farm_id: number;
  season_id?: number | null;
  date: string;
  quantity: number;
  grade: string;
  price?: number | null;
  buyer?: string | null;
  date_of_pruning?: string | null;
  notes?: string | null;
  created_at?: string | null;
  professional_creator_id?: string | null;
  acting_organization_id?: string | null;
  professional_creator_name?: string | null;
  acting_organization_name?: string | null;
}

export type HarvestRecordInsert = Omit<HarvestRecord, 'id' | 'created_at'>;
export type HarvestRecordUpdate = Partial<Omit<HarvestRecord, 'id' | 'farm_id' | 'created_at'>>;

// ============================================================
// MARK: - Expense Record
// ============================================================

export type ExpenseType = 'labor' | 'materials' | 'equipment' | 'fuel' | 'other';

export interface ExpenseRecord {
  id?: number;
  farm_id: number;
  season_id?: number | null;
  date: string;
  type: ExpenseType | string;
  cost: number;
  date_of_pruning?: string | null;
  remarks?: string | null;
  // Labor-specific fields
  num_workers?: number | null;
  hours_worked?: number | null;
  work_type?: string | null;
  rate_per_unit?: number | null;
  worker_names?: string | null;
  created_at?: string | null;
}

export type ExpenseRecordInsert = Omit<ExpenseRecord, 'id' | 'created_at'>;
export type ExpenseRecordUpdate = Partial<Omit<ExpenseRecord, 'id' | 'farm_id' | 'created_at'>>;

// ============================================================
// MARK: - Daily Note Record
// ============================================================

export interface DailyNoteRecord {
  id?: number;
  farm_id: number;
  season_id?: number | null;
  date: string;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  professional_creator_id?: string | null;
  acting_organization_id?: string | null;
  professional_creator_name?: string | null;
  acting_organization_name?: string | null;
}

export type DailyNoteRecordInsert = Omit<DailyNoteRecord, 'id' | 'created_at' | 'updated_at'>;
export type DailyNoteRecordUpdate = Partial<
  Omit<DailyNoteRecord, 'id' | 'farm_id' | 'created_at' | 'updated_at'>
>;

// ============================================================
// MARK: - Soil Test Record
// ============================================================

export interface SoilTestRecord {
  id?: number;
  farm_id: number;
  season_id?: number | null;
  date: string;
  parameters: Record<string, number>; // pH, N, P, K, etc.
  date_of_pruning?: string | null;
  recommendations?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

export type SoilTestRecordInsert = Omit<SoilTestRecord, 'id' | 'created_at'>;
export type SoilTestRecordUpdate = Partial<Omit<SoilTestRecord, 'id' | 'farm_id' | 'created_at'>>;

// ============================================================
// MARK: - Petiole Test Record
// ============================================================

export interface PetioleTestRecord {
  id?: number;
  farm_id: number;
  season_id?: number | null;
  date: string;
  parameters: Record<string, number>; // N, P, K, Ca, Mg, etc.
  date_of_pruning?: string | null;
  recommendations?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

export type PetioleTestRecordInsert = Omit<PetioleTestRecord, 'id' | 'created_at'>;
export type PetioleTestRecordUpdate = Partial<
  Omit<PetioleTestRecord, 'id' | 'farm_id' | 'created_at'>
>;

// ============================================================
// MARK: - Petiole Triage (consultant review queue)
// ============================================================

export type PetioleTriageStatus = 'pending' | 'in_review' | 'reviewed' | 'escalated' | 'resolved';

export interface PetioleTriage {
  id: string;
  organization_id: string;
  farm_id: number;
  petiole_test_id: number;
  client_user_id: string;
  status: PetioleTriageStatus;
  severity: 'low' | 'medium' | 'high' | null;
  classification: string | null;
  summary: string | null;
  recommendation: string | null;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type PetioleTriageInsert = Omit<PetioleTriage, 'id' | 'created_at' | 'updated_at'>;
export type PetioleTriageUpdate = Partial<
  Omit<PetioleTriage, 'id' | 'organization_id' | 'farm_id' | 'created_at'>
>;

// ============================================================
// MARK: - Fertilizer Plan (consultant response to a petiole review)
// ============================================================

export interface FertilizerPlanItem {
  fertilizer_name: string;
  quantity: number;
  unit: string;
  /** Identity link to chemical_products(id). Null = custom/legacy item. */
  product_id?: number | null;
  /** Quantity basis, stored verbatim from the authoring picker. Null = legacy row. */
  quantity_basis?: QuantityBasis | null;
  application_method?: string | null;
  application_frequency?: number | null;
  notes?: string | null;
  application_date?: string | null;
  sort_order?: number | null;
}

export interface FertilizerPlan {
  id: string;
  review_id: string;
  farm_id: number;
  organization_id: string;
  title: string;
  notes: string | null;
  items: FertilizerPlanItem[];
  consultant_name?: string | null;
  reviewed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type FertilizerPlanInsert = Omit<FertilizerPlan, 'id' | 'created_at' | 'updated_at'>;
export type FertilizerPlanUpdate = Partial<
  Omit<FertilizerPlan, 'id' | 'review_id' | 'farm_id' | 'organization_id' | 'created_at'>
>;

// ============================================================
// MARK: - Soil Profile
// ============================================================

export interface SoilSectionData {
  name: string;
  depth_m?: number | null;
  width_m?: number | null;
  photo_path?: string | null;
  photo_preview?: string | null;
  ec_ds_m?: number | null;
  moisture_pct_user: number;
  created_at?: string | null;
}

export interface SoilProfile {
  id?: number;
  farm_id: number;
  season_id?: number | null;
  fusarium_pct?: number | null;
  sections: SoilSectionData[];
  created_at?: string | null;
}

export type SoilProfileInsert = Omit<SoilProfile, 'id'> & { created_at?: string | null };
export type SoilProfileUpdate = Partial<Omit<SoilProfile, 'id' | 'farm_id'>>;

// ============================================================
// MARK: - Calculation History
// ============================================================

export type CalculationType = 'etc' | 'nutrients' | 'lai' | 'discharge' | string;

export interface CalculationHistory {
  id?: number;
  farm_id: number;
  calculation_type: CalculationType;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  date: string;
  created_at?: string | null;
}

export type CalculationHistoryInsert = Omit<CalculationHistory, 'id' | 'created_at'>;

// ============================================================
// MARK: - Profile
// ============================================================

export type UserType = 'farmer' | 'consultant' | 'admin';
export type Currency = 'USD' | 'EUR' | 'INR' | 'GBP' | string;
export type SpacingUnit = 'feet' | 'mm' | string;

export interface Profile {
  id: string;
  email?: string | null;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  user_type?: UserType | null;
  consultant_organization_id?: string | null;
  area_unit_preference?: 'hectares' | 'acres' | null;
  currency_preference?: Currency | null;
  preferred_spacing_unit?: SpacingUnit | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;

// ============================================================
// MARK: - Warehouse Item
// ============================================================

export type WarehouseItemType = 'fertilizer' | 'spray';
export type WarehouseUnit = 'kg' | 'liter' | 'gram' | 'ml' | string;

export interface WarehouseItem {
  id?: number;
  user_id?: string;
  name: string;
  type: WarehouseItemType | string;
  quantity: number;
  unit: WarehouseUnit;
  unit_price: number;
  reorder_quantity?: number | null;
  composition?: NutrientCompositionItem[] | null;
  manufacturer?: string | null;
  density_kg_per_l?: number | null;
  default_dose_quantity?: number | null;
  default_dose_unit?: string | null;
  default_dose_basis?: QuantityBasis | null;
  composition_source?: 'manual' | 'preset' | string;
  composition_updated_at?: string | null;
  catalog_product_id?: number | null;
  catalog_mapping_status?: 'mapped_verified' | 'mapped_provisional' | 'unmapped';
  catalog_mapping_source?: 'manual' | 'preset' | 'auto';
  catalog_mapped_at?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type WarehouseItemInsert = Omit<
  WarehouseItem,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>;
export type WarehouseItemUpdate = Partial<
  Omit<WarehouseItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>
>;

// ============================================================
// MARK: - Worker
// ============================================================

export interface Worker {
  id?: number;
  user_id?: string;
  name: string;
  daily_rate: number;
  advance_balance: number;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export type WorkerInsert = Omit<Worker, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type WorkerUpdate = Partial<Omit<Worker, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

/** Calculate earnings based on work status */
export function calculateWorkerEarnings(
  worker: Worker,
  status: WorkStatus,
  rateOverride?: number,
): number {
  const rate = rateOverride ?? worker.daily_rate;
  switch (status) {
    case 'full_day':
      return rate;
    case 'half_day':
      return rate * 0.5;
    case 'absent':
      return 0;
    default:
      return 0;
  }
}

// ============================================================
// MARK: - Worker Attendance
// ============================================================

export type WorkStatus = 'full_day' | 'half_day' | 'absent';

export interface WorkerAttendance {
  id?: number;
  worker_id: number;
  farm_ids: number[]; // INTEGER[] in Postgres
  date: string;
  work_status: WorkStatus;
  work_type: string;
  daily_rate_override?: number | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type WorkerAttendanceInsert = Omit<WorkerAttendance, 'id' | 'created_at' | 'updated_at'>;
export type WorkerAttendanceUpdate = Partial<
  Omit<WorkerAttendance, 'id' | 'worker_id' | 'created_at' | 'updated_at'>
>;

/** Get status multiplier for attendance calculations */
export function getStatusMultiplier(status: WorkStatus): number {
  switch (status) {
    case 'full_day':
      return 1.0;
    case 'half_day':
      return 0.5;
    case 'absent':
      return 0.0;
    default:
      return 0.0;
  }
}

// ============================================================
// MARK: - Worker Transaction
// ============================================================

export type TransactionType = 'advance_given' | 'advance_deducted' | 'payment';

export interface WorkerTransaction {
  id?: number;
  worker_id: number;
  farm_id?: number | null;
  date: string;
  type: TransactionType;
  amount: number;
  settlement_id?: number | null;
  notes?: string | null;
  created_at?: string | null;
}

export type WorkerTransactionInsert = Omit<WorkerTransaction, 'id' | 'created_at'>;

/** Check if transaction is a debit */
export function isDebitTransaction(transaction: WorkerTransaction): boolean {
  return transaction.type === 'advance_given' || transaction.type === 'payment';
}

// ============================================================
// MARK: - Worker Settlement
// ============================================================

export type SettlementStatus = 'draft' | 'confirmed';

export interface WorkerSettlement {
  id?: number;
  worker_id: number;
  farm_id?: number | null;
  period_start: string;
  period_end: string;
  days_worked: number;
  gross_amount: number;
  advance_deducted: number;
  net_payment: number;
  status: SettlementStatus;
  notes?: string | null;
  confirmed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type WorkerSettlementInsert = Omit<WorkerSettlement, 'id' | 'created_at' | 'updated_at'>;
export type WorkerSettlementUpdate = Partial<
  Omit<WorkerSettlement, 'id' | 'worker_id' | 'created_at' | 'updated_at'>
>;

// ============================================================
// MARK: - Work Type
// ============================================================

export interface WorkType {
  id?: number;
  user_id?: string | null;
  name: string;
  is_default: boolean;
  created_at?: string | null;
}

export type WorkTypeInsert = Omit<WorkType, 'id' | 'user_id' | 'is_default' | 'created_at'>;

// ============================================================
// MARK: - Temporary Worker Entry
// ============================================================

export interface TemporaryWorkerEntry {
  id?: number;
  farm_id: number;
  season_id?: number | null;
  user_id?: string;
  date: string;
  name: string;
  hours_worked: number;
  amount_paid: number;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type TemporaryWorkerEntryInsert = Omit<
  TemporaryWorkerEntry,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>;

// ============================================================
// MARK: - Error Types (matching Swift SupabaseDataError)
// ============================================================

export type DataErrorType =
  | 'NOT_AUTHENTICATED'
  | 'NETWORK_ERROR'
  | 'DECODING_ERROR'
  | 'SERVER_ERROR'
  | 'NOT_FOUND'
  | 'UNKNOWN';

export interface DataError {
  type: DataErrorType;
  message: string;
  originalError?: Error;
}

export function createDataError(type: DataErrorType, error?: Error): DataError {
  const messages: Record<DataErrorType, string> = {
    NOT_AUTHENTICATED: 'Please sign in to continue',
    NETWORK_ERROR: `Network error: ${error?.message ?? 'Unknown'}`,
    DECODING_ERROR: `Data error: ${error?.message ?? 'Unknown'}`,
    SERVER_ERROR: `Server error: ${error?.message ?? 'Unknown'}`,
    NOT_FOUND: 'Record not found',
    UNKNOWN: `Unknown error: ${error?.message ?? 'Unknown'}`,
  };

  return {
    type,
    message: messages[type],
    originalError: error,
  };
}

// ============================================================
// MARK: - Date Helpers (matching Swift extensions)
// ============================================================

/** Format date as Supabase date string (YYYY-MM-DD) */
export function toSupabaseDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** Format date as Supabase timestamp string (ISO 8601) */
export function toSupabaseTimestampString(date: Date): string {
  return date.toISOString();
}

/** Parse Supabase date string to Date */
export function fromSupabaseDateString(dateString: string): Date | null {
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

/** Parse Supabase timestamp string to Date */
export function fromSupabaseTimestampString(timestampString: string): Date | null {
  const date = new Date(timestampString);
  return isNaN(date.getTime()) ? null : date;
}

// ============================================================
// MARK: - Database Table Names
// ============================================================

export const TABLES = {
  FARMS: 'farms',
  FARM_SEASONS: 'farm_seasons',
  CHEMICAL_PRODUCTS: 'chemical_products',
  CHEMICAL_PRODUCT_ALIASES: 'chemical_product_aliases',
  CHEMICAL_PRODUCT_COMPOSITIONS: 'chemical_product_compositions',
  CHEMICAL_MIXES: 'chemical_mixes',
  CHEMICAL_MIX_COMPONENTS: 'chemical_mix_components',
  CHEMICAL_PHI_RULES: 'chemical_phi_rules',
  CHEMICAL_LABEL_SOURCES: 'chemical_label_sources',
  CHEMICAL_LABEL_CLAIMS: 'chemical_label_claims',
  CHEMICAL_LABEL_CLAIM_MRLS: 'chemical_label_claim_mrls',
  IRRIGATION_RECORDS: 'irrigation_records',
  SPRAY_RECORDS: 'spray_records',
  FERTIGATION_RECORDS: 'fertigation_records',
  HARVEST_RECORDS: 'harvest_records',
  EXPENSE_RECORDS: 'expense_records',
  DAILY_NOTES: 'daily_notes',
  SOIL_TEST_RECORDS: 'soil_test_records',
  PETIOLE_TEST_RECORDS: 'petiole_test_records',
  PETIOLE_TRIAGE: 'petiole_triage',
  FERTILIZER_PLANS: 'fertilizer_plans',
  SOIL_PROFILES: 'soil_profiles',
  CALCULATION_HISTORY: 'calculation_history',
  PROFILES: 'profiles',
  WAREHOUSE_ITEMS: 'warehouse_items',
  WORKERS: 'workers',
  WORKER_ATTENDANCE: 'worker_attendance',
  WORKER_TRANSACTIONS: 'worker_transactions',
  WORKER_SETTLEMENTS: 'worker_settlements',
  WORK_TYPES: 'work_types',
  TEMPORARY_WORKER_ENTRIES: 'temporary_worker_entries',
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];
