/**
 * ReadOnly Farm Assistant Service
 * Deterministic-first query engine: local classification → Supabase fetch → local aggregation → local phrasing
 */
import { supabase } from '@/lib/supabase';
import { requireUserId } from '@/lib/auth-utils';
import i18n from '@/i18n';
import { TABLES } from '@/types/database';
import type { Farm } from '@/types/database';
import type {
  IntentCategory,
  QueryType,
  QueryIntent,
  AssistantAnswer,
  AssistantAnswerRow,
  ClarificationPrompt,
  UnsupportedIntentResponse,
} from '@/types/voice-assistant';
import type { SupportedLanguageCode } from '@/i18n/languages';

// ============================================================
// MARK: - Constants
// ============================================================

const HISTORY_RECORD_LIMIT = 50;
const LAST_RECORD_LIMIT = 1;
const TOTAL_QUERY_PAGE_SIZE = 500;
const MAX_TOTAL_RECORDS = 10_000; // Safety guard to prevent OOM on mobile
const MAX_DISPLAY_ROWS = 5;
const CONFIDENCE_THRESHOLD = 0.6;

// ============================================================
// MARK: - Keyword Maps
// ============================================================

const CATEGORY_PATTERNS: Array<{ category: IntentCategory; patterns: RegExp[] }> = [
  {
    category: 'spray',
    patterns: [
      /\bspray(ed|ing|s)?\b/i,
      /\bchemical(s)?\b/i,
      /\bpesticide(s)?\b/i,
      /\bfungicide(s)?\b/i,
      /\binsecticide(s)?\b/i,
      /\btreatment(s)?\b/i,
      /स्प्रे/i,
      /छिड़काव/i,
      /फवारणी/i,
      /कीटनाशक/i,
      /बुरशीनाशक/i,
    ],
  },
  {
    category: 'irrigation',
    patterns: [
      /\birrigat(e|ed|ion|ing)\b/i,
      /\bwater(ed|ing)?\b/i,
      /\bdrip\b/i,
      /सिंचाई/i,
      /पानी/i,
      /पाणी/i,
      /ठिबक/i,
    ],
  },
  {
    category: 'fertigation',
    patterns: [
      /\bfertigat(e|ed|ion|ing)\b/i,
      /\bfertiliz(e|ed|er|ers|ing)\b/i,
      /\bfertilis(e|ed|er|ers|ing)\b/i,
      /\bnutrient(s)?\b/i,
      /\bmanure\b/i,
      /उर्वरक/i,
      /खाद/i,
      /खत/i,
      /फर्टिगेशन/i,
      /खते/i,
      /पोषक/i,
    ],
  },
  {
    category: 'expense',
    patterns: [
      /\bexpense(s)?\b/i,
      /\bspend(ing|t)?\b/i,
      /\bcost(s|ed|ing)?\b/i,
      /\bmoney\b/i,
      /\bbudget\b/i,
      /\bbill(s|ed)?\b/i,
      /\bhow much\b.*\b(did|have|was)\b/i,
      /खर्च/i,
      /लागत/i,
      /किंमत/i,
      /पैस/i,
    ],
  },
];

const QUERY_TYPE_PATTERNS: Array<{ queryType: QueryType; patterns: RegExp[] }> = [
  {
    queryType: 'total',
    patterns: [
      /\btotal\b/i,
      /\bhow many\b/i,
      /\bhow much\b/i,
      /\bsum\b/i,
      /\baggregate\b/i,
      /\ball\b/i,
      /कुल/i,
      /एकूण/i,
      /जमा/i,
      /योग/i,
      /कितना/i,
      /कितने/i,
      /किती/i,
    ],
  },
  {
    queryType: 'last',
    patterns: [
      /\blast\b(?!\s+(week|month|year|season|january|february|march|april|may|june|july|august|september|october|november|december))/i,
      /\bmost recent\b/i,
      /\blatest\b/i,
      /\bprevious\s+(record|entry|one)\b/i,
      /आखिरी/i,
      /हालिया/i,
      /नवीनतम/i,
      /शेवटचा/i,
      /शेवटचे/i,
      /शेवटच/i,
      /अलीकडील/i,
    ],
  },
];

