export type AreaUnitPreference = 'acres' | 'hectares';

export function resolveAreaUnitPreference(value: unknown): AreaUnitPreference {
  return value === 'hectares' || value === 'acres' ? value : 'acres';
}

const ACRES_TO_HECTARES = 0.404686;

export function convertAreaFromAcres(areaInAcres: number, targetUnit: AreaUnitPreference): number {
  return targetUnit === 'hectares' ? areaInAcres * ACRES_TO_HECTARES : areaInAcres;
}
