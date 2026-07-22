import type { LogTypeId } from '@/constants/calculator-models';

interface AddLogRouteOptions {
  farmId?: number | string | null;
  initialLogType?: LogTypeId | null;
  lockFarmSelection?: boolean;
}

export function createAddLogHref({
  farmId,
  initialLogType,
  lockFarmSelection = false,
}: AddLogRouteOptions = {}) {
  return {
    pathname: '/add-entry',
    params: {
      ...(farmId != null ? { farmId: String(farmId) } : {}),
      ...(initialLogType ? { initialLogType } : {}),
      initialTab: 'log',
      tabs: 'log',
      ...(lockFarmSelection ? { lockFarmSelection: 'true' } : {}),
    },
  } as const;
}

interface QuickLogRouteOptions {
  farmId: number;
  initialLogType?: LogTypeId | null;
}

/**
 * Fast-path (one-tap) logging route for a concrete farm. Renders
 * {@link ReceiptLogScreen} via `app/log-entry/quick.tsx` and, when
 * `initialLogType` is set, opens that activity's sheet on mount.
 */
export function createQuickLogHref({ farmId, initialLogType }: QuickLogRouteOptions) {
  return {
    pathname: '/log-entry/quick',
    params: {
      farmId: String(farmId),
      ...(initialLogType ? { initialLogType } : {}),
    },
  } as const;
}

/**
 * Resolve where a dashboard Quick Action → farm selection should navigate:
 * a concrete single farm opens the fast path; the "all farms" sentinel opens
 * the batch composer (with its own farm picker) instead.
 */
export function resolveDashboardLogTarget({
  farmId,
  allFarmsId,
  initialLogType,
}: {
  farmId: number;
  allFarmsId: number;
  initialLogType?: LogTypeId | null;
}) {
  if (farmId === allFarmsId) {
    return createAddLogHref({ farmId: 'all', initialLogType });
  }
  return createQuickLogHref({ farmId, initialLogType });
}

// Route to a farm's detail screen with the season-start form auto-opened.
// Used by the "Start season" CTA in logging forms when the farm is between
// seasons and Save is gated.
export function createStartSeasonHref(farmId: number | string) {
  return {
    pathname: '/farm/[id]',
    params: { id: String(farmId), startSeason: '1' },
  } as const;
}
