import {
  pendingLogsReducer,
  initialPendingLogsState,
  type PendingLogsState,
} from '@/components/screens/entry-form/pending-logs-reducer';
import type { PendingLog, PendingLogFailure } from '@/components/screens/entry-form/PendingLogs';
import type { LogTypeId } from '@/constants/calculator-models';

function makeLog(id: string, type: LogTypeId, overrides: Partial<PendingLog> = {}): PendingLog {
  return {
    id,
    type,
    scope: 'single_farm',
    farmId: 1,
    data: { duration: 1 } as PendingLog['data'],
    displayDescription: `${type} ${id}`,
    isSourceTaskLog: false,
    ...overrides,
  };
}

const failure: PendingLogFailure = { message: 'boom' };

describe('pendingLogsReducer', () => {
  describe('append', () => {
    it('appends a draft and leaves it untagged when there is no source task', () => {
      const next = pendingLogsReducer(initialPendingLogsState, {
        type: 'append',
        log: makeLog('a', 'spray'),
        sourceTaskType: null,
      });
      expect(next.logs).toHaveLength(1);
      expect(next.logs[0].isSourceTaskLog).toBe(false);
    });

    it('tags the first draft whose type matches the source task', () => {
      const next = pendingLogsReducer(initialPendingLogsState, {
        type: 'append',
        log: makeLog('a', 'spray'),
        sourceTaskType: 'spray',
      });
      expect(next.logs[0].isSourceTaskLog).toBe(true);
    });

    it('does not tag a second matching draft once one is already tagged', () => {
      const afterFirst = pendingLogsReducer(initialPendingLogsState, {
        type: 'append',
        log: makeLog('a', 'spray'),
        sourceTaskType: 'spray',
      });
      const afterSecond = pendingLogsReducer(afterFirst, {
        type: 'append',
        log: makeLog('b', 'spray'),
        sourceTaskType: 'spray',
      });
      expect(afterSecond.logs.map((l) => l.isSourceTaskLog)).toEqual([true, false]);
    });

    it('does not tag when the draft type differs from the source task type', () => {
      const next = pendingLogsReducer(initialPendingLogsState, {
        type: 'append',
        log: makeLog('a', 'irrigation'),
        sourceTaskType: 'spray',
      });
      expect(next.logs[0].isSourceTaskLog).toBe(false);
    });

    it('overrides a stale isSourceTaskLog flag on the incoming draft', () => {
      const next = pendingLogsReducer(initialPendingLogsState, {
        type: 'append',
        log: makeLog('a', 'spray', { isSourceTaskLog: true }),
        sourceTaskType: null,
      });
      expect(next.logs[0].isSourceTaskLog).toBe(false);
    });

    it('preserves existing logs and the failure map', () => {
      const start: PendingLogsState = { logs: [makeLog('a', 'spray')], failures: { a: failure } };
      const next = pendingLogsReducer(start, {
        type: 'append',
        log: makeLog('b', 'harvest'),
        sourceTaskType: null,
      });
      expect(next.logs.map((l) => l.id)).toEqual(['a', 'b']);
      expect(next.failures).toEqual({ a: failure });
    });
  });

  describe('remove', () => {
    it('removes the matching draft', () => {
      const start: PendingLogsState = {
        logs: [makeLog('a', 'spray'), makeLog('b', 'harvest')],
        failures: {},
      };
      const next = pendingLogsReducer(start, { type: 'remove', id: 'a' });
      expect(next.logs.map((l) => l.id)).toEqual(['b']);
    });

    it('keeps the same failures reference when the removed draft had no failure', () => {
      const start: PendingLogsState = { logs: [makeLog('a', 'spray')], failures: { b: failure } };
      const next = pendingLogsReducer(start, { type: 'remove', id: 'a' });
      expect(next.failures).toBe(start.failures);
    });

    it('drops the failure entry for the removed draft', () => {
      const start: PendingLogsState = {
        logs: [makeLog('a', 'spray')],
        failures: { a: failure, b: failure },
      };
      const next = pendingLogsReducer(start, { type: 'remove', id: 'a' });
      expect(next.failures).toEqual({ b: failure });
      expect(next.failures).not.toBe(start.failures);
    });
  });

  describe('setFailures / clear', () => {
    it('replaces the failure map and keeps the logs', () => {
      const start: PendingLogsState = { logs: [makeLog('a', 'spray')], failures: {} };
      const next = pendingLogsReducer(start, { type: 'setFailures', failures: { a: failure } });
      expect(next.failures).toEqual({ a: failure });
      expect(next.logs).toBe(start.logs);
    });

    it('resets failures to empty via setFailures({})', () => {
      const start: PendingLogsState = { logs: [makeLog('a', 'spray')], failures: { a: failure } };
      const next = pendingLogsReducer(start, { type: 'setFailures', failures: {} });
      expect(next.failures).toEqual({});
      expect(next.logs).toHaveLength(1);
    });

    it('clears both logs and failures', () => {
      const start: PendingLogsState = { logs: [makeLog('a', 'spray')], failures: { a: failure } };
      expect(pendingLogsReducer(start, { type: 'clear' })).toEqual(initialPendingLogsState);
    });
  });

  it('returns the same state object for an unknown action', () => {
    const start: PendingLogsState = { logs: [makeLog('a', 'spray')], failures: {} };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(pendingLogsReducer(start, { type: 'noop' } as any)).toBe(start);
  });
});
