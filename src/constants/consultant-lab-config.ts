/**
 * Consultant lab configuration ported from vinesight-web.
 *
 * The web consultant product uses its own parameter key spelling and ranges.
 * We keep these separate from the farmer-side `lab-test-parameters.ts` so the
 * consultant mobile view matches the web consultant product exactly.
 */

export interface PetioleRangeDef {
  key: string;
  label: string;
  unit: string;
  optimalMin: number;
  optimalMax: number;
  warnLow?: number;
  warnHigh?: number;
}

export interface PetioleParamGroup {
  title: string;
  params: string[];
}

export interface NutrientRecommendation {
  nutrient: string;
  product: string;
  defaultQuantity: number;
  unit: string;
  method: string;
  frequency: number;
  note?: string;
}

export const PLAN_ITEM_UNIT_OPTIONS = ['kg/acre', 'g/acre', 'L/acre', 'ml/acre', 'ppm'] as const;

export type PlanItemUnit = (typeof PLAN_ITEM_UNIT_OPTIONS)[number];

export const PETIOLE_RANGES: PetioleRangeDef[] = [
  { key: 'total_nitrogen', label: 'Total N', unit: '%', optimalMin: 1.51, optimalMax: 2.21 },
  { key: 'nitrate_nitrogen', label: 'NO₃-N', unit: 'ppm', optimalMin: 700, optimalMax: 1000 },
  { key: 'ammonical_nitrogen', label: 'NH₄-N', unit: 'ppm', optimalMin: 400, optimalMax: 700 },
  { key: 'phosphorus', label: 'P', unit: '%', optimalMin: 0.31, optimalMax: 0.51 },
  { key: 'potassium', label: 'K', unit: '%', optimalMin: 1.51, optimalMax: 2.01 },
  { key: 'calcium', label: 'Ca', unit: '%', optimalMin: 1.51, optimalMax: 2.21 },
  { key: 'magnesium', label: 'Mg', unit: '%', optimalMin: 0.31, optimalMax: 0.61 },
  { key: 'sulphur', label: 'S', unit: '%', optimalMin: 0.15, optimalMax: 0.51 },
  { key: 'iron', label: 'Fe', unit: 'ppm', optimalMin: 80, optimalMax: 120 },
  { key: 'manganese', label: 'Mn', unit: 'ppm', optimalMin: 40, optimalMax: 100 },
  { key: 'zinc', label: 'Zn', unit: 'ppm', optimalMin: 50, optimalMax: 80 },
  { key: 'copper', label: 'Cu', unit: 'ppm', optimalMin: 5, optimalMax: 15 },
  { key: 'boron', label: 'B', unit: 'ppm', optimalMin: 25, optimalMax: 50 },
  { key: 'molybdenum', label: 'Mo', unit: 'ppm', optimalMin: 0.25, optimalMax: 0.51 },
  { key: 'sodium', label: 'Na', unit: '%', optimalMin: 0.01, optimalMax: 0.51 },
  { key: 'chloride', label: 'Cl', unit: '%', optimalMin: 0.05, optimalMax: 0.25 },
];

export const PETIOLE_PARAM_GROUPS: PetioleParamGroup[] = [
  {
    title: 'Major nutrients',
    params: ['total_nitrogen', 'nitrate_nitrogen', 'ammonical_nitrogen', 'phosphorus', 'potassium'],
  },
  {
    title: 'Secondary nutrients',
    params: ['calcium', 'magnesium', 'sulphur'],
  },
  {
    title: 'Micro nutrients',
    params: ['iron', 'manganese', 'zinc', 'copper', 'boron', 'molybdenum'],
  },
  {
    title: 'Other',
    params: ['sodium', 'chloride'],
  },
];

