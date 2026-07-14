/**
 * Data-access primitives for offline-first record writes.
 *
 * These wrap the raw Supabase calls with the two correctness properties the
 * offline queue depends on:
 *
 *   - {@link idempotentCreate} — create keyed by `client_uuid` with
 *     ON CONFLICT DO NOTHING (`ignoreDuplicates`). A replayed create never
 *     duplicates a row and never clobbers a later edit (Codex C1/C2). The first
 *     insert returns the new row; a replay reads the canonical row back by
 *     `client_uuid`.
 *   - {@link targetedUpdate} / {@link targetedDelete} — address a record by its
 *     server `id` when known, else by `client_uuid`, so an edit/delete works on
 *     a record that was itself created offline and hasn't synced yet.
 */

import { supabase } from '@/lib/supabase';
import { newClientUuid } from './client-id';

/**
 * A reference to a record: prefer the server `id`; fall back to `client_uuid`.
 *
 * `client_uuid` is client-generated (not unguessable), so it is only a valid
 * address WITHIN a farm: the fallback branch requires `farmId` and filters by
 * it, so a stale/reused uuid can never touch another farm's row.
 */
export interface RecordRef {
  id?: number | null;
  clientUuid?: string | null;
  farmId?: number | null;
}

function describeRef(ref: RecordRef): string {
  if (ref.id != null) return `id=${ref.id}`;
  if (ref.clientUuid != null)
    return `client_uuid=${ref.clientUuid} farm_id=${ref.farmId ?? '<missing>'}`;
  return '<empty>';
}

/**
 * Insert `record` idempotently on `client_uuid`. Generates a `client_uuid` when
 * the caller did not supply one. Returns the canonical server row whether this
 * call inserted it or a prior (replayed) call did.
 */
export async function idempotentCreate<T extends object>(
  table: string,
  record: T & { client_uuid?: string | null },
): Promise<Record<string, unknown>> {
  const client_uuid = record.client_uuid ?? newClientUuid();
  const payload = { ...record, client_uuid };

  const { data, error } = await supabase
    .from(table)
    .upsert(payload, { onConflict: 'client_uuid', ignoreDuplicates: true })
    .select()
    .maybeSingle();
  if (error) throw error;
  if (data) return data as Record<string, unknown>;

  // ignoreDuplicates skipped the row → a conflicting row already exists from a
  // prior replay. Read it back SCOPED TO THIS FARM so a reused/stale uuid can
  // never make the create "succeed" with another farm's row.
  const farmId = (record as { farm_id?: number | null }).farm_id;
  let readBack = supabase.from(table).select('*').eq('client_uuid', client_uuid);
  if (farmId != null) readBack = readBack.eq('farm_id', farmId);
  const { data: existing, error: readError } = await readBack.maybeSingle();
  if (readError) throw readError;
  if (!existing) {
    throw new Error(
      `idempotentCreate: conflicting ${table} row for client_uuid=${client_uuid} is not readable in farm_id=${farmId ?? '<unknown>'} — uuid collides with a row outside this farm`,
    );
  }
  return existing as Record<string, unknown>;
}

/** Update a record addressed by `id` (preferred) or `client_uuid`. */
export async function targetedUpdate(
  table: string,
  ref: RecordRef,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const base = supabase.from(table).update(patch);
  const filtered =
    ref.id != null
      ? base.eq('id', ref.id)
      : ref.clientUuid != null && ref.farmId != null
        ? base.eq('client_uuid', ref.clientUuid).eq('farm_id', ref.farmId)
        : null;
  if (!filtered)
    throw new Error(
      `targetedUpdate: ref needs an id, or a client_uuid + farmId (${describeRef(ref)})`,
    );

  const { data, error } = await filtered.select().single();
  if (error) throw error;
  return data as Record<string, unknown>;
}

/** Delete a record addressed by `id` (preferred) or `client_uuid`. */
export async function targetedDelete(table: string, ref: RecordRef): Promise<void> {
  const base = supabase.from(table).delete();
  const filtered =
    ref.id != null
      ? base.eq('id', ref.id)
      : ref.clientUuid != null && ref.farmId != null
        ? base.eq('client_uuid', ref.clientUuid).eq('farm_id', ref.farmId)
        : null;
  if (!filtered)
    throw new Error(
      `targetedDelete: ref needs an id, or a client_uuid + farmId (${describeRef(ref)})`,
    );

  const { error } = await filtered;
  if (error) throw error;
}
