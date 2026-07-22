import {
  filterAttentionItemsForMode,
  isAttentionItemVisibleInMode,
} from '@/utils/dashboard-attention';
import type { TodayNeedAttentionItem } from '@/hooks/use-dashboard-stats';

const item = (type: TodayNeedAttentionItem['type']): TodayNeedAttentionItem =>
  ({
    id: `${type}-1`,
    type,
    severity: 'medium',
    farmId: 1,
    farmName: 'Farm 1',
  }) as TodayNeedAttentionItem;

describe('isAttentionItemVisibleInMode', () => {
  it('hides overdueTask in Simplified mode', () => {
    expect(isAttentionItemVisibleInMode(item('overdueTask'), false)).toBe(false);
  });

  it('keeps overdueTask in Detailed mode', () => {
    expect(isAttentionItemVisibleInMode(item('overdueTask'), true)).toBe(true);
  });

  it('keeps noRecentLogs and phiDeadline in both modes', () => {
    for (const detailed of [false, true]) {
      expect(isAttentionItemVisibleInMode(item('noRecentLogs'), detailed)).toBe(true);
      expect(isAttentionItemVisibleInMode(item('phiDeadline'), detailed)).toBe(true);
    }
  });
});

describe('filterAttentionItemsForMode', () => {
  const items = [
    item('overdueTask'),
    item('noRecentLogs'),
    item('phiDeadline'),
    item('lowWaterLevel'),
  ];

  it('drops overdueTask in Simplified mode', () => {
    const result = filterAttentionItemsForMode(items, false).map((i) => i.type);
    expect(result).toEqual(['noRecentLogs', 'phiDeadline', 'lowWaterLevel']);
  });

  it('keeps everything in Detailed mode', () => {
    const result = filterAttentionItemsForMode(items, true).map((i) => i.type);
    expect(result).toEqual(['overdueTask', 'noRecentLogs', 'phiDeadline', 'lowWaterLevel']);
  });

  it('returns an empty array for nullish input', () => {
    expect(filterAttentionItemsForMode(undefined, false)).toEqual([]);
    expect(filterAttentionItemsForMode(null, true)).toEqual([]);
  });
});
