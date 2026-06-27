import {
  EXPECTED_FARM_DB_ERROR_CODES,
  getFarmErrorMeta,
  isFarmPrimaryKeySequenceViolation,
  isRetryableFarmInsertConstraintViolation,
  isUniqueDisplayOrderViolation,
  shouldCaptureFarmErrorInSentry,
} from '@/utils/farm-error-utils';

describe('farm-error-utils', () => {
  it('extracts db error metadata from unknown error object', () => {
    const error = {
      code: '22003',
      details: 'numeric overflow',
      hint: null,
      message: 'numeric field overflow',
    };

    expect(getFarmErrorMeta(error)).toEqual({
      code: '22003',
      details: 'numeric overflow',
      hint: undefined,
      message: 'numeric field overflow',
    });
  });

  it('does not capture known expected DB validation errors in sentry', () => {
    for (const code of EXPECTED_FARM_DB_ERROR_CODES) {
      expect(shouldCaptureFarmErrorInSentry({ code })).toBe(false);
    }
  });

  it('captures unknown/no-code errors in sentry', () => {
    expect(shouldCaptureFarmErrorInSentry({ code: 'PGRST301' })).toBe(true);
    expect(shouldCaptureFarmErrorInSentry({})).toBe(true);
  });

  it('detects retryable farm insert unique constraint violations', () => {
    const displayOrderError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "farms_user_display_order_unique"',
    };
    const primaryKeyError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "farms_pkey"',
    };
    const unrelatedUniqueError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "other_table_pkey"',
    };

    expect(isUniqueDisplayOrderViolation(displayOrderError)).toBe(true);
    expect(isFarmPrimaryKeySequenceViolation(primaryKeyError)).toBe(true);
    expect(isRetryableFarmInsertConstraintViolation(displayOrderError)).toBe(true);
    expect(isRetryableFarmInsertConstraintViolation(primaryKeyError)).toBe(true);
    expect(isRetryableFarmInsertConstraintViolation(unrelatedUniqueError)).toBe(false);
  });
});
