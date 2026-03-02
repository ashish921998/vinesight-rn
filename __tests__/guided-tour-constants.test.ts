import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';

describe('GUIDED_TOUR_TARGET_IDS', () => {
  // Workers module tour targets
  const WORKERS_TARGETS = [
    'WORKERS_TAB_SELECTOR',
    'WORKERS_FAB',
    'WORKERS_ATTENDANCE_TAB',
    'WORKERS_MARK_DAY_CELL',
  ] as const;

  const WORKER_FORM_TARGETS = [
    'WORKER_FORM_NAME',
    'WORKER_FORM_DAILY_RATE',
    'WORKER_FORM_SAVE',
  ] as const;

  const SETTLEMENT_TARGETS = [
    'SETTLEMENT_WORKER_PICKER',
    'SETTLEMENT_PERIOD_SELECTOR',
    'SETTLEMENT_CALCULATE_BTN',
  ] as const;

  it.each(WORKERS_TARGETS)('has workers tour target %s', (key) => {
    expect(GUIDED_TOUR_TARGET_IDS[key]).toBeDefined();
    expect(typeof GUIDED_TOUR_TARGET_IDS[key]).toBe('string');
    expect(GUIDED_TOUR_TARGET_IDS[key].length).toBeGreaterThan(0);
  });

  it.each(WORKER_FORM_TARGETS)('has worker form tour target %s', (key) => {
    expect(GUIDED_TOUR_TARGET_IDS[key]).toBeDefined();
    expect(typeof GUIDED_TOUR_TARGET_IDS[key]).toBe('string');
  });

  it.each(SETTLEMENT_TARGETS)('has settlement tour target %s', (key) => {
    expect(GUIDED_TOUR_TARGET_IDS[key]).toBeDefined();
    expect(typeof GUIDED_TOUR_TARGET_IDS[key]).toBe('string');
  });

  it('all target ID values are unique', () => {
    const values = Object.values(GUIDED_TOUR_TARGET_IDS);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('workers tour targets use "workers_tour:" prefix', () => {
    for (const key of [...WORKERS_TARGETS, ...WORKER_FORM_TARGETS, ...SETTLEMENT_TARGETS]) {
      expect(GUIDED_TOUR_TARGET_IDS[key]).toMatch(/^workers_tour:/);
    }
  });
});
