import { formatNumber } from '@/i18n/format';
import {
  getDescriptionFromData,
  type LogRecordData,
  type LogRecordInput,
} from '@/utils/log-description';

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
  const showArea = options.showArea ?? true;
  const includeArea = shouldShowArea(log.data, showArea);
  const formatArea = (area: number) =>
    t('farmDetails.header.areaAcres', { value: formatNumber(area) });

  switch (log.type) {
    case 'irrigation': {
      const parts = [];
      if (includeArea && log.data.area) parts.push(formatArea(log.data.area));
      const moistureStatus = log.data.moisture_status?.trim();
      if (moistureStatus) parts.push(moistureStatus);
      return parts.length > 0 ? parts.join(' • ') : null;
    }
    case 'spray': {
      const parts = [];
      if (includeArea && log.data.area) parts.push(formatArea(log.data.area));
      const weather = log.data.weather?.trim();
      if (weather) parts.push(weather);
      return parts.length > 0 ? parts.join(' • ') : null;
    }
    case 'harvest':
      return log.data.buyer?.trim() || log.data.notes?.trim() || null;
    case 'expense':
      return log.data.remarks?.trim() || null;
    case 'fertigation':
      return includeArea && log.data.area ? formatArea(log.data.area) : null;
    case 'note':
      return null;
  }
}

export function getDelegatedAttribution(t: Translate, data: LogRecordData): string | null {
  if (!isDelegatedRecord(data) || !data.professional_creator_id) return null;

  return t('professional.attribution', {
    member: data.professional_creator_name?.trim() || t('professional.organizationMember'),
    organization: data.acting_organization_name?.trim() || t('professional.organization'),
  });
}

/**
 * Presentation options for the shared activity-row mapper.
 */
export interface ActivityPresentationOptions {
  /** Required to format expense descriptions. */
  currency?: string;
  /** Pass false to hide acreage on farmer-facing rows. Defaults to true. */
  showArea?: boolean;
  /** Include professional delegated attribution in secondaryDetail. */
  includeAttribution?: boolean;
}

export interface ActivityRowPresentation {
  description: string;
  secondaryDetail?: string;
}

/**
 * Single canonical mapper for activity-row presentation. Composes the
 * description, secondary detail, and (optionally) delegated attribution so
 * every surface — dashboard, farm-detail, timeline — formats a log identically.
 */
export function getActivityRowPresentation(
  log: LogRecordInput,
  t: Translate,
  options: ActivityPresentationOptions = {},
): ActivityRowPresentation {
  const description = getDescriptionFromData(log, t, options.currency);
  const parts: Array<string | null> = [
    getSecondaryDetail(log, t, { showArea: options.showArea }),
    options.includeAttribution ? getDelegatedAttribution(t, log.data) : null,
  ];
  const secondaryDetail = parts.filter((part): part is string => Boolean(part)).join(' • ');
  return { description, secondaryDetail: secondaryDetail || undefined };
}
