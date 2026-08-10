import type { LogTypeId } from '@/constants';
import type {
  ExpenseRecord,
  FertigationRecord,
  HarvestRecord,
  IrrigationRecord,
  SprayRecord,
} from '@/types';
import type { LogRecordData } from '@/utils/log-description';

export interface SecondaryDetailOptions {
  /** Hide acreage for farmer-facing farm-detail rows while retaining other details. */
  showArea?: boolean;
}

type DelegatedRecord = LogRecordData & {
  professional_creator_id?: string | null;
  professional_creator_name?: string | null;
  acting_organization_name?: string | null;
};

function isDelegatedRecord(data: LogRecordData): data is DelegatedRecord {
  return 'professional_creator_id' in data;
}

function shouldShowArea(data: LogRecordData, showArea: boolean): boolean {
  // Professional activity keeps the acreage context that identifies delegated work.
  return showArea || (isDelegatedRecord(data) && Boolean(data.professional_creator_id));
}

export function getSecondaryDetail(
  type: LogTypeId,
  data?: LogRecordData,
  options: SecondaryDetailOptions = {},
): string | null {
  if (!data) return null;

  const showArea = options.showArea ?? true;
  const includeArea = shouldShowArea(data, showArea);

  switch (type) {
    case 'irrigation': {
      const irrigation = data as IrrigationRecord;
      const area = irrigation.area;
      const moistureStatus = irrigation.moisture_status;
      const parts = [];
      if (includeArea && area) parts.push(`${area} acres`);
      if (moistureStatus) parts.push(moistureStatus);
      return parts.length > 0 ? parts.join(' • ') : null;
    }
    case 'spray': {
      const spray = data as SprayRecord;
      const area = spray.area;
      const weather = spray.weather;
      const parts = [];
      if (includeArea && area) parts.push(`${area} acres`);
      if (weather) parts.push(weather);
      return parts.length > 0 ? parts.join(' • ') : null;
    }
    case 'harvest': {
      const harvest = data as HarvestRecord;
      return harvest.buyer || harvest.notes || null;
    }
    case 'expense': {
      const expense = data as ExpenseRecord;
      return expense.remarks || null;
    }
    case 'fertigation': {
      const fertigation = data as FertigationRecord;
      return includeArea && fertigation.area ? `${fertigation.area} acres` : null;
    }
    case 'note':
      return null;
    default:
      return null;
  }
}

export function getDelegatedAttribution(
  t: (key: string, options?: Record<string, unknown>) => string,
  data?: LogRecordData,
): string | null {
  if (!data || !isDelegatedRecord(data) || !data.professional_creator_id) return null;

  return t('professional.attribution', {
    member: data.professional_creator_name ?? t('professional.organizationMember'),
    organization: data.acting_organization_name ?? t('professional.organization'),
  });
}
