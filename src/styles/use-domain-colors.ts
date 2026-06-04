import { useMemo } from 'react';
import { getThemeColors } from './theme';
import { useIsDark } from './use-theme';

/**
 * Dark-aware DOMAIN colors (category / water-status / lab-test).
 *
 * These are the non-generic, semantically-named colors that the M3 colorScheme
 * deliberately does not model. They are sourced from the same dark-aware
 * `getThemeColors(isDark)` ramp as `useThemeColors()`, so values are identical —
 * this is a pure relocation, not a re-color. Use this for category dots, water
 * status, and lab-test colors instead of the legacy `colors.*` palette.
 *
 * See docs/theming-consolidation-proposal.md §3.
 */
export const useDomainColors = () => {
  const isDark = useIsDark();
  return useMemo(() => {
    const c = getThemeColors(isDark);
    return {
      category: {
        irrigation: c.irrigation[500],
        spray: c.spray[500],
        fertigation: c.fertigation[500],
        harvest: c.harvest[500],
        labour: c.labour[500],
        note: c.note[500],
        observation: c.observation[500],
        task: c.task[500],
        expense: c.expense[500],
      },
      water: {
        critical: c.water.critical,
        low: c.water.low,
        medium: c.water.medium,
        good: c.water.good,
      },
      labTest: {
        soil: c.labTest.soil,
        petiole: c.labTest.petiole,
      },
    };
  }, [isDark]);
};
