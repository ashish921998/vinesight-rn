export const FARM_SETUP_NOTIFICATION_CAMPAIGN = 'first_farm_v1' as const;
export const FARM_SETUP_NOTIFICATION_ROUTE = '/farm/add' as const;

type FarmSetupNotificationData = {
  type?: unknown;
  campaign?: unknown;
  sequence?: unknown;
};

export function resolveFarmSetupNotificationRoute(
  data: FarmSetupNotificationData | null | undefined,
): typeof FARM_SETUP_NOTIFICATION_ROUTE | null {
  if (!data || data.type !== 'farm_setup_reminder') return null;
  if (data.campaign !== FARM_SETUP_NOTIFICATION_CAMPAIGN) return null;
  if (
    typeof data.sequence !== 'number' ||
    !Number.isInteger(data.sequence) ||
    data.sequence < 1 ||
    data.sequence > 3
  ) {
    return null;
  }

  return FARM_SETUP_NOTIFICATION_ROUTE;
}