// Note: 'may' is excluded due to ambiguity with modal verb "may I..."
// It's handled separately with stricter context requirements
const MONTH_ENTRIES: Array<readonly [string, number]> = [
  ['january', 0],
  ['february', 1],
  ['march', 2],
  ['april', 3],
  ['june', 5],
  ['july', 6],
  ['august', 7],
  ['september', 8],
  ['october', 9],
  ['november', 10],
  ['december', 11],
  ['jan', 0],
  ['feb', 1],
  ['mar', 2],
  ['apr', 3],
  ['jun', 5],
  ['jul', 6],
  ['aug', 7],
  ['sep', 8],
  ['sept', 8],
  ['oct', 9],
  ['nov', 10],
  ['dec', 11],
  ['जनवरी', 0],
  ['फरवरी', 1],
  ['मार्च', 2],
  ['अप्रैल', 3],
  ['मई', 4],
  ['जून', 5],
  ['जुलाई', 6],
  ['अगस्त', 7],
  ['सितंबर', 8],
  ['अक्तूबर', 9],
  ['अक्टूबर', 9],
  ['नवंबर', 10],
  ['दिसम्बर', 11],
  ['दिसंबर', 11],
  ['जानेवारी', 0],
  ['फेब्रुवारी', 1],
  ['एप्रिल', 3],
  ['मे', 4],
  ['जुलै', 6],
  ['ऑगस्ट', 7],
  ['सप्टेंबर', 8],
  ['ऑक्टोबर', 9],
  ['नोव्हेंबर', 10],
  ['डिसेंबर', 11],
];

const MONTH_MAP: Record<string, number> = Object.fromEntries(MONTH_ENTRIES) as Record<
  string,
  number
>;

const CLOSE_BUT_UNSUPPORTED_PATTERNS: Array<{
  pattern: RegExp;
  messageKey: string;
  defaultMessage: string;
  suggestionKey: string;
  defaultSuggestion: string;
}> = [
  {
    pattern: /\bwhat should (i|we)\b.*\bspray\b/i,
    messageKey: 'farmAssistant.errors.unsupportedMessages.sprayRecommendation',
    defaultMessage: "I can't recommend sprays, but I can show your last spray if you want.",
    suggestionKey: 'farmAssistant.errors.unsupportedSuggestions.showLastSpray',
    defaultSuggestion: 'Show my last spray',
  },
  {
    pattern:
      /\b(add|create|insert|update|delete)\b|\blog\b(?=\s+(?:\d|an?\b|new\b|today\b|yesterday\b|spray\b|irrigation\b|fertigation\b|expense\b))|\brecord\b(?=\s+(?:\d|an?\s+new|new\b))/i,
    messageKey: 'farmAssistant.errors.unsupportedMessages.recordCreation',
    defaultMessage: "I can't create records, but I can show your recent history.",
    suggestionKey: 'farmAssistant.errors.unsupportedSuggestions.showRecentHistory',
    defaultSuggestion: 'Show recent history',
  },
  {
    pattern: /\b(recommend|suggest|should|advice|predict)\b/i,
    messageKey: 'farmAssistant.errors.unsupportedMessages.recommendation',
    defaultMessage: "I can't give recommendations, but I can show your farm history.",
    suggestionKey: 'farmAssistant.errors.unsupportedSuggestions.showRecentActivity',
    defaultSuggestion: 'Show recent activity',
  },
  {
    pattern: /\bhow is\b.*\b(crop|farm|plant|vine)\b/i,
    messageKey: 'farmAssistant.errors.unsupportedMessages.cropHealth',
    defaultMessage:
      'I can help with spray, irrigation, fertilizer, or expense history. Try asking about one of those.',
    suggestionKey: 'farmAssistant.errors.unsupportedSuggestions.askSprayLastMonth',
    defaultSuggestion: 'What spray did I do last month?',
  },
];

