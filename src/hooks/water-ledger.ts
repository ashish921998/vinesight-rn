/**
 * Water ledger — the single seam for mutating a farm's water balance.
 *
 * Farm water level (`farms.remaining_water`) used to be changed by a client-side
 * read-modify-write smeared across the irrigation submit path, the manual water sheet,
 * and the session rollback. Concurrent writers silently lost updates (see
 * docs/multi-device-write-safety.html). This module routes irrigation's effect on the
 * balance through atomic server RPCs (log_irrigation / revert_irrigation) so the delta
 * is computed from the row's own current value, never a stale snapshot.
 *
 * The data-ops take the Supabase client + season resolver as injectable deps so they
 * are unit-testable without a live backend; the hooks add React Query invalidation.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase as defaultClient } from '../lib/supabase';
import { resolveOptionalSeasonIdForDate as defaultResolveSeasonId } from '../lib/season-context';
import { queryKeys } from './query-keys';
import type { IrrigationRecordInsert } from '../types';

type LedgerClient = typeof defaultClient;

export interface WaterLedgerDeps {
  client?: LedgerClient;
  resolveSeasonId?: typeof defaultResolveSeasonId;
}

export interface LogIrrigationResult {
  id: number | null;
  /**
   * Exact amount this irrigation added to remaining_water (clamped to tank capacity);
   * 0 on farms without tank-capacity config. Stored so a rollback can subtract the
   * precise amount rather than guessing.
   */
  waterDelta: number;
}

/**
 * Atomically insert an irrigation record AND apply its water delta via the
 * `log_irrigation` RPC. Replaces the old insert-then-absolute-write.
 */
export async function logIrrigation(
  payload: IrrigationRecordInsert,
  { client = defaultClient, resolveSeasonId = defaultResolveSeasonId }: WaterLedgerDeps = {},
): Promise<LogIrrigationResult> {
  const seasonId =
    payload.season_id ?? (await resolveSeasonId({ farmId: payload.farm_id, date: payload.date }));
  const { data, error } = await client.rpc('log_irrigation', {
    p_farm_id: payload.farm_id,
    p_date: payload.date,
    p_duration: payload.duration,
    p_area: payload.area,
    p_growth_stage: payload.growth_stage ?? '',
    p_moisture_status: payload.moisture_status ?? '',
    p_system_discharge: payload.system_discharge ?? 0,
    p_date_of_pruning: payload.date_of_pruning ?? null,
    p_season_id: seasonId ?? null,
  });
  if (error) throw error;
  const result = data as { record?: { id?: number | null } | null; water_delta?: number } | null;
  return { id: result?.record?.id ?? null, waterDelta: Number(result?.water_delta ?? 0) };
}

/**
 * Atomically delete an irrigation record and subtract the exact delta it applied via
 * the `revert_irrigation` RPC. Used to roll back an irrigation when a later draft in the
 * same Activity stack save fails.
 */
export async function revertIrrigation(
  payload: { recordId: number; waterDelta: number },
  { client = defaultClient }: WaterLedgerDeps = {},
): Promise<void> {
  const { error } = await client.rpc('revert_irrigation', {
    p_record_id: payload.recordId,
    p_water_delta: payload.waterDelta,
  });
  if (error) throw error;
}

export function useLogIrrigation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: IrrigationRecordInsert) => logIrrigation(payload),
    onSuccess: (_result, payload) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.irrigationRecords.listByFarm(payload.farm_id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.irrigationRecords.lists() });
      // Water balance lives on the farm row.
      queryClient.invalidateQueries({ queryKey: queryKeys.farms.all });
    },
  });
}

export function useRevertIrrigation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { recordId: number; waterDelta: number }) => revertIrrigation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.irrigationRecords.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.farms.all });
    },
  });
}
