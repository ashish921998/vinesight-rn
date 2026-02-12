import type { ExpenseTypeId } from '@/constants/calculator-models';
import type { ExpenseType } from '@/types';

const FORM_TO_RECORD_EXPENSE_TYPE: Record<ExpenseTypeId, ExpenseType> = {
  Equipment: 'equipment',
  Fuel: 'fuel',
  'Seeds/Plants': 'materials',
  Packaging: 'materials',
  Transport: 'materials',
  Maintenance: 'equipment',
  Other: 'other',
};

const NORMALIZED_TO_FORM_EXPENSE_TYPE: Record<string, ExpenseTypeId> = {
  equipment: 'Equipment',
  fuel: 'Fuel',
  // Prefer a materials-backed option to preserve backend `materials` on edit-save roundtrips.
  materials: 'Seeds/Plants',
  labor: 'Other',
  other: 'Other',
  'seeds/plants': 'Seeds/Plants',
  seedsplants: 'Seeds/Plants',
  packaging: 'Packaging',
  transport: 'Transport',
  maintenance: 'Maintenance',
};

const normalizeExpenseType = (value: string): string => {
  return value.trim().toLowerCase().replace(/\s+/g, '').replace(/[_-]/g, '');
};

export function mapExpenseTypeIdToRecordType(type: ExpenseTypeId): ExpenseType {
  return FORM_TO_RECORD_EXPENSE_TYPE[type];
}

export function mapExpenseRecordTypeToTypeId(
  value: string | null | undefined,
  fallback: ExpenseTypeId | '' = '',
): ExpenseTypeId | '' {
  if (!value || typeof value !== 'string') return fallback;

  const trimmed = value.trim();
  const direct = NORMALIZED_TO_FORM_EXPENSE_TYPE[trimmed.toLowerCase()];
  if (direct) return direct;

  const normalized = normalizeExpenseType(trimmed);
  const mapped = NORMALIZED_TO_FORM_EXPENSE_TYPE[normalized];
  if (mapped) return mapped;

  return fallback;
}
