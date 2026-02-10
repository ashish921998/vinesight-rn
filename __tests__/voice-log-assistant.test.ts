import {
  buildVoiceLogFormPrefill,
  getVoiceLogMissingFields,
  resolveVoiceLogTurn,
  shouldAttemptVoiceLogExtraction,
} from '@/services/voice-log-assistant';
import type { ActivityLogExtractionResult, VoiceLogDraft } from '@/types/voice-log';
import type { Farm } from '@/types';

const FARMS: Farm[] = [
  { id: 1, name: 'Sunset Farm' } as Farm,
  { id: 2, name: 'Green Valley' } as Farm,
];

function emptyExtraction(
  overrides: Partial<ActivityLogExtractionResult>,
): ActivityLogExtractionResult {
  return {
    intent: 'none',
    activityType: null,
    cancel: false,
    farmName: null,
    dateIso: null,
    dateRelative: null,
    confidence: 0,
    irrigation: { durationHours: null },
    spray: { waterVolume: null, chemicals: [] },
    harvest: { quantity: null, grade: null, price: null, buyer: null },
    expense: { cost: null, expenseType: null, remarks: null },
    fertigation: { waterVolume: null, fertilizers: [] },
    ...overrides,
  };
}

describe('voice-log-assistant', () => {
  const fixedNow = new Date('2026-02-10T10:00:00Z');

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(fixedNow);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('auto-selects farm context on farm screen for irrigation', () => {
    const result = resolveVoiceLogTurn({
      transcript: 'Log irrigation for 2 hours',
      farms: FARMS,
      contextFarm: FARMS[0],
      originContext: 'farm',
      activeDraft: null,
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;

    expect(result.draft.type).toBe('irrigation');
    expect(result.draft.farmId).toBe(1);
    expect(result.draft.irrigation.durationHours).toBe(2);
  });

  it('asks for farm on dashboard when farm is missing', () => {
    const result = resolveVoiceLogTurn({
      transcript: 'Log irrigation for 2 hours',
      farms: FARMS,
      contextFarm: null,
      originContext: 'dashboard',
      activeDraft: null,
    });

    expect(result.kind).toBe('clarify');
    if (result.kind !== 'clarify') return;

    expect(result.missingFields).toContain('farm');
    expect(result.missingFields).not.toContain('duration');
  });

  it('uses LLM extraction to resolve spray details', () => {
    const llmExtraction = emptyExtraction({
      intent: 'log_activity',
      activityType: 'spray',
      farmName: 'Green Valley',
      dateRelative: 'yesterday',
      confidence: 0.92,
      spray: {
        waterVolume: 200,
        chemicals: [{ name: 'Sulphur', quantity: 2, unit: 'gm/L' }],
      },
    });

    const result = resolveVoiceLogTurn({
      transcript: 'कल spray log करो',
      farms: FARMS,
      contextFarm: null,
      originContext: 'dashboard',
      activeDraft: null,
      llmExtraction,
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;

    expect(result.draft.type).toBe('spray');
    expect(result.draft.farmId).toBe(2);
    expect(result.draft.date).toBe('2026-02-09');
    expect(result.draft.spray.waterVolume).toBe(200);
    expect(result.draft.spray.chemicals).toHaveLength(1);
  });

  it('returns harvest grade as missing when only quantity is provided', () => {
    const llmExtraction = emptyExtraction({
      intent: 'log_activity',
      activityType: 'harvest',
      harvest: {
        quantity: 500,
        grade: null,
        price: null,
        buyer: null,
      },
    });

    const result = resolveVoiceLogTurn({
      transcript: 'log harvest 500 kg',
      farms: FARMS,
      contextFarm: null,
      originContext: 'dashboard',
      activeDraft: null,
      llmExtraction,
    });

    expect(result.kind).toBe('clarify');
    if (result.kind !== 'clarify') return;

    expect(result.draft.type).toBe('harvest');
    expect(result.missingFields).toContain('farm');
    expect(result.missingFields).toContain('grade');
  });

  it('completes expense draft from follow-up answer', () => {
    const draft: VoiceLogDraft = {
      type: 'expense',
      farmId: 1,
      farmName: 'Sunset Farm',
      date: '2026-02-10',
      irrigation: { durationHours: null },
      spray: { waterVolume: null, chemicals: [] },
      harvest: { quantity: null, grade: null, price: null, buyer: null },
      expense: { cost: null, expenseType: 'Fuel', remarks: null },
      fertigation: { waterVolume: null, fertilizers: [] },
    };

    const result = resolveVoiceLogTurn({
      transcript: '₹1200',
      farms: FARMS,
      contextFarm: FARMS[0],
      originContext: 'farm',
      activeDraft: draft,
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;

    expect(result.draft.expense.cost).toBe(1200);
    expect(result.draft.expense.expenseType).toBe('Fuel');
  });

  it('supports fertigation with fertilizers list', () => {
    const llmExtraction = emptyExtraction({
      intent: 'log_activity',
      activityType: 'fertigation',
      farmName: 'Sunset Farm',
      fertigation: {
        waterVolume: 300,
        fertilizers: [{ name: 'Urea', quantity: 5, unit: 'kg/acre' }],
      },
    });

    const result = resolveVoiceLogTurn({
      transcript: 'log fertigation with urea',
      farms: FARMS,
      contextFarm: null,
      originContext: 'dashboard',
      activeDraft: null,
      llmExtraction,
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;

    expect(result.draft.type).toBe('fertigation');
    expect(result.draft.fertigation.fertilizers).toHaveLength(1);
  });

  it('supports cancel signal from LLM while draft is active', () => {
    const llmExtraction = emptyExtraction({
      intent: 'none',
      cancel: true,
      confidence: 0.9,
    });

    const draft: VoiceLogDraft = {
      type: 'irrigation',
      farmId: 1,
      farmName: 'Sunset Farm',
      date: '2026-02-10',
      irrigation: { durationHours: null },
      spray: { waterVolume: null, chemicals: [] },
      harvest: { quantity: null, grade: null, price: null, buyer: null },
      expense: { cost: null, expenseType: null, remarks: null },
      fertigation: { waterVolume: null, fertilizers: [] },
    };

    const result = resolveVoiceLogTurn({
      transcript: 'cancel',
      farms: FARMS,
      contextFarm: FARMS[0],
      originContext: 'farm',
      activeDraft: draft,
      llmExtraction,
    });

    expect(result.kind).toBe('cancelled');
  });

  it('returns none for cancel when no draft is active', () => {
    const result = resolveVoiceLogTurn({
      transcript: 'cancel',
      farms: FARMS,
      contextFarm: null,
      originContext: 'dashboard',
      activeDraft: null,
    });

    expect(result.kind).toBe('none');
  });

  it('lets user override farm context by explicitly naming another farm', () => {
    const llmExtraction = emptyExtraction({
      intent: 'log_activity',
      activityType: 'irrigation',
      farmName: 'Green Valley',
      irrigation: { durationHours: 2 },
    });

    const result = resolveVoiceLogTurn({
      transcript: 'Log irrigation in Green Valley for 2 hours',
      farms: FARMS,
      contextFarm: FARMS[0],
      originContext: 'farm',
      activeDraft: null,
      llmExtraction,
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;

    expect(result.draft.farmId).toBe(2);
    expect(result.draft.farmName).toBe('Green Valley');
  });

  it('does not auto-pick single farm from dashboard context', () => {
    const oneFarm = [FARMS[0]];
    const result = resolveVoiceLogTurn({
      transcript: 'Log irrigation for 1 hour',
      farms: oneFarm,
      contextFarm: null,
      originContext: 'dashboard',
      activeDraft: null,
    });

    expect(result.kind).toBe('clarify');
    if (result.kind !== 'clarify') return;
    expect(result.missingFields).toContain('farm');
  });

  it('uses fallback parsing for spray water volume from transcript', () => {
    const draft: VoiceLogDraft = {
      type: 'spray',
      farmId: 1,
      farmName: 'Sunset Farm',
      date: '2026-02-10',
      irrigation: { durationHours: null },
      spray: { waterVolume: null, chemicals: [{ name: 'Sulphur', quantity: 1, unit: 'gm/L' }] },
      harvest: { quantity: null, grade: null, price: null, buyer: null },
      expense: { cost: null, expenseType: null, remarks: null },
      fertigation: { waterVolume: null, fertilizers: [] },
    };

    const result = resolveVoiceLogTurn({
      transcript: '200 liters',
      farms: FARMS,
      contextFarm: FARMS[0],
      originContext: 'farm',
      activeDraft: draft,
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.draft.spray.waterVolume).toBe(200);
  });

  it('uses fallback parsing for expense type/category from transcript', () => {
    const draft: VoiceLogDraft = {
      type: 'expense',
      farmId: 1,
      farmName: 'Sunset Farm',
      date: '2026-02-10',
      irrigation: { durationHours: null },
      spray: { waterVolume: null, chemicals: [] },
      harvest: { quantity: null, grade: null, price: null, buyer: null },
      expense: { cost: 800, expenseType: null, remarks: null },
      fertigation: { waterVolume: null, fertilizers: [] },
    };

    const result = resolveVoiceLogTurn({
      transcript: 'diesel bill',
      farms: FARMS,
      contextFarm: FARMS[0],
      originContext: 'farm',
      activeDraft: draft,
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.draft.expense.expenseType).toBe('Fuel');
  });

  it('builds prefill payload and computes missing fields', () => {
    const draft: VoiceLogDraft = {
      type: 'spray',
      farmId: 2,
      farmName: 'Green Valley',
      date: '2026-02-10',
      irrigation: { durationHours: null },
      spray: {
        waterVolume: 150,
        chemicals: [{ name: 'Sulphur', quantity: 2, unit: 'gm/L' }],
      },
      harvest: { quantity: null, grade: null, price: null, buyer: null },
      expense: { cost: null, expenseType: null, remarks: null },
      fertigation: { waterVolume: null, fertilizers: [] },
    };

    expect(getVoiceLogMissingFields(draft)).toEqual([]);

    const prefill = buildVoiceLogFormPrefill(draft);
    expect(prefill.type).toBe('spray');
    expect(prefill.spray?.waterVolume).toBe(150);
    expect(prefill.spray?.chemicals).toHaveLength(1);
  });

  it('applies default units while building prefill payloads', () => {
    const fertigationDraft: VoiceLogDraft = {
      type: 'fertigation',
      farmId: 1,
      farmName: 'Sunset Farm',
      date: '2026-02-10',
      irrigation: { durationHours: null },
      spray: { waterVolume: null, chemicals: [] },
      harvest: { quantity: null, grade: null, price: null, buyer: null },
      expense: { cost: null, expenseType: null, remarks: null },
      fertigation: {
        waterVolume: 250,
        fertilizers: [{ name: 'NPK', quantity: 3, unit: null }],
      },
    };

    const sprayDraft: VoiceLogDraft = {
      type: 'spray',
      farmId: 1,
      farmName: 'Sunset Farm',
      date: '2026-02-10',
      irrigation: { durationHours: null },
      spray: {
        waterVolume: 120,
        chemicals: [{ name: 'Sulphur', quantity: 2, unit: null }],
      },
      harvest: { quantity: null, grade: null, price: null, buyer: null },
      expense: { cost: null, expenseType: null, remarks: null },
      fertigation: { waterVolume: null, fertilizers: [] },
    };

    const fertigationPrefill = buildVoiceLogFormPrefill(fertigationDraft);
    const sprayPrefill = buildVoiceLogFormPrefill(sprayDraft);

    expect(fertigationPrefill.fertigation?.fertilizers[0]?.unit).toBe('kg/acre');
    expect(sprayPrefill.spray?.chemicals[0]?.unit).toBe('gm/L');
  });

  it('gates LLM extraction for non-activity queries unless draft is active', () => {
    expect(shouldAttemptVoiceLogExtraction('What is weather today?', false)).toBe(false);
    expect(shouldAttemptVoiceLogExtraction('log spray 200 liters', false)).toBe(true);
    expect(shouldAttemptVoiceLogExtraction('anything', true)).toBe(true);
  });
});
