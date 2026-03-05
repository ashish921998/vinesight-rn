const MAX_OPTIONAL_NUMERIC_VALUE = 1_000_000;
export const MAX_SOIL_FIELD_ABS = 10_000;

export interface OptionalFarmNumberRawValues {
  vineSpacing: string;
  rowSpacing: string;
  totalTankCapacity: string;
  systemDischarge: string;
  bulkDensity: string;
  cationExchangeCapacity: string;
  soilWaterRetention: string;
}

export interface OptionalFarmNumberLabels {
  bulkDensity: string;
  cationExchangeCapacity: string;
  soilWaterRetention: string;
}

export interface ParsedOptionalFarmNumbers {
  vineSpacing?: number;
  rowSpacing?: number;
  totalTankCapacity?: number;
  systemDischarge?: number;
  bulkDensity?: number;
  cationExchangeCapacity?: number;
  soilWaterRetention?: number;
}

export type OptionalFarmNumberValidationError =
  | { code: 'invalid_numeric' }
  | { code: 'out_of_bounds' }
  | { code: 'precision_overflow'; fields: string[] };

export interface OptionalFarmNumberValidationResult {
  parsed: ParsedOptionalFarmNumbers;
  error?: OptionalFarmNumberValidationError;
}

const parseOptionalNumber = (raw: string): number | undefined | null => {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    // Non-empty but non-numeric input.
    return null;
  }
  return parsed;
};

const getPrecisionOverflowFieldLabels = (
  values: Array<{ label: string; value: number | undefined }>,
): string[] => {
  return values
    .filter(
      (item) =>
        item.value !== undefined &&
        Number.isFinite(item.value) &&
        Math.abs(item.value) > MAX_SOIL_FIELD_ABS,
    )
    .map((item) => item.label);
};

export const validateAndParseOptionalFarmNumbers = (
  rawValues: OptionalFarmNumberRawValues,
  labels: OptionalFarmNumberLabels,
): OptionalFarmNumberValidationResult => {
  const vineSpacing = parseOptionalNumber(rawValues.vineSpacing);
  const rowSpacing = parseOptionalNumber(rawValues.rowSpacing);
  const totalTankCapacity = parseOptionalNumber(rawValues.totalTankCapacity);
  const systemDischarge = parseOptionalNumber(rawValues.systemDischarge);
  const bulkDensity = parseOptionalNumber(rawValues.bulkDensity);
  const cationExchangeCapacity = parseOptionalNumber(rawValues.cationExchangeCapacity);
  const soilWaterRetention = parseOptionalNumber(rawValues.soilWaterRetention);

  const parsed: ParsedOptionalFarmNumbers = {
    vineSpacing: vineSpacing ?? undefined,
    rowSpacing: rowSpacing ?? undefined,
    totalTankCapacity: totalTankCapacity ?? undefined,
    systemDischarge: systemDischarge ?? undefined,
    bulkDensity: bulkDensity ?? undefined,
    cationExchangeCapacity: cationExchangeCapacity ?? undefined,
    soilWaterRetention: soilWaterRetention ?? undefined,
  };

  const parsedValues = [
    vineSpacing,
    rowSpacing,
    totalTankCapacity,
    systemDischarge,
    bulkDensity,
    cationExchangeCapacity,
    soilWaterRetention,
  ];

  if (parsedValues.some((value) => value === null)) {
    return { parsed, error: { code: 'invalid_numeric' } };
  }

  const boundedValues = parsedValues.filter((value): value is number => value !== undefined);
  if (boundedValues.some((value) => value < 0 || value > MAX_OPTIONAL_NUMERIC_VALUE)) {
    return { parsed, error: { code: 'out_of_bounds' } };
  }

  const overflowFieldLabels = getPrecisionOverflowFieldLabels([
    { label: labels.bulkDensity, value: parsed.bulkDensity },
    { label: labels.cationExchangeCapacity, value: parsed.cationExchangeCapacity },
    { label: labels.soilWaterRetention, value: parsed.soilWaterRetention },
  ]);

  if (overflowFieldLabels.length > 0) {
    return {
      parsed,
      error: { code: 'precision_overflow', fields: overflowFieldLabels },
    };
  }

  return { parsed };
};
