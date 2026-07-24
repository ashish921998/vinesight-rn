import { useMemo } from 'react';
import { LOG_TYPES, type LogTypeId } from '@/constants/calculator-models';
import { useDomainColors } from '@/styles/use-domain-colors';

type LogPresentation = { icon: string; color: string };

/**
 * Single typed presentation (icon + color) for every log type. Icons come from
 * the canonical LOG_TYPES model (ICON_REGISTRY); colors come from the dark-aware
 * domain ramp. Both the quick-action grid and the recent-activity list read from
 * this one map, so a log type can never render with two different glyphs/colors.
 */
export function useLogPresentation(): Record<LogTypeId, LogPresentation> {
  const domain = useDomainColors();
  return useMemo(() => {
    const colorFor: Record<LogTypeId, string> = {
      irrigation: domain.category.irrigation,
      spray: domain.category.spray,
      harvest: domain.category.harvest,
      expense: domain.category.expense,
      fertigation: domain.category.fertigation,
      note: domain.category.note,
    };
    return LOG_TYPES.reduce(
      (acc, { id, icon }) => {
        acc[id] = { icon, color: colorFor[id] };
        return acc;
      },
      {} as Record<LogTypeId, LogPresentation>,
    );
  }, [domain]);
}
