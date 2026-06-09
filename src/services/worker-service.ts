/**
 * Worker Settlement Service
 * Handles worker settlement calculations and creation
 */

import { supabase } from '@/lib/supabase';
import type { WorkerSettlement, WorkerSettlementInsert } from '@/types';

export interface SettlementCalculation {
  days_worked: number;
  gross_amount: number;
  attendance_details: Array<{
    date: string;
    work_status: 'full_day' | 'half_day';
    work_type: string;
    rate: number;
    earnings: number;
  }>;
}

/** Per-status rollup of a settlement's attendance, for the ledger display. */
export interface SettlementLedgerSummary {
  fullDays: number;
  halfDays: number;
  /** Uniform rate across all full/half days, or null when rates differ. */
  fullRate: number | null;
  halfRate: number | null;
  fullEarnings: number;
  halfEarnings: number;
}

/**
 * Pure rollup of attendance detail rows into full/half-day counts, the uniform rate
 * for each band (null when rates differ), and summed earnings. Extracted from the
 * settlement modal so the ledger math is testable without rendering the (1k-line) modal.
 */
export function summarizeSettlementLedger(
  attendanceDetails: Array<{ work_status: 'full_day' | 'half_day'; rate: number; earnings: number }>,
): SettlementLedgerSummary {
  const fullDays = attendanceDetails.filter((d) => d.work_status === 'full_day');
  const halfDays = attendanceDetails.filter((d) => d.work_status === 'half_day');
  const uniformRate = (days: typeof fullDays): number | null => {
    const rates = Array.from(new Set(days.map((d) => d.rate)));
    return rates.length === 1 ? rates[0] : null;
  };
  return {
    fullDays: fullDays.length,
    halfDays: halfDays.length,
    fullRate: uniformRate(fullDays),
    halfRate: uniformRate(halfDays),
    fullEarnings: fullDays.reduce((a, d) => a + d.earnings, 0),
    halfEarnings: halfDays.reduce((a, d) => a + d.earnings, 0),
  };
}

/**
 * Calculate settlement for a worker for a given period
 */
export async function calculateWorkerSettlement(
  workerId: number,
  farmId: number | null,
  periodStart: string,
  periodEnd: string,
): Promise<SettlementCalculation> {
  // Get worker's default rate
  const { data: worker, error: workerError } = await supabase
    .from('workers')
    .select('*')
    .eq('id', workerId)
    .single();

  if (workerError) throw workerError;

  // Get attendance records for period
  let query = supabase
    .from('worker_attendance')
    .select('*')
    .eq('worker_id', workerId)
    .gte('date', periodStart)
    .lte('date', periodEnd)
    .neq('work_status', 'absent')
    .order('date');

  if (farmId) {
    query = query.contains('farm_ids', [farmId]);
  }

  const { data: attendance, error: attendanceError } = await query;

  if (attendanceError) throw attendanceError;

  let totalDays = 0;
  let grossAmount = 0;
  const details: SettlementCalculation['attendance_details'] = [];

  for (const record of attendance || []) {
    const rate = record.daily_rate_override ?? worker.daily_rate;
    const dayFraction = record.work_status === 'full_day' ? 1 : 0.5;
    const earnings = rate * dayFraction;

    totalDays += dayFraction;
    grossAmount += earnings;

    details.push({
      date: record.date,
      work_status: record.work_status,
      work_type: record.work_type,
      rate,
      earnings,
    });
  }

  return {
    days_worked: totalDays,
    gross_amount: grossAmount,
    attendance_details: details,
  };
}

/** Injectable dependencies for the worker-settlement seam (defaults to the real client). */
export interface WorkerLedgerDeps {
  client?: Pick<typeof supabase, 'rpc'>;
}

/**
 * Atomically record a worker settlement and apply its advance-balance delta via the
 * settle_worker RPC: the settlement row, the advance/payment transactions, and the
 * advance_balance decrement all land in one server-side transaction (computed from the
 * worker row's own value under a row lock), or none do. Replaces the old client-side
 * read-modify-write of advance_balance plus best-effort compensating delete
 * (see docs/multi-device-write-safety.html).
 */
export async function settleWorker(
  settlement: WorkerSettlementInsert,
  deps: WorkerLedgerDeps = {},
): Promise<WorkerSettlement> {
  const client = deps.client ?? supabase;
  const { data, error } = await client.rpc('settle_worker', {
    p_worker_id: settlement.worker_id,
    p_farm_id: settlement.farm_id ?? null,
    p_period_start: settlement.period_start,
    p_period_end: settlement.period_end,
    p_days_worked: settlement.days_worked,
    p_gross_amount: settlement.gross_amount,
    p_advance_deducted: settlement.advance_deducted,
    p_net_payment: settlement.net_payment,
    p_status: settlement.status ?? 'confirmed',
    p_notes: settlement.notes ?? null,
  });
  if (error) throw error;
  return data as WorkerSettlement;
}
