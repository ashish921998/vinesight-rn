import { resolveNextPageIndex } from '@/features/onboarding/onboarding-screen';

describe('resolveNextPageIndex', () => {
  it('advances to the next page', () => {
    expect(resolveNextPageIndex(0)).toBe(1);
    expect(resolveNextPageIndex(2)).toBe(3);
  });

  it('clamps at the last page (5 pages, indices 0-4)', () => {
    expect(resolveNextPageIndex(4)).toBe(4);
  });
});
