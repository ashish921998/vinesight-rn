import {
  saveIrrigationWithLinkedFertigation,
  type SaveLogFn,
  type IrrigationDeleteFn,
} from '@/features/entry-log-session/save-irrigation-with-linked-fertigation';
import type {
  SaveSingleLogInput,
  SaveSingleLogResult,
} from '@/features/entry-log-session/use-save-single-log';
import type { Farm } from '@/types';
import type { AreaUnitPreference } from '@/utils/preferences';

const farm = { id: 7, area: 4, system_discharge: 12 } as Farm;
const dateStr = '2026-07-30';
const areaUnit = 'acre' as AreaUnitPreference;

function irrigationResult(overrides: Partial<SaveSingleLogResult> = {}): SaveSingleLogResult {
  return {
    type: 'irrigation',
    recordId: 100,
    clientUuid: 'irrig-uuid',
    farmId: 7,
    ...overrides,
  };
}

function fertigationResult(overrides: Partial<SaveSingleLogResult> = {}): SaveSingleLogResult {
  return {
    type: 'fertigation',
    recordId: 200,
    clientUuid: 'fert-uuid',
    farmId: 7,
    ...overrides,
  };
}

/** Builds a recording mock saveLog that returns per-type results and captures calls. */
function makeSaveLog(
  results: { irrigation?: SaveSingleLogResult; fertigation?: SaveSingleLogResult },
  fertigationThrows?: Error,
) {
  const calls: SaveSingleLogInput[] = [];
  const fn: SaveLogFn = jest.fn(async (input: SaveSingleLogInput) => {
    calls.push(input);
    if (input.type === 'fertigation' && fertigationThrows) throw fertigationThrows;
    return input.type === 'irrigation'
      ? (results.irrigation ?? irrigationResult())
      : (results.fertigation ?? fertigationResult());
  });
  return { fn, calls };
}

function makeDelete() {
  const calls: Parameters<IrrigationDeleteFn>[0][] = [];
  const fn: IrrigationDeleteFn = jest.fn(async (ref) => {
    calls.push(ref);
  });
  return { fn, calls };
}

describe('saveIrrigationWithLinkedFertigation', () => {
  it('saves irrigation then a linked fertigation when fertilizers are present', async () => {
    const saveLog = makeSaveLog({});
    const deleteIrrigation = makeDelete();

    const outcome = await saveIrrigationWithLinkedFertigation({
      saveLog: saveLog.fn,
      deleteIrrigation: deleteIrrigation.fn,
      irrigationData: { duration: 3 } as never,
      fertigationData: { fertilizers: [{ name: 'NPK' }] } as never,
      hasFertilizers: true,
      farm,
      dateStr,
      preferredAreaUnit: areaUnit,
    });

    expect(saveLog.calls).toHaveLength(2);
    expect(saveLog.calls[0]?.type).toBe('irrigation');
    expect(saveLog.calls[1]).toMatchObject({
      type: 'fertigation',
      linkedIrrigationRecordId: 100,
    });
    expect(outcome.irrigation.recordId).toBe(100);
    expect(outcome.fertigation?.recordId).toBe(200);
    expect(deleteIrrigation.calls).toHaveLength(0);
  });

  it('saves only the irrigation when there are no fertilizers', async () => {
    const saveLog = makeSaveLog({});
    const deleteIrrigation = makeDelete();

    const outcome = await saveIrrigationWithLinkedFertigation({
      saveLog: saveLog.fn,
      deleteIrrigation: deleteIrrigation.fn,
      irrigationData: { duration: 3 } as never,
      fertigationData: { fertilizers: [] } as never,
      hasFertilizers: false,
      farm,
      dateStr,
      preferredAreaUnit: areaUnit,
    });

    expect(saveLog.calls).toHaveLength(1);
    expect(saveLog.calls[0]?.type).toBe('irrigation');
    expect(outcome.fertigation).toBeNull();
    expect(deleteIrrigation.calls).toHaveLength(0);
  });

  it('deletes the irrigation and rethrows when the fertigation save fails', async () => {
    const saveLog = makeSaveLog({}, new Error('fertigation boom'));
    const deleteIrrigation = makeDelete();

    await expect(
      saveIrrigationWithLinkedFertigation({
        saveLog: saveLog.fn,
        deleteIrrigation: deleteIrrigation.fn,
        irrigationData: { duration: 3 } as never,
        fertigationData: { fertilizers: [{ name: 'NPK' }] } as never,
        hasFertilizers: true,
        farm,
        dateStr,
        preferredAreaUnit: areaUnit,
      }),
    ).rejects.toThrow('fertigation boom');

    // Irrigation was saved, then compensated by delete.
    expect(saveLog.calls).toHaveLength(2);
    expect(deleteIrrigation.calls).toHaveLength(1);
    expect(deleteIrrigation.calls[0]).toMatchObject({
      id: 100,
      clientUuid: 'irrig-uuid',
      farmId: 7,
    });
  });

  it('swallows a compensation-delete failure and rethrows the original save error', async () => {
    const saveLog = makeSaveLog({}, new Error('fertigation boom'));
    const deleteCalls: Parameters<IrrigationDeleteFn>[0][] = [];
    const deleteIrrigation: IrrigationDeleteFn = jest.fn(async (ref) => {
      deleteCalls.push(ref);
      throw new Error('delete boom');
    });

    await expect(
      saveIrrigationWithLinkedFertigation({
        saveLog: saveLog.fn,
        deleteIrrigation,
        irrigationData: { duration: 3 } as never,
        fertigationData: { fertilizers: [{ name: 'NPK' }] } as never,
        hasFertilizers: true,
        farm,
        dateStr,
        preferredAreaUnit: areaUnit,
      }),
    ).rejects.toThrow('fertigation boom');

    expect(deleteCalls).toHaveLength(1);
  });

  it('reuses an existing irrigation result on the retry path instead of re-saving', async () => {
    const saveLog = makeSaveLog({});
    const deleteIrrigation = makeDelete();
    const existing = irrigationResult({ recordId: 999, clientUuid: 'retry-uuid' });

    const outcome = await saveIrrigationWithLinkedFertigation({
      saveLog: saveLog.fn,
      deleteIrrigation: deleteIrrigation.fn,
      irrigationData: { duration: 3 } as never,
      fertigationData: { fertilizers: [{ name: 'NPK' }] } as never,
      hasFertilizers: true,
      farm,
      dateStr,
      preferredAreaUnit: areaUnit,
      existingIrrigation: existing,
    });

    // Only the fertigation rider is saved; irrigation is reused.
    expect(saveLog.calls).toHaveLength(1);
    expect(saveLog.calls[0]).toMatchObject({
      type: 'fertigation',
      linkedIrrigationRecordId: 999,
    });
    expect(outcome.irrigation).toBe(existing);
    expect(outcome.fertigation?.recordId).toBe(200);
  });
});
