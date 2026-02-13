/**
 * PowerSync Schema Definition
 *
 * Defines the local SQLite schema that mirrors key Supabase tables for offline-first access.
 * PowerSync uses this schema to create local tables and sync data bidirectionally with Supabase.
 *
 * Only the most critical tables for offline access are included here.
 * Additional tables can be added incrementally as needed.
 *
 * @see https://docs.powersync.com/usage/installation/react-native
 * @see src/types/database.ts for the full Supabase type definitions
 */

import { column, Schema, Table } from '@powersync/common';

// ============================================================
// MARK: - Table Definitions
// ============================================================

/**
 * Farms table - Core entity, must be available offline.
 * Maps to Supabase `farms` table.
 */
const farms = new Table({
  // PowerSync uses a text `id` column by default (UUID-based).
  // Supabase integer IDs are stored as text in PowerSync and cast as needed.
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
});

/**
 * Farm Seasons table - Needed for season-scoped queries offline.
 * Maps to Supabase `farm_seasons` table.
 */
const farm_seasons = new Table({
  farm_id: column.text,
  user_id: column.text,
  start_date: column.text,
  end_date: column.text,
  season_name: column.text,
  crop_type_snapshot: column.text,
  template_key: column.text,
  template_version: column.real,
  config_json: column.text, // JSON stored as text
  created_at: column.text,
  updated_at: column.text,
});

/**
 * Task Reminders table - Critical for field workers to see pending tasks offline.
 * Maps to Supabase `task_reminders` table.
 */
const task_reminders = new Table({
  farm_id: column.text,
  season_id: column.text,
  title: column.text,
  description: column.text,
  type: column.text,
  status: column.text,
  priority: column.text,
  due_date: column.text,
  estimated_duration_minutes: column.real,
  location: column.text,
  completed: column.integer,
  completed_at: column.text,
  assigned_to_user_id: column.text,
  created_by: column.text,
  linked_record_type: column.text,
  linked_record_id: column.text,
  planned_inputs: column.text, // JSON stored as text
  created_at: column.text,
  updated_at: column.text,
});

/**
 * Workers table - Needed for attendance tracking in the field.
 * Maps to Supabase `workers` table.
 */
const workers = new Table({
  user_id: column.text,
  name: column.text,
  daily_rate: column.real,
  advance_balance: column.real,
  is_active: column.integer, // boolean stored as 0/1
  created_at: column.text,
  updated_at: column.text,
});

/**
 * Worker Attendance table - Field workers mark attendance offline.
 * Maps to Supabase `worker_attendance` table.
 */
const worker_attendance = new Table({
  worker_id: column.text,
  farm_ids: column.text, // INTEGER[] stored as JSON text
  date: column.text,
  work_status: column.text,
  work_type: column.text,
  daily_rate_override: column.real,
  notes: column.text,
  created_at: column.text,
  updated_at: column.text,
});

/**
 * Profiles table - User profile needed for auth context offline.
 * Maps to Supabase `profiles` table.
 */
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

/**
 * Irrigation Records table - Common field activity logged offline.
 * Maps to Supabase `irrigation_records` table.
 */
const irrigation_records = new Table({
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
});

/**
 * Spray Records table - Spray activities logged in the field.
 * Maps to Supabase `spray_records` table.
 */
const spray_records = new Table({
  farm_id: column.text,
  season_id: column.text,
  date: column.text,
  chemical: column.text,
  chemical_items: column.text, // JSON stored as text
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
});

/**
 * Fertigation Records table - Fertigation activities logged in the field.
 * Maps to Supabase `fertigation_records` table.
 */
const fertigation_records = new Table({
  farm_id: column.text,
  season_id: column.text,
  date: column.text,
  fertilizers: column.text, // JSON stored as text
  water_volume: column.real,
  nutrient_totals_elemental: column.text, // JSON stored as text
  nutrient_totals_elemental_per_acre: column.text, // JSON stored as text
  nutrient_calc_coverage: column.real,
  area: column.real,
  date_of_pruning: column.text,
  notes: column.text,
  created_at: column.text,
});

/**
 * Harvest Records table - Harvest data logged in the field.
 * Maps to Supabase `harvest_records` table.
 */
const harvest_records = new Table({
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
});

/**
 * Expense Records table - Expense tracking available offline.
 * Maps to Supabase `expense_records` table.
 */
const expense_records = new Table({
  farm_id: column.text,
  season_id: column.text,
  date: column.text,
  type: column.text,
  cost: column.real,
  date_of_pruning: column.text,
  remarks: column.text,
  num_workers: column.real,
  hours_worked: column.real,
  work_type: column.text,
  rate_per_unit: column.real,
  worker_names: column.text,
  created_at: column.text,
});

/**
 * Daily Notes table - Quick notes captured in the field.
 * Maps to Supabase `daily_notes` table.
 */
const daily_notes = new Table({
  farm_id: column.text,
  season_id: column.text,
  date: column.text,
  notes: column.text,
  created_at: column.text,
  updated_at: column.text,
});

/**
 * Warehouse Items table - Inventory reference available offline.
 * Maps to Supabase `warehouse_items` table.
 */
const warehouse_items = new Table({
  user_id: column.text,
  name: column.text,
  type: column.text,
  quantity: column.real,
  unit: column.text,
  unit_price: column.real,
  reorder_quantity: column.real,
  composition: column.text, // JSON stored as text
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
});

// ============================================================
// MARK: - Schema Export
// ============================================================

/**
 * The PowerSync schema containing all tables that should be synced for offline access.
 * Table names must match the Supabase table names exactly.
 */
export const AppSchema = new Schema({
  farms,
  farm_seasons,
  task_reminders,
  workers,
  worker_attendance,
  profiles,
  irrigation_records,
  spray_records,
  fertigation_records,
  harvest_records,
  expense_records,
  daily_notes,
  warehouse_items,
});

/** Type helper for the PowerSync database instance */
export type AppDatabase = (typeof AppSchema)['types'];
