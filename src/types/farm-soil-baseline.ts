/**
 * Farm-level soil baseline columns recorded at farm creation. A subset of the
 * `farms` row surfaced by the lab-reports soil panel. Every column is optional
 * here because the panel omits any field that wasn't recorded, and a missing /
 * RLS-hidden farm row yields `null` from the service.
 *
 * Defined centrally (rather than in the panel component) so the data-layer
 * service and hook can import it without depending on UI code — see
 * `src/services/farm-soil-baseline.ts` and `src/hooks/use-farm-soil-baseline.ts`.
 */
export interface FarmSoilBaseline {
  soil_texture_class?: string | null;
  sand_percentage?: number | null;
  silt_percentage?: number | null;
  clay_percentage?: number | null;
  cation_exchange_capacity?: number | null;
  soil_water_retention?: number | null;
  bulk_density?: number | null;
}
