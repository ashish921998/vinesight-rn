/**
 * Record → form-data mappers
 * Convert saved farm records back into the form-data shapes the entry forms
 * edit. Used by the activity edit flow and by "repeat last log" drafts.
 */

import {
  createEmptySprayFormData,
  createEmptyFertigationFormData,
  type IrrigationFormData,
  type SprayFormData,
  type HarvestFormData,
  type ExpenseFormData,
  type FertigationFormData,
  type NoteFormData,
} from '@/components/forms';
import type {
  IrrigationRecord,
  SprayRecord,
  HarvestRecord,
  ExpenseRecord,
  FertigationRecord,
  DailyNoteRecord,
} from '@/types';
import { mapExpenseRecordTypeToTypeId } from '@/utils/expense-type';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

const allowedSprayUnits = ['gm/L', 'ml/L', 'ppm', 'kg', 'gram', 'liter', 'ml'] as const;
type AllowedSprayUnit = (typeof allowedSprayUnits)[number];
const allowedSprayUnitByLowercase = new Map<string, AllowedSprayUnit>(
  allowedSprayUnits.map((unit) => [unit.toLowerCase(), unit]),
);

function normalizeLegacySprayUnit(rawUnit: string): AllowedSprayUnit | null {
  const lowered = rawUnit.trim().toLowerCase();
  if (lowered === 'gm/liter' || lowered === 'gm/litre' || lowered === 'gm/l' || lowered === 'g/l') {
    return 'gm/L';
  }
  if (lowered === 'ml/liter' || lowered === 'ml/litre' || lowered === 'ml/l') {
    return 'ml/L';
  }
  if (lowered === 'gm/acre') return 'gram';
  if (lowered === 'ml/acre') return 'ml';
  return allowedSprayUnitByLowercase.get(lowered) ?? null;
}

export function irrigationRecordToFormData(record: IrrigationRecord): IrrigationFormData {
  return { duration: record.duration || 0 };
}

export function sprayRecordToFormData(record: SprayRecord): SprayFormData {
  const data = createEmptySprayFormData();

  if (record.dose && record.dose.includes('Water:')) {
    const waterMatch = record.dose.match(/Water:\s*(\d+(?:\.\d+)?)/);
    if (waterMatch) {
      const parsedVolume = parseFloat(waterMatch[1]);
      data.waterVolume = isNaN(parsedVolume) ? 0 : parsedVolume;
    } else {
      console.warn('[recordToForm] Water volume parsing failed:', record.dose);
    }
  }

  data.catalogMixId = record.catalog_mix_id ?? null;
  data.governingPhiDays = record.governing_phi_days ?? null;
  data.safeHarvestDate = record.safe_harvest_date ?? null;
  data.phiBlockingComponent = record.phi_blocking_component ?? null;
  data.phiStatus = record.phi_status ?? null;

  if (record.chemical_items && record.chemical_items.length > 0) {
    data.chemicals = record.chemical_items.map((item) => ({
      ...(item.unit?.trim().toLowerCase().includes('/acre')
        ? ({ quantityBasis: item.quantity_basis ?? 'per_acre' } as const)
        : ({ quantityBasis: item.quantity_basis ?? 'total' } as const)),
      id: generateId(),
      name: item.name,
      quantity: item.quantity ?? 0,
      unit:
        (item.unit ? normalizeLegacySprayUnit(item.unit) : null) ??
        ('ml/L' as SprayFormData['chemicals'][number]['unit']),
      warehouseItemId: item.warehouse_item_id ?? null,
      catalogProductId: item.catalog_product_id ?? null,
      planItemId: item.plan_item_id ?? null,
      compositionSnapshot: item.composition_snapshot ?? null,
      densityKgPerL: item.density_kg_per_l ?? null,
    }));
  } else if (record.chemical) {
    const chemicalParts = record.chemical.split(',').map((part) => part.trim());
    data.chemicals = chemicalParts.map((part) => {
      const match = part.match(/(.+?)\s*\((\d+\.?\d*)\s*(.+?)\)/);
      if (match) {
        const unit = normalizeLegacySprayUnit(match[3]);
        const parsedQuantity = parseFloat(match[2]);
        if (isNaN(parsedQuantity)) {
          console.warn('[recordToForm] Invalid chemical quantity:', match[2]);
          return {
            id: generateId(),
            name: part,
            quantity: 0,
            unit: 'ml/L' as const,
          };
        }
        if (!unit) {
          console.warn('[recordToForm] Invalid unit, using default:', match[3]);
          return {
            id: generateId(),
            name: match[1].trim(),
            quantity: parsedQuantity,
            unit: 'ml/L' as const,
          };
        }
        return {
          id: generateId(),
          name: match[1].trim(),
          quantity: parsedQuantity,
          unit,
          quantityBasis: 'total' as const,
          warehouseItemId: null,
          catalogProductId: null,
          compositionSnapshot: null,
          densityKgPerL: null,
        };
      }
      console.warn('[recordToForm] Chemical parsing failed, using defaults:', part);
      return {
        id: generateId(),
        name: part,
        quantity: 0,
        unit: 'ml/L' as const,
        quantityBasis: 'total' as const,
        warehouseItemId: null,
        catalogProductId: null,
        compositionSnapshot: null,
        densityKgPerL: null,
      };
    });
  }
  return data;
}

export function harvestRecordToFormData(record: HarvestRecord): HarvestFormData {
  return {
    quantity: record.quantity || 0,
    grade: (record.grade || '') as HarvestFormData['grade'],
    price: record.price || 0,
    buyer: record.buyer || '',
  };
}

export function expenseRecordToFormData(record: ExpenseRecord): ExpenseFormData {
  return {
    type: mapExpenseRecordTypeToTypeId(record.type, 'Other'),
    cost: record.cost || 0,
    remarks: record.remarks || '',
  };
}

export function fertigationRecordToFormData(record: FertigationRecord): FertigationFormData {
  const data = createEmptyFertigationFormData();
  if (record.fertilizers && record.fertilizers.length > 0) {
    data.fertilizers = record.fertilizers.map((f) => ({
      name: f.name,
      quantity: f.quantity ?? 0,
      // Stored units load verbatim — historical spellings ('kg/acre',
      // web-written strings) render as-is, never coerced (issue #192).
      unit: f.unit,
      quantityBasis: f.quantity_basis ?? 'total',
      warehouseItemId: f.warehouse_item_id ?? null,
      catalogProductId: f.catalog_product_id ?? null,
      planItemId: f.plan_item_id ?? null,
      compositionSnapshot: f.composition_snapshot ?? null,
      densityKgPerL: f.density_kg_per_l ?? null,
    }));
  }
  return data;
}

export function dailyNoteRecordToFormData(record: DailyNoteRecord): NoteFormData {
  return { notes: record.notes ?? '' };
}
