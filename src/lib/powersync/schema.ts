/**
 * PowerSync Schema Definition
 *
 * Maps the critical offline tables from the Supabase database schema
 * (src/types/database.ts) to PowerSync Table definitions.
 *
 * PowerSync stores all IDs as TEXT (UUIDs). Numeric Supabase `id` columns
 * are synced as INTEGER but referenced via PowerSync's internal TEXT `id`.
 *
 * JSON/array columns (e.g. chemical_items, fertilizers, parameters, sections,
 * farm_ids, composition) are stored as TEXT and parsed at the application layer.
 */

import { column, Schema, Table } from '@powersync/react-native';

// ============================================================
// MARK: - Farms
// ============================================================

const farms = new Table(
  {
    user_id: column.text,
    name: column.text,
    region: column.text,
    area: column.real,
    crop: column.text,
    crop_variety: column.text,
    planting_date: column.text,
    vine_spacing: column.real,
    row_spacing: column.real,
    total_tank_capacity: column.real,
    system_discharge: column.real,
    remaining_water: column.real,
    water_calculation_updated_at: column.text,
    latitude: column.real,
    longitude: column.real,
    elevation: column.real,
    timezone: column.text,
    location_name: column.text,
    location_source: column.text,
    location_updated_at: column.text,
    bulk_density: column.real,
    cation_exchange_capacity: column.real,
    soil_water_retention: column.real,
    soil_texture_class: column.text,
    sand_percentage: column.real,
    silt_percentage: column.real,
    clay_percentage: column.real,
    date_of_pruning: column.text,
    first_season_start_date: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_user: ['user_id'] } },
);

// ============================================================
// MARK: - Farm Seasons
// ============================================================

