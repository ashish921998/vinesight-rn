/**
 * Voice Log Routing Module
 * Voice log state machine: draft creation, merging, turn resolution, and form prefill.
 */

import type { ActivityLogExtractionResult } from './intent.ts';
import type {
  Farm,
  VoiceLogActivityType,
  VoiceLogChemicalItem,
  VoiceLogDraft,
  VoiceLogFertilizerItem,
  VoiceLogFormPrefill,
  VoiceLogMissingField,
  VoiceLogOriginContext,
  VoiceLogTurnResult,
} from './types.ts';
import {
  DEFAULT_CHEMICAL_UNIT,
  DEFAULT_FERTILIZER_UNIT,
  LOG_INTENT_MIN_CONFIDENCE,
  VOICE_PATTERNS,
  detectActivityTypeFromText,
  escapeRegex,
  getVoiceLogMissingFields,
  hasLoggingSignal,
  isLikelyLogHistoryQuery,
  parseAmount,
  parseDurationHours,
  parseExpenseType,
  parseHarvestGrade,
  parseLogDate,
  parseQuantityKg,
  parseWaterVolume,
  toLocalDateString,
  normalizeText,
} from './intent-patterns.ts';

// ============================================================
// MARK: - Farm Resolution Utilities
// ============================================================

function findFarmMatchesByName(name: string, farms: Farm[]): Farm[] {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return [];

  const farmsWithId = farms.filter((farm) => farm.id !== undefined && farm.id !== null);

  const exactMatches = farmsWithId.filter((farm) => normalizeText(farm.name) === normalizedName);
  if (exactMatches.length > 0) return exactMatches;

  const boundaryPattern = new RegExp(`\\b${escapeRegex(normalizedName)}\\b`, 'i');
  const boundaryMatches = farmsWithId.filter((farm) =>
    boundaryPattern.test(normalizeText(farm.name)),
  );
  if (boundaryMatches.length > 0) return boundaryMatches;

  return farmsWithId.filter((farm) => {
    const normalizedFarmName = normalizeText(farm.name);
    if (!normalizedFarmName) return false;
    return (
      normalizedFarmName.includes(normalizedName) || normalizedName.includes(normalizedFarmName)
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
    irrigation: { durationHours: null },
    spray: { waterVolume: null, chemicals: [] },
    harvest: { quantity: null, grade: null, price: null, buyer: null },
    expense: { cost: null, expenseType: null, remarks: null },
    fertigation: { waterVolume: null, fertilizers: [] },
  };
}

// ============================================================
// MARK: - Draft Merging
// ============================================================

function normalizeItemName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function mergeChemicalItems(
  existing: VoiceLogChemicalItem[],
  incoming: VoiceLogChemicalItem[],
): VoiceLogChemicalItem[] {
  const merged = [...existing];
  for (const item of incoming) {
    const normalizedName = normalizeItemName(item.name);
    if (!normalizedName) continue;
    const existingIndex = merged.findIndex((e) => normalizeItemName(e.name) === normalizedName);
    if (existingIndex >= 0) {
      const existingItem = merged[existingIndex];
      if (!existingItem) continue;
      merged[existingIndex] = {
        ...existingItem,
        name: item.name || existingItem.name,
        quantity: item.quantity ?? existingItem.quantity,
        unit: item.unit ?? existingItem.unit,
      };
    } else {
      merged.push(item);
    }
  }
  return merged;
}

function mergeFertilizerItems(
  existing: VoiceLogFertilizerItem[],
  incoming: VoiceLogFertilizerItem[],
): VoiceLogFertilizerItem[] {
  const merged = [...existing];
  for (const item of incoming) {
    const normalizedName = normalizeItemName(item.name);
    if (!normalizedName) continue;
    const existingIndex = merged.findIndex((e) => normalizeItemName(e.name) === normalizedName);
    if (existingIndex >= 0) {
      const existingItem = merged[existingIndex];
      if (!existingItem) continue;
      merged[existingIndex] = {
        ...existingItem,
        name: item.name || existingItem.name,
        quantity: item.quantity ?? existingItem.quantity,
        unit: item.unit ?? existingItem.unit,
      };
    } else {
      merged.push(item);
    }
  }
  return merged;
}

function parseLogDateFromLLM(
  extraction: ActivityLogExtractionResult | null | undefined,
): string | null {
  if (!extraction) return null;
  if (extraction.dateIso && /^\d{4}-\d{2}-\d{2}$/.test(extraction.dateIso)) {
    return extraction.dateIso;
  }
  if (extraction.dateRelative === 'today') return toLocalDateString(new Date());
  if (extraction.dateRelative === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return toLocalDateString(yesterday);
  }
  return null;
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
    merged.spray.chemicals = mergeChemicalItems(merged.spray.chemicals, extraction.spray.chemicals);
  }
  if (extraction.harvest.quantity && extraction.harvest.quantity > 0) {
    merged.harvest.quantity = extraction.harvest.quantity;
  }
  if (extraction.harvest.grade) merged.harvest.grade = extraction.harvest.grade;
  if (extraction.harvest.price && extraction.harvest.price > 0) {
    merged.harvest.price = extraction.harvest.price;
  }
  if (extraction.harvest.buyer) merged.harvest.buyer = extraction.harvest.buyer;
  if (extraction.expense.cost && extraction.expense.cost > 0) {
    merged.expense.cost = extraction.expense.cost;
  }
  if (extraction.expense.expenseType) merged.expense.expenseType = extraction.expense.expenseType;
  if (extraction.expense.remarks) merged.expense.remarks = extraction.expense.remarks;
  if (extraction.fertigation.waterVolume && extraction.fertigation.waterVolume > 0) {
    merged.fertigation.waterVolume = extraction.fertigation.waterVolume;
  }
  if (extraction.fertigation.fertilizers.length > 0) {
    merged.fertigation.fertilizers = mergeFertilizerItems(
      merged.fertigation.fertilizers,
      extraction.fertigation.fertilizers,
    );
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
      const d = parseDurationHours(transcript);
      if (d !== null) merged.irrigation.durationHours = d;
      break;
    }
    case 'spray': {
      const wv = parseWaterVolume(transcript);
      if (wv !== null) merged.spray.waterVolume = wv;
      break;
    }
    case 'harvest': {
      const qty = parseQuantityKg(transcript);
      if (qty !== null) merged.harvest.quantity = qty;
      const grade = parseHarvestGrade(transcript);
      if (grade) merged.harvest.grade = grade;
      break;
    }
    case 'expense': {
      const cost = parseAmount(transcript);
      if (cost !== null) merged.expense.cost = cost;
      const et = parseExpenseType(transcript);
      if (et) merged.expense.expenseType = et;
      break;
    }
    case 'fertigation': {
      const wv = parseWaterVolume(transcript);
      if (wv !== null) merged.fertigation.waterVolume = wv;
      break;
    }
  }
  return merged;
}

