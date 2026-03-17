/**
 * Voice Log Draft Module
 * Draft creation, merging, and field-level update helpers for the voice log state machine.
 */

import type { ActivityLogExtractionResult } from './intent.ts';
import type {
  Farm,
  VoiceLogActivityType,
  VoiceLogChemicalItem,
  VoiceLogDraft,
  VoiceLogFertilizerItem,
  VoiceLogMissingField,
} from './types.ts';
import {
  parseAmount,
  parseDurationHours,
  parseExpenseType,
  parseHarvestGrade,
  parseQuantityKg,
  parseWaterVolume,
  toLocalDateString,
} from './intent-patterns.ts';

// ============================================================
// MARK: - Empty Draft Factory
// ============================================================

export function createEmptyDraft(
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
// MARK: - Item Merge Helpers
// ============================================================

function normalizeItemName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function mergeChemicalItems(
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

export function mergeFertilizerItems(
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

// ============================================================
// MARK: - Date Resolution from LLM
// ============================================================

export function parseLogDateFromLLM(
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

// ============================================================
// MARK: - Draft Merge Functions
// ============================================================

export function mergeDraftFromLLM(
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

export function mergeDraftFromText(draft: VoiceLogDraft, transcript: string): VoiceLogDraft {
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

export function mergeDraftFromTextForField(
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
