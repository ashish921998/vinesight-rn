import type { Worker, WorkerAttendance, WorkerTransaction, WorkStatus } from '@/types';
import { calculateWorkerEarnings, getStatusMultiplier } from '@/types';

export interface WorkerAnalyticsMetrics {
  workerId: number;
  fullDays: number;
  halfDays: number;
  absentDays: number;
  workDaysEquivalent: number;
  attendanceRate: number;
  earnings: number;
  payments: number;
  advancesGiven: number;
  advancesDeducted: number;
  netBalance: number;
  overrideUsageRate: number;
}

export interface WorkerAnalyticsOverview {
  totalWorkDays: number;
  attendanceRate: number;
  totalEarnings: number;
  netBalance: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface WeeklySummary {
  start: string;
  end: string;
  workDaysEquivalent: number;
  earnings: number;
}

export function getDefaultDateRange(days = 30): DateRange {
  const today = new Date();
  const to = normalizeDate(today);
  const from = addDays(to, -(days - 1));
  return { from, to };
}

export function normalizeDate(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getDateRangeDays(range: DateRange): number {
  const start = normalizeDate(range.from).getTime();
  const end = normalizeDate(range.to).getTime();
  const diff = Math.floor((end - start) / (1000 * 60 * 60 * 24));
  return diff + 1;
}

export function isDateInRange(dateStr: string, range: DateRange): boolean {
  const date = normalizeDate(new Date(`${dateStr}T00:00:00`));
  return date >= normalizeDate(range.from) && date <= normalizeDate(range.to);
}

export function computeWorkerMetrics(
  worker: Worker,
  attendance: WorkerAttendance[],
  transactions: WorkerTransaction[],
  range: DateRange,
): WorkerAnalyticsMetrics {
  let fullDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let workDaysEquivalent = 0;
  let earnings = 0;
  let overrideCount = 0;

  attendance.forEach((record) => {
    if (!isDateInRange(record.date, range)) return;
    const status = record.work_status as WorkStatus;
    const multiplier = getStatusMultiplier(status);
    workDaysEquivalent += multiplier;
    earnings += calculateWorkerEarnings(worker, status, record.daily_rate_override ?? undefined);
    if (record.daily_rate_override !== null && record.daily_rate_override !== undefined) {
      overrideCount += 1;
    }
    if (status === 'full_day') fullDays += 1;
    if (status === 'half_day') halfDays += 1;
    if (status === 'absent') absentDays += 1;
  });

  const payments = sumTransactions(transactions, 'payment', range);
  const advancesGiven = sumTransactions(transactions, 'advance_given', range);
  const advancesDeducted = sumTransactions(transactions, 'advance_deducted', range);
  const netBalance = earnings - payments - advancesGiven + advancesDeducted;

  const totalDays = getDateRangeDays(range);
  const attendanceRate = totalDays > 0 ? workDaysEquivalent / totalDays : 0;
  const overrideUsageRate = attendance.length > 0 ? overrideCount / attendance.length : 0;

  return {
    workerId: worker.id ?? 0,
    fullDays,
    halfDays,
    absentDays,
    workDaysEquivalent,
    attendanceRate,
    earnings,
    payments,
    advancesGiven,
    advancesDeducted,
    netBalance,
    overrideUsageRate,
  };
}

export function computeOverview(metrics: WorkerAnalyticsMetrics[]): WorkerAnalyticsOverview {
  const totalWorkDays = metrics.reduce((sum, m) => sum + m.workDaysEquivalent, 0);
  const totalEarnings = metrics.reduce((sum, m) => sum + m.earnings, 0);
  const netBalance = metrics.reduce((sum, m) => sum + m.netBalance, 0);
  const attendanceRate =
    metrics.length > 0 ? metrics.reduce((sum, m) => sum + m.attendanceRate, 0) / metrics.length : 0;

  return {
    totalWorkDays,
    attendanceRate,
    totalEarnings,
    netBalance,
  };
}

export function getWeeklySummaries(
  worker: Worker,
  attendance: WorkerAttendance[],
  range: DateRange,
): WeeklySummary[] {
  const start = normalizeDate(range.from);
  const end = normalizeDate(range.to);
  const summaries: WeeklySummary[] = [];

  let cursor = new Date(start);
  while (cursor <= end) {
    const weekStart = new Date(cursor);
    const weekEnd = addDays(weekStart, 6);
    const effectiveEnd = weekEnd <= end ? weekEnd : end;

    const weekRange: DateRange = { from: weekStart, to: effectiveEnd };
    const weekAttendance = attendance.filter((record) => isDateInRange(record.date, weekRange));

    let workDaysEquivalent = 0;
    let earnings = 0;
    weekAttendance.forEach((record) => {
      const status = record.work_status as WorkStatus;
      workDaysEquivalent += getStatusMultiplier(status);
      earnings += calculateWorkerEarnings(worker, status, record.daily_rate_override ?? undefined);
    });

    summaries.push({
      start: weekStart.toISOString().split('T')[0],
      end: effectiveEnd.toISOString().split('T')[0],
      workDaysEquivalent,
      earnings,
    });

    cursor = addDays(weekStart, 7);
  }

  return summaries;
}

function sumTransactions(
  transactions: WorkerTransaction[],
  type: WorkerTransaction['type'],
  range: DateRange,
): number {
  return transactions
    .filter((tx) => tx.type === type && isDateInRange(tx.date, range))
    .reduce((sum, tx) => sum + tx.amount, 0);
}
