/**
 * Worker Settlement Service
 * Handles worker settlement calculations and creation
 */

import { supabase } from '@/lib/supabase';
import type { WorkerSettlement, WorkerSettlementInsert } from '@/types';

interface SettlementCalculation {
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

/**
 * Create and confirm a worker settlement
 */
export async function createWorkerSettlement(
  settlement: WorkerSettlementInsert,
): Promise<WorkerSettlement> {
  // Create settlement as draft
  const { data: createdSettlement, error: insertError } = await supabase
    .from('worker_settlements')
    .insert({
      worker_id: settlement.worker_id,
      farm_id: settlement.farm_id ?? null,
      period_start: settlement.period_start,
      period_end: settlement.period_end,
      days_worked: settlement.days_worked,
      gross_amount: settlement.gross_amount,
      advance_deducted: settlement.advance_deducted,
      net_payment: settlement.net_payment,
      status: 'confirmed',
      notes: settlement.notes ?? null,
      confirmed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) throw insertError;

  // Create advance deduction transaction if applicable
  if (settlement.advance_deducted > 0) {
    const { error: txError } = await supabase.from('worker_transactions').insert({
      worker_id: settlement.worker_id,
      farm_id: settlement.farm_id ?? null,
      date: new Date().toISOString().split('T')[0],
      type: 'advance_deducted',
      amount: settlement.advance_deducted,
      settlement_id: createdSettlement.id,
      notes: null,
    });

    if (txError) throw txError;

    // Update worker's advance balance
    const { data: workerData, error: fetchError } = await supabase
      .from('workers')
      .select('advance_balance')
      .eq('id', settlement.worker_id)
      .single();

    if (fetchError) throw fetchError;

    if (workerData) {
      const { error: updateError } = await supabase
        .from('workers')
        .update({
          advance_balance: Math.max(0, workerData.advance_balance - settlement.advance_deducted),
        })
        .eq('id', settlement.worker_id);

      if (updateError) throw updateError;
    }
  }

  // Create payment transaction if applicable
  if (settlement.net_payment > 0) {
    const { error: paymentError } = await supabase.from('worker_transactions').insert({
      worker_id: settlement.worker_id,
      farm_id: settlement.farm_id ?? null,
      date: new Date().toISOString().split('T')[0],
      type: 'payment',
      amount: settlement.net_payment,
      settlement_id: createdSettlement.id,
      notes: null,
    });

    if (paymentError) throw paymentError;
  }

  return createdSettlement;
}
