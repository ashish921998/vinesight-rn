/**
 * Intent Extraction Module
 * Handles LLM-based intent extraction for routing decisions.
 */

import { extractIntentWithTimeout } from '../providers/index.ts';
import {
  parseJsonObjectFromText,
  toOptionalNumber,
  toOptionalString,
  toRecord,
  toRoundedPositiveNumber,
} from '../utils/index.ts';

export interface ActivityLogExtractionResult {
  intent: 'log_activity' | 'query_history' | 'advisory' | 'none';
  intentConfidence: number;
  activityType: 'irrigation' | 'spray' | 'harvest' | 'expense' | 'fertigation' | null;
  cancel: boolean;
  farmName: string | null;
  dateIso: string | null;
  dateRelative: 'today' | 'yesterday' | null;
  confidence: number;
  irrigation: { durationHours: number | null };
  spray: {
    waterVolume: number | null;
    chemicals: Array<{ name: string; quantity: number | null; unit: string | null }>;
  };
  harvest: {
    quantity: number | null;
    grade: string | null;
    price: number | null;
    buyer: string | null;
  };
  expense: { cost: number | null; expenseType: string | null; remarks: string | null };
  fertigation: {
    waterVolume: number | null;
    fertilizers: Array<{ name: string; quantity: number | null; unit: string | null }>;
  };
}

/**
 * Parse chemical items from LLM extraction result
 */
function parseChemicalItems(
  value: unknown,
): Array<{ name: string; quantity: number | null; unit: string | null }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = toRecord(item);
      if (!row) return null;
      const name = toOptionalString(row.name) ?? '';
      const quantity = toRoundedPositiveNumber(row.quantity);
      const unit = toOptionalString(row.unit);
      if (!name && quantity === null && unit === null) return null;
      return { name, quantity, unit };
    })
    .filter((item): item is { name: string; quantity: number | null; unit: string | null } =>
      Boolean(item),
    );
}

/**
 * Parse fertilizer items from LLM extraction result
 */
function parseFertilizerItems(
  value: unknown,
): Array<{ name: string; quantity: number | null; unit: string | null }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = toRecord(item);
      if (!row) return null;
      const name = toOptionalString(row.name) ?? '';
      const quantity = toRoundedPositiveNumber(row.quantity);
      const unit = toOptionalString(row.unit);
      if (!name && quantity === null && unit === null) return null;
      return { name, quantity, unit };
    })
    .filter((item): item is { name: string; quantity: number | null; unit: string | null } =>
      Boolean(item),
    );
}

/**
 * Parse activity extraction result from LLM JSON response
 */
export function parseActivityExtractionResult(raw: string): ActivityLogExtractionResult | null {
  const obj = parseJsonObjectFromText(raw);
  if (!obj) return null;

  const intentRaw = toOptionalString(obj.intent);
  const intent: ActivityLogExtractionResult['intent'] =
    intentRaw === 'log_activity' || intentRaw === 'query_history' || intentRaw === 'advisory'
      ? intentRaw
      : 'none';

  const activityTypeRaw = toOptionalString(obj.activity_type);
  const activityType =
    activityTypeRaw === 'irrigation' ||
    activityTypeRaw === 'spray' ||
    activityTypeRaw === 'harvest' ||
    activityTypeRaw === 'expense' ||
    activityTypeRaw === 'fertigation'
      ? activityTypeRaw
      : null;

  const farmName = toOptionalString(obj.farm_name);
  const dateIsoRaw = toOptionalString(obj.date_iso);
  const dateIso = dateIsoRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateIsoRaw) ? dateIsoRaw : null;
  const dateRelativeRaw = toOptionalString(obj.date_relative);
  const dateRelative: 'today' | 'yesterday' | null =
    dateRelativeRaw === 'today' || dateRelativeRaw === 'yesterday' ? dateRelativeRaw : null;

  const confidenceRaw = toOptionalNumber(obj.confidence);
  const confidence =
    confidenceRaw !== null ? Math.min(1, Math.max(0, confidenceRaw)) : intent === 'none' ? 0 : 0.6;

  const intentConfidenceRaw = toOptionalNumber(obj.intent_confidence);
  const intentConfidence =
    intentConfidenceRaw !== null ? Math.min(1, Math.max(0, intentConfidenceRaw)) : confidence;

  const irrigationRaw = toRecord(obj.irrigation);
  const sprayRaw = toRecord(obj.spray);
  const harvestRaw = toRecord(obj.harvest);
  const expenseRaw = toRecord(obj.expense);
  const fertigationRaw = toRecord(obj.fertigation);

  return {
    intent,
    intentConfidence,
    activityType,
    cancel: obj.cancel === true,
    farmName,
    dateIso,
    dateRelative,
    confidence,
    irrigation: {
      durationHours: toRoundedPositiveNumber(irrigationRaw?.duration_hours ?? null),
    },
    spray: {
      waterVolume: toRoundedPositiveNumber(sprayRaw?.water_volume ?? null),
      chemicals: parseChemicalItems(sprayRaw?.chemicals ?? []),
    },
    harvest: {
      quantity: toRoundedPositiveNumber(harvestRaw?.quantity ?? null),
      grade: toOptionalString(harvestRaw?.grade ?? null),
      price: toRoundedPositiveNumber(harvestRaw?.price ?? null),
      buyer: toOptionalString(harvestRaw?.buyer ?? null),
    },
    expense: {
      cost: toRoundedPositiveNumber(expenseRaw?.cost ?? null),
      expenseType: toOptionalString(expenseRaw?.expense_type ?? null),
      remarks: toOptionalString(expenseRaw?.remarks ?? null),
    },
    fertigation: {
      waterVolume: toRoundedPositiveNumber(fertigationRaw?.water_volume ?? null),
      fertilizers: parseFertilizerItems(fertigationRaw?.fertilizers ?? []),
    },
  };
}

/**
 * Extract activity intent from transcript using LLM
 */
export async function extractActivityIntent(input: {
  transcript: string;
  locale: 'en' | 'hi' | 'mr';
  farmNames: string[];
  contextFarmName?: string | null;
}): Promise<ActivityLogExtractionResult | null> {
  const rawJson = await extractIntentWithTimeout({
    transcript: input.transcript,
    locale: input.locale,
    farmNames: input.farmNames,
    contextFarmName: input.contextFarmName,
  });

  if (!rawJson) return null;
  return parseActivityExtractionResult(rawJson);
}

/**
 * Build deterministic query intent from transcript patterns
 */
export function buildDeterministicQueryIntent(input: {
  transcript: string;
  activity: 'irrigation' | 'spray' | 'fertigation' | 'expense' | null;
}): { category: string | null; confidence: number } {
  const historyScore =
    /\b(total|how much|how many|last|latest|history|record)\b/i.test(input.transcript) ||
    /कितना|कितने|किती|इतिहास|एकूण|कुल|शेवट/i.test(input.transcript)
      ? 0.72
      : 0;
  if (historyScore === 0) {
    return { category: null, confidence: 0 };
  }
  return {
    category: input.activity ?? 'general',
    confidence: input.activity ? 0.8 : 0.65,
  };
}
