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

// Route to a farm's detail screen with the season-start form auto-opened.
// Used by the "Start season" CTA in logging forms when the farm is between
// seasons and Save is gated.
export function createStartSeasonHref(farmId: number | string) {
  return {
    pathname: '/farm/[id]',
    params: { id: String(farmId), startSeason: '1' },
  } as const;
}
