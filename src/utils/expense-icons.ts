import type { ExpenseTypeId } from '@/constants/calculator-models';
import { resolveSymbolIconName } from '@/constants/icon-registry';
import { mapExpenseRecordTypeToTypeId } from './expense-type';

export const EXPENSE_TYPE_ICONS: Record<ExpenseTypeId, string> = {
  Equipment: 'wrench.and.screwdriver',
  Fuel: 'car',
  'Seeds/Plants': 'leaf',
  Packaging: 'cube',
  Transport: 'bus',
  Maintenance: 'hammer',
  Other: 'ellipsis',
};

export function getExpenseIconName(
  expenseType: string | null | undefined,
  fallback = 'dollarsign.circle.fill',
): string {
  const normalizedType = mapExpenseRecordTypeToTypeId(expenseType, '');
  const resolvedFallback = resolveSymbolIconName(fallback);
  if (!normalizedType) return resolvedFallback;
  return EXPENSE_TYPE_ICONS[normalizedType] ?? resolvedFallback;
}
