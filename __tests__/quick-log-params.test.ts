// The fast-path route file pulls in the heavy ReceiptLogScreen; mock it (and
// the onboarding activation side-effects) so we can unit-test the exported
// param parsers in isolation.
jest.mock('@/components/screens/receipt-log-screen', () => ({
  ReceiptLogScreen: () => null,
}));
jest.mock('@/hooks/use-safe-back', () => ({
  useSafeBack: () => jest.fn(),
}));
jest.mock('@/features/onboarding/activation', () => ({
  markOnboardingFirstActionCompleted: jest.fn(),
  parseOnboardingActionType: jest.fn(() => null),
  parseOnboardingFlag: jest.fn(() => false),
}));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

import { parseQuickFarmId, parseQuickLogType } from '../app/log-entry/quick';

describe('parseQuickFarmId', () => {
  it('parses a valid numeric farmId', () => {
    expect(parseQuickFarmId('12')).toBe(12);
    expect(parseQuickFarmId(['7'])).toBe(7);
  });

  it('returns null for missing, non-numeric, or all-farms values', () => {
    expect(parseQuickFarmId(undefined)).toBeNull();
    expect(parseQuickFarmId('all')).toBeNull();
    expect(parseQuickFarmId('abc')).toBeNull();
    expect(parseQuickFarmId('')).toBeNull();
  });
});

describe('parseQuickLogType', () => {
  it('accepts valid LogTypeId values', () => {
    expect(parseQuickLogType('irrigation')).toBe('irrigation');
    expect(parseQuickLogType('note')).toBe('note');
    expect(parseQuickLogType(['spray'])).toBe('spray');
    expect(parseQuickLogType('fertigation')).toBe('fertigation');
  });

  it('returns null for invalid or absent values', () => {
    expect(parseQuickLogType('bogus')).toBeNull();
    expect(parseQuickLogType(undefined)).toBeNull();
    expect(parseQuickLogType('')).toBeNull();
  });
});
