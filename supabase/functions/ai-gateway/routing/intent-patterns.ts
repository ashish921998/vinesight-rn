/**
 * Intent Patterns Module
 * Voice log and history-query pattern matching, text utilities, parsing helpers,
 * and getVoiceLogMissingFields.
 */

import type {
  VoiceLogActivityType,
  VoiceLogDraft,
  VoiceLogMissingField,
  QueryIntent,
} from './types.ts';

// ============================================================
// MARK: - Constants
// ============================================================

export const LOG_INTENT_MIN_CONFIDENCE = 0.55;
export const QUERY_INTENT_MIN_CONFIDENCE = 0.55;
export const ADVISORY_INTENT_MIN_CONFIDENCE = 0.6;
export const ROUTE_MARGIN = 0.1;
export const MAX_EXPENSE_AMOUNT = 10000000;
export const MAX_HARVEST_QUANTITY_KG = 100000;
export const MAX_WATER_VOLUME_LITERS = 1000000;
export const DEFAULT_CHEMICAL_UNIT = 'gm/L';
export const DEFAULT_FERTILIZER_UNIT = 'kg/acre';

// ============================================================
// MARK: - Pattern Matching
// ============================================================

interface VoicePatternSet {
  logAction: RegExp[];
  historyQuery: RegExp[];
  cancel: RegExp[];
  activities: Record<VoiceLogActivityType, RegExp[]>;
}

const ENGLISH_PATTERNS: VoicePatternSet = {
  logAction: [
    /\b(log|record|add|create|save|submit|enter)\b/i,
    /\b(i\s+want\s+to|let\s+me|please)\b/i,
  ],
  historyQuery: [
    /\bhow\s+many\b/i,
    /\bhow\s+much\b/i,
    /\bwhat\s+(did|was|were)\b/i,
    /\bshow\b/i,
    /\blist\b/i,
    /\btotal\b/i,
    /\bhistory\b/i,
    /\blast\b/i,
    /\blatest\b/i,
    /\bwhen\s+did\b/i,
    /\bdid\s+(i|we)\b/i,
  ],
  cancel: [/\bcancel\b/i, /\bstop\b/i, /\bnever\s*mind\b/i, /\bskip\b/i],
  activities: {
    irrigation: [/\birrigat(e|ed|ion|ing)\b/i, /\bwater(ing|ed)?\b/i, /\bdrip\b/i],
    spray: [
      /\bspray(ed|ing)?\b/i,
      /\bchemical(s)?\b/i,
      /\bpesticide(s)?\b/i,
      /\bfungicide(s)?\b/i,
      /\binsecticide(s)?\b/i,
    ],
    harvest: [/\bharvest(ed|ing)?\b/i, /\bpick(ing|ed)?\b/i, /\bgrapes?\s+picked\b/i],
    expense: [
      /\bexpense(s)?\b/i,
      /\bcost(s|ed|ing)?\b/i,
      /\bspent?\b/i,
      /\bspending\b/i,
      /\bbill(s)?\b/i,
    ],
    fertigation: [
      /\bfertigat(e|ed|ion|ing)\b/i,
      /\bfertiliz(e|ed|er|ers|ing)\b/i,
      /\bfertilis(e|ed|er|ers|ing)\b/i,
      /\bnutrient(s)?\b/i,
    ],
  },
};

const HINDI_PATTERNS: VoicePatternSet = {
  logAction: [/लॉग/i, /रिकॉर्ड/i, /जोड़/i],
  historyQuery: [/कितना/i, /कितने/i, /कुल/i],
  cancel: [/रद्द/i, /बंद/i],
  activities: {
    irrigation: [/सिंचाई/i, /पानी/i],
    spray: [/स्प्रे/i, /छिड़काव/i],
    harvest: [/कटाई/i, /तोड़ाई/i],
    expense: [/खर्च/i, /लागत/i],
    fertigation: [/उर्वरक/i, /खाद/i, /फर्टिगेशन/i],
  },
};

