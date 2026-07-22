import {
  createAddLogHref,
  createQuickLogHref,
  resolveDashboardLogTarget,
} from '@/utils/add-log-navigation';

const ALL_FARMS_ID = -1;

describe('resolveDashboardLogTarget', () => {
  it('routes a concrete single farm to the fast path with initialLogType', () => {
    const target = resolveDashboardLogTarget({
      farmId: 12,
      allFarmsId: ALL_FARMS_ID,
      initialLogType: 'irrigation',
    });
    expect(target).toEqual(createQuickLogHref({ farmId: 12, initialLogType: 'irrigation' }));
    expect(target.pathname).toBe('/log-entry/quick');
    expect(target.params).toMatchObject({ farmId: '12', initialLogType: 'irrigation' });
  });

  it('routes the note quick action through the fast path too', () => {
    const target = resolveDashboardLogTarget({
      farmId: 5,
      allFarmsId: ALL_FARMS_ID,
      initialLogType: 'note',
    });
    expect(target.pathname).toBe('/log-entry/quick');
    expect(target.params).toMatchObject({ farmId: '5', initialLogType: 'note' });
  });

  it('routes ALL_FARMS_ID to the batch composer with farmId=all', () => {
    const target = resolveDashboardLogTarget({
      farmId: ALL_FARMS_ID,
      allFarmsId: ALL_FARMS_ID,
      initialLogType: 'spray',
    });
    expect(target).toEqual(createAddLogHref({ farmId: 'all', initialLogType: 'spray' }));
    expect(target.pathname).toBe('/add-entry');
    expect(target.params).toMatchObject({ farmId: 'all', initialLogType: 'spray' });
  });

  it('omits initialLogType when null', () => {
    const target = resolveDashboardLogTarget({ farmId: 8, allFarmsId: ALL_FARMS_ID });
    expect(target.pathname).toBe('/log-entry/quick');
    expect(target.params).not.toHaveProperty('initialLogType');
  });
});
