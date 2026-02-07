export interface FarmDbErrorMeta {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
}

export const EXPECTED_FARM_DB_ERROR_CODES = new Set([
  '22003', // numeric field overflow
  '22P02', // invalid text representation
  '23502', // not-null violation
  '23503', // foreign key violation
  '23505', // unique violation
  '23514', // check violation
]);

export const getFarmErrorMeta = (error: unknown): FarmDbErrorMeta => {
  if (typeof error !== 'object' || !error) return {};
  const record = error as Record<string, unknown>;
  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    details: typeof record.details === 'string' ? record.details : undefined,
    hint: typeof record.hint === 'string' ? record.hint : undefined,
    message: typeof record.message === 'string' ? record.message : undefined,
  };
};

export const shouldCaptureFarmErrorInSentry = (errorMeta: FarmDbErrorMeta): boolean => {
  if (!errorMeta.code) return true;
  return !EXPECTED_FARM_DB_ERROR_CODES.has(errorMeta.code);
};
