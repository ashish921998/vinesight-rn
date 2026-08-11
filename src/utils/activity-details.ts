import { formatNumber } from '@/i18n/format';
import type { LogRecordData, LogRecordInput } from '@/utils/log-description';

export interface SecondaryDetailOptions {
  /** Hide acreage for farmer-facing farm-detail rows while retaining other details. */
  showArea?: boolean;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

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
  log: LogRecordInput,
  t: Translate,
  options: SecondaryDetailOptions = {},
): string | null {
  if (!log.data) return null;

  const showArea = options.showArea ?? true;
  const includeArea = shouldShowArea(log.data, showArea);
  const formatArea = (area: number) =>
    t('farmDetails.header.areaAcres', { value: formatNumber(area) });

  switch (log.type) {
    case 'irrigation': {
      const parts = [];
      if (includeArea && log.data.area) parts.push(formatArea(log.data.area));
      if (log.data.moisture_status) parts.push(log.data.moisture_status);
      return parts.length > 0 ? parts.join(' • ') : null;
    }
    case 'spray': {
      const parts = [];
      if (includeArea && log.data.area) parts.push(formatArea(log.data.area));
      if (log.data.weather) parts.push(log.data.weather);
      return parts.length > 0 ? parts.join(' • ') : null;
    }
    case 'harvest':
      return log.data.buyer || log.data.notes || null;
    case 'expense':
      return log.data.remarks || null;
    case 'fertigation':
      return includeArea && log.data.area ? formatArea(log.data.area) : null;
    case 'note':
      return null;
  }
}

export function getDelegatedAttribution(t: Translate, data?: LogRecordData): string | null {
  if (!data || !isDelegatedRecord(data) || !data.professional_creator_id) return null;

  return t('professional.attribution', {
    member: data.professional_creator_name ?? t('professional.organizationMember'),
    organization: data.acting_organization_name ?? t('professional.organization'),
  });
}
