export type SubscriptionErrorReason =
  | 'farm_limit_reached'
  | 'worker_limit_reached'
  | 'attendance_history_limited'
  | 'lab_trends_disabled'
  | 'ai_disabled'
  | 'ai_rate_limited'
  | 'feature_locked';

export const extractErrorReason = (error: unknown): SubscriptionErrorReason | null => {
  if (!error) return null;
  if (typeof error === 'string') {
    return error.includes('farm_limit_reached')
      ? 'farm_limit_reached'
      : error.includes('worker_limit_reached')
        ? 'worker_limit_reached'
        : error.includes('lab_trends_disabled')
          ? 'lab_trends_disabled'
          : error.includes('ai_disabled')
            ? 'ai_disabled'
            : error.includes('ai_rate_limited')
              ? 'ai_rate_limited'
              : error.includes('attendance_history_limited')
                ? 'attendance_history_limited'
                : null;
  }
  if (typeof error === 'object' && error) {
    const message = 'message' in error && typeof error.message === 'string' ? error.message : null;
    const details = 'details' in error && typeof error.details === 'string' ? error.details : null;
    const combined = [message, details].filter(Boolean).join(' ');
    return extractErrorReason(combined);
  }
  return null;
};
