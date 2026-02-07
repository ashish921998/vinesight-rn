const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const EXPECTED_FARM_DB_ERROR_CODES = [
  '22003', // numeric_value_out_of_range
  '22007', // invalid_datetime_format
  '22P02', // invalid_text_representation
  '23505', // unique_violation
  '23514', // check_violation
] as const;

export interface FarmErrorMeta {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
}

export function getFarmErrorMeta(error: unknown): FarmErrorMeta {
  if (!error || typeof error !== 'object') return {};

  const raw = error as Record<string, unknown>;
  return {
    code: toOptionalString(raw.code),
    details: toOptionalString(raw.details),
    hint: toOptionalString(raw.hint),
    message: toOptionalString(raw.message),
  };
}

export function shouldCaptureFarmErrorInSentry(error: unknown): boolean {
  const { code } = getFarmErrorMeta(error);
  if (!code) return true;
  return !EXPECTED_FARM_DB_ERROR_CODES.includes(
    code as (typeof EXPECTED_FARM_DB_ERROR_CODES)[number],
  );
}
