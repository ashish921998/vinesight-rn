/**
 * Worker Settlement Service
 * Handles worker settlement calculations and creation
 */

import { getDataAccess } from '@/data-access';
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
  const worker = await getDataAccess().workers.getWorker(workerId);
  if (!worker) throw new Error(`Worker ${workerId} not found`);

  // Get attendance records for period
  const attendance = await getDataAccess().workers.getAttendance({
    workerId,
    periodStart,
    periodEnd,
    farmId,
  });

  let totalDays = 0;
  let grossAmount = 0;
  const details: SettlementCalculation['attendance_details'] = [];

  for (const record of attendance || []) {
    if (record.work_status === 'absent') continue;
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
 * Create a worker settlement with the given status.
 */
export async function createWorkerSettlement(
  settlement: WorkerSettlementInsert,
): Promise<WorkerSettlement> {
  const status = settlement.status ?? 'confirmed';
  const createdSettlement = await getDataAccess().workers.createSettlement({
    worker_id: settlement.worker_id,
    farm_id: settlement.farm_id ?? null,
    period_start: settlement.period_start,
    period_end: settlement.period_end,
    days_worked: settlement.days_worked,
    gross_amount: settlement.gross_amount,
    advance_deducted: settlement.advance_deducted,
    net_payment: settlement.net_payment,
    status,
    notes: settlement.notes ?? null,
    confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
  });
  if (createdSettlement.id === undefined) {
    throw new Error('Created worker settlement did not return an id');
  }

  if (status === 'confirmed') {
    try {
      // Create advance deduction transaction if applicable
      if (settlement.advance_deducted > 0) {
        await getDataAccess().workers.createTransaction({
          worker_id: settlement.worker_id,
          farm_id: settlement.farm_id ?? null,
          date: new Date().toISOString().split('T')[0],
          type: 'advance_deducted',
          amount: settlement.advance_deducted,
          settlement_id: createdSettlement.id,
          notes: null,
        });

        // Update worker's advance balance
        const advanceBalance = await getDataAccess().workers.getAdvanceBalance(
          settlement.worker_id,
        );
        if (advanceBalance !== null) {
          await getDataAccess().workers.updateAdvanceBalance(
            settlement.worker_id,
            Math.max(0, advanceBalance - settlement.advance_deducted),
          );
        }
      }

      // Create payment transaction if applicable
      if (settlement.net_payment > 0) {
        await getDataAccess().workers.createTransaction({
          worker_id: settlement.worker_id,
          farm_id: settlement.farm_id ?? null,
          date: new Date().toISOString().split('T')[0],
          type: 'payment',
          amount: settlement.net_payment,
          settlement_id: createdSettlement.id,
          notes: null,
        });
      }
    } catch (error) {
      // Rollback: delete the settlement if any subsequent step fails
      await getDataAccess().workers.deleteSettlement(createdSettlement.id);
      throw error;
    }
  }

  return createdSettlement;
}
