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
