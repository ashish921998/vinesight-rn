import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LOG_TYPES, type LogTypeId } from '@/constants/calculator-models';
import { type RegistryIconName } from '@/constants/icon-registry';
import { useDomainColors } from '@/styles/use-domain-colors';

export type LogPresentation = { icon: RegistryIconName; color: string; label: string };

/**
 * Single typed presentation (icon + color + label) for every log type. Icons and
 * labels come from the canonical LOG_TYPES model; colors come from the dark-aware domain ramp,
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
  const { t } = useTranslation();
  return useMemo(() => {
    const presentationFor = (id: LogTypeId): LogPresentation => {
      const logType = LOG_TYPES.find((lt) => lt.id === id);
      if (logType === undefined) {
        throw new Error(`useLogPresentation: LOG_TYPES has no entry for "${id}"`);
      }
      return { icon: logType.icon, color: domain.category[id], label: t(logType.labelKey) };
    };
    return {
      irrigation: presentationFor('irrigation'),
      spray: presentationFor('spray'),
      harvest: presentationFor('harvest'),
      expense: presentationFor('expense'),
      fertigation: presentationFor('fertigation'),
      note: presentationFor('note'),
    } satisfies Record<LogTypeId, LogPresentation>;
  }, [domain, t]);
}