// ============================================================
// MARK: - Intent Classification
// ============================================================

export function classifyIntent(transcript: string, farms: Farm[]): QueryIntent {
  const text = transcript.toLowerCase().trim();
  let confidence = 0;

  let category: IntentCategory | null = null;
  for (const { category: cat, patterns } of CATEGORY_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        category = cat;
        confidence += 0.4;
        break;
      }
    }
    if (category) break;
  }

  let queryType: QueryType = 'history';
  for (const { queryType: qt, patterns } of QUERY_TYPE_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        queryType = qt;
        confidence += 0.2;
        break;
      }
    }
    if (queryType !== 'history') break;
  }

  const timeRange = parseTimeRange(text);
  if (timeRange) {
    confidence += 0.2;
  }

  let farmName: string | null = null;
  let farmId: number | null = null;
  for (const farm of farms) {
    if (farm.name && text.includes(farm.name.toLowerCase())) {
      farmName = farm.name;
      farmId = farm.id ?? null;
      confidence += 0.2;
      break;
    }
  }

  confidence = Math.min(confidence, 1);

  return {
    category,
    queryType,
    timeRange,
    farmName,
    farmId,
    confidence,
    rawTranscript: transcript,
  };
}

// ============================================================
// MARK: - Time Range Parsing
// ============================================================

function parseTimeRange(text: string): { start: Date; end: Date } | null {
  const now = new Date();

  if (/\btoday\b/i.test(text) || /आज/i.test(text) || /आजच/i.test(text)) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (
    /\byesterday\b/i.test(text) ||
    /कल/i.test(text) ||
    /\bkal\b/i.test(text) ||
    /काल/i.test(text)
  ) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - 1);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (
    /\blast\s+week\b/i.test(text) ||
    /पिछले?\s+(हफ्ते|सप्ताह)/i.test(text) ||
    /(मागच्या|गेल्या)\s+आठवड/i.test(text)
  ) {
    const start = new Date(now);
    // Inclusive date filters are used downstream, so use a 7-day window including today.
    start.setDate(start.getDate() - 6);
    return { start, end: now };
  }

  if (
    /\bthis\s+week\b/i.test(text) ||
    /इस\s+(हफ्ते|सप्ताह)/i.test(text) ||
    /(या|ह्या)\s+आठवड/i.test(text)
  ) {
    const start = new Date(now);
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }

  if (
    /\blast\s+month\b/i.test(text) ||
    /पिछले?\s+महीने/i.test(text) ||
    /(मागच्या|गेल्या|मागील)\s+महिन/i.test(text)
  ) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { start, end };
  }

  if (
    /\bthis\s+month\b/i.test(text) ||
    /इस\s+महीने/i.test(text) ||
    /(या|ह्या)\s+महिन/i.test(text)
  ) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: now };
  }

  if (
    /\bthis\s+(season|year)\b/i.test(text) ||
    /इस\s+(सीजन|मौसम|साल|वर्ष)/i.test(text) ||
    /(या|ह्या)\s+(हंगाम|वर्ष)/i.test(text)
  ) {
    const start = new Date(now.getFullYear(), 0, 1);
    return { start, end: now };
  }

  if (
    /\blast\s+(season|year)\b/i.test(text) ||
    /पिछले?\s+(सीजन|मौसम|साल|वर्ष)/i.test(text) ||
    /(गेल्या|मागील)\s+(हंगाम|वर्ष)/i.test(text)
  ) {
    const start = new Date(now.getFullYear() - 1, 0, 1);
    const end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
    return { start, end };
  }

  // Special handling for 'may' - require explicit temporal context to avoid
  // matching modal verb usage (e.g., "may I see...", "you may check...")
  // Valid patterns: "in may", "may 2024", "may 15th", "last may", "this may"
  const mayPattern =
    /(?:^|\s)(?:in\s+|last\s+|this\s+|में\s+|मध्ये\s+)may(?:\s+(?:\d{1,2}(?:st|nd|rd|th)?|\d{4})|\s*$|[,.?!])/i;
  if (mayPattern.test(text)) {
    const monthIndex = 4; // May is index 4
    const year = monthIndex > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59);
    return { start, end };
  }

  const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const [monthName, monthIndex] of Object.entries(MONTH_MAP)) {
    const pattern = new RegExp(
      `(?:^|\\s)(?:in\\s+|में\\s+|मध्ये\\s+)?${escapeRegExp(monthName)}(?=\\s|$|[,.?!])`,
      'i',
    );
    if (pattern.test(text)) {
      const year = monthIndex > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
      const start = new Date(year, monthIndex, 1);
      const end = new Date(year, monthIndex + 1, 0, 23, 59, 59);
      return { start, end };
    }
  }

  return null;
}

