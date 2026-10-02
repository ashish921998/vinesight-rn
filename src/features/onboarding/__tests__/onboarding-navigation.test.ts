import { ONBOARDING_COMPLETION_HREF } from '../onboarding-navigation';

describe('onboarding navigation', () => {
  it('finishes on the dashboard after the first farm is ready', () => {
    expect(ONBOARDING_COMPLETION_HREF).toBe('/(tabs)');
  });
});
