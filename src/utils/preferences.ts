export type AreaUnitPreference = 'acres' | 'hectares';

export function resolveAreaUnitPreference(value: unknown): AreaUnitPreference {
  return value === 'hectares' || value === 'acres' ? value : 'acres';
}

const ACRES_TO_HECTARES = 0.404686;
const HECTARES_TO_ACRES = 1 / ACRES_TO_HECTARES;

export function convertAreaFromAcres(areaInAcres: number, targetUnit: AreaUnitPreference): number {
  return targetUnit === 'hectares' ? areaInAcres * ACRES_TO_HECTARES : areaInAcres;
}

export function convertAreaToAcres(area: number, sourceUnit: AreaUnitPreference): number {
  return sourceUnit === 'hectares' ? area * HECTARES_TO_ACRES : area;
}

export function normalizeAreaToAcres(
  area: number | null | undefined,
  sourceUnit: AreaUnitPreference = 'acres',
): number {
  if (typeof area !== 'number' || !Number.isFinite(area) || area <= 0) return 0;
  const normalized = convertAreaToAcres(area, sourceUnit);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
}
