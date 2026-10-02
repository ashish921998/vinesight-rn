const mockSetDetailedMode = jest.fn();
const mockResetOnboarding = jest.fn();
let mockAppModeHydrated = false;
let mockOnboardingHydrated = false;
let mockFinishAppModeHydration: (() => void) | null = null;
let mockFinishOnboardingHydration: (() => void) | null = null;

jest.mock('@/stores/app-mode-store', () => ({
  useAppModeStore: {
    getState: () => ({ setDetailedMode: mockSetDetailedMode }),
    persist: {
      hasHydrated: () => mockAppModeHydrated,
      onFinishHydration: (callback: () => void) => {
        mockFinishAppModeHydration = callback;
        return jest.fn();
      },
    },
  },
}));

jest.mock('@/stores/onboarding-store', () => ({
  useOnboardingStore: {
    getState: () => ({ resetOnboarding: mockResetOnboarding }),
    persist: {
      hasHydrated: () => mockOnboardingHydrated,
      onFinishHydration: (callback: () => void) => {
        mockFinishOnboardingHydration = callback;
        return jest.fn();
      },
    },
  },
}));

import { initializeNewFarmerExperience } from '@/stores/new-farmer-experience';

describe('initializeNewFarmerExperience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppModeHydrated = false;
    mockOnboardingHydrated = false;
    mockFinishAppModeHydration = null;
    mockFinishOnboardingHydration = null;
  });

  it('waits for persisted stores before resetting the new farmer state', async () => {
    const initialization = initializeNewFarmerExperience();

    expect(mockSetDetailedMode).not.toHaveBeenCalled();
    expect(mockResetOnboarding).not.toHaveBeenCalled();

    mockAppModeHydrated = true;
    mockFinishAppModeHydration?.();
    await Promise.resolve();
    expect(mockResetOnboarding).not.toHaveBeenCalled();

    mockOnboardingHydrated = true;
    mockFinishOnboardingHydration?.();
    await initialization;

    expect(mockSetDetailedMode).toHaveBeenCalledWith(false);
    expect(mockResetOnboarding).toHaveBeenCalledTimes(1);
  });
});
