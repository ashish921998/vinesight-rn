import type { LogTypeId } from '@/constants';
import { formatCurrency, formatNumber } from '@/i18n/format';

/**
 * Minimal structural contract each canonical helper reads per log type.
 * Intentionally narrower than the full DB record types: it declares only the
 * fields the presentation helpers consume, so both full records (farm-detail,
 * timeline, professional) and partial column Picks (dashboard) satisfy it.
 */
export interface LogRecordDataByType {
  irrigation: { duration?: number | null; area?: number | null; moisture_status?: string | null };
  spray: { chemical?: string | null; area?: number | null; weather?: string | null };
  harvest: {
    quantity?: number | null;
    grade?: string | null;
    buyer?: string | null;
    notes?: string | null;
  };
  expense: { cost?: number | null; type?: string | null; remarks?: string | null };
  fertigation: { fertilizers?: Array<{ name?: string | null }> | null; area?: number | null };
  note: { notes?: string | null };
}

export type LogRecordInput = {
  [Type in LogTypeId]: {
    type: Type;
    data: LogRecordDataByType[Type];
  };
}[LogTypeId];

export type LogRecordData = LogRecordDataByType[LogTypeId];

/**
 * Build the composite row id used across dashboard, farm-detail, and home
 * surfaces. Centralized so every producer uses one convention; consumers that
 * need the numeric id parse it from this string (see simplified-home).
 */
export function activityRowId(type: LogTypeId, id: number | string | undefined): string {
  return `${type}_${id ?? 0}`;
}

export function getDescriptionFromData(
  log: LogRecordInput,
  t: (key: string, options?: Record<string, unknown>) => string,
  currency?: string,
): string {
  switch (log.type) {
    case 'irrigation': {
      const duration = log.data.duration ?? 0;
      const displayDuration = formatNumber(duration, {
        maximumFractionDigits: Number.isInteger(duration) ? 0 : 1,
      });
      return t('logs.irrigationDurationHoursShort', { hours: displayDuration });
    }
    case 'spray':
      return log.data.chemical?.trim() || t('logs.sprayApplication');
    case 'harvest': {
      const quantity = formatNumber(log.data.quantity ?? 0, { maximumFractionDigits: 1 });
      const grade = log.data.grade?.trim() || t('common.na');
      return t('logs.harvestDescription', { quantityKg: quantity, grade });
    }
    case 'expense': {
      if (!currency) return '';
      const cost = formatCurrency(log.data.cost ?? 0, currency);
      const expenseType = log.data.type?.trim() || t('common.general');
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
      return log.data.notes?.trim() || t('logs.types.note');
  }
}
