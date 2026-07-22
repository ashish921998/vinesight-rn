import { buildFullName } from '@/stores/auth-phone';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), auth: {} },
}));

jest.mock('@/lib/query-cache', () => ({
  queryClient: {
    clear: jest.fn(),
    setQueryData: jest.fn(),
    invalidateQueries: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/services/telemetry', () => ({
  telemetry: { capture: jest.fn(), identify: jest.fn(), reset: jest.fn(), screen: jest.fn() },
}));

describe('buildFullName', () => {
  it('joins first and last name with a space', () => {
    expect(buildFullName('Asha', 'Patil')).toBe('Asha Patil');
  });

  it('returns the first name alone when last name is blank', () => {
    expect(buildFullName('Asha', '')).toBe('Asha');
  });

  it('trims surrounding whitespace', () => {
    expect(buildFullName('Asha', '  ')).toBe('Asha');
  });
});