const MARATHI_PATTERNS: VoicePatternSet = {
  logAction: [/नोंद/i, /नोंदव/i, /सेव/i],
  historyQuery: [/किती/i, /एकूण/i, /दाखव/i, /यादी/i, /शेवट/i, /माग(चा|ची|चे|च्या)/i, /कधी/i],
  cancel: [/थांब/i, /थांबा/i, /बंद/i],
  activities: {
    irrigation: [/पाणी/i, /ठिबक/i],
    spray: [/फवारणी/i],
    harvest: [/कापणी/i, /तोडणी/i],
    expense: [/खर्च/i, /किंमत/i],
    fertigation: [/खत/i],
  },
};

function mergePatternSets(...sets: VoicePatternSet[]): VoicePatternSet {
  const merged: VoicePatternSet = {
    logAction: [],
    historyQuery: [],
    cancel: [],
    activities: { irrigation: [], spray: [], harvest: [], expense: [], fertigation: [] },
  };
  for (const set of sets) {
    merged.logAction.push(...set.logAction);
    merged.historyQuery.push(...set.historyQuery);
    merged.cancel.push(...set.cancel);
    for (const key of Object.keys(merged.activities) as VoiceLogActivityType[]) {
      merged.activities[key].push(...set.activities[key]);
    }
  }
  return merged;
}

export const VOICE_PATTERNS = mergePatternSets(ENGLISH_PATTERNS, HINDI_PATTERNS, MARATHI_PATTERNS);

// ============================================================
// MARK: - Text Processing Utilities
// ============================================================

export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s\u0900-\u097f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function roundNumber(value: number): number {
  return Math.round(value * 100) / 100;
}

// ============================================================
// MARK: - Parsing Functions
// ============================================================

export function parseDurationHours(transcript: string): number | null {
  const text = transcript.trim();
  if (!text) return null;

  const numericOnlyMatch = text.match(/^(\d+(?:\.\d+)?)$/);
  if (numericOnlyMatch?.[1]) {
    const parsed = Number.parseFloat(numericOnlyMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 24) return roundNumber(parsed);
  }

  const hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*(hours?|hour|hrs?|hr|h|घंटे|घंटा|तास|तासे)/i);
  if (hoursMatch?.[1]) {
    const parsed = Number.parseFloat(hoursMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 24) return roundNumber(parsed);
  }

  const minutesMatch = text.match(/(\d+(?:\.\d+)?)\s*(minutes?|minute|mins?|min|m|मिनट|मिनिट)/i);
  if (minutesMatch?.[1]) {
    const parsed = Number.parseFloat(minutesMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) return roundNumber(parsed / 60);
  }

  if (/\bhalf\s+an?\s+hour\b/i.test(text)) return 0.5;

  const looseForMatch = text.match(/\bfor\s+(\d+(?:\.\d+)?)\b/i);
  if (looseForMatch?.[1]) {
    const parsed = Number.parseFloat(looseForMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 24) return roundNumber(parsed);
  }

  return null;
}

export function parseWaterVolume(transcript: string): number | null {
  const text = transcript.trim();
  if (!text) return null;

  const numericOnlyMatch = text.match(/^(\d+(?:\.\d+)?)$/);
  if (numericOnlyMatch?.[1]) {
    const parsed = Number.parseFloat(numericOnlyMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= MAX_WATER_VOLUME_LITERS)
      return roundNumber(parsed);
    return null;
  }

  const match = text.match(/(\d+(?:\.\d+)?)\s*(liters?|liter|litre|litres|l|एल|लीटर|लिटर)/i);
  if (!match?.[1]) return null;
  const parsed = Number.parseFloat(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_WATER_VOLUME_LITERS) return null;
  return roundNumber(parsed);
}