// ============================================================
// MARK: - Clarification
// ============================================================

export function buildClarification(
  intent: QueryIntent,
  language?: SupportedLanguageCode,
): ClarificationPrompt | null {
  const t = i18n.getFixedT(language ?? i18n.language);
  if (intent.confidence >= CONFIDENCE_THRESHOLD) return null;

  if (!intent.category) {
    return {
      question: t('farmAssistant.clarification.whatToKnow', {
        defaultValue: 'What would you like to know about?',
      }),
      options: [
        t('farmAssistant.clarification.sprayHistory', { defaultValue: 'Spray history' }),
        t('farmAssistant.clarification.irrigationHistory', { defaultValue: 'Irrigation history' }),
        t('farmAssistant.clarification.fertilizerHistory', { defaultValue: 'Fertilizer history' }),
        t('farmAssistant.clarification.expenseSummary', { defaultValue: 'Expense summary' }),
      ],
    };
  }

  if (!intent.timeRange) {
    return {
      question: t('farmAssistant.clarification.forWhichPeriod', {
        defaultValue: 'For which time period?',
      }),
      options: [
        t('farmAssistant.clarification.thisWeek', { defaultValue: 'This week' }),
        t('farmAssistant.clarification.thisMonth', { defaultValue: 'This month' }),
        t('farmAssistant.clarification.thisSeason', { defaultValue: 'This season' }),
        t('farmAssistant.clarification.lastMonth', { defaultValue: 'Last month' }),
      ],
    };
  }

  return null;
}

export function checkUnsupportedIntent(
  transcript: string,
  language?: SupportedLanguageCode,
): UnsupportedIntentResponse | null {
  const text = transcript.toLowerCase().trim();
  const t = i18n.getFixedT(language ?? i18n.language);

  for (const {
    pattern,
    messageKey,
    defaultMessage,
    suggestionKey,
    defaultSuggestion,
  } of CLOSE_BUT_UNSUPPORTED_PATTERNS) {
    if (pattern.test(text)) {
      return {
        type: 'close_but_unsupported',
        message: t(messageKey, { defaultValue: defaultMessage }),
        suggestion: t(suggestionKey, { defaultValue: defaultSuggestion }),
      };
    }
  }

  return null;
}

// ============================================================
// MARK: - Data Fetching
// ============================================================

async function getFarmNames(farmIds: number[]): Promise<Map<number, string>> {
  if (farmIds.length === 0) return new Map();
  const userId = await requireUserId();
  const { data } = await supabase
    .from(TABLES.FARMS)
    .select('id, name')
    .eq('user_id', userId)
    .in('id', farmIds);

  const map = new Map<number, string>();
  (data ?? []).forEach((f: { id: number; name: string }) => {
    map.set(f.id, f.name);
  });
  return map;
}

