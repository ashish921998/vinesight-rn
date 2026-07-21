import { getDataAccess } from '@/data-access';
import type { FarmSoilBaseline } from '@/types/farm-soil-baseline';

/**
 * Fetch the farm-level soil baseline columns (texture, CEC, etc.) for a farm.
 *
 * Uses `.maybeSingle()` so a missing row (RLS-hidden or deleted farm) returns
 * `null` instead of throwing (PGRST116). This data is supplementary to the lab
 * tests — a null/empty result means the soil panel simply omits the farm chips
 * rather than failing the whole screen.
 */
export async function fetchFarmSoilBaseline(farmId: number): Promise<FarmSoilBaseline | null> {
  const { data, error } = await getDataAccess()
    .from('farms')
    .select(
      'soil_texture_class, sand_percentage, silt_percentage, clay_percentage, cation_exchange_capacity, soil_water_retention, bulk_density',
    )
    .eq('id', farmId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as FarmSoilBaseline | null;
}