function mergeDraftFromTextForField(
  draft: VoiceLogDraft,
  transcript: string,
  field: VoiceLogMissingField,
): VoiceLogDraft {
  const merged: VoiceLogDraft = {
    ...draft,
    irrigation: { ...draft.irrigation },
    spray: { ...draft.spray, chemicals: [...draft.spray.chemicals] },
    harvest: { ...draft.harvest },
    expense: { ...draft.expense },
    fertigation: { ...draft.fertigation, fertilizers: [...draft.fertigation.fertilizers] },
  };

  switch (field) {
    case 'duration': {
      const d = parseDurationHours(transcript);
      if (d !== null) merged.irrigation.durationHours = d;
      break;
    }
    case 'waterVolume': {
      const wv = parseWaterVolume(transcript);
      if (wv !== null) {
        if (merged.type === 'spray') merged.spray.waterVolume = wv;
        else if (merged.type === 'fertigation') merged.fertigation.waterVolume = wv;
      }
      break;
    }
    case 'quantity': {
      const qty = parseQuantityKg(transcript);
      if (qty !== null) merged.harvest.quantity = qty;
      break;
    }
    case 'grade': {
      const g = parseHarvestGrade(transcript);
      if (g) merged.harvest.grade = g;
      break;
    }
    case 'cost': {
      const c = parseAmount(transcript);
      if (c !== null) merged.expense.cost = c;
      break;
    }
    case 'expenseType': {
      const et = parseExpenseType(transcript);
      if (et) merged.expense.expenseType = et;
      break;
    }
    case 'farm':
    case 'chemicals':
    case 'fertilizers':
      break;
  }
  return merged;
}

// ============================================================
// MARK: - Voice Log Turn Resolution
// ============================================================