function formatDateForQuery(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function fetchRecordsForIntent(
  intent: QueryIntent,
): Promise<{ records: Record<string, unknown>[]; farmNames: Map<number, string> }> {
  const userId = await requireUserId();

  const buildBaseQuery = (table: string) => {
    let query = supabase.from(table).select('*, farms!inner(name)');

    query = query.eq('farms.user_id', userId);

    if (intent.farmId) {
      query = query.eq('farm_id', intent.farmId);
    }

    if (intent.timeRange) {
      const startStr = formatDateForQuery(intent.timeRange.start);
      const endStr = formatDateForQuery(intent.timeRange.end);
      query = query.gte('date', startStr).lte('date', endStr);
    }

    return query;
  };

  const fetchTotalRecords = async (table: string): Promise<Record<string, unknown>[]> => {
    let offset = 0;
    const allRecords: Record<string, unknown>[] = [];

    while (true) {
      const { data, error } = await buildBaseQuery(table)
        .order('date', { ascending: false })
        .range(offset, offset + TOTAL_QUERY_PAGE_SIZE - 1);

      if (error) throw error;

      const page = (data ?? []) as Record<string, unknown>[];
      allRecords.push(...page);

      // Safety guards: stop if page is incomplete or max records reached
      if (page.length < TOTAL_QUERY_PAGE_SIZE || allRecords.length >= MAX_TOTAL_RECORDS) {
        break;
      }

      offset += TOTAL_QUERY_PAGE_SIZE;
    }

    return allRecords;
  };

  let table: string;
  switch (intent.category) {
    case 'spray':
      table = TABLES.SPRAY_RECORDS;
      break;
    case 'irrigation':
      table = TABLES.IRRIGATION_RECORDS;
      break;
    case 'fertigation':
      table = TABLES.FERTIGATION_RECORDS;
      break;
    case 'expense':
      table = TABLES.EXPENSE_RECORDS;
      break;
    default:
      return { records: [], farmNames: new Map() };
  }

  let records: Record<string, unknown>[] = [];

  if (intent.queryType === 'total') {
    records = await fetchTotalRecords(table);
  } else {
    const limit = intent.queryType === 'last' ? LAST_RECORD_LIMIT : HISTORY_RECORD_LIMIT;
    const { data, error } = await buildBaseQuery(table)
      .order('date', { ascending: false })
      .limit(limit);
    if (error) throw error;
    records = (data ?? []) as Record<string, unknown>[];
  }

  const farmIds = [...new Set(records.map((r) => r.farm_id as number).filter(Boolean))];
  const farmNames = await getFarmNames(farmIds);

  return { records, farmNames };
}

// ============================================================
// MARK: - Local Aggregation
// ============================================================

export function computeAnswer(
  intent: QueryIntent,
  records: Record<string, unknown>[],
  farmNames: Map<number, string>,
): AssistantAnswer {
  if (!intent.category) {
    throw new Error('Intent category is required to compute an answer');
  }
  const category = intent.category;
  const now = new Date();
  const timeRange = intent.timeRange ?? { start: new Date(now.getFullYear(), 0, 1), end: now };

  if (records.length === 0) {
    return {
      category,
      queryType: intent.queryType,
      summary: { label: 'No records found', value: 0 },
      rows: [],
      timeRange,
      farmFilter: intent.farmName,
      totalRecordCount: 0,
    };
  }

  const rows = buildRows(category, records, farmNames);
  const summary = buildSummary(category, intent.queryType, records, rows);

  const displayRows =
    intent.queryType === 'last' ? rows.slice(0, 1) : rows.slice(0, MAX_DISPLAY_ROWS);

  return {
    category,
    queryType: intent.queryType,
    summary,
    rows: displayRows,
    timeRange,
    farmFilter: intent.farmName,
    totalRecordCount: records.length,
  };
}

function buildRows(
  category: IntentCategory,
  records: Record<string, unknown>[],
  farmNames: Map<number, string>,
): AssistantAnswerRow[] {
  switch (category) {
    case 'spray':
      return records.map((r) => ({
        date: String(r.date ?? ''),
        primary: String(r.chemical ?? 'Unknown'),
        secondary: String(r.dose ?? ''),
        farmName: farmNames.get(r.farm_id as number) ?? 'Unknown',
      }));

    case 'irrigation':
      return records.map((r) => ({
        date: String(r.date ?? ''),
        primary: `${r.duration ?? 0} hours`,
        secondary: r.growth_stage ? String(r.growth_stage) : undefined,
        farmName: farmNames.get(r.farm_id as number) ?? 'Unknown',
      }));

    case 'fertigation':
      return records.map((r) => {
        const fertilizers = r.fertilizers as Array<{
          name: string;
          quantity: number;
          unit: string;
        }> | null;
        const fertilizerStr = fertilizers
          ? fertilizers.map((f) => `${f.name} ${f.quantity}${f.unit}`).join(', ')
          : 'Unknown';
        return {
          date: String(r.date ?? ''),
          primary: fertilizerStr,
          farmName: farmNames.get(r.farm_id as number) ?? 'Unknown',
        };
      });

    case 'expense':
      return records.map((r) => ({
        date: String(r.date ?? ''),
        primary: String(r.type ?? 'other'),
        secondary: `₹${Number(r.cost ?? 0).toLocaleString()}`,
        farmName: farmNames.get(r.farm_id as number) ?? 'Unknown',
      }));

    default:
      return [];
  }
}

function buildSummary(
  category: IntentCategory,
  queryType: QueryType,
  records: Record<string, unknown>[],
  rows: AssistantAnswerRow[],
): AssistantAnswer['summary'] {
  if (queryType === 'last' && rows.length > 0) {
    const row = rows[0];
    return {
      label: `Last ${category}`,
      value: `${row.primary} on ${row.date}`,
    };
  }

  if (queryType === 'total') {
    switch (category) {
      case 'irrigation': {
        const totalHours = records.reduce((sum, r) => sum + Number(r.duration ?? 0), 0);
        return {
          label: 'Total irrigation',
          value: Math.round(totalHours * 100) / 100,
          unit: 'hours',
        };
      }
      case 'expense': {
        const totalCost = records.reduce((sum, r) => sum + Number(r.cost ?? 0), 0);
        return {
          label: 'Total expenses',
          value: Math.round(totalCost * 100) / 100,
          unit: '₹',
        };
      }
      case 'spray':
        return {
          label: 'Total spray applications',
          value: records.length,
        };
      case 'fertigation':
        return {
          label: 'Total fertigation applications',
          value: records.length,
        };
    }
  }

  return {
    label: `${category.charAt(0).toUpperCase() + category.slice(1)} records found`,
    value: records.length,
  };
}

// ============================================================
// MARK: - Verbalization (Local deterministic phrasing)
// ============================================================

export async function verbalizeAnswer(
  answer: AssistantAnswer,
  language: SupportedLanguageCode = 'en',
): Promise<string | undefined> {
  if (answer.totalRecordCount === 0) return undefined;

  const categoryLabel: Record<SupportedLanguageCode, Record<IntentCategory, string>> = {
    en: {
      spray: 'spray',
      irrigation: 'irrigation',
      fertigation: 'fertigation',
      expense: 'expense',
    },
    hi: {
      spray: 'स्प्रे',
      irrigation: 'सिंचाई',
      fertigation: 'फर्टिगेशन',
      expense: 'खर्च',
    },
    mr: {
      spray: 'फवारणी',
      irrigation: 'सिंचन',
      fertigation: 'फर्टिगेशन',
      expense: 'खर्च',
    },
  };

  const unitValue =
    answer.summary.unit && answer.summary.unit.startsWith('₹')
      ? `₹${Number(answer.summary.value).toLocaleString('en-IN')}`
      : `${answer.summary.value}${answer.summary.unit ? ` ${answer.summary.unit}` : ''}`;

  if (answer.queryType === 'last' && answer.rows[0]) {
    const latest = answer.rows[0];
    if (language === 'hi') {
      return `आपका आखिरी ${categoryLabel.hi[answer.category]} रिकॉर्ड ${latest.date} का है (${latest.primary})।`;
    }
    if (language === 'mr') {
      return `तुमची शेवटची ${categoryLabel.mr[answer.category]} नोंद ${latest.date} ची आहे (${latest.primary})।`;
    }
    return `Your latest ${categoryLabel.en[answer.category]} record is ${latest.primary} on ${latest.date}.`;
  }

  if (answer.queryType === 'total') {
    if (language === 'hi') {
      return `कुल ${categoryLabel.hi[answer.category]} ${unitValue} है। यह ${answer.totalRecordCount} रिकॉर्ड पर आधारित है।`;
    }
    if (language === 'mr') {
      return `एकूण ${categoryLabel.mr[answer.category]} ${unitValue} आहे। हे ${answer.totalRecordCount} नोंदींवर आधारित आहे।`;
    }
    return `Total ${categoryLabel.en[answer.category]} is ${unitValue}, based on ${answer.totalRecordCount} records.`;
  }

  if (language === 'hi') {
    return `${categoryLabel.hi[answer.category]} के ${answer.totalRecordCount} रिकॉर्ड मिले हैं।`;
  }
  if (language === 'mr') {
    return `${categoryLabel.mr[answer.category]}च्या ${answer.totalRecordCount} नोंदी मिळाल्या आहेत।`;
  }
  return `Found ${answer.totalRecordCount} ${categoryLabel.en[answer.category]} records.`;
}

// ============================================================
// MARK: - Main Query Pipeline
// ============================================================

export interface FarmAssistantResult {
  answer: AssistantAnswer;
}

export interface FarmAssistantRequestContext {
  transcript: string;
  farms: Farm[];
  language: SupportedLanguageCode;
}

export interface FarmAssistantIntentEngine {
  classify: (transcript: string, farms: Farm[]) => QueryIntent;
}

export interface FarmAssistantDataEngine {
  fetch: (
    intent: QueryIntent,
  ) => Promise<{ records: Record<string, unknown>[]; farmNames: Map<number, string> }>;
}

export interface FarmAssistantAnswerEngine {
  compute: (
    intent: QueryIntent,
    records: Record<string, unknown>[],
    farmNames: Map<number, string>,
  ) => AssistantAnswer;
  verbalize: (
    answer: AssistantAnswer,
    language: SupportedLanguageCode,
  ) => Promise<string | undefined>;
}

export interface FarmAssistantPipeline {
  run: (context: FarmAssistantRequestContext) => Promise<FarmAssistantResult>;
}

export interface FarmAssistantDependencies {
  intentEngine: FarmAssistantIntentEngine;
  dataEngine: FarmAssistantDataEngine;
  answerEngine: FarmAssistantAnswerEngine;
}

export function createFarmAssistantPipeline({
  intentEngine,
  dataEngine,
  answerEngine,
}: FarmAssistantDependencies): FarmAssistantPipeline {
  return {
    async run({
      transcript,
      farms,
      language,
    }: FarmAssistantRequestContext): Promise<FarmAssistantResult> {
      const intent = intentEngine.classify(transcript, farms);

      if (!intent.category) {
        throw new Error(
          'I can only help with spray, irrigation, fertigation, and expense history.',
        );
      }

      const { records, farmNames } = await dataEngine.fetch(intent);
      const answer = answerEngine.compute(intent, records, farmNames);

      const verbalizedText = await answerEngine.verbalize(answer, language);
      return {
        answer: verbalizedText ? { ...answer, verbalizedText } : answer,
      };
    },
  };
}

const defaultPipeline = createFarmAssistantPipeline({
  intentEngine: {
    classify: classifyIntent,
  },
  dataEngine: {
    fetch: fetchRecordsForIntent,
  },
  answerEngine: {
    compute: computeAnswer,
    verbalize: verbalizeAnswer,
  },
});

let activePipeline: FarmAssistantPipeline = defaultPipeline;

export function setFarmAssistantPipeline(pipeline: FarmAssistantPipeline | null): void {
  activePipeline = pipeline ?? defaultPipeline;
}

export function resetFarmAssistantPipeline(): void {
  activePipeline = defaultPipeline;
}

export async function executeQuery(
  transcript: string,
  farms: Farm[],
  language: SupportedLanguageCode = 'en',
): Promise<FarmAssistantResult> {
  return activePipeline.run({
    transcript,
    farms,
    language,
  });
}
