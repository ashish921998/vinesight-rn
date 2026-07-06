/**
 * Shared resolution of a farm's area in canonical acres.
 *
 * `farms.area` is the raw number the owner typed under their area-unit
 * preference (`profiles.area_unit_preference`), NOT canonical acres — it must
 * be converted through {@link convertAreaToAcres} before any per-acre math
 * (nutrient totals, plan-card plot totals, etc.).
 *
 * Mirrors the server-side resolution in the `stamp_fertilizer_plan_farm_area`
 * trigger (supabase/migrations/20260705120000_fertilizer_plan_area_snapshot.sql),
 * which joins `profiles` on `farms.user_id`.
 *
 * Call sites MUST use this hook rather than inlining the conversion, so a
 * future change to the resolution lands in one place. Centralizing it also
 * fixes delegated mode, where the signed-in consultant's preference differs
 * from the client's — pass the client's unit via `areaUnitOverride` so the
 * payload uses the same basis the plan/record was written against.
 */
import { useProfile } from './use-profile';
import { useAuthStore } from '../stores';
import {
  convertAreaToAcres,
  resolveAreaUnitPreference,
  type AreaUnitPreference,
} from '../utils/preferences';

export interface UseFarmAreaAcresResult {
  /** Resolved preference (defaults to 'acres' for unknown/null). */
  preferredAreaUnit: AreaUnitPreference;
  /** Canonical acres, or null when the area is missing/zero/non-finite. */
  farmAreaAcres: number | null;
}

export function useFarmAreaAcres(
  area: number | null | undefined,
  areaUnitOverride?: AreaUnitPreference | null,
): UseFarmAreaAcresResult {
  const { data: profile } = useProfile({ enabled: false });
  const user = useAuthStore((state) => state.user);
  // The delegated path overrides with the CLIENT's preference; the farmer path
  // reads the signed-in user's profile (then auth_metadata fallback).
  const preferredAreaUnit = resolveAreaUnitPreference(
    areaUnitOverride ?? profile?.area_unit_preference ?? user?.user_metadata?.area_unit,
  );
  const farmAreaAcres =
    typeof area === 'number' && Number.isFinite(area) && area > 0
      ? convertAreaToAcres(area, preferredAreaUnit)
      : null;

  return { preferredAreaUnit, farmAreaAcres };
}
