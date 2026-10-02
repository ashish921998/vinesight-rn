/**
 * log-prefills — pure builders that turn the add-log screen's prefill sources
 * (plan one-tap items, task irrigation duration, voice extraction) into
 * form-data drafts.
 *
 * Quick-log types (irrigation/spray/harvest/expense) seed the shared
 * QuickLogSheet via its `initialDraft` prop; the inline-modal survivors
 * (fertigation, all-farms expense) seed their state from the same builders.
 * One mapping per source, shared by both surfaces, so the two can't drift.
 */
import {
  createEmptySprayFormData,
  createEmptyFertigationFormData,
  type ChemicalEntry,
  type ExpenseFormData,
  type FertigationFormData,
  type HarvestFormData,
  type SprayFormData,
} from '@/components/forms';
import type { QuickLogInitialDraft, QuickLogType } from '@/components/sheets/quick-log-sheet';
import { CHEMICAL_UNITS, HARVEST_GRADES, type HarvestGrade } from '@/constants/calculator-models';
import { resolveFertigationPrefill } from '@/constants/fertilizer-units';
import type { QuantityBasis } from '@/types/database';
import type { PlannedInputItem } from '@/types/task';
import type {
  ExpenseData as VoiceExpenseData,
  FertigationData as VoiceFertigationData,
  HarvestData as VoiceHarvestData,
  VoiceLogFormPrefill,
} from '@/types/voice-log';
import { mapExpenseRecordTypeToTypeId } from '@/utils/expense-type';

/** The fields a prefill source can know about a chemical row (plan item or voice extraction). */
type SprayPrefillItem = {
  name?: string | null;
  quantity?: number | null;
  unit?: string | null;
  quantityBasis?: QuantityBasis | null;
  planItemId?: string | null;
};

function isValidChemicalUnit(unit: string): unit is ChemicalEntry['unit'] {
  return CHEMICAL_UNITS.includes(unit as ChemicalEntry['unit']);
}

/** Map loose source spellings ("gm/litre", "ml/acre") onto the picker's canonical units. */
function normalizeSprayDoseUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  if (
    normalized === 'gm/liter' ||
    normalized === 'gm/litre' ||
    normalized === 'gm/l' ||
    normalized === 'g/l'
  ) {
    return 'gm/L';
  }
  if (normalized === 'ml/liter' || normalized === 'ml/litre' || normalized === 'ml/l') {
    return 'ml/L';
  }
  if (normalized === 'gm/acre' || normalized === 'g/acre' || normalized === 'gram/acre') {
    return 'gram';
  }
  if (normalized === 'ml/acre') return 'ml';
  return unit.trim();
}

function createPrefillId(prefix: string, index: number): string {
  return `${prefix}_${Date.now()}_${index}`;
}

function toChemicalEntry(item: SprayPrefillItem, index: number): ChemicalEntry {
  const normalizedUnit = item.unit ? normalizeSprayDoseUnit(item.unit) : null;
  const unit = normalizedUnit && isValidChemicalUnit(normalizedUnit) ? normalizedUnit : 'gm/L';
  return {
    id: createPrefillId('chem', index),
    name: item.name ?? '',
    quantity: item.quantity ?? undefined,
    unit,
    quantityBasis:
      item.quantityBasis ??
      (item.unit?.trim().toLowerCase().includes('/acre') ? 'per_acre' : 'total'),
    // Plan one-tap linkage (issue #197) survives into the saved record.
    planItemId: item.planItemId ?? null,
  };
}

/** Spray draft from plan chemicals or a voice extraction; blank rows when neither has any. */
export function buildSprayPrefill(
  items: SprayPrefillItem[] | null | undefined,
  waterVolume?: number | null,
): SprayFormData {
  const base = createEmptySprayFormData();
  return {
    ...base,
    waterVolume: waterVolume ?? undefined,
    chemicals: items?.length ? items.map(toChemicalEntry) : base.chemicals,
  };
}

export function buildHarvestPrefill(harvest: VoiceHarvestData): HarvestFormData {
  const grade =
    harvest.grade && HARVEST_GRADES.includes(harvest.grade as HarvestGrade)
      ? (harvest.grade as HarvestGrade)
      : '';
  return {
    quantity: harvest.quantity ?? undefined,
    grade,
    price: harvest.price ?? undefined,
    buyer: harvest.buyer ?? undefined,
  };
}

export function buildExpensePrefill(expense: VoiceExpenseData): ExpenseFormData {
  return {
    type: mapExpenseRecordTypeToTypeId(expense.expenseType, ''),
    cost: expense.cost ?? undefined,
    remarks: expense.remarks ?? undefined,
  };
}

/** Fertigation draft from plan one-tap items; keeps the plan-item linkage (issue #197). */
export function buildFertigationPlanPrefill(items: PlannedInputItem[]): FertigationFormData {
  return {
    fertilizers: items.map((item, index) => {
      const { unit, quantityBasis } = resolveFertigationPrefill(item.unit);
      return {
        id: createPrefillId('fert', index),
        name: item.name,
        quantity: item.quantity ?? 0,
        unit,
        quantityBasis,
        planItemId: item.planItemId ?? null,
      };
    }),
  };
}

export function buildFertigationVoicePrefill(
  fertigation: VoiceFertigationData,
): FertigationFormData {
  const base = createEmptyFertigationFormData();
  return {
    fertilizers: fertigation.fertilizers?.length
      ? fertigation.fertilizers.map((item, index) => {
          const { unit, quantityBasis: resolvedBasis } = resolveFertigationPrefill(item.unit);
          return {
            id: createPrefillId('fert', index),
            name: item.name ?? '',
            quantity: item.quantity ?? undefined,
            unit,
            quantityBasis: item.quantityBasis ?? resolvedBasis,
          };
        })
      : base.fertilizers,
  };
}

/**
 * The sheet prefill for a quick-log open, assembled from whichever prefill
 * sources the host received. Returns null when nothing applies, so the sheet
 * opens blank — identical to a manual chip tap.
 */
export function buildQuickLogInitialDraft({
  type,
  planSprayChemicals,
  irrigationDurationHours,
  voice,
}: {
  type: QuickLogType;
  planSprayChemicals?: PlannedInputItem[] | null;
  irrigationDurationHours?: number | null;
  voice?: VoiceLogFormPrefill | null;
}): QuickLogInitialDraft | null {
  switch (type) {
    case 'irrigation': {
      const duration = voice?.irrigation?.durationHours ?? irrigationDurationHours;
      return duration && duration > 0 ? { irrigation: { duration } } : null;
    }
    case 'spray': {
      if (voice?.spray) {
        return { spray: buildSprayPrefill(voice.spray.chemicals, voice.spray.waterVolume) };
      }
      if (planSprayChemicals?.length) {
        return { spray: buildSprayPrefill(planSprayChemicals) };
      }
      return null;
    }
    case 'harvest':
      return voice?.harvest ? { harvest: buildHarvestPrefill(voice.harvest) } : null;
    case 'expense':
      return voice?.expense ? { expense: buildExpensePrefill(voice.expense) } : null;
  }
}
