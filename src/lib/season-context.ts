import { supabase } from './supabase';
import { TABLES, type FarmSeason } from '../types';
import { formatLocalDate } from '../utils/date';

function extractSeasonIdFromRpc(data: unknown): number | null {
  if (typeof data === 'number') return Number.isFinite(data) ? data : null;
  if (data && typeof data === 'object' && 'season_id' in data) {
    const seasonId = (data as { season_id?: unknown }).season_id;
    if (typeof seasonId === 'number' && Number.isFinite(seasonId)) return seasonId;
  }
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (typeof first === 'number' && Number.isFinite(first)) return first;
    if (first && typeof first === 'object' && 'season_id' in first) {
      const seasonId = (first as { season_id?: unknown }).season_id;
      if (typeof seasonId === 'number' && Number.isFinite(seasonId)) return seasonId;
    }
  }
  return null;
}

function isPostgrestErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

export async function getActiveFarmSeason(farmId: number): Promise<FarmSeason | null> {
  const { data, error } = await supabase
    .from(TABLES.FARM_SEASONS)
    .select('*')
    .eq('farm_id', farmId)
    .is('end_date', null)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') return null;
    throw error;
  }
  return data ?? null;
}

// In-session cache of resolved season ids, keyed by `farmId:activityDate`.
// A farm's season for a given date does not change mid-session, so caching this
// lets repeated saves skip the resolution round-trip(s) before the insert.
const seasonIdCache = new Map<string, number>();

function seasonCacheKey(farmId: number, activityDate: string): string {
  return `${farmId}:${activityDate}`;
}

/**
 * Drop cached season resolutions for a farm (or all farms). Call after the
 * farm's seasons change — e.g. creating, editing, or recomputing seasons.
 */
export function invalidateSeasonIdCache(farmId?: number): void {
  if (farmId === undefined) {
    seasonIdCache.clear();
    return;
  }
  const prefix = `${farmId}:`;
  for (const key of seasonIdCache.keys()) {
    if (key.startsWith(prefix)) seasonIdCache.delete(key);
  }
}

export async function resolveSeasonIdForDate({
  farmId,
  date,
}: {
  farmId: number;
  date: string | Date;
}): Promise<number | null> {
  const activityDate = typeof date === 'string' ? date.slice(0, 10) : formatLocalDate(date);

  const cached = seasonIdCache.get(seasonCacheKey(farmId, activityDate));
  if (cached !== undefined) return cached;

  const { data: rpcData, error: rpcError } = await supabase.rpc('resolve_farm_season_for_date', {
    p_farm_id: farmId,
    p_activity_date: activityDate,
  });

  if (!rpcError) {
    const rpcSeasonId = extractSeasonIdFromRpc(rpcData);
    if (rpcSeasonId !== null) {
      seasonIdCache.set(seasonCacheKey(farmId, activityDate), rpcSeasonId);
      return rpcSeasonId;
    }
  }

  const { data, error } = await supabase
    .from(TABLES.FARM_SEASONS)
    .select('id,start_date,end_date')
    .eq('farm_id', farmId)
    .order('start_date', { ascending: false });

  if (error) {
    // Table may not exist on older schemas without the farm_seasons migration.
    if (error.code === '42P01') return null;
    throw error;
  }

  const matched = (data ?? []).find((season) => {
    const startsBeforeOrOnDate = season.start_date <= activityDate;
    const endsAfterOrOnDate = season.end_date === null || season.end_date >= activityDate;
    return startsBeforeOrOnDate && endsAfterOrOnDate;
  });

  if (matched?.id) {
    seasonIdCache.set(seasonCacheKey(farmId, activityDate), matched.id);
    return matched.id;
  }
  return null;
}

export async function resolveOptionalSeasonIdForDate(args: {
  farmId: number;
  date: string | Date;
}): Promise<number | null> {
  try {
    return await resolveSeasonIdForDate(args);
  } catch (error) {
    if (isPostgrestErrorWithCode(error, '42P01')) {
      return null;
    }
    throw error;
  }
}

/**
 * Resolve the season id for a date, lazily creating the farm's initial season
 * when the farm has no season history yet — e.g. during onboarding where the
 * initial season may still be in flight, or for older farms created before the
 * season feature existed. Farms that are merely *between* seasons are left
 * alone: their records stay unassigned until the next season starts (which
 * recomputes assignments) rather than resurrecting an overlapping season.
 */