export function parseQuantityKg(transcript: string): number | null {
  const text = transcript.trim();
  if (!text) return null;

  const numericOnlyMatch = text.match(/^(\d+(?:\.\d+)?)$/);
  if (numericOnlyMatch?.[1]) {
    const parsed = Number.parseFloat(numericOnlyMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= MAX_HARVEST_QUANTITY_KG)
      return roundNumber(parsed);
    return null;
  }

  const match = text.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms?|किलो|किग्रा|किलोग्राम)/i);
  if (!match?.[1]) return null;
  const parsed = Number.parseFloat(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_HARVEST_QUANTITY_KG) return null;
  return roundNumber(parsed);
}

export function parseAmount(transcript: string): number | null {
  const text = transcript.trim();
  if (!text) return null;

  const rupeeMatch = text.match(/(?:₹|rs\.?|inr)\s*(\d[\d,]*(?:\.\d+)?)/i);
  const genericMatches = [...text.matchAll(/\b(\d[\d,]*(?:\.\d+)?)\b/g)];
  const genericMatch = genericMatches.length > 0 ? genericMatches[genericMatches.length - 1] : null;
  const picked = rupeeMatch?.[1] ?? genericMatch?.[1];
  if (!picked) return null;

  const parsed = Number.parseFloat(picked.replace(/,/g, ''));
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_EXPENSE_AMOUNT) return null;
  return roundNumber(parsed);
}

export const EXPENSE_TYPES = [
  'Equipment',
  'Fuel',
  'Seeds/Plants',
  'Packaging',
  'Transport',
  'Maintenance',
  'Other',
] as const;
export const HARVEST_GRADES = [
  'A',
  'B',
  'C',
  'Export Quality',
  'Premium',
  'Standard',
  'Reject',
] as const;

export function parseHarvestGrade(transcript: string): string | null {
  const normalized = normalizeText(transcript);
  if (!normalized) return null;

  if (/^[abc]$/i.test(normalized)) return normalized.toUpperCase();

  const explicitGradeMatch = normalized.match(/\b(?:grade\s*([abc])|([abc])\s*grade)\b/);
  if (explicitGradeMatch) {
    const rawGrade = explicitGradeMatch[1] ?? explicitGradeMatch[2];
    if (rawGrade) return rawGrade.toUpperCase();
  }

  for (const grade of HARVEST_GRADES) {
    const normalizedGrade = normalizeText(grade);
    if (normalizedGrade.length > 1 && normalized.includes(normalizedGrade)) return grade;
  }

  return null;
}

export function parseExpenseType(transcript: string): string | null {
  const normalized = normalizeText(transcript);
  if (!normalized) return null;

  for (const expenseType of EXPENSE_TYPES) {
    if (normalized.includes(normalizeText(expenseType))) return expenseType;
  }

  if (/diesel|petrol|gas|डीज़ल|डिझेल|पेट्रोल|गैस|इंधन/i.test(transcript)) return 'Fuel';
  if (/repair|service|मरम्मत|दुरुस्ती|सर्विस/i.test(transcript)) return 'Maintenance';
  if (/transport|truck|delivery|ट्रांसपोर्ट|ट्रक|वाहतूक/i.test(transcript)) return 'Transport';
  if (/seed|plant|बीज|बियाणे|पौधा|रोप/i.test(transcript)) return 'Seeds/Plants';
  if (/pack|पैकिंग|पॅकिंग/i.test(transcript)) return 'Packaging';

  return null;
}