export const NUTRIENT_RECOMMENDATIONS: NutrientRecommendation[] = [
  {
    nutrient: 'total_nitrogen',
    product: 'Urea',
    defaultQuantity: 8,
    unit: 'kg/acre',
    method: 'Fertigation',
    frequency: 7,
    note: 'Split dose over 2–3 irrigations',
  },
  {
    nutrient: 'phosphorus',
    product: 'MAP 12-61-0',
    defaultQuantity: 4,
    unit: 'kg/acre',
    method: 'Fertigation',
    frequency: 14,
  },
  {
    nutrient: 'potassium',
    product: 'Potassium Sulphate',
    defaultQuantity: 6,
    unit: 'kg/acre',
    method: 'Fertigation',
    frequency: 7,
  },
  {
    nutrient: 'calcium',
    product: 'Calcium Nitrate',
    defaultQuantity: 5,
    unit: 'kg/acre',
    method: 'Fertigation',
    frequency: 14,
  },
  {
    nutrient: 'magnesium',
    product: 'Magnesium Sulphate',
    defaultQuantity: 3,
    unit: 'kg/acre',
    method: 'Fertigation',
    frequency: 14,
  },
  {
    nutrient: 'sulphur',
    product: 'Sulphur 90%',
    defaultQuantity: 2,
    unit: 'kg/acre',
    method: 'Broadcast',
    frequency: 1,
  },
  {
    nutrient: 'zinc',
    product: 'Zinc Sulphate',
    defaultQuantity: 1,
    unit: 'kg/acre',
    method: 'Foliar',
    frequency: 1,
  },
  {
    nutrient: 'boron',
    product: 'Borax',
    defaultQuantity: 0.5,
    unit: 'kg/acre',
    method: 'Foliar',
    frequency: 1,
  },
  {
    nutrient: 'iron',
    product: 'Ferrous Sulphate',
    defaultQuantity: 1,
    unit: 'kg/acre',
    method: 'Foliar',
    frequency: 1,
  },
];

const WEB_PETIOLE_KEY_MAP: Record<string, string> = {
  // Web misspelling accepted by the consultant product
  ammonical_nitrogen: 'ammonical_nitrogen',
  ammoniacal_nitrogen: 'ammonical_nitrogen',
  ammonium_n: 'ammonical_nitrogen',
  // Web spelling (British) for sulphur
  sulphur: 'sulphur',
  sulfur: 'sulphur',
  s: 'sulphur',
  // Common aliases mapped back to the consultant key set
  total_n: 'total_nitrogen',
  total_nitrogen: 'total_nitrogen',
  tn: 'total_nitrogen',
  nitrate_n: 'nitrate_nitrogen',
  no3_n: 'nitrate_nitrogen',
  'no3-n': 'nitrate_nitrogen',
  phosphorus: 'phosphorus',
  p: 'phosphorus',
  potassium: 'potassium',
  k: 'potassium',
  calcium: 'calcium',
  ca: 'calcium',
  magnesium: 'magnesium',
  mg: 'magnesium',
  iron: 'iron',
  fe: 'iron',
  manganese: 'manganese',
  mn: 'manganese',
  zinc: 'zinc',
  zn: 'zinc',
  copper: 'copper',
  cu: 'copper',
  boron: 'boron',
  b: 'boron',
  molybdenum: 'molybdenum',
  mo: 'molybdenum',
  sodium: 'sodium',
  na: 'sodium',
  chloride: 'chloride',
  cl: 'chloride',
};

/**
 * Normalize a raw petiole parameter key to the consultant key set.
 * Accepts both vinesight-web and farmer-side spellings.
 */
export function normalizeConsultantPetioleKey(key: string): string {
  const lower = key.toLowerCase().trim().replace(/\s+/g, '_');
  return WEB_PETIOLE_KEY_MAP[lower] ?? lower;
}

export function getPetioleRangeDef(key: string): PetioleRangeDef | undefined {
  const normalized = normalizeConsultantPetioleKey(key);
  return PETIOLE_RANGES.find((r) => r.key === normalized);
}

export function getRecommendationForNutrient(
  nutrientKey: string,
): NutrientRecommendation | undefined {
  const normalized = normalizeConsultantPetioleKey(nutrientKey);
  return NUTRIENT_RECOMMENDATIONS.find((r) => r.nutrient === normalized);
}

export type ParamStatus = 'ok' | 'warn' | 'bad';

export function getParamStatus(
  value: number | null | undefined,
  range: PetioleRangeDef,
): ParamStatus {
  if (value === null || value === undefined || Number.isNaN(value)) return 'ok';
  const warnLow = range.optimalMin * 0.9;
  const warnHigh = range.optimalMax * 1.1;
  if (value < warnLow || value > warnHigh) return 'bad';
  if (value < range.optimalMin || value > range.optimalMax) return 'warn';
  return 'ok';
}
