import {
  classifyIntent,
  buildClarification,
  checkUnsupportedIntent,
  computeAnswer,
  verbalizeAnswer,
} from '@/services/farm-assistant-service';
import type { Farm } from '@/types/database';
import type { QueryIntent, AssistantAnswer } from '@/types/voice-assistant';

const FARMS = [
  { id: 1, name: 'Farm A' },
  { id: 2, name: 'Green Valley' },
] as Farm[];

const NO_FARMS: Farm[] = [] as Farm[];

function makeIntent(overrides: Partial<QueryIntent> = {}): QueryIntent {
  return {
    category: 'spray',
    queryType: 'history',
    timeRange: null,
    farmName: null,
    farmId: null,
    confidence: 0.4,
    rawTranscript: '',
    ...overrides,
  };
}

// ============================================================
// 1. Intent Classification
// ============================================================

describe('classifyIntent', () => {
  describe('category detection', () => {
    it.each([
      ['What spray did I do last month?', 'spray'],
      ['Which chemical did I spray?', 'spray'],
      ['pesticide used', 'spray'],
      ['पिछले महीने स्प्रे क्या किया?', 'spray'],
      ['मागील महिन्यात फवारणी काय केली?', 'spray'],
      ['How many hours did I irrigate?', 'irrigation'],
      ['watering last week', 'irrigation'],
      ['इस महीने सिंचाई कितनी हुई?', 'irrigation'],
      ['या महिन्यात पाणी किती दिले?', 'irrigation'],
      ['fertilizer this season', 'fertigation'],
      ['What nutrients did I use?', 'fertigation'],
      ['इस सीजन उर्वरक कितना दिया?', 'fertigation'],
      ['या हंगामात खत किती दिले?', 'fertigation'],
      ['How much did I spend?', 'expense'],
      ['total cost this month', 'expense'],
      ['इस महीने कितना खर्च हुआ?', 'expense'],
      ['या महिन्यात किती खर्च झाला?', 'expense'],
    ])('"%s" → category: %s', (transcript, expected) => {
      const intent = classifyIntent(transcript, NO_FARMS);
      expect(intent.category).toBe(expected);
    });

    it('returns null category for unknown input', () => {
      expect(classifyIntent('How is the weather?', NO_FARMS).category).toBeNull();
    });

    it('returns null category for empty transcript', () => {
      expect(classifyIntent('', NO_FARMS).category).toBeNull();
    });
  });

  // ============================================================
  // 2. Query Type Detection
  // ============================================================

  describe('query type detection', () => {
    it('"total irrigation" → queryType: total', () => {
      expect(classifyIntent('total irrigation', NO_FARMS).queryType).toBe('total');
    });

    it('"how many sprays" → queryType: total', () => {
      expect(classifyIntent('how many sprays', NO_FARMS).queryType).toBe('total');
    });

    it('"इस महीने कुल सिंचाई" → queryType: total', () => {
      expect(classifyIntent('इस महीने कुल सिंचाई', NO_FARMS).queryType).toBe('total');
    });

    it('"या महिन्यात एकूण सिंचन" → queryType: total', () => {
      expect(classifyIntent('या महिन्यात एकूण सिंचन', NO_FARMS).queryType).toBe('total');
    });

    it('"last spray" → queryType: last', () => {
      expect(classifyIntent('last spray', NO_FARMS).queryType).toBe('last');
    });

    it('"आखिरी स्प्रे" → queryType: last', () => {
      expect(classifyIntent('आखिरी स्प्रे', NO_FARMS).queryType).toBe('last');
    });

    it('"शेवटची फवारणी" → queryType: last', () => {
      expect(classifyIntent('शेवटची फवारणी', NO_FARMS).queryType).toBe('last');
    });

    it('"last month spray" should NOT be queryType last', () => {
      expect(classifyIntent('last month spray', NO_FARMS).queryType).not.toBe('last');
    });

    it('"last week irrigation" should NOT be queryType last', () => {
      expect(classifyIntent('last week irrigation', NO_FARMS).queryType).not.toBe('last');
    });

    it('"previous month spray" should NOT be queryType last', () => {
      expect(classifyIntent('previous month spray', NO_FARMS).queryType).not.toBe('last');
    });

    it('"previous record" → queryType: last', () => {
      expect(classifyIntent('previous record', NO_FARMS).queryType).toBe('last');
    });

    it('"most recent irrigation" → queryType: last', () => {
      expect(classifyIntent('most recent irrigation', NO_FARMS).queryType).toBe('last');
    });

    it('"spray history" → queryType: history (default)', () => {
      expect(classifyIntent('spray history', NO_FARMS).queryType).toBe('history');
    });
  });

  // ============================================================
  // 3. Time Range Parsing (via classifyIntent)
  // ============================================================

  describe('time range parsing', () => {
    const fixedNow = new Date('2026-02-10T00:00:00Z');

    beforeAll(() => {
      jest.useFakeTimers().setSystemTime(fixedNow);
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('"spray last week" → timeRange ~6 days ago (inclusive 7-day window)', () => {
      const intent = classifyIntent('spray last week', NO_FARMS);
      expect(intent.timeRange).not.toBeNull();
      const now = new Date();
      const daysDiff = (now.getTime() - intent.timeRange!.start.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeCloseTo(6, 0);
    });

    it('"spray last month" → timeRange covers previous calendar month', () => {
      const intent = classifyIntent('spray last month', NO_FARMS);
      expect(intent.timeRange).not.toBeNull();
      const now = new Date();
      const expectedStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      expect(intent.timeRange!.start.getFullYear()).toBe(expectedStart.getFullYear());
      expect(intent.timeRange!.start.getMonth()).toBe(expectedStart.getMonth());
      expect(intent.timeRange!.start.getDate()).toBe(1);
    });

    it('"spray this month" → timeRange starts from 1st of current month', () => {
      const intent = classifyIntent('spray this month', NO_FARMS);
      expect(intent.timeRange).not.toBeNull();
      const now = new Date();
      expect(intent.timeRange!.start.getMonth()).toBe(now.getMonth());
      expect(intent.timeRange!.start.getDate()).toBe(1);
    });

    it('"इस महीने सिंचाई" → timeRange starts from 1st of current month', () => {
      const intent = classifyIntent('इस महीने सिंचाई', NO_FARMS);
      expect(intent.timeRange).not.toBeNull();
      const now = new Date();
      expect(intent.timeRange!.start.getMonth()).toBe(now.getMonth());
      expect(intent.timeRange!.start.getDate()).toBe(1);
    });

    it('"या महिन्यात फवारणी" → timeRange starts from 1st of current month', () => {
      const intent = classifyIntent('या महिन्यात फवारणी', NO_FARMS);
      expect(intent.timeRange).not.toBeNull();
      const now = new Date();
      expect(intent.timeRange!.start.getMonth()).toBe(now.getMonth());
      expect(intent.timeRange!.start.getDate()).toBe(1);
    });

    it('"spray this season" → timeRange starts from Jan 1', () => {
      const intent = classifyIntent('spray this season', NO_FARMS);
      expect(intent.timeRange).not.toBeNull();
      const now = new Date();
      expect(intent.timeRange!.start.getFullYear()).toBe(now.getFullYear());
      expect(intent.timeRange!.start.getMonth()).toBe(0);
      expect(intent.timeRange!.start.getDate()).toBe(1);
    });

    it('"spray this year" → timeRange starts from Jan 1', () => {
      const intent = classifyIntent('spray this year', NO_FARMS);
      expect(intent.timeRange).not.toBeNull();
      expect(intent.timeRange!.start.getMonth()).toBe(0);
      expect(intent.timeRange!.start.getDate()).toBe(1);
    });

    it('"spray in January" → timeRange covers January', () => {
      const intent = classifyIntent('spray in January', NO_FARMS);
      expect(intent.timeRange).not.toBeNull();
      expect(intent.timeRange!.start.getMonth()).toBe(0);
      expect(intent.timeRange!.start.getDate()).toBe(1);
      expect(intent.timeRange!.end.getMonth()).toBe(0);
    });

    it('"spray in August" → timeRange covers August', () => {
      const intent = classifyIntent('spray in August', NO_FARMS);
      expect(intent.timeRange).not.toBeNull();
      expect(intent.timeRange!.start.getMonth()).toBe(7);
      expect(intent.timeRange!.end.getMonth()).toBe(7);
    });

    it('no time keywords → timeRange: null', () => {
      expect(classifyIntent('spray', NO_FARMS).timeRange).toBeNull();
    });
  });

  // ============================================================
  // 4. Farm Name Matching
  // ============================================================

  describe('farm name matching', () => {
    it('"spray on Farm A" → farmName: Farm A, farmId: 1', () => {
      const intent = classifyIntent('spray on Farm A', FARMS);
      expect(intent.farmName).toBe('Farm A');
      expect(intent.farmId).toBe(1);
    });

    it('"irrigation at green valley" → case-insensitive match', () => {
      const intent = classifyIntent('irrigation at green valley', FARMS);
      expect(intent.farmName).toBe('Green Valley');
      expect(intent.farmId).toBe(2);
    });

    it('"spray last month" (no farm mentioned) → farmName: null', () => {
      const intent = classifyIntent('spray last month', FARMS);
      expect(intent.farmName).toBeNull();
    });
  });

  // ============================================================
  // 5. Confidence Scoring
  // ============================================================

  describe('confidence scoring', () => {
    it('all signals → confidence: 1.0', () => {
      const intent = classifyIntent('total irrigation last week on Farm A', FARMS);
      expect(intent.confidence).toBe(1.0);
    });

    it('category only → confidence: 0.4', () => {
      expect(classifyIntent('spray', NO_FARMS).confidence).toBe(0.4);
    });

    it('unknown → confidence: 0', () => {
      expect(classifyIntent('hello', NO_FARMS).confidence).toBe(0);
    });
  });
});

// ============================================================
// 6. Clarification
// ============================================================

describe('buildClarification', () => {
  it('low confidence + no category → asks "What would you like to know about?"', () => {
    const intent = makeIntent({ category: null, confidence: 0 });
    const result = buildClarification(intent);
    expect(result).not.toBeNull();
    expect(result!.question).toBe('What would you like to know about?');
    expect(result!.options.length).toBeGreaterThan(0);
  });

  it('low confidence + category but no timeRange → asks "For which time period?"', () => {
    const intent = makeIntent({ category: 'spray', confidence: 0.4, timeRange: null });
    const result = buildClarification(intent);
    expect(result).not.toBeNull();
    expect(result!.question).toBe('For which time period?');
  });

  it('confidence >= 0.6 → returns null', () => {
    const intent = makeIntent({
      confidence: 0.8,
      timeRange: { start: new Date(), end: new Date() },
    });
    expect(buildClarification(intent)).toBeNull();
  });
});

// ============================================================
// 7. Unsupported Intent
// ============================================================

describe('checkUnsupportedIntent', () => {
  it('"What should I spray next?" → close_but_unsupported', () => {
    const result = checkUnsupportedIntent('What should I spray next?');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('close_but_unsupported');
    expect(result!.suggestion).toBeTruthy();
  });

  it('"Log 2 hours irrigation" → close_but_unsupported', () => {
    const result = checkUnsupportedIntent('Log 2 hours irrigation');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('close_but_unsupported');
  });

  it('"recommend a fertilizer" → close_but_unsupported', () => {
    const result = checkUnsupportedIntent('recommend a fertilizer');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('close_but_unsupported');
  });

  it('"How is my crop doing?" → close_but_unsupported', () => {
    const result = checkUnsupportedIntent('How is my crop doing?');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('close_but_unsupported');
  });

  it('"show spray log for last month" → null (supported read query)', () => {
    expect(checkUnsupportedIntent('show spray log for last month')).toBeNull();
  });

  it('"total irrigation this month" → null (supported)', () => {
    expect(checkUnsupportedIntent('total irrigation this month')).toBeNull();
  });
});

// ============================================================
// 8. computeAnswer — Local Aggregation
// ============================================================

describe('computeAnswer', () => {
  const farmNames = new Map([[1, 'Farm A']]);

  it('spray history → rows with 2 entries', () => {
    const records: Record<string, unknown>[] = [
      { date: '2025-01-15', chemical: 'Mancozeb', dose: '2g/L', farm_id: 1 },
      { date: '2025-01-10', chemical: 'Carbendazim', dose: '1g/L', farm_id: 1 },
    ];
    const intent = makeIntent({ category: 'spray', queryType: 'history' });
    const answer = computeAnswer(intent, records, farmNames);
    expect(answer.rows).toHaveLength(2);
    expect(answer.summary.value).toBe(2);
    expect(answer.summary.label).toContain('records found');
  });

  it('irrigation total → summary.value = 5.5 hours', () => {
    const records: Record<string, unknown>[] = [
      { date: '2025-01-15', duration: 2.5, farm_id: 1 },
      { date: '2025-01-10', duration: 3.0, farm_id: 1 },
    ];
    const intent = makeIntent({ category: 'irrigation', queryType: 'total' });
    const answer = computeAnswer(intent, records, farmNames);
    expect(answer.summary.value).toBe(5.5);
    expect(answer.summary.unit).toBe('hours');
  });

  it('expense total → summary.value = 4000, unit = ₹', () => {
    const records: Record<string, unknown>[] = [
      { date: '2025-01-15', type: 'spray', cost: 1500, farm_id: 1 },
      { date: '2025-01-10', type: 'irrigation', cost: 2500, farm_id: 1 },
    ];
    const intent = makeIntent({ category: 'expense', queryType: 'total' });
    const answer = computeAnswer(intent, records, farmNames);
    expect(answer.summary.value).toBe(4000);
    expect(answer.summary.unit).toBe('₹');
  });

  it('fertigation history → rows[0].primary contains fertilizer name', () => {
    const records: Record<string, unknown>[] = [
      { date: '2025-01-15', fertilizers: [{ name: 'Urea', quantity: 5, unit: 'kg' }], farm_id: 1 },
    ];
    const intent = makeIntent({ category: 'fertigation', queryType: 'history' });
    const answer = computeAnswer(intent, records, farmNames);
    expect(answer.rows[0].primary).toContain('Urea');
  });

  it('last query type → returns only 1 row', () => {
    const records: Record<string, unknown>[] = [
      { date: '2025-01-15', chemical: 'Mancozeb', dose: '2g/L', farm_id: 1 },
      { date: '2025-01-10', chemical: 'Carbendazim', dose: '1g/L', farm_id: 1 },
    ];
    const intent = makeIntent({ category: 'spray', queryType: 'last' });
    const answer = computeAnswer(intent, records, farmNames);
    expect(answer.rows).toHaveLength(1);
  });

  it('empty records → No records found', () => {
    const intent = makeIntent({ category: 'spray', queryType: 'history' });
    const answer = computeAnswer(intent, [], farmNames);
    expect(answer.summary.label).toBe('No records found');
    expect(answer.rows).toHaveLength(0);
    expect(answer.totalRecordCount).toBe(0);
  });

  it('caps display rows at 5 but preserves totalRecordCount', () => {
    const records: Record<string, unknown>[] = Array.from({ length: 10 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, '0')}`,
      chemical: `Chem${i}`,
      dose: '1g/L',
      farm_id: 1,
    }));
    const intent = makeIntent({ category: 'spray', queryType: 'history' });
    const answer = computeAnswer(intent, records, farmNames);
    expect(answer.rows).toHaveLength(5);
    expect(answer.totalRecordCount).toBe(10);
  });
});

// ============================================================
// 9. verbalizeAnswer — Graceful Fallback
// ============================================================

describe('verbalizeAnswer', () => {
  const baseAnswer: AssistantAnswer = {
    category: 'spray',
    queryType: 'history',
    summary: { label: 'Spray records found', value: 2 },
    rows: [{ date: '2025-01-15', primary: 'Mancozeb', secondary: '2g/L', farmName: 'Farm A' }],
    timeRange: { start: new Date('2025-01-01'), end: new Date('2025-01-31') },
    farmFilter: null,
    totalRecordCount: 2,
  };

  it('returns deterministic local phrasing for non-empty answers', async () => {
    const result = await verbalizeAnswer(baseAnswer, 'en');
    expect(result).toBeTruthy();
    expect(result).toContain('Found');
  });

  it('returns undefined for empty records', async () => {
    const emptyAnswer: AssistantAnswer = {
      ...baseAnswer,
      rows: [],
      totalRecordCount: 0,
      summary: { label: 'No records found', value: 0 },
    };
    const result = await verbalizeAnswer(emptyAnswer, 'en');
    expect(result).toBeUndefined();
  });
});
