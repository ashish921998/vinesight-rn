import { EXPENSE_TYPES, HARVEST_GRADES } from '@/constants/calculator-models';
import type { Farm } from '@/types';
import type {
  ActivityLogExtractionResult,
  VoiceLogActivityType,
  VoiceLogDraft,
  VoiceLogFormPrefill,
  VoiceLogMissingField,
  VoiceLogOriginContext,
} from '@/types/voice-log';

export type VoiceLogTurnResult =
  | { kind: 'none' }
  | { kind: 'cancelled' }
  | {
      kind: 'clarify';
      draft: VoiceLogDraft;
      missingFields: VoiceLogMissingField[];
    }
  | {
      kind: 'ready';
      draft: VoiceLogDraft;
    };

interface ResolveVoiceLogTurnInput {
  transcript: string;
  farms: Farm[];
  contextFarm?: Farm | null;
  activeDraft?: VoiceLogDraft | null;
  originContext: VoiceLogOriginContext;
  llmExtraction?: ActivityLogExtractionResult | null;
}

const LOG_ACTION_PATTERNS = [
  /\b(log|record|add|create|save|submit|enter)\b/i,
  /\b(i\s+want\s+to|let\s+me|please)\b/i,
  /लॉग/i,
  /रिकॉर्ड/i,
  /जोड़/i,
  /नोंद/i,
  /नोंदव/i,
  /सेव/i,
];

const ACTIVITY_PATTERNS: Record<VoiceLogActivityType, RegExp[]> = {
  irrigation: [
    /\birrigat(e|ed|ion|ing)\b/i,
    /\bwater(ing|ed)?\b/i,
    /\bdrip\b/i,
    /सिंचाई/i,
    /पानी/i,
    /पाणी/i,
    /ठिबक/i,
  ],
  spray: [
    /\bspray(ed|ing)?\b/i,
    /\bchemical(s)?\b/i,
    /\bpesticide(s)?\b/i,
    /\bfungicide(s)?\b/i,
    /\binsecticide(s)?\b/i,
    /स्प्रे/i,
    /छिड़काव/i,
    /फवारणी/i,
  ],
  harvest: [
    /\bharvest(ed|ing)?\b/i,
    /\bpick(ing|ed)?\b/i,
    /\bgrapes?\s+picked\b/i,
    /कटाई/i,
    /तोड़ाई/i,
    /कापणी/i,
    /तोडणी/i,
  ],
  expense: [
    /\bexpense(s)?\b/i,
    /\bcost(s|ed|ing)?\b/i,
    /\bspent?\b/i,
    /\bspending\b/i,
    /\bbill(s)?\b/i,
    /खर्च/i,
    /लागत/i,
    /किंमत/i,
  ],
  fertigation: [
    /\bfertigat(e|ed|ion|ing)\b/i,
    /\bfertiliz(e|ed|er|ers|ing)\b/i,
    /\bfertilis(e|ed|er|ers|ing)\b/i,
    /\bnutrient(s)?\b/i,
    /उर्वरक/i,
    /खाद/i,
    /खत/i,
    /फर्टिगेशन/i,
  ],
};

const CANCEL_PATTERNS = [
  /\bcancel\b/i,
  /\bstop\b/i,
  /\bnever\s*mind\b/i,
  /\bskip\b/i,
  /रद्द/i,
  /थांब/i,
  /थांबा/i,
  /बंद/i,
];

const DEFAULT_CHEMICAL_UNIT = 'gm/L';
const DEFAULT_FERTILIZER_UNIT = 'kg/acre';

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s\u0900-\u097f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function roundNumber(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseDurationHours(transcript: string): number | null {
  const text = transcript.trim();
  if (!text) return null;

  const hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*(hours?|hour|hrs?|hr|h|घंटे|घंटा|तास|तासे)/i);
  if (hoursMatch?.[1]) {
    const parsed = Number.parseFloat(hoursMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 24) {
      return roundNumber(parsed);
    }
  }

  const minutesMatch = text.match(/(\d+(?:\.\d+)?)\s*(minutes?|minute|mins?|min|m|मिनट|मिनिट)/i);
  if (minutesMatch?.[1]) {
    const parsed = Number.parseFloat(minutesMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return roundNumber(parsed / 60);
    }
  }

  if (/\bhalf\s+an?\s+hour\b/i.test(text)) {
    return 0.5;
  }

  const looseForMatch = text.match(/\bfor\s+(\d+(?:\.\d+)?)\b/i);
  if (looseForMatch?.[1]) {
    const parsed = Number.parseFloat(looseForMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 24) {
      return roundNumber(parsed);
    }
  }

  return null;
}

