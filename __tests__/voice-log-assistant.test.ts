import {
  buildVoiceLogFormPrefill,
  decideChatRoute,
  getVoiceLogMissingFields,
  isRouteClarificationCancelResponse,
  resolveRouteClarificationResponse,
  resolveVoiceLogTurn,
  shouldAttemptVoiceLogExtraction,
} from '@/services/voice-log-assistant';
import type { QueryIntent } from '@/types/voice-assistant';
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
    intentConfidence: 0,
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

  it('routes to farm query for high-confidence history intent', () => {
    const route = decideChatRoute({
      transcript: 'How many irrigation hours did we log today?',
      hasActiveDraft: false,
      llmExtraction: emptyExtraction({
        intent: 'query_history',
        intentConfidence: 0.9,
      }),
      deterministicQueryIntent: null,
    });

    expect(route).toBe('farm_query');
  });

  it('routes to voice logging for high-confidence log intent', () => {
    const route = decideChatRoute({
      transcript: 'Log irrigation for 2 hours',
      hasActiveDraft: false,
      llmExtraction: emptyExtraction({
        intent: 'log_activity',
        intentConfidence: 0.92,
        activityType: 'irrigation',
      }),
      deterministicQueryIntent: null,
    });

    expect(route).toBe('voice_log');
  });

  it('routes to voice logging whenever a draft is active', () => {
    const route = decideChatRoute({
      transcript: 'how much irrigation did we log',
      hasActiveDraft: true,
      llmExtraction: emptyExtraction({
        intent: 'query_history',
        intentConfidence: 0.95,
      }),
      deterministicQueryIntent: null,
    });

    expect(route).toBe('voice_log');
  });

  it('returns clarify route when query and log signals are both high', () => {
    const route = decideChatRoute({
      transcript: 'log irrigation and also show total today',
      hasActiveDraft: false,
      llmExtraction: emptyExtraction({
        intent: 'log_activity',
        intentConfidence: 0.7,
      }),
      deterministicQueryIntent: {
        category: 'irrigation',
        queryType: 'total',
        timeRange: null,
        farmName: null,
        farmId: null,
        confidence: 0.72,
        rawTranscript: 'log irrigation and also show total today',
      },
    });

    expect(route).toBe('clarify_route');
  });

  it('parses clarification response options', () => {
    expect(resolveRouteClarificationResponse('1')).toBe('voice_log');
    expect(resolveRouteClarificationResponse('2')).toBe('farm_query');
    expect(resolveRouteClarificationResponse('show history')).toBe('farm_query');
    expect(resolveRouteClarificationResponse('log new activity')).toBe('voice_log');
    expect(resolveRouteClarificationResponse('maybe later')).toBeNull();
  });

  it('detects route clarification cancellation responses', () => {
    expect(isRouteClarificationCancelResponse('cancel')).toBe(true);
    expect(isRouteClarificationCancelResponse('go back')).toBe(true);
    expect(isRouteClarificationCancelResponse('रद्द')).toBe(true);
    expect(isRouteClarificationCancelResponse('show history')).toBe(false);
  });

  it('uses deterministic query intent when LLM intent is unavailable', () => {
    const deterministicQueryIntent: QueryIntent = {
      category: 'irrigation',
      queryType: 'total',
      timeRange: null,
      farmName: null,
      farmId: null,
      confidence: 0.8,
      rawTranscript: 'how many irrigation hours this month',
    };

    const route = decideChatRoute({
      transcript: deterministicQueryIntent.rawTranscript,
      hasActiveDraft: false,
      llmExtraction: null,
      deterministicQueryIntent,
    });

    expect(route).toBe('farm_query');
  });

  it('routes Marathi history-only query to farm query', () => {
    const route = decideChatRoute({
      transcript: 'मागच्या आठवड्याच्या नोंदी दाखवा',
      hasActiveDraft: false,
      llmExtraction: null,
      deterministicQueryIntent: null,
    });

    expect(route).toBe('farm_query');
  });

  it('does not treat explicit zero intent confidence as high-confidence intent', () => {
    const route = decideChatRoute({
      transcript: 'hello there',
      hasActiveDraft: false,
      llmExtraction: emptyExtraction({
        intent: 'query_history',
        intentConfidence: 0,
        confidence: 0.9,
      }),
      deterministicQueryIntent: null,
    });

    expect(route).toBe('fallback_llm');
  });

  it('does not start draft for low-confidence LLM log intent', () => {
    const result = resolveVoiceLogTurn({
      transcript: 'maybe something about watering',
      farms: [{ id: 1, name: 'Sunset Farm' } as Farm],
      contextFarm: null,
      originContext: 'dashboard',
      activeDraft: null,
      llmExtraction: {
        intent: 'log_activity',
        intentConfidence: 0.3,
        activityType: 'irrigation',
        cancel: false,
        farmName: null,
        dateIso: null,
        dateRelative: null,
        confidence: 0.3,
        irrigation: { durationHours: null },
        spray: { waterVolume: null, chemicals: [] },
        harvest: { quantity: null, grade: null, price: null, buyer: null },
        expense: { cost: null, expenseType: null, remarks: null },
        fertigation: { waterVolume: null, fertilizers: [] },
      },
    });

    expect(result.kind).toBe('none');
  });

  it('parses expense type from Hindi/Marathi keywords', () => {
    const draft: VoiceLogDraft = {
      type: 'expense',
      farmId: 1,
      farmName: 'Sunset Farm',
      date: '2026-02-10',
      irrigation: { durationHours: null },
      spray: { waterVolume: null, chemicals: [] },
      harvest: { quantity: null, grade: null, price: null, buyer: null },
      expense: { cost: 500, expenseType: null, remarks: null },
      fertigation: { waterVolume: null, fertilizers: [] },
    };

    const dieselResult = resolveVoiceLogTurn({
      transcript: 'डीज़ल',
      farms: [{ id: 1, name: 'Sunset Farm' } as Farm],
      contextFarm: { id: 1, name: 'Sunset Farm' } as Farm,
      originContext: 'farm',
      activeDraft: draft,
    });

    expect(dieselResult.kind).toBe('ready');
    if (dieselResult.kind !== 'ready') return;
    expect(dieselResult.draft.expense.expenseType).toBe('Fuel');
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

  it('defaults Marathi "काल" to yesterday when deterministic date parsing is used', () => {
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
      transcript: 'काल 2 तास सिंचन',
      farms: FARMS,
      contextFarm: FARMS[0],
      originContext: 'farm',
      activeDraft: draft,
      llmExtraction: emptyExtraction({
        intent: 'log_activity',
        activityType: 'irrigation',
        dateRelative: null,
      }),
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.draft.date).toBe('2026-02-09');
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

  it('accepts bare numeric follow-up for irrigation duration', () => {
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
      transcript: '2',
      farms: FARMS,
      contextFarm: FARMS[0],
      originContext: 'farm',
      activeDraft: draft,
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.draft.irrigation.durationHours).toBe(2);
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

  it('accepts bare numeric follow-up for spray water volume', () => {
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
      transcript: '200',
      farms: FARMS,
      contextFarm: FARMS[0],
      originContext: 'farm',
      activeDraft: draft,
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.draft.spray.waterVolume).toBe(200);
  });

  it('accepts bare numeric follow-up for harvest quantity', () => {
    const draft: VoiceLogDraft = {
      type: 'harvest',
      farmId: 1,
      farmName: 'Sunset Farm',
      date: '2026-02-10',
      irrigation: { durationHours: null },
      spray: { waterVolume: null, chemicals: [] },
      harvest: { quantity: null, grade: 'A', price: null, buyer: null },
      expense: { cost: null, expenseType: null, remarks: null },
      fertigation: { waterVolume: null, fertilizers: [] },
    };

    const result = resolveVoiceLogTurn({
      transcript: '500',
      farms: FARMS,
      contextFarm: FARMS[0],
      originContext: 'farm',
      activeDraft: draft,
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.draft.harvest.quantity).toBe(500);
  });

  it('does not treat article words as harvest grade', () => {
    const draft: VoiceLogDraft = {
      type: 'harvest',
      farmId: 1,
      farmName: 'Sunset Farm',
      date: '2026-02-10',
      irrigation: { durationHours: null },
      spray: { waterVolume: null, chemicals: [] },
      harvest: { quantity: 500, grade: null, price: null, buyer: null },
      expense: { cost: null, expenseType: null, remarks: null },
      fertigation: { waterVolume: null, fertilizers: [] },
    };

    const result = resolveVoiceLogTurn({
      transcript: 'we sold a lot today',
      farms: FARMS,
      contextFarm: FARMS[0],
      originContext: 'farm',
      activeDraft: draft,
    });

    expect(result.kind).toBe('clarify');
    if (result.kind !== 'clarify') return;
    expect(result.draft.harvest.grade).toBeNull();
    expect(result.missingFields).toContain('grade');
  });

  it('accepts single-letter harvest grade follow-up', () => {
    const draft: VoiceLogDraft = {
      type: 'harvest',
      farmId: 1,
      farmName: 'Sunset Farm',
      date: '2026-02-10',
      irrigation: { durationHours: null },
      spray: { waterVolume: null, chemicals: [] },
      harvest: { quantity: 500, grade: null, price: null, buyer: null },
      expense: { cost: null, expenseType: null, remarks: null },
      fertigation: { waterVolume: null, fertilizers: [] },
    };

    const result = resolveVoiceLogTurn({
      transcript: 'A',
      farms: FARMS,
      contextFarm: FARMS[0],
      originContext: 'farm',
      activeDraft: draft,
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.draft.harvest.grade).toBe('A');
  });

  it('accepts punctuation in single-letter harvest grade follow-up', () => {
    const draft: VoiceLogDraft = {
      type: 'harvest',
      farmId: 1,
      farmName: 'Sunset Farm',
      date: '2026-02-10',
      irrigation: { durationHours: null },
      spray: { waterVolume: null, chemicals: [] },
      harvest: { quantity: 500, grade: null, price: null, buyer: null },
      expense: { cost: null, expenseType: null, remarks: null },
      fertigation: { waterVolume: null, fertilizers: [] },
    };

    const result = resolveVoiceLogTurn({
      transcript: 'A.',
      farms: FARMS,
      contextFarm: FARMS[0],
      originContext: 'farm',
      activeDraft: draft,
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.draft.harvest.grade).toBe('A');
  });

  it('preserves existing chemical fields when LLM incoming values are null', () => {
    const draft: VoiceLogDraft = {
      type: 'spray',
      farmId: 1,
      farmName: 'Sunset Farm',
      date: '2026-02-10',
      irrigation: { durationHours: null },
      spray: { waterVolume: 200, chemicals: [{ name: 'Sulphur', quantity: 1, unit: 'gm/L' }] },
      harvest: { quantity: null, grade: null, price: null, buyer: null },
      expense: { cost: null, expenseType: null, remarks: null },
      fertigation: { waterVolume: null, fertilizers: [] },
    };

    const result = resolveVoiceLogTurn({
      transcript: 'update spray',
      farms: FARMS,
      contextFarm: FARMS[0],
      originContext: 'farm',
      activeDraft: draft,
      llmExtraction: emptyExtraction({
        intent: 'log_activity',
        activityType: 'spray',
        spray: { waterVolume: null, chemicals: [{ name: 'Sulphur', quantity: null, unit: null }] },
      }),
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.draft.spray.chemicals[0]).toEqual({ name: 'Sulphur', quantity: 1, unit: 'gm/L' });
  });

  it('preserves existing fertilizer fields when LLM incoming values are null', () => {
    const draft: VoiceLogDraft = {
      type: 'fertigation',
      farmId: 1,
      farmName: 'Sunset Farm',
      date: '2026-02-10',
      irrigation: { durationHours: null },
      spray: { waterVolume: null, chemicals: [] },
      harvest: { quantity: null, grade: null, price: null, buyer: null },
      expense: { cost: null, expenseType: null, remarks: null },
      fertigation: {
        waterVolume: null,
        fertilizers: [{ name: 'NPK', quantity: 2, unit: 'kg/acre' }],
      },
    };

    const result = resolveVoiceLogTurn({
      transcript: 'update fertigation',
      farms: FARMS,
      contextFarm: FARMS[0],
      originContext: 'farm',
      activeDraft: draft,
      llmExtraction: emptyExtraction({
        intent: 'log_activity',
        activityType: 'fertigation',
        fertigation: {
          waterVolume: null,
          fertilizers: [{ name: 'NPK', quantity: null, unit: null }],
        },
      }),
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.draft.fertigation.fertilizers[0]).toEqual({
      name: 'NPK',
      quantity: 2,
      unit: 'kg/acre',
    });
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

  it('parses expense amount with Indian-style commas', () => {
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
      transcript: '₹1,200',
      farms: FARMS,
      contextFarm: FARMS[0],
      originContext: 'farm',
      activeDraft: draft,
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.draft.expense.cost).toBe(1200);
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

  it('attempts LLM extraction for all non-empty text inputs', () => {
    expect(shouldAttemptVoiceLogExtraction('What is weather today?', false)).toBe(true);
    expect(shouldAttemptVoiceLogExtraction('log spray 200 liters', false)).toBe(true);
    expect(
      shouldAttemptVoiceLogExtraction('How many irrigation hours did we log today?', false),
    ).toBe(true);
    expect(shouldAttemptVoiceLogExtraction('anything', true)).toBe(true);
    expect(shouldAttemptVoiceLogExtraction('   ', false)).toBe(false);
  });

  it('does not start logging flow for history-style irrigation question', () => {
    const result = resolveVoiceLogTurn({
      transcript: 'How many irrigation hours did we log today?',
      farms: FARMS,
      contextFarm: FARMS[0],
      originContext: 'farm',
      activeDraft: null,
    });

    expect(result.kind).toBe('none');
  });
});