/**
 * Resolve voice log turn from user input
 */
export function resolveVoiceLogTurn(input: {
  transcript: string;
  farms: Farm[];
  contextFarm?: Farm | null;
  activeDraft?: VoiceLogDraft | null;
  originContext: VoiceLogOriginContext;
  llmExtraction?: ActivityLogExtractionResult | null;
  expectedField?: VoiceLogMissingField | null;
}): VoiceLogTurnResult {
  const {
    transcript,
    farms,
    contextFarm,
    activeDraft,
    originContext,
    llmExtraction,
    expectedField,
  } = input;

  const text = transcript.trim();
  if (!text) return { kind: 'none' };

  if (llmExtraction?.cancel || VOICE_PATTERNS.cancel.some((p) => p.test(text))) {
    if (activeDraft || llmExtraction?.intent === 'log_activity') return { kind: 'cancelled' };
    return { kind: 'none' };
  }

  if (!activeDraft && isLikelyLogHistoryQuery(text)) return { kind: 'none' };

  const inferredTypeFromText = detectActivityTypeFromText(text);
  const inferredType = activeDraft?.type ?? llmExtraction?.activityType ?? inferredTypeFromText;

  if (!activeDraft) {
    const hasStartIntent =
      (llmExtraction?.intent === 'log_activity' &&
        (llmExtraction.intentConfidence ?? 0) >= LOG_INTENT_MIN_CONFIDENCE) ||
      (hasLoggingSignal(text) && Boolean(inferredType));
    if (!hasStartIntent || !inferredType) return { kind: 'none' };
  }

  if (!inferredType) return { kind: 'none' };

  const farmsWithId = farms.filter((f) => f.id !== undefined && f.id !== null);
  const defaultFarm =
    originContext === 'farm' && contextFarm?.id !== undefined && contextFarm.id !== null
      ? contextFarm
      : null;

  const today = toLocalDateString(new Date());
  let nextDraft = activeDraft ?? createEmptyDraft(inferredType, defaultFarm, today);

  const resolvedFromLLM = resolveFarmByName(llmExtraction?.farmName ?? null, farmsWithId);
  if (resolvedFromLLM?.id) {
    nextDraft = { ...nextDraft, farmId: resolvedFromLLM.id, farmName: resolvedFromLLM.name };
  }

  const resolvedFromText = resolveFarmFromText(text, farmsWithId);
  if (resolvedFromText?.id) {
    nextDraft = { ...nextDraft, farmId: resolvedFromText.id, farmName: resolvedFromText.name };
  }

  nextDraft = mergeDraftFromLLM(nextDraft, llmExtraction);
  if (activeDraft && expectedField) {
    nextDraft = mergeDraftFromTextForField(nextDraft, text, expectedField);
  } else {
    nextDraft = mergeDraftFromText(nextDraft, text);
  }

  const parsedDate = parseLogDateFromLLM(llmExtraction) ?? parseLogDate(text);
  if (parsedDate) nextDraft = { ...nextDraft, date: parsedDate };

  const missingFields = getVoiceLogMissingFields(nextDraft);
  if (missingFields.length > 0) return { kind: 'clarify', draft: nextDraft, missingFields };
  return { kind: 'ready', draft: nextDraft };
}

/**
 * Check if voice log extraction should be attempted
 */
export function shouldAttemptVoiceLogExtraction(
  transcript: string,
  hasActiveDraft: boolean,
): boolean {
  if (hasActiveDraft) return true;
  const text = transcript.trim();
  if (!text) return false;
  if (hasLoggingSignal(text)) return true;
  if (detectActivityTypeFromText(text) !== null) return true;
  if (isLikelyLogHistoryQuery(text)) return true;
  if (/\b(how|what|when|should|can|suggest|recommend|advice)\b/i.test(text)) return true;
  if (text.split(/\s+/).length < 3) return false;
  return true;
}

// ============================================================
// MARK: - Form Prefill Builder
// ============================================================

/**
 * Build form prefill from voice log draft
 */
export function buildVoiceLogFormPrefill(draft: VoiceLogDraft): VoiceLogFormPrefill {
  switch (draft.type) {
    case 'irrigation':
      return {
        type: 'irrigation',
        date: draft.date,
        irrigation: { durationHours: draft.irrigation.durationHours },
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
