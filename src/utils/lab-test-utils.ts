import { soilParamOptions, petioleParamOptions } from '@/constants/lab-test-parameters';

export type TestType = 'soil' | 'petiole';
export type ParamStatus = 'ok' | 'warn' | 'bad';

const CORE_SOIL_PARAMS = [
  'ph',
  'ec',
  'nitrogen',
  'phosphorus',
  'potassium',
  'calcium',
  'magnesium',
  'sulfur',
] as const;

const CORE_PETIOLE_PARAMS = [
  'total_nitrogen',
  'phosphorus',
  'potassium',
  'calcium',
  'magnesium',
  'sulfur',
] as const;

export const validateAndCleanParameters = (
  rawParams: Array<{ name: string; value: number }>,
  testType: TestType,
): Record<string, number> => {
  const parameters = testType === 'soil' ? soilParamOptions : petioleParamOptions;
  const cleanParams: Record<string, number> = {};

  for (const { name, value } of rawParams) {
    const normalizedKey = normalizeParameterKey(name, testType);
    const param = parameters.find((p) => p.key === normalizedKey);
    if (param && typeof value === 'number' && !isNaN(value)) {
      cleanParams[param.key] = value;
    }
  }

  return cleanParams;
};

export const normalizeParameterKey = (key: string, testType: TestType) => {
  const soilKeyMap: Record<string, string> = {
    pH: 'ph',
    EC: 'ec',
    OC: 'organicCarbon',
    OM: 'organicMatter',
    organic_carbon: 'organicCarbon',
    organic_matter: 'organicMatter',
    calcium_carbonate: 'calciumCarbonate',
    carbonate: 'carbonate',
    bicarbonate: 'bicarbonate',
    N: 'nitrogen',
    P: 'phosphorus',
    K: 'potassium',
    Ca: 'calcium',
    Mg: 'magnesium',
    S: 'sulfur',
    Fe: 'iron',
    Mn: 'manganese',
    Zn: 'zinc',
    Cu: 'copper',
    B: 'boron',
  };

  const petioleKeyMap: Record<string, string> = {
    N: 'total_nitrogen',
    TN: 'total_nitrogen',
    P: 'phosphorus',
    K: 'potassium',
    Ca: 'calcium',
    Mg: 'magnesium',
    S: 'sulfur',
    Fe: 'iron',
    Mn: 'manganese',
    Zn: 'zinc',
    Cu: 'copper',
    B: 'boron',
    Mo: 'molybdenum',
    Na: 'sodium',
    Cl: 'chloride',
    'NO3-N': 'nitrate_nitrogen',
    'NH4-N': 'ammoniacal_nitrogen',
    'N-NO3': 'nitrate_nitrogen',
    'N-NH4': 'ammoniacal_nitrogen',
    nitrate_n: 'nitrate_nitrogen',
    ammonium_n: 'ammoniacal_nitrogen',
    ammonical_nitrogen: 'ammoniacal_nitrogen',
  };

  const keyMap = testType === 'petiole' ? petioleKeyMap : soilKeyMap;
  let mappedKey = keyMap[key];

  if (!mappedKey) {
    const lowerKey = key.toLowerCase();
    for (const [mapKey, mapValue] of Object.entries(keyMap)) {
      if (mapKey.toLowerCase() === lowerKey) {
        mappedKey = mapValue;
        break;
      }
    }
  }

  return mappedKey || key;
};

const parseNumeric = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

export const getParamOption = (key: string, type: TestType) => {
  const list = type === 'soil' ? soilParamOptions : petioleParamOptions;
  const normalizedKey = normalizeParameterKey(key, type);
  return list.find((item) => item.key === normalizedKey);
};

export const getParamStatus = (
  value: unknown,
  option?: { optimalMin: number; optimalMax: number },
): ParamStatus => {
  const numeric = parseNumeric(value);
  if (numeric === null || !option) return 'ok';
  const warnLow = option.optimalMin * 0.9;
  const warnHigh = option.optimalMax * 1.1;
  if (numeric < warnLow || numeric > warnHigh) return 'bad';
  if (numeric < option.optimalMin || numeric > option.optimalMax) return 'warn';
  return 'ok';
};

export const selectDisplayParams = (
  parameters: Record<string, unknown> | null | undefined,
  type: TestType,
  limit: number,
) => {
  const entries = Object.entries(parameters || {}).filter(([, value]) => {
    return value !== null && value !== undefined && value !== '';
  });
  if (entries.length === 0) {
    return { selected: [] as [string, unknown][], remainingCount: 0, outOfRangeCount: 0 };
  }

  const coreList = type === 'soil' ? CORE_SOIL_PARAMS : CORE_PETIOLE_PARAMS;
  const normalizedEntries = entries.map(([key, value]) => ({
    key: String(key),
    value,
    normalized: normalizeParameterKey(String(key), type),
  }));

  const outOfRange: { key: string; value: unknown; normalized: string }[] = [];
  const byNormalized = new Map<string, { key: string; value: unknown; normalized: string }>();

  normalizedEntries.forEach((entry) => {
    const option = getParamOption(entry.normalized, type);
    const status = getParamStatus(entry.value, option);
    if (status === 'bad') {
      outOfRange.push(entry);
    }
    if (!byNormalized.has(entry.normalized)) {
      byNormalized.set(entry.normalized, entry);
    }
  });

  const selected: [string, unknown][] = [];
  const used = new Set<string>();

  outOfRange.forEach((entry) => {
    if (selected.length < limit && !used.has(entry.normalized)) {
      selected.push([entry.key, entry.value]);
      used.add(entry.normalized);
    }
  });

  coreList.forEach((coreKey) => {
    const match = byNormalized.get(coreKey);
    if (match && selected.length < limit && !used.has(coreKey)) {
      selected.push([match.key, match.value]);
      used.add(coreKey);
    }
  });

  const remainingCount = Math.max(0, entries.length - selected.length);
  return {
    selected,
    remainingCount,
    outOfRangeCount: outOfRange.length,
  };
};
