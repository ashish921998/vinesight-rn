import {
  FARM_SETUP_NOTIFICATION_ROUTE,
  resolveFarmSetupNotificationRoute,
} from '@/services/farm-setup-notifications';

describe('resolveFarmSetupNotificationRoute', () => {
  it.each([1, 2, 3])('routes reminder sequence %s to the add-farm form', (sequence) => {
    expect(
      resolveFarmSetupNotificationRoute({
        type: 'farm_setup_reminder',
        campaign: 'first_farm_v1',
        sequence,
      }),
    ).toBe(FARM_SETUP_NOTIFICATION_ROUTE);
  });

  it.each([
    undefined,
    {},
    { type: 'guided_tour_reminder', campaign: 'first_farm_v1', sequence: 1 },
    { type: 'farm_setup_reminder', campaign: 'stale_campaign', sequence: 1 },
    { type: 'farm_setup_reminder', campaign: 'first_farm_v1', sequence: 0 },
    { type: 'farm_setup_reminder', campaign: 'first_farm_v1', sequence: 4 },
    { type: 'farm_setup_reminder', campaign: 'first_farm_v1', sequence: '1' },
  ])('rejects invalid or stale notification data %#', (data) => {
    expect(resolveFarmSetupNotificationRoute(data)).toBeNull();
  });
});
