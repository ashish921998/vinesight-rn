import type {
  IrrigationRecord,
  SprayRecord,
  HarvestRecord,
  ExpenseRecord,
  FertigationRecord,
  DailyNoteRecord,
} from '@/types';
import type { LogTypeId } from '@/constants';
import { formatCurrency, formatNumber } from '@/i18n/format';

type LogRecordData =
  | IrrigationRecord
  | SprayRecord
  | HarvestRecord
  | ExpenseRecord
  | FertigationRecord
  | DailyNoteRecord;

export function getDescriptionFromData(
  type: LogTypeId,
  t: (key: string, options?: Record<string, unknown>) => string,
  data?: LogRecordData,
  currency?: string,
): string {
  if (!data) return '';

  switch (type) {
    case 'irrigation': {
      const irrigation = data as IrrigationRecord;
      const duration = irrigation.duration ?? 0;
      const displayDuration = formatNumber(duration, {
        maximumFractionDigits: Number.isInteger(duration) ? 0 : 1,
      });
      return t('logs.irrigationDurationHoursShort', { hours: displayDuration });
    }
    case 'spray': {
      const spray = data as SprayRecord;
      return spray.chemical || t('logs.sprayApplication');
    }
    case 'harvest': {
      const harvest = data as HarvestRecord;
      const quantity = formatNumber(harvest.quantity ?? 0, { maximumFractionDigits: 1 });
      const grade = harvest.grade || t('common.na');
      return t('logs.harvestDescription', { quantityKg: quantity, grade });
    }
    case 'expense': {
      const expense = data as ExpenseRecord;
      if (!currency) return '';
      const cost = formatCurrency(expense.cost ?? 0, currency);
      const expenseType = expense.type || t('common.general');
      return t('logs.expenseDescription', { cost, type: expenseType });
    }
    case 'fertigation': {
      const fertigation = data as FertigationRecord;
      const fertNames =
        fertigation.fertilizers?.map((f) => f.name?.trim() ?? '').filter(Boolean) ?? [];
      if (fertNames.length > 0) return fertNames.join(', ');
      const fertCount = fertigation.fertilizers?.length || 0;
      return t('logs.fertigationApplied', {
        count: fertCount,
        countFormatted: formatNumber(fertCount, { maximumFractionDigits: 0 }),
      });
    }
    case 'note': {
      const note = data as DailyNoteRecord;
      return note.notes || t('logs.types.note');
    }
    default:
      return '';
  }
}

export type { LogRecordData };