export async function resolveOrCreateSeasonIdForDate(args: {
  farmId: number;
  date: string | Date;
}): Promise<number | null> {
  const existing = await resolveOptionalSeasonIdForDate(args);
  if (existing !== null) return existing;

  try {
    // Imported lazily to avoid a module cycle with the farms hooks file.
    const { ensureInitialFarmSeasonForFarmId } = await import('../hooks/use-farms');
    await ensureInitialFarmSeasonForFarmId(args.farmId);
  } catch (error) {
    // If season creation fails (e.g. missing table on an older schema), fall
    // back to a null season rather than blocking the write entirely.
    if (isPostgrestErrorWithCode(error, '42P01')) return null;
    console.warn('[season-context] failed to create initial season on demand:', error);
    throw error;
  }

  return resolveOptionalSeasonIdForDate(args);
}

interface SeasonAssignmentTableConfig {
  table: string;
  dateColumn: string;
  fallbackDateColumn?: string;
}

function normalizeDateInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value.length >= 10) return value.slice(0, 10);
  return null;
}

function pickSeasonForDate(
  seasons: Array<Pick<FarmSeason, 'id' | 'start_date' | 'end_date'>>,
  activityDate: string,
): number | null {
  for (let i = 0; i < seasons.length; i += 1) {
    const season = seasons[i];
    if (!season.id) continue;
    if (season.start_date > activityDate) continue;
    if (season.end_date !== null && season.end_date < activityDate) continue;
    return season.id;
  }
  return null;
}

export async function recomputeSeasonAssignmentsClient(farmId: number): Promise<number> {
  const { data: seasons, error: seasonsError } = await supabase
    .from(TABLES.FARM_SEASONS)
    .select('id,start_date,end_date')
    .eq('farm_id', farmId)
    .order('start_date', { ascending: false });

  if (seasonsError) throw seasonsError;

  // Season windows are changing — drop any cached resolutions for this farm.
  invalidateSeasonIdCache(farmId);

  const windows = (seasons ?? []) as Array<Pick<FarmSeason, 'id' | 'start_date' | 'end_date'>>;
  const tableConfigs: SeasonAssignmentTableConfig[] = [
    { table: TABLES.IRRIGATION_RECORDS, dateColumn: 'date' },
    { table: TABLES.SPRAY_RECORDS, dateColumn: 'date' },
    { table: TABLES.FERTIGATION_RECORDS, dateColumn: 'date' },
    { table: TABLES.HARVEST_RECORDS, dateColumn: 'date' },
    { table: TABLES.EXPENSE_RECORDS, dateColumn: 'date' },
    { table: TABLES.DAILY_NOTES, dateColumn: 'date' },
    { table: 'task_reminders', dateColumn: 'due_date', fallbackDateColumn: 'created_at' },
    { table: TABLES.SOIL_TEST_RECORDS, dateColumn: 'date' },
    { table: TABLES.PETIOLE_TEST_RECORDS, dateColumn: 'date' },
    { table: TABLES.SOIL_PROFILES, dateColumn: 'created_at' },
    { table: TABLES.TEMPORARY_WORKER_ENTRIES, dateColumn: 'date' },
  ];

  let updatedCount = 0;
  const todayIso = formatLocalDate(new Date());

  for (const config of tableConfigs) {
    const selectColumns = [
      'id',
      'season_id',
      config.dateColumn,
      ...(config.fallbackDateColumn ? [config.fallbackDateColumn] : []),
    ].join(',');

    const { data: rows, error } = await supabase
      .from(config.table)
      .select(selectColumns)
      .eq('farm_id', farmId);

    if (error) {
      // Table or column may not exist on older beta schemas.
      if (error.code === '42P01' || error.code === '42703') continue;
      throw error;
    }

    const typedRows = (Array.isArray(rows) ? rows : []) as unknown as Array<
      Record<string, unknown>
    >;
    for (const row of typedRows) {
      const rowId = typeof row.id === 'number' ? row.id : null;
      if (!rowId) continue;

      const primaryDate = normalizeDateInput(row[config.dateColumn]);
      const fallbackDate = config.fallbackDateColumn
        ? normalizeDateInput(row[config.fallbackDateColumn])
        : null;
      const activityDate = primaryDate ?? fallbackDate ?? todayIso;
      const resolvedSeasonId = pickSeasonForDate(windows, activityDate);
      const existingSeasonId = typeof row.season_id === 'number' ? row.season_id : null;

      if (existingSeasonId === resolvedSeasonId) continue;

      const { error: updateError } = await supabase
        .from(config.table)
        .update({ season_id: resolvedSeasonId })
        .eq('id', rowId)
        .eq('farm_id', farmId);

      if (updateError) throw updateError;
      updatedCount += 1;
    }
  }

  return updatedCount;
}
