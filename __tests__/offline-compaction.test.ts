import { compactQueuedOps, type CompactableOp } from '@/features/offline/compaction';

const create = (handle: string, data: Record<string, unknown>): CompactableOp => ({
  kind: 'create',
  handle,
  data,
});
const update = (handle: string, patch: Record<string, unknown>): CompactableOp => ({
  kind: 'update',
  handle,
  patch,
});
const del = (handle: string): CompactableOp => ({ kind: 'delete', handle });

describe('compactQueuedOps', () => {
  it('passes a lone create through unchanged', () => {
    expect(compactQueuedOps([create('uuid:a', { duration: 2 })])).toEqual([
      create('uuid:a', { duration: 2 }),
    ]);
  });

  it('folds create + update into one create with merged fields', () => {
    const out = compactQueuedOps([
      create('uuid:a', { duration: 2, area: 1 }),
      update('uuid:a', { duration: 5 }),
    ]);
    expect(out).toEqual([create('uuid:a', { duration: 5, area: 1 })]);
  });

  it('merges multiple updates with later fields winning', () => {
    const out = compactQueuedOps([
      create('uuid:a', { duration: 2 }),
      update('uuid:a', { duration: 5 }),
      update('uuid:a', { duration: 9, note: 'x' }),
    ]);
    expect(out).toEqual([create('uuid:a', { duration: 9, note: 'x' })]);
  });

  it('cancels a create that is later deleted (never hits the server)', () => {
    expect(compactQueuedOps([create('uuid:a', { duration: 2 }), del('uuid:a')])).toEqual([]);
  });

  it('cancels create + update + delete entirely', () => {
    const out = compactQueuedOps([
      create('uuid:a', { duration: 2 }),
      update('uuid:a', { duration: 5 }),
      del('uuid:a'),
    ]);
    expect(out).toEqual([]);
  });

  it('merges edits to an already-synced record into one update', () => {
    const out = compactQueuedOps([
      update('id:42', { grade: 'A' }),
      update('id:42', { price: 100 }),
    ]);
    expect(out).toEqual([update('id:42', { grade: 'A', price: 100 })]);
  });

  it('collapses update(s) then delete on a server record to just the delete', () => {
    expect(compactQueuedOps([update('id:42', { grade: 'A' }), del('id:42')])).toEqual([
      del('id:42'),
    ]);
  });

  it('keeps a lone delete', () => {
    expect(compactQueuedOps([del('id:7')])).toEqual([del('id:7')]);
  });

  it('keeps distinct handles independent and in first-seen order', () => {
    const out = compactQueuedOps([
      create('uuid:a', { d: 1 }),
      update('id:9', { x: 1 }),
      update('uuid:a', { d: 2 }),
      del('id:9'),
      create('uuid:b', { d: 3 }),
    ]);
    expect(out).toEqual([create('uuid:a', { d: 2 }), del('id:9'), create('uuid:b', { d: 3 })]);
  });

  it('ignores a stray update after a create+delete cancellation', () => {
    const out = compactQueuedOps([
      create('uuid:a', { d: 1 }),
      del('uuid:a'),
      update('uuid:a', { d: 2 }),
    ]);
    expect(out).toEqual([]);
  });

  it('does not mutate the input ops', () => {
    const input = [create('uuid:a', { d: 1 }), update('uuid:a', { d: 2 })];
    const snapshot = JSON.parse(JSON.stringify(input));
    compactQueuedOps(input);
    expect(input).toEqual(snapshot);
  });
});