function parseWaterVolume(transcript: string): number | null {
  const text = transcript.trim();
  if (!text) return null;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(liters?|liter|litre|litres|l|एल|लीटर|लिटर)/i);
  if (!match?.[1]) return null;
  const parsed = Number.parseFloat(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return roundNumber(parsed);
}

function parseQuantityKg(transcript: string): number | null {
  const text = transcript.trim();
  if (!text) return null;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms?|किलो|किग्रा|किलोग्राम)/i);
  if (!match?.[1]) return null;
  const parsed = Number.parseFloat(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return roundNumber(parsed);
}

function parseAmount(transcript: string): number | null {
  const text = transcript.trim();
  if (!text) return null;
  const rupeeMatch = text.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i);
  const genericMatch = text.match(/\b(\d+(?:\.\d+)?)\b/);
  const picked = rupeeMatch?.[1] ?? genericMatch?.[1];
  if (!picked) return null;
  const parsed = Number.parseFloat(picked);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return roundNumber(parsed);
}

function parseHarvestGrade(transcript: string): string | null {
  const normalized = normalizeText(transcript);
  if (!normalized) return null;

  if (/\bgrade\s*a\b/i.test(transcript) || /\b(?:^|\s)a(?:\s|$)\b/i.test(transcript)) return 'A';
  if (/\bgrade\s*b\b/i.test(transcript) || /\b(?:^|\s)b(?:\s|$)\b/i.test(transcript)) return 'B';
  if (/\bgrade\s*c\b/i.test(transcript) || /\b(?:^|\s)c(?:\s|$)\b/i.test(transcript)) return 'C';

  for (const grade of HARVEST_GRADES) {
    const normalizedGrade = normalizeText(grade);
    if (normalizedGrade.length <= 1) continue;
    if (normalized.includes(normalizedGrade)) {
      return grade;
    }
  }

  return null;
}

function parseExpenseType(transcript: string): string | null {
  const normalized = normalizeText(transcript);
  if (!normalized) return null;

  for (const expenseType of EXPENSE_TYPES) {
    if (normalized.includes(normalizeText(expenseType))) {
      return expenseType;
    }
  }

  if (/diesel|petrol|gas/i.test(transcript)) return 'Fuel';
  if (/repair|service/i.test(transcript)) return 'Maintenance';
  if (/transport|truck|delivery/i.test(transcript)) return 'Transport';
  if (/seed|plant/i.test(transcript)) return 'Seeds/Plants';
  if (/pack/i.test(transcript)) return 'Packaging';

  return null;
}

function parseLogDate(transcript: string): string | null {
  const now = new Date();
  const text = transcript.toLowerCase();

  if (/\b(yesterday)\b/i.test(text) || /कल/i.test(transcript)) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return toLocalDateString(yesterday);
  }

  if (/\b(today)\b/i.test(text) || /आज/i.test(transcript)) {
    return toLocalDateString(now);
  }

  return null;
}

function parseLogDateFromLLM(
  extraction: ActivityLogExtractionResult | null | undefined,
): string | null {
  if (!extraction) return null;
  if (extraction.dateIso && /^\d{4}-\d{2}-\d{2}$/.test(extraction.dateIso)) {
    return extraction.dateIso;
  }
  if (extraction.dateRelative === 'today') {
    return toLocalDateString(new Date());
  }
  if (extraction.dateRelative === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return toLocalDateString(yesterday);
  }
  return null;
}

function hasLoggingSignal(transcript: string): boolean {
  return LOG_ACTION_PATTERNS.some((pattern) => pattern.test(transcript));
}

