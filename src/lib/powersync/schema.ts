/**
 * PowerSync Schema Definition
 *
 * Defines the local SQLite schema for offline-first sync.
 * Includes all tables needed for offline reads and writes:
 * farms, farm_seasons, profiles, all record types, tasks,
 * workers, and worker-related tables.
 *
 * Note: PowerSync uses TEXT-based UUIDs for `id` columns by default.
 * Supabase integer IDs are stored as TEXT in the local DB and cast as needed.
 * JSON/array columns are stored as TEXT and parsed on read.
 */

import { column, Schema, Table } from '@powersync/common';

// ============================================================
// MARK: - Farms Table
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
// MARK: - Farm Seasons Table
// ============================================================

const farm_seasons = new Table(
  {
    farm_id: column.text,
    user_id: column.text,
    start_date: column.text,
    end_date: column.text,
    season_name: column.text,
    crop_type_snapshot: column.text,
    template_key: column.text,
    template_version: column.integer,
    config_json: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'] } },
);

// ============================================================
// MARK: - Profiles Table
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
// MARK: - Irrigation Records Table
// ============================================================

const irrigation_records = new Table(
  {
    farm_id: column.text,
    season_id: column.text,
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
  { indexes: { by_farm: ['farm_id'] } },
);

// ============================================================
// MARK: - Spray Records Table
// ============================================================

const spray_records = new Table(
  {
    farm_id: column.text,
    season_id: column.text,
    date: column.text,
    chemical: column.text,
    chemical_items: column.text, // JSON array stored as text
    dose: column.text,
    nutrient_totals_elemental: column.text, // JSON stored as text
    nutrient_totals_elemental_per_acre: column.text, // JSON stored as text
    nutrient_calc_coverage: column.real,
    area: column.real,
    weather: column.text,
    operator: column.text,
    date_of_pruning: column.text,
    notes: column.text,
    created_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'] } },
);

// ============================================================
// MARK: - Fertigation Records Table
// ============================================================

const fertigation_records = new Table(
  {
    farm_id: column.text,
    season_id: column.text,
    date: column.text,
    fertilizers: column.text, // JSON array stored as text
    water_volume: column.real,
    nutrient_totals_elemental: column.text, // JSON stored as text
    nutrient_totals_elemental_per_acre: column.text, // JSON stored as text
    nutrient_calc_coverage: column.real,
    area: column.real,
    date_of_pruning: column.text,
    notes: column.text,
    created_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'] } },
);

// ============================================================
// MARK: - Harvest Records Table
// ============================================================

const harvest_records = new Table(
  {
    farm_id: column.text,
    season_id: column.text,
    date: column.text,
    quantity: column.real,
    grade: column.text,
    price: column.real,
    buyer: column.text,
    date_of_pruning: column.text,
    notes: column.text,
    created_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'] } },
);

// ============================================================
// MARK: - Expense Records Table
// ============================================================

const expense_records = new Table(
  {
    farm_id: column.text,
    season_id: column.text,
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
  { indexes: { by_farm: ['farm_id'] } },
);

// ============================================================
// MARK: - Daily Notes Table
// ============================================================

const daily_notes = new Table(
  {
    farm_id: column.text,
    season_id: column.text,
    date: column.text,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'], by_farm_date: ['farm_id', 'date'] } },
);

// ============================================================
// MARK: - Task Reminders Table
// ============================================================

const task_reminders = new Table(
  {
    farm_id: column.text,
    season_id: column.text,
    title: column.text,
    description: column.text,
    type: column.text,
    status: column.text,
    priority: column.text,
    due_date: column.text,
    estimated_duration_minutes: column.integer,
    location: column.text,
    completed: column.integer, // boolean stored as 0/1
    completed_at: column.text,
    assigned_to_user_id: column.text,
    created_by: column.text,
    linked_record_type: column.text,
    linked_record_id: column.text,
    planned_inputs: column.text, // JSON array stored as text
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'] } },
);

// ============================================================
// MARK: - Workers Table
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
// MARK: - Worker Attendance Table
// ============================================================

const worker_attendance = new Table(
  {
    worker_id: column.text,
    farm_ids: column.text, // JSON array stored as text
    date: column.text,
    work_status: column.text,
    work_type: column.text,
    daily_rate_override: column.real,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_worker: ['worker_id'] } },
);

// ============================================================
// MARK: - Worker Transactions Table
// ============================================================

const worker_transactions = new Table(
  {
    worker_id: column.text,
    farm_id: column.text,
    date: column.text,
    type: column.text,
    amount: column.real,
    settlement_id: column.text,
    notes: column.text,
    created_at: column.text,
  },
  { indexes: { by_worker: ['worker_id'] } },
);

// ============================================================
// MARK: - Worker Settlements Table
// ============================================================

const worker_settlements = new Table(
  {
    worker_id: column.text,
    farm_id: column.text,
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
// MARK: - Temporary Worker Entries Table
// ============================================================

const temporary_worker_entries = new Table(
  {
    farm_id: column.text,
    season_id: column.text,
    user_id: column.text,
    date: column.text,
    name: column.text,
    hours_worked: column.real,
    amount_paid: column.real,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_farm: ['farm_id'] } },
);

// ============================================================
// MARK: - Schema Export
// ============================================================

export const powersyncSchema = new Schema({
  farms,
  farm_seasons,
  profiles,
  irrigation_records,
  spray_records,
  fertigation_records,
  harvest_records,
  expense_records,
  daily_notes,
  task_reminders,
  workers,
  worker_attendance,
  worker_transactions,
  worker_settlements,
  temporary_worker_entries,
});
