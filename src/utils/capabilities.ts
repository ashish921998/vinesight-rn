import type { CapabilityLimit } from '@/types';

export const isUnlimited = (limit: CapabilityLimit | undefined | null): boolean =>
  limit === 'unlimited';

export const limitToNumber = (limit: CapabilityLimit | undefined | null): number | null => {
  if (limit === 'unlimited' || limit === undefined || limit === null) return null;
  if (typeof limit === 'number' && Number.isFinite(limit)) return limit;
  return null;
};

export const isLimitReached = (current: number, limit: CapabilityLimit | undefined | null) => {
  const numericLimit = limitToNumber(limit);
  if (numericLimit === null) return false;
  return current >= numericLimit;
};

export const formatLimit = (limit: CapabilityLimit | undefined | null): string => {
  if (limit === 'unlimited') return '∞';
  if (typeof limit === 'number' && Number.isFinite(limit)) return limit.toString();
  return '--';
};
