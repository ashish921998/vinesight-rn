/**
 * Voice Log Routing Module
 * Voice log state machine: farm resolution, turn resolution, and form prefill.
 * Draft creation and merging helpers are in voice-log-draft.ts.
 */

import type { ActivityLogExtractionResult } from './intent.ts';
import type {
  Farm,
  VoiceLogDraft,
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
  parseLogDate,
  toLocalDateString,
  normalizeText,
} from './intent-patterns.ts';
import {
  createEmptyDraft,
  mergeDraftFromLLM,
  mergeDraftFromText,
  mergeDraftFromTextForField,
  parseLogDateFromLLM,
} from './voice-log-draft.ts';

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
