import type { TodayNeedAttentionItem } from '@/hooks/use-dashboard-stats';

/**
 * Whether a single "Today Needs Attention" item should be shown for the given
 * app mode. In Simplified mode (`detailedMode === false`) we hide
 * `overdueTask` items because they route to the now-gated `/tasks` screen;
 * the remaining Simplified-reachable items (`noRecentLogs` → fast-path log,
 * `phiDeadline` → spray-safe-checker) stay visible. Detailed mode shows all.
 */
export function isAttentionItemVisibleInMode(
  item: Pick<TodayNeedAttentionItem, 'type'>,
  detailedMode: boolean,
): boolean {
  if (!detailedMode && item.type === 'overdueTask') return false;
  return true;
}

/** Filter a list of attention items to those visible in the given app mode. */
export function filterAttentionItemsForMode<T extends Pick<TodayNeedAttentionItem, 'type'>>(
  items: T[] | undefined | null,
  detailedMode: boolean,
): T[] {
  if (!items) return [];
  return items.filter((item) => isAttentionItemVisibleInMode(item, detailedMode));
}
