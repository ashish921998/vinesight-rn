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

export async function resolveSeasonIdForDate({
  farmId,
  date,
}: {
  farmId: number;
  date: string | Date;
}): Promise<number | null> {
  const activityDate = typeof date === 'string' ? date.slice(0, 10) : formatLocalDate(date);

  const { data: rpcData, error: rpcError } = await supabase.rpc('resolve_farm_season_for_date', {
    p_farm_id: farmId,
    p_activity_date: activityDate,
  });

  if (!rpcError) {
    const rpcSeasonId = extractSeasonIdFromRpc(rpcData);
    if (rpcSeasonId !== null) return rpcSeasonId;
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

  if (matched?.id) return matched.id;
  return null;
}

export async function resolveOptionalSeasonIdForDate(args: {
  farmId: number;
  date: string | Date;
}): Promise<number | null> {
  try {
    return await resolveSeasonIdForDate(args);
  } catch (error) {
    console.warn('[season-context] resolveSeasonIdForDate failed:', error);
    return null;
  }
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
