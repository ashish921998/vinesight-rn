/**
 * PowerSync Row Transforms
 *
 * Convert raw SQLite row objects from PowerSync into the application's
 * TypeScript types. PowerSync stores data with slightly different
 * representations (e.g., booleans as 0/1, JSON as TEXT strings),
 * so these transforms normalize the data to match the existing types.
 */

import type { Farm, FarmSeason, Profile } from '../../types';

// ============================================================
// MARK: - Farm Transform
// ============================================================

/**
 * Convert a raw SQLite row into a Farm object.
 * PowerSync uses TEXT `id` internally, but the app expects numeric IDs.
 */
export function farmRowToFarm(row: Record<string, unknown>): Farm {
  return {
    id: toNumber(row.id),
    user_id: toStringOrUndefined(row.user_id),
    name: toString(row.name),
    region: toString(row.region),
    area: toNumberOrZero(row.area),
    crop: toString(row.crop),
    crop_variety: toString(row.crop_variety),
    planting_date: toString(row.planting_date),
    vine_spacing: toNumberOrNull(row.vine_spacing),
    row_spacing: toNumberOrNull(row.row_spacing),
    total_tank_capacity: toNumberOrNull(row.total_tank_capacity),
    system_discharge: toNumberOrNull(row.system_discharge),
    remaining_water: toNumberOrNull(row.remaining_water),
    water_calculation_updated_at: toStringOrNull(row.water_calculation_updated_at),
    latitude: toNumberOrNull(row.latitude),
    longitude: toNumberOrNull(row.longitude),
    elevation: toNumberOrNull(row.elevation),
    timezone: toStringOrNull(row.timezone),
    location_name: toStringOrNull(row.location_name),
    location_source: toStringOrNull(row.location_source),
    location_updated_at: toStringOrNull(row.location_updated_at),
    bulk_density: toNumberOrNull(row.bulk_density),
    cation_exchange_capacity: toNumberOrNull(row.cation_exchange_capacity),
    soil_water_retention: toNumberOrNull(row.soil_water_retention),
    soil_texture_class: toStringOrNull(row.soil_texture_class),
    sand_percentage: toNumberOrNull(row.sand_percentage),
    silt_percentage: toNumberOrNull(row.silt_percentage),
    clay_percentage: toNumberOrNull(row.clay_percentage),
    date_of_pruning: toStringOrNull(row.date_of_pruning),
    first_season_start_date: toStringOrNull(row.first_season_start_date),
    created_at: toStringOrNull(row.created_at),
    updated_at: toStringOrNull(row.updated_at),
  };
}

// ============================================================
// MARK: - Farm Season Transform
// ============================================================

/**
 * Convert a raw SQLite row into a FarmSeason object.
 * JSON columns (config_json) are parsed from TEXT.
 */
export function farmSeasonRowToFarmSeason(row: Record<string, unknown>): FarmSeason {
  return {
    id: toNumber(row.id),
    farm_id: toNumberOrZero(row.farm_id),
    user_id: toStringOrUndefined(row.user_id),
    start_date: toString(row.start_date),
    end_date: toStringOrNull(row.end_date),
    season_name: toStringOrNull(row.season_name),
    crop_type_snapshot: toStringOrNull(row.crop_type_snapshot),
    template_key: toStringOrNull(row.template_key),
    template_version: toNumberOrNull(row.template_version) as number | null | undefined,
    config_json: parseJsonOrNull(row.config_json) as Record<string, unknown> | null | undefined,
    created_at: toStringOrNull(row.created_at),
    updated_at: toStringOrNull(row.updated_at),
  };
}

// ============================================================
// MARK: - Profile Transform
// ============================================================

/**
 * Convert a raw SQLite row into a Profile object.
 */
export function profileRowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: toString(row.id),
    email: toStringOrNull(row.email),
    full_name: toStringOrNull(row.full_name),
    username: toStringOrNull(row.username),
    avatar_url: toStringOrNull(row.avatar_url),
    phone: toStringOrNull(row.phone),
    user_type: toStringOrNull(row.user_type) as Profile['user_type'],
    consultant_organization_id: toStringOrNull(row.consultant_organization_id),
    currency_preference: toStringOrNull(row.currency_preference) as Profile['currency_preference'],
    preferred_spacing_unit: toStringOrNull(
      row.preferred_spacing_unit,
    ) as Profile['preferred_spacing_unit'],
    created_at: toStringOrNull(row.created_at),
    updated_at: toStringOrNull(row.updated_at),
  };
}

// ============================================================
// MARK: - Utility Helpers
// ============================================================

function toString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function toStringOrUndefined(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value);
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
}

function toNumberOrZero(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

function parseJsonOrNull(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return value; // Already parsed
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
