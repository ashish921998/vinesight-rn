import {
  shouldShowAppModeIntro,
  type AppModeIntroVisibilityState,
} from '@/components/app-mode-intro-modal';

// A migrating user who never ran onboarding: authenticated, hydrated, on
// Simplified mode, hasn't seen the intro, and the tour isn't presenting.
const MIGRATING_USER: AppModeIntroVisibilityState = {
  isAuthenticated: true,
  isLoading: false,
  needsProfileCompletion: false,
  detailedMode: false,
  modeHydrated: true,
  hasSeenIntro: false,
  introHydrated: true,
  tourIsPresenting: false,
};

describe('shouldShowAppModeIntro', () => {
  it('shows for a migrating user (authenticated, Simplified, not seen, tour idle)', () => {
    expect(shouldShowAppModeIntro(MIGRATING_USER)).toBe(true);
  });

  it('hides once the intro has been seen (e.g. new users marked seen at onboarding)', () => {
    expect(shouldShowAppModeIntro({ ...MIGRATING_USER, hasSeenIntro: true })).toBe(false);
  });

  it('hides for Detailed-mode users', () => {
    expect(shouldShowAppModeIntro({ ...MIGRATING_USER, detailedMode: true })).toBe(false);
  });

  it('hides while the guided tour is actively presenting', () => {
    expect(shouldShowAppModeIntro({ ...MIGRATING_USER, tourIsPresenting: true })).toBe(false);
  });

  it('hides until both stores have hydrated', () => {
    expect(shouldShowAppModeIntro({ ...MIGRATING_USER, introHydrated: false })).toBe(false);
    expect(shouldShowAppModeIntro({ ...MIGRATING_USER, modeHydrated: false })).toBe(false);
  });

  it('hides when unauthenticated, loading, or mid-profile-completion', () => {
    expect(shouldShowAppModeIntro({ ...MIGRATING_USER, isAuthenticated: false })).toBe(false);
    expect(shouldShowAppModeIntro({ ...MIGRATING_USER, isLoading: true })).toBe(false);
    expect(shouldShowAppModeIntro({ ...MIGRATING_USER, needsProfileCompletion: true })).toBe(false);
  });
});