const farm_seasons = new Table(
  {
    farm_id: column.integer,
    user_id: column.text,
    start_date: column.text,
    end_date: column.text,
    season_name: column.text,
    crop_type_snapshot: column.text,
    template_key: column.text,
    template_version: column.integer,
    config_json: column.text, // JSON stored as TEXT
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'] } },
);

// ============================================================
// MARK: - Irrigation Records
// ============================================================

const irrigation_records = new Table(
  {
    farm_id: column.integer,
    season_id: column.integer,
    date: column.text,
    duration: column.real,
    area: column.real,
    growth_stage: column.text,
    moisture_status: column.text,
    system_discharge: column.real,
    date_of_pruning: column.text,
    notes: column.text,
    created_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'], by_season: ['season_id'] } },
);

// ============================================================
// MARK: - Spray Records
// ============================================================

const spray_records = new Table(
  {
    farm_id: column.integer,
    season_id: column.integer,
    date: column.text,
    chemical: column.text,
    chemical_items: column.text, // JSON array stored as TEXT
    dose: column.text,
    nutrient_totals_elemental: column.text, // JSON stored as TEXT
    nutrient_totals_elemental_per_acre: column.text, // JSON stored as TEXT
    nutrient_calc_coverage: column.real,
    area: column.real,
    weather: column.text,
    operator: column.text,
    date_of_pruning: column.text,
    notes: column.text,
    created_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'], by_season: ['season_id'] } },
);

// ============================================================
// MARK: - Fertigation Records
// ============================================================

const fertigation_records = new Table(
  {
    farm_id: column.integer,
    season_id: column.integer,
    date: column.text,
    fertilizers: column.text, // JSON array stored as TEXT
    water_volume: column.real,
    nutrient_totals_elemental: column.text, // JSON stored as TEXT
    nutrient_totals_elemental_per_acre: column.text, // JSON stored as TEXT
    nutrient_calc_coverage: column.real,
    area: column.real,
    date_of_pruning: column.text,
    notes: column.text,
    created_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'], by_season: ['season_id'] } },
);

// ============================================================
// MARK: - Harvest Records
// ============================================================

const harvest_records = new Table(
  {
    farm_id: column.integer,
    season_id: column.integer,
    date: column.text,
    quantity: column.real,
    grade: column.text,
    price: column.real,
    buyer: column.text,
    date_of_pruning: column.text,
    notes: column.text,
    created_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'], by_season: ['season_id'] } },
);

// ============================================================
// MARK: - Expense Records
// ============================================================

const expense_records = new Table(
  {
    farm_id: column.integer,
    season_id: column.integer,
    date: column.text,
    type: column.text,
    cost: column.real,
    date_of_pruning: column.text,
    remarks: column.text,
    num_workers: column.integer,
    hours_worked: column.real,
    work_type: column.text,
    rate_per_unit: column.real,
    worker_names: column.text,
    created_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'], by_season: ['season_id'] } },
);

// ============================================================
// MARK: - Daily Notes
// ============================================================

const daily_notes = new Table(
  {
    farm_id: column.integer,
    season_id: column.integer,
    date: column.text,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'] } },
);

// ============================================================
// MARK: - Soil Test Records
// ============================================================

const soil_test_records = new Table(
  {
    farm_id: column.integer,
    season_id: column.integer,
    date: column.text,
    parameters: column.text, // JSON stored as TEXT
    date_of_pruning: column.text,
    recommendations: column.text,
    notes: column.text,
    created_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'] } },
);

// ============================================================
// MARK: - Petiole Test Records
// ============================================================

const petiole_test_records = new Table(
  {
    farm_id: column.integer,
    season_id: column.integer,
    date: column.text,
    parameters: column.text, // JSON stored as TEXT
    date_of_pruning: column.text,
    recommendations: column.text,
    notes: column.text,
    created_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'] } },
);

// ============================================================
// MARK: - Soil Profiles
// ============================================================

const soil_profiles = new Table(
  {
    farm_id: column.integer,
    season_id: column.integer,
    fusarium_pct: column.real,
    sections: column.text, // JSON array stored as TEXT
    created_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'] } },
);

// ============================================================
// MARK: - Profiles
// ============================================================

const profiles = new Table({
  email: column.text,
  full_name: column.text,
  username: column.text,
  avatar_url: column.text,
  phone: column.text,
  user_type: column.text,
  consultant_organization_id: column.text,
  currency_preference: column.text,
  preferred_spacing_unit: column.text,
  created_at: column.text,
  updated_at: column.text,
});

// ============================================================
// MARK: - Warehouse Items
// ============================================================

const warehouse_items = new Table(
  {
    user_id: column.text,
    name: column.text,
    type: column.text,
    quantity: column.real,
    unit: column.text,
    unit_price: column.real,
    reorder_quantity: column.real,
    composition: column.text, // JSON array stored as TEXT
    manufacturer: column.text,
    density_kg_per_l: column.real,
    default_dose_quantity: column.real,
    default_dose_unit: column.text,
    default_dose_basis: column.text,
    composition_source: column.text,
    composition_updated_at: column.text,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_user: ['user_id'] } },
);

// ============================================================
// MARK: - Workers
// ============================================================

const workers = new Table(
  {
    user_id: column.text,
    name: column.text,
    daily_rate: column.real,
    advance_balance: column.real,
    is_active: column.integer, // boolean stored as 0/1
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_user: ['user_id'] } },
);

// ============================================================
// MARK: - Worker Attendance
// ============================================================

const worker_attendance = new Table(
  {
    worker_id: column.integer,
    farm_ids: column.text, // INTEGER[] stored as JSON TEXT
    date: column.text,
    work_status: column.text,
    work_type: column.text,
    daily_rate_override: column.real,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_worker: ['worker_id'], by_date: ['date'] } },
);

// ============================================================
// MARK: - Worker Transactions
// ============================================================

const worker_transactions = new Table(
  {
    worker_id: column.integer,
    farm_id: column.integer,
    date: column.text,
    type: column.text,
    amount: column.real,
    settlement_id: column.integer,
    notes: column.text,
    created_at: column.text,
  },
  { indexes: { by_worker: ['worker_id'] } },
);

// ============================================================
// MARK: - Worker Settlements
// ============================================================

const worker_settlements = new Table(
  {
    worker_id: column.integer,
    farm_id: column.integer,
    period_start: column.text,
    period_end: column.text,
    days_worked: column.real,
    gross_amount: column.real,
    advance_deducted: column.real,
    net_payment: column.real,
    status: column.text,
    notes: column.text,
    confirmed_at: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_worker: ['worker_id'] } },
);

// ============================================================
// MARK: - Work Types
// ============================================================

const work_types = new Table(
  {
    user_id: column.text,
    name: column.text,
    is_default: column.integer, // boolean stored as 0/1
    created_at: column.text,
  },
  { indexes: { by_user: ['user_id'] } },
);

// ============================================================
// MARK: - Temporary Worker Entries
// ============================================================

const temporary_worker_entries = new Table(
  {
    farm_id: column.integer,
    season_id: column.integer,
    user_id: column.text,
    date: column.text,
    name: column.text,
    hours_worked: column.real,
    amount_paid: column.real,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'], by_user: ['user_id'] } },
);

// ============================================================
// MARK: - Schema Export
// ============================================================

/**
 * The PowerSync schema for offline-first sync.
 * Maps all 20 critical Supabase tables for local SQLite storage.
 */
export const AppSchema = new Schema({
  farms,
  farm_seasons,
  irrigation_records,
  spray_records,
  fertigation_records,
  harvest_records,
  expense_records,
  daily_notes,
  soil_test_records,
  petiole_test_records,
  soil_profiles,
  profiles,
  warehouse_items,
  workers,
  worker_attendance,
  worker_transactions,
  worker_settlements,
  work_types,
  temporary_worker_entries,
});

/** Type helper for the app schema */
export type AppDatabase = (typeof AppSchema)['types'];
