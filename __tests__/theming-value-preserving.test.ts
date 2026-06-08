import { getM3Theme, getThemeColors } from '@/styles/theme';

// Throwaway verification: every new M3 token must equal the exact legacy
// palette value it replaced, in BOTH light and dark. This is the
// "value-preserving / pixel-identical" claim, checked at the source.
describe.each([
  ['light', false],
  ['dark', true],
])('theming consolidation is value-preserving (%s)', (_label, isDark) => {
  const m3 = getM3Theme(isDark as boolean);
  const c = getThemeColors(isDark as boolean);

  test('surface ramp s50..s900 === colors.surface[N]', () => {
    for (const n of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      expect((m3.surface as Record<string, string>)[`s${n}`]).toBe(
        (c.surface as Record<number, string>)[n],
      );
    }
  });

  test('primary ramp p50..p950 === colors.primary[N]', () => {
    for (const n of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
      expect((m3.primary as Record<string, string>)[`p${n}`]).toBe(
        (c.primary as Record<number, string>)[n],
      );
    }
  });

  test('neutral ramp n50..n900 === colors.gray[N]', () => {
    for (const n of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      expect((m3.neutral as Record<string, string>)[`n${n}`]).toBe(
        (c.gray as Record<number, string>)[n],
      );
    }
  });

  test('status + accent + info roles === legacy flat values', () => {
    expect(m3.colorScheme.error).toBe(c.error);
    expect(m3.colorScheme.success).toBe(c.success);
    expect(m3.colorScheme.warning).toBe(c.warning);
    expect(m3.colorScheme.secondary).toBe(c.secondary[500]);
    expect(m3.colorScheme.accent).toBe(c.accent[500]);
    expect(m3.colorScheme.info).toBe(c.info);
  });
});
