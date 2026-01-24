/**
 * Onboarding Types for Vinesight
 * Types for the onboarding flow
 */

export type OnboardingStep = 'welcome' | 'features' | 'preferences' | 'notifications' | 'complete';

export interface OnboardingState {
  isComplete: boolean;
  currentStep: OnboardingStep;
  preferences: OnboardingPreferences;
}

export interface OnboardingPreferences {
  country: string;
  areaUnit: 'hectares' | 'acres';
  notificationsEnabled: boolean;
}

export interface OnboardingFeature {
  icon: string;
  title: string;
  description: string;
  color: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'welcome',
  'features',
  'preferences',
  'notifications',
  'complete',
];

export const ONBOARDING_FEATURES: OnboardingFeature[] = [
  {
    icon: 'add-circle',
    title: 'Add Your Farms',
    description:
      'Create farms with details like location, crop type, and area. Manage multiple farms from one place.',
    color: '#1a5d1a',
  },
  {
    icon: 'stats-chart',
    title: 'Track Everything',
    description:
      'Log irrigation, sprays, harvests, expenses, and more. All your records in one place.',
    color: '#F59E0B',
  },
  {
    icon: 'water',
    title: 'Smart Water Management',
    description: 'Automatic water level calculations based on weather and soil conditions.',
    color: '#3B82F6',
  },
  {
    icon: 'flask',
    title: 'Lab Test Results',
    description: 'Store and analyze soil and petiole test results with nutrient tracking.',
    color: '#8B5CF6',
  },
  {
    icon: 'document-text',
    title: 'Generate Reports',
    description: 'Create date-range reports to track productivity and analyze farm performance.',
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