export function parseLogDate(transcript: string): string | null {
  const now = new Date();
  const text = transcript.toLowerCase();
  const hasHindiKalToken = /(^|[\s,.;!?()[\]{}"'-])कल($|[\s,.;!?()[\]{}"'-])/u.test(transcript);
  const hasMarathiKaalToken = /(^|[\s,.;!?()[\]{}"'-])काल($|[\s,.;!?()[\]{}"'-])/u.test(transcript);

  if (/\b(yesterday)\b/i.test(text)) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return toLocalDateString(yesterday);
  }

  if (/\b(tomorrow)\b/i.test(text)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return toLocalDateString(tomorrow);
  }

  if (/\b(today)\b/i.test(text) || /आज/i.test(transcript)) return toLocalDateString(now);

  if (hasHindiKalToken || hasMarathiKaalToken) {
    const hasPastTense = /(की|किया|दिया|था|थे|थी|केला|केली|केले|दिला|दिली|झाला|झाली)/i.test(
      transcript,
    );
    const hasFutureTense = /(करूंगा|करूँगा|दूंगा|देऊंगा|होगा|करेन|देईन|करणार|करणार आहे|होईल)/i.test(
      transcript,
    );

    if (hasFutureTense && !hasPastTense) {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      return toLocalDateString(tomorrow);
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return toLocalDateString(yesterday);
  }

  return null;
}

// ============================================================
// MARK: - Detection Functions
// ============================================================

export function hasLoggingSignal(transcript: string): boolean {
  return VOICE_PATTERNS.logAction.some((pattern) => pattern.test(transcript));
}

export function isLikelyLogHistoryQuery(transcript: string): boolean {
  const text = transcript.trim();
  if (!text) return false;

  const hasQuerySignal = VOICE_PATTERNS.historyQuery.some((pattern) => pattern.test(text));
  if (!hasQuerySignal) return false;

  return (
    /\b(logged?|records?|entries|history|total|today|yesterday|this\s+week|this\s+month)\b/i.test(
      text,
    ) ||
    /नोंद|नोंदी|रेकॉर्ड|इतिहास|एकूण|आज|काल|आठवड|महिन/i.test(text) ||
    Boolean(detectActivityTypeFromText(text))
  );
}

export function detectActivityTypeFromText(transcript: string): VoiceLogActivityType | null {
  const ranked: VoiceLogActivityType[] = [
    'irrigation',
    'spray',
    'fertigation',
    'harvest',
    'expense',
  ];
  let bestType: VoiceLogActivityType | null = null;
  let bestScore = 0;

  for (const type of ranked) {
    const score = VOICE_PATTERNS.activities[type].reduce(
      (acc, pattern) => acc + (pattern.test(transcript) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return bestScore > 0 ? bestType : null;
}

// ============================================================
// MARK: - Voice Log Missing Fields
// ============================================================

/**
 * Get missing fields for a voice log draft
 */
export function getVoiceLogMissingFields(draft: VoiceLogDraft): VoiceLogMissingField[] {
  const missing: VoiceLogMissingField[] = [];

  if (draft.farmId === undefined || draft.farmId === null) missing.push('farm');

  switch (draft.type) {
    case 'irrigation': {
      if (!draft.irrigation.durationHours || draft.irrigation.durationHours <= 0)
        missing.push('duration');
      break;
    }
    case 'spray': {
      if (!draft.spray.waterVolume || draft.spray.waterVolume <= 0) missing.push('waterVolume');
      if (!draft.spray.chemicals.some((item) => item.name.trim() && (item.quantity ?? 0) > 0))
        missing.push('chemicals');
      break;
    }
    case 'harvest': {
      if (!draft.harvest.quantity || draft.harvest.quantity <= 0) missing.push('quantity');
      if (!draft.harvest.grade) missing.push('grade');
      break;
    }
    case 'expense': {
      if (!draft.expense.cost || draft.expense.cost <= 0) missing.push('cost');
      if (!draft.expense.expenseType) missing.push('expenseType');
      break;
    }
    case 'fertigation': {
      if (
        !draft.fertigation.fertilizers.some((item) => item.name.trim() && (item.quantity ?? 0) > 0)
      )
        missing.push('fertilizers');
      break;
    }
  }

  return missing;
}

// ============================================================
// MARK: - Re-export for score helpers
// ============================================================

/**
 * Score from deterministic query intent
 */
export function scoreFromDeterministicQueryIntent(intent: QueryIntent | null | undefined): number {
  if (!intent?.category) return 0;
  return Math.min(1, Math.max(0, intent.confidence));
}
