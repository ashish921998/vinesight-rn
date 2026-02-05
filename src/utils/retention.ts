import type { CapabilityLimit } from '@/types';
import { isUnlimited, limitToNumber } from './capabilities';

export interface RetentionRecord {
  created_at?: string | null;
  date?: string | null;
}

export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  const desiredMonth = result.getMonth() + months;
  result.setMonth(desiredMonth);

  // Handle month overflow (e.g., Jan 31 -> Feb 31 -> Mar 2). Clamp to last day of month.
  if (result.getMonth() !== ((desiredMonth % 12) + 12) % 12) {
    result.setDate(0);
  }

  return result;
};

export const getRecordBaseDate = (record: RetentionRecord): Date | null => {
  const candidate = record.created_at || record.date;
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getRetentionCutoff = (
  retentionMonths: CapabilityLimit | undefined | null,
  now = new Date(),
): Date | null => {
  const months = limitToNumber(retentionMonths);
  if (months === null) return null;
  return addMonths(now, -months);
};

export const isWithinRetention = (
  baseDate: Date | null,
  retentionMonths: CapabilityLimit | undefined | null,
  now = new Date(),
): boolean => {
  if (!baseDate) return true;
  if (isUnlimited(retentionMonths)) return true;
  const months = limitToNumber(retentionMonths);
  if (months === null) return true;
  const cutoff = getRetentionCutoff(retentionMonths, now);
  if (!cutoff) return true;
  return baseDate >= cutoff;
};

export const getRetentionExpiryDate = (
  baseDate: Date | null,
  retentionMonths: CapabilityLimit | undefined | null,
): Date | null => {
  if (!baseDate) return null;
  if (isUnlimited(retentionMonths)) return null;
  const months = limitToNumber(retentionMonths);
  if (months === null) return null;
  return addMonths(baseDate, months);
};

export const getDaysUntil = (date: Date, now = new Date()): number => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(0, 0, 0, 0);
  const diff = end.getTime() - start.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};
