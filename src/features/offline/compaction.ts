/**
 * Queue compaction for the offline write outbox.
 *
 * The paused-mutation queue can hold several operations for the SAME record
 * (created offline, then edited, then deleted, all before reconnect). Replaying
 * them verbatim is wasteful and unsafe: a `create` + later `update` can land
 * out of order, and a `create` + `delete` round-trips a row that never needed
 * to exist. Compaction collapses each record's operations into the minimal
 * correct result BEFORE flush:
 *
 *     create → update(s)         ⇒ one create carrying the merged final fields
 *     create → delete            ⇒ nothing (the record never reaches the server)
 *     update(s) (server record)  ⇒ one update with merged fields
 *     update(s) → delete         ⇒ just the delete
 *
 * A record is addressed by a stable `handle`: `uuid:<client_uuid>` for an
 * offline-created record, or `id:<server id>` for an already-synced one.
 * Operations for different handles keep their original first-seen order.
 *
 *   queue:  [create A, update A, create B, delete A, update C]
 *            └──────── A ───────┘          └─ A ─┘
 *   compact: [create B, update C]      (A created-then-deleted ⇒ dropped)
 */

export type CompactableOp =
  | { kind: 'create'; handle: string; data: Record<string, unknown> }
  | { kind: 'update'; handle: string; patch: Record<string, unknown> }
  | { kind: 'delete'; handle: string };

/**
 * Collapse a FIFO list of queued operations into the minimal equivalent set,
 * preserving the first-seen order of each distinct handle.
 */
export function compactQueuedOps(ops: readonly CompactableOp[]): CompactableOp[] {
  const order: string[] = [];
  // `null` marks a handle whose create+delete cancelled out.
  const folded = new Map<string, CompactableOp | null>();

  for (const op of ops) {
    if (!folded.has(op.handle)) order.push(op.handle);
    const current = folded.get(op.handle); // CompactableOp | null | undefined

    switch (op.kind) {
      case 'create':
        // A create defines the base. client_uuids are unique, so in normal use
        // this is the first op seen for the handle.
        folded.set(op.handle, { kind: 'create', handle: op.handle, data: { ...op.data } });
        break;

      case 'update':
        if (current === null) break; // already created-then-deleted; moot
        if (current?.kind === 'create') {
          folded.set(op.handle, {
            kind: 'create',
            handle: op.handle,
            data: { ...current.data, ...op.patch },
          });
        } else if (current?.kind === 'update') {
          folded.set(op.handle, {
            kind: 'update',
            handle: op.handle,
            patch: { ...current.patch, ...op.patch },
          });
        } else if (current?.kind === 'delete') {
          break; // deleted already; a later edit is moot
        } else {
          // No prior op: an edit to an already-synced (server) record.
          folded.set(op.handle, { kind: 'update', handle: op.handle, patch: { ...op.patch } });
        }
        break;

      case 'delete':
        if (current?.kind === 'create') {
          // Created AND deleted before sync — cancel both; never touch the server.
          folded.set(op.handle, null);
        } else if (current === null) {
          break; // already cancelled; repeated deletes are moot
        } else {
          // Drops any pending update; the row exists on the server and must go.
          folded.set(op.handle, { kind: 'delete', handle: op.handle });
        }
        break;
    }
  }

  const result: CompactableOp[] = [];
  for (const handle of order) {
    const op = folded.get(handle);
    if (op) result.push(op);
  }
  return result;
}
