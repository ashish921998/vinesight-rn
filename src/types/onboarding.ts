/**
 * Onboarding Types for Vinesight
 * Types for the onboarding flow
 */

export type OnboardingStep =
  | 'language'
  | 'welcome'
  | 'features'
  | 'preferences'
  | 'notifications'
  | 'complete';

export interface OnboardingState {
  isComplete: boolean;
  hasHydrated: boolean;
  currentStep: OnboardingStep;
  preferences: OnboardingPreferences;
}

export interface OnboardingPreferences {
  country: string;
  currency: string;
  areaUnit: 'hectares' | 'acres';
  notificationsEnabled: boolean;
}

export interface OnboardingFeature {
  id: 'addFarms' | 'trackEverything' | 'waterManagement' | 'labTests' | 'reports';
  icon: string;
  color: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'language',
  'welcome',
  'features',
  'preferences',
  'notifications',
  'complete',
];

export const ONBOARDING_FEATURES: OnboardingFeature[] = [
  {
    id: 'addFarms',
    icon: 'plus.circle.fill',
    color: '#1a5d1a',
  },
  {
    id: 'trackEverything',
    icon: 'chart.bar.fill',
    color: '#F59E0B',
  },
  {
    id: 'waterManagement',
    icon: 'drop.fill',
    color: '#3B82F6',
  },
  {
    id: 'labTests',
    icon: 'flask.fill',
    color: '#8B5CF6',
  },
  {
    id: 'reports',
    icon: 'doc.text.fill',
    color: '#EF4444',
  },
];

export const COUNTRIES = [
  'India',
  'USA',
  'Australia',
  'Spain',
  'Italy',
  'France',
  'Chile',
  'Argentina',
  'South Africa',
  'Other',
];
