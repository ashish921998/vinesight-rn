import type {
  DailyNoteRecord,
  ExpenseRecord,
  FertigationRecord,
  HarvestRecord,
  IrrigationRecord,
  SprayRecord,
} from '@/types';
import type { LogTypeId } from '@/constants';
import { formatCurrency, formatNumber } from '@/i18n/format';

export interface LogRecordDataByType {
  irrigation: IrrigationRecord;
  spray: SprayRecord;
  harvest: HarvestRecord;
  expense: ExpenseRecord;
  fertigation: FertigationRecord;
  note: DailyNoteRecord;
}

export type LogRecordInput = {
  [Type in LogTypeId]: {
    type: Type;
    data?: LogRecordDataByType[Type];
  };
}[LogTypeId];

export type LogRecordData = LogRecordDataByType[LogTypeId];

export function getDescriptionFromData(
  log: LogRecordInput,
  t: (key: string, options?: Record<string, unknown>) => string,
  currency?: string,
): string {
  if (!log.data) return '';

  switch (log.type) {
    case 'irrigation': {
      const duration = log.data.duration ?? 0;
      const displayDuration = formatNumber(duration, {
        maximumFractionDigits: Number.isInteger(duration) ? 0 : 1,
      });
      return t('logs.irrigationDurationHoursShort', { hours: displayDuration });
    }
    case 'spray':
      return log.data.chemical || t('logs.sprayApplication');
    case 'harvest': {
      const quantity = formatNumber(log.data.quantity ?? 0, { maximumFractionDigits: 1 });
      const grade = log.data.grade || t('common.na');
      return t('logs.harvestDescription', { quantityKg: quantity, grade });
    }
    case 'expense': {
      if (!currency) return '';
      const cost = formatCurrency(log.data.cost ?? 0, currency);
      const expenseType = log.data.type || t('common.general');
      return t('logs.expenseDescription', { cost, type: expenseType });
    }
    case 'fertigation': {
      const fertNames =
        log.data.fertilizers?.map((fertilizer) => fertilizer.name?.trim() ?? '').filter(Boolean) ??
        [];
      if (fertNames.length > 0) return fertNames.join(', ');
      const fertCount = log.data.fertilizers?.length || 0;
      return t('logs.fertigationApplied', {
        count: fertCount,
        countFormatted: formatNumber(fertCount, { maximumFractionDigits: 0 }),
      });
    }
    case 'note':
      return log.data.notes || t('logs.types.note');
  }
}