function detectActivityTypeFromText(transcript: string): VoiceLogActivityType | null {
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
    const score = ACTIVITY_PATTERNS[type].reduce((acc, pattern) => {
      return acc + (pattern.test(transcript) ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return bestScore > 0 ? bestType : null;
}

function findFarmMatchesByName(name: string, farms: Farm[]): Farm[] {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return [];

  const normalizedNeedle = ` ${normalizedName} `;

  return farms.filter((farm) => {
    if (farm.id === undefined || farm.id === null) return false;
    const normalizedFarmName = normalizeText(farm.name);
    if (!normalizedFarmName) return false;
    const farmToken = ` ${normalizedFarmName} `;
    return (
      farmToken.includes(normalizedNeedle) ||
      normalizedNeedle.includes(farmToken) ||
      normalizedFarmName === normalizedName
    );
  });
}

function resolveFarmByName(name: string | null, farms: Farm[]): Farm | null {
  if (!name) return null;
  const matches = findFarmMatchesByName(name, farms);
  if (matches.length !== 1) return null;
  return matches[0] ?? null;
}

function resolveFarmFromText(transcript: string, farms: Farm[]): Farm | null {
  const normalizedTranscript = ` ${normalizeText(transcript)} `;
  if (!normalizedTranscript.trim()) return null;

  let bestMatch: Farm | null = null;
  let bestLength = 0;

  for (const farm of farms) {
    if (farm.id === undefined || farm.id === null) continue;
    const normalizedName = normalizeText(farm.name);
    if (!normalizedName) continue;

    const fullToken = ` ${normalizedName} `;
    if (normalizedTranscript.includes(fullToken) && normalizedName.length > bestLength) {
      bestLength = normalizedName.length;
      bestMatch = farm;
    }
  }

  return bestMatch;
}

function createEmptyDraft(
  type: VoiceLogActivityType,
  fallbackFarm: Farm | null,
  fallbackDate: string,
): VoiceLogDraft {
  return {
    type,
    farmId: fallbackFarm?.id ?? null,
    farmName: fallbackFarm?.name ?? null,
    date: fallbackDate,
    irrigation: {
      durationHours: null,
    },
    spray: {
      waterVolume: null,
      chemicals: [],
    },
    harvest: {
      quantity: null,
      grade: null,
      price: null,
      buyer: null,
    },
    expense: {
      cost: null,
      expenseType: null,
      remarks: null,
    },
    fertigation: {
      waterVolume: null,
      fertilizers: [],
    },
  };
}

function hasCompleteChemicals(draft: VoiceLogDraft): boolean {
  return draft.spray.chemicals.some((item) => item.name.trim() && (item.quantity ?? 0) > 0);
}

function hasCompleteFertilizers(draft: VoiceLogDraft): boolean {
  return draft.fertigation.fertilizers.some((item) => item.name.trim() && (item.quantity ?? 0) > 0);
}

export function getVoiceLogMissingFields(draft: VoiceLogDraft): VoiceLogMissingField[] {
  const missing: VoiceLogMissingField[] = [];

  if (draft.farmId === undefined || draft.farmId === null) {
    missing.push('farm');
  }

  switch (draft.type) {
    case 'irrigation': {
      if (!draft.irrigation.durationHours || draft.irrigation.durationHours <= 0) {
        missing.push('duration');
      }
      break;
    }
    case 'spray': {
      if (!draft.spray.waterVolume || draft.spray.waterVolume <= 0) {
        missing.push('waterVolume');
      }
      if (!hasCompleteChemicals(draft)) {
        missing.push('chemicals');
      }
      break;
    }
    case 'harvest': {
      if (!draft.harvest.quantity || draft.harvest.quantity <= 0) {
        missing.push('quantity');
      }
      if (!draft.harvest.grade) {
        missing.push('grade');
      }
      break;
    }
    case 'expense': {
      if (!draft.expense.cost || draft.expense.cost <= 0) {
        missing.push('cost');
      }
      if (!draft.expense.expenseType) {
        missing.push('expenseType');
      }
      break;
    }
    case 'fertigation': {
      if (!hasCompleteFertilizers(draft)) {
        missing.push('fertilizers');
      }
      break;
    }
  }

  return missing;
}

function mergeDraftFromLLM(
  draft: VoiceLogDraft,
  extraction: ActivityLogExtractionResult | null | undefined,
): VoiceLogDraft {
  if (!extraction) return draft;

  const merged: VoiceLogDraft = {
    ...draft,
    irrigation: { ...draft.irrigation },
    spray: { ...draft.spray, chemicals: [...draft.spray.chemicals] },
    harvest: { ...draft.harvest },
    expense: { ...draft.expense },
    fertigation: { ...draft.fertigation, fertilizers: [...draft.fertigation.fertilizers] },
  };

  if (extraction.irrigation.durationHours && extraction.irrigation.durationHours > 0) {
    merged.irrigation.durationHours = extraction.irrigation.durationHours;
  }

  if (extraction.spray.waterVolume && extraction.spray.waterVolume > 0) {
    merged.spray.waterVolume = extraction.spray.waterVolume;
  }

  if (extraction.spray.chemicals.length > 0) {
    merged.spray.chemicals = extraction.spray.chemicals;
  }

  if (extraction.harvest.quantity && extraction.harvest.quantity > 0) {
    merged.harvest.quantity = extraction.harvest.quantity;
  }
  if (extraction.harvest.grade) {
    merged.harvest.grade = extraction.harvest.grade;
  }
  if (extraction.harvest.price && extraction.harvest.price > 0) {
    merged.harvest.price = extraction.harvest.price;
  }
  if (extraction.harvest.buyer) {
    merged.harvest.buyer = extraction.harvest.buyer;
  }

  if (extraction.expense.cost && extraction.expense.cost > 0) {
    merged.expense.cost = extraction.expense.cost;
  }
  if (extraction.expense.expenseType) {
    merged.expense.expenseType = extraction.expense.expenseType;
  }
  if (extraction.expense.remarks) {
    merged.expense.remarks = extraction.expense.remarks;
  }

  if (extraction.fertigation.waterVolume && extraction.fertigation.waterVolume > 0) {
    merged.fertigation.waterVolume = extraction.fertigation.waterVolume;
  }
  if (extraction.fertigation.fertilizers.length > 0) {
    merged.fertigation.fertilizers = extraction.fertigation.fertilizers;
  }

  return merged;
}

function mergeDraftFromText(draft: VoiceLogDraft, transcript: string): VoiceLogDraft {
  const merged: VoiceLogDraft = {
    ...draft,
    irrigation: { ...draft.irrigation },
    spray: { ...draft.spray, chemicals: [...draft.spray.chemicals] },
    harvest: { ...draft.harvest },
    expense: { ...draft.expense },
    fertigation: { ...draft.fertigation, fertilizers: [...draft.fertigation.fertilizers] },
  };

  switch (merged.type) {
    case 'irrigation': {
      const duration = parseDurationHours(transcript);
      if (duration !== null) {
        merged.irrigation.durationHours = duration;
      }
      break;
    }
    case 'spray': {
      const waterVolume = parseWaterVolume(transcript);
      if (waterVolume !== null) {
        merged.spray.waterVolume = waterVolume;
      }
      break;
    }
    case 'harvest': {
      const quantity = parseQuantityKg(transcript);
      if (quantity !== null) {
        merged.harvest.quantity = quantity;
      }
      const grade = parseHarvestGrade(transcript);
      if (grade) {
        merged.harvest.grade = grade;
      }
      break;
    }
    case 'expense': {
      const cost = parseAmount(transcript);
      if (cost !== null) {
        merged.expense.cost = cost;
      }
      const expenseType = parseExpenseType(transcript);
      if (expenseType) {
        merged.expense.expenseType = expenseType;
      }
      break;
    }
    case 'fertigation': {
      const waterVolume = parseWaterVolume(transcript);
      if (waterVolume !== null) {
        merged.fertigation.waterVolume = waterVolume;
      }
      break;
    }
  }

  return merged;
}

export function resolveVoiceLogTurn({
  transcript,
  farms,
  contextFarm,
  activeDraft,
  originContext,
  llmExtraction,
}: ResolveVoiceLogTurnInput): VoiceLogTurnResult {
  const text = transcript.trim();
  if (!text) return { kind: 'none' };

  if (llmExtraction?.cancel || CANCEL_PATTERNS.some((pattern) => pattern.test(text))) {
    if (activeDraft || llmExtraction?.intent === 'log_activity') {
      return { kind: 'cancelled' };
    }
    return { kind: 'none' };
  }

  const inferredTypeFromText = detectActivityTypeFromText(text);
  const inferredType = activeDraft?.type ?? llmExtraction?.activityType ?? inferredTypeFromText;

  if (!activeDraft) {
    const hasStartIntent =
      llmExtraction?.intent === 'log_activity' || (hasLoggingSignal(text) && Boolean(inferredType));

    if (!hasStartIntent || !inferredType) {
      return { kind: 'none' };
    }
  }

  if (!inferredType) {
    return { kind: 'none' };
  }

  const farmsWithId = farms.filter((farm) => farm.id !== undefined && farm.id !== null);
  const defaultFarm =
    originContext === 'farm' && contextFarm?.id !== undefined && contextFarm.id !== null
      ? contextFarm
      : null;

  const today = toLocalDateString(new Date());
  let nextDraft = activeDraft ?? createEmptyDraft(inferredType, defaultFarm, today);

  const resolvedFarmFromLLM = resolveFarmByName(llmExtraction?.farmName ?? null, farmsWithId);
  if (resolvedFarmFromLLM?.id) {
    nextDraft = {
      ...nextDraft,
      farmId: resolvedFarmFromLLM.id,
      farmName: resolvedFarmFromLLM.name,
    };
  }

  const resolvedFarmFromText = resolveFarmFromText(text, farmsWithId);
  if (resolvedFarmFromText?.id) {
    nextDraft = {
      ...nextDraft,
      farmId: resolvedFarmFromText.id,
      farmName: resolvedFarmFromText.name,
    };
  }

  nextDraft = mergeDraftFromLLM(nextDraft, llmExtraction);
  nextDraft = mergeDraftFromText(nextDraft, text);

  const parsedDate = parseLogDateFromLLM(llmExtraction) ?? parseLogDate(text);
  if (parsedDate) {
    nextDraft = {
      ...nextDraft,
      date: parsedDate,
    };
  }

  const missingFields = getVoiceLogMissingFields(nextDraft);
  if (missingFields.length > 0) {
    return {
      kind: 'clarify',
      draft: nextDraft,
      missingFields,
    };
  }

  return {
    kind: 'ready',
    draft: nextDraft,
  };
}

export function shouldAttemptVoiceLogExtraction(
  transcript: string,
  hasActiveDraft: boolean,
): boolean {
  if (hasActiveDraft) return true;
  const text = transcript.trim();
  if (!text) return false;

  const hasActivitySignal = Object.values(ACTIVITY_PATTERNS).some((patterns) =>
    patterns.some((pattern) => pattern.test(text)),
  );

  const hasNumberSignal = /\d/.test(text);

  return (hasActivitySignal && hasLoggingSignal(text)) || (hasActivitySignal && hasNumberSignal);
}

export function buildVoiceLogFormPrefill(draft: VoiceLogDraft): VoiceLogFormPrefill {
  switch (draft.type) {
    case 'irrigation':
      return {
        type: 'irrigation',
        date: draft.date,
        irrigation: {
          durationHours: draft.irrigation.durationHours,
        },
      };
    case 'spray':
      return {
        type: 'spray',
        date: draft.date,
        spray: {
          waterVolume: draft.spray.waterVolume,
          chemicals: draft.spray.chemicals.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit ?? DEFAULT_CHEMICAL_UNIT,
          })),
        },
      };
    case 'harvest':
      return {
        type: 'harvest',
        date: draft.date,
        harvest: {
          quantity: draft.harvest.quantity,
          grade: draft.harvest.grade,
          price: draft.harvest.price,
          buyer: draft.harvest.buyer,
        },
      };
    case 'expense':
      return {
        type: 'expense',
        date: draft.date,
        expense: {
          cost: draft.expense.cost,
          expenseType: draft.expense.expenseType,
          remarks: draft.expense.remarks,
        },
      };
    case 'fertigation':
      return {
        type: 'fertigation',
        date: draft.date,
        fertigation: {
          waterVolume: draft.fertigation.waterVolume,
          fertilizers: draft.fertigation.fertilizers.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit ?? DEFAULT_FERTILIZER_UNIT,
          })),
        },
      };
  }
}
