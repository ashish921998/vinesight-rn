import { isAddLogFlowRoute } from '@/features/guided-tour/controller';

describe('isAddLogFlowRoute', () => {
  it('activates on the fast-path route (pathname)', () => {
    expect(isAddLogFlowRoute('/log-entry/quick', [])).toBe(true);
  });

  it('activates on the fast-path route (segments)', () => {
    expect(isAddLogFlowRoute(null, ['log-entry', 'quick'])).toBe(true);
  });

  it('still activates on the existing add-log routes', () => {
    expect(isAddLogFlowRoute('/log-entry/add', [])).toBe(true);
    expect(isAddLogFlowRoute('/add-entry', [])).toBe(true);
    expect(isAddLogFlowRoute('/add-activity', [])).toBe(true);
    expect(isAddLogFlowRoute(null, ['log-entry', 'add'])).toBe(true);
    expect(isAddLogFlowRoute(null, ['add-entry'])).toBe(true);
  });

  it('does not activate on unrelated routes', () => {
    expect(isAddLogFlowRoute('/(tabs)', ['(tabs)'])).toBe(false);
    expect(isAddLogFlowRoute('/farm/12', ['farm', '[id]'])).toBe(false);
    expect(isAddLogFlowRoute('/log-entry/edit/5', ['log-entry', 'edit', '[id]'])).toBe(false);
  });
});
