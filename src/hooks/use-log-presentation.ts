import { useMemo } from 'react';
import { LOG_TYPES, type LogTypeId } from '@/constants/calculator-models';
import { type RegistryIconName } from '@/constants/icon-registry';
import { useDomainColors } from '@/styles/use-domain-colors';

type LogPresentation = { icon: RegistryIconName; color: string };

/**
 * Single typed presentation (icon + color) for every log type. Icons come from
 * the canonical LOG_TYPES model; colors come from the dark-aware domain ramp,
 * indexed directly by LogTypeId — `domain.category` is keyed by a superset of
 * every LogTypeId, so there is no per-type color map to drift out of sync.
 *
 * The map is an explicit object literal keyed by every LogTypeId and checked
 * with `satisfies Record<LogTypeId, LogPresentation>`, so adding a new LogTypeId
 * without a branch here is a compile-time error — there is no unsafe
 * `as Record<...>` assertion that could mask a missing entry. Consumers can
 * therefore index `presentation[activity.type]` knowing it is always present.
 */
export function useLogPresentation(): Record<LogTypeId, LogPresentation> {
  const domain = useDomainColors();
  return useMemo(() => {
    const presentationFor = (id: LogTypeId): LogPresentation => {
      const icon = LOG_TYPES.find((lt) => lt.id === id)?.icon;
      if (icon === undefined) {
        throw new Error(`useLogPresentation: LOG_TYPES has no icon for "${id}"`);
      }
      return { icon, color: domain.category[id] };
    };
    return {
      irrigation: presentationFor('irrigation'),
      spray: presentationFor('spray'),
      harvest: presentationFor('harvest'),
      expense: presentationFor('expense'),
      fertigation: presentationFor('fertigation'),
      note: presentationFor('note'),
    } satisfies Record<LogTypeId, LogPresentation>;
  }, [domain]);
}
