/**
 * PowerSync Schema Definition
 *
 * Defines the local SQLite schema for offline-first sync.
 * Only includes tables needed for Phase 2 core offline reads:
 * farms, farm_seasons, and profiles.
 *
 * Note: PowerSync uses TEXT-based UUIDs for `id` columns by default.
 * Supabase integer IDs are stored as TEXT in the local DB and cast as needed.
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
// MARK: - Schema Export
// ============================================================

export const powersyncSchema = new Schema({
  farms,
  farm_seasons,
  profiles,
});
