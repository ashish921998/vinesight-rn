/**
 * Farm-record data access
 *
 * The append-style farm record families (irrigation, spray, fertigation,
 * harvest, expense) all hit Supabase with the same four shapes: list-by-farm,
 * list-by-farms, create (with season-id resolution), update, delete. These were
 * copy-pasted into ~25 near-identical hook bodies in `use-records.ts`.
 *
 * Concentrating them here gives one place to change the query shape AND makes
 * the data access unit-testable: the Supabase client and the season resolver
 * are injectable, so a fake client can exercise these without a live backend.
 * The React Query wiring (keys + invalidation) stays in the hooks, on purpose —
 * that is per-family and is the part worth keeping explicit.
 */
import { supabase as defaultClient } from '../lib/supabase';
import { resolveOptionalSeasonIdForDate as defaultResolveSeasonId } from '../lib/season-context';

type RecordClient = typeof defaultClient;

export interface FarmRecordInsertBase {
  farm_id: number;
  date: string;
  season_id?: number | null;
}

export interface RecordApiDeps {
  /** Supabase client; injectable so tests can pass a fake. Defaults to the app client. */
  client?: RecordClient;
  /** Season resolver; injectable for tests. Defaults to the real season-context resolver. */
  resolveSeasonId?: typeof defaultResolveSeasonId;
}

/** List a farm's records for a table, newest first, optionally scoped to a season. */
export async function listFarmRecords<TRow>(
  table: string,
  farmId: number,
  seasonId: number | undefined,
  { client = defaultClient }: RecordApiDeps = {},
): Promise<TRow[]> {
  let query = client
    .from(table)
    .select('*')
    .eq('farm_id', farmId)
    .order('date', { ascending: false });
  if (seasonId !== undefined) {
    query = query.eq('season_id', seasonId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TRow[];
}

/** List records across several farms, newest first. Empty input short-circuits. */
export async function listFarmRecordsByFarms<TRow>(
  table: string,
  farmIds: number[],
  { client = defaultClient }: RecordApiDeps = {},
): Promise<TRow[]> {
  if (farmIds.length === 0) return [];
  const { data, error } = await client
    .from(table)
    .select('*')
    .in('farm_id', farmIds)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TRow[];
}

/**
 * Insert a record, resolving its season from the farm + date when the caller
 * did not supply one (mirrors the prior per-hook behavior exactly).
 */
export async function createFarmRecord<TRow, TInsert extends FarmRecordInsertBase>(
  table: string,
  record: TInsert,
  { client = defaultClient, resolveSeasonId = defaultResolveSeasonId }: RecordApiDeps = {},
): Promise<TRow> {
  const seasonId =
    record.season_id ?? (await resolveSeasonId({ farmId: record.farm_id, date: record.date }));
  const { data, error } = await client
    .from(table)
    .insert({ ...record, season_id: seasonId })
    .select()
    .single();
  if (error) throw error;
  return data as TRow;
}

/** Update a record by id. */
export async function updateFarmRecord<TRow>(
  table: string,
  id: number,
  updates: Partial<TRow>,
  { client = defaultClient }: RecordApiDeps = {},
): Promise<TRow> {
  const { data, error } = await client.from(table).update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as TRow;
}

/** Delete a record by id. */
export async function deleteFarmRecord(
  table: string,
  id: number,
  { client = defaultClient }: RecordApiDeps = {},
): Promise<void> {
  const { error } = await client.from(table).delete().eq('id', id);
  if (error) throw error;
}
