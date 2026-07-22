import { useCallback, useMemo } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';

import { ReceiptLogScreen } from '@/components/screens/receipt-log-screen';
import { useSafeBack } from '@/hooks/use-safe-back';
import { LOG_TYPES, type LogTypeId } from '@/constants/calculator-models';
import {
  markOnboardingFirstActionCompleted,
  parseOnboardingActionType,
  parseOnboardingFlag,
} from '@/features/onboarding/activation';

/** Parse a numeric farmId param; missing/`all`/invalid → null. */
export function parseQuickFarmId(value?: string | string[]): number | null {
  if (value == null) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'all') return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Parse and validate an initialLogType param against `LogTypeId`; invalid → null. */
export function parseQuickLogType(value?: string | string[]): LogTypeId | null {
  if (value == null) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  return LOG_TYPES.some((lt) => lt.id === raw) ? (raw as LogTypeId) : null;
}

/**
 * Farmer fast-path logging screen.
 *
 * Renders the shared {@link ReceiptLogScreen} for a concrete farm (the caller
 * — dashboard / farm detail / logs — already picked one) and, when arriving
 * from a Quick Action, opens that activity's entry sheet immediately. Mirrors
 * the consultant `/professional/log/add` route minus the delegated context.
 */
export default function QuickLogRoute() {
  const goBack = useSafeBack();
  const params = useLocalSearchParams<{
    farmId?: string;
    initialLogType?: string;
    onboarding?: string;
    onboardingActionType?: string;
  }>();

  const farmId = useMemo(() => parseQuickFarmId(params.farmId), [params.farmId]);
  const initialLogType = useMemo(
    () => parseQuickLogType(params.initialLogType),
    [params.initialLogType],
  );
  const isOnboardingActionFlow = useMemo(
    () => parseOnboardingFlag(params.onboarding),
    [params.onboarding],
  );
  const onboardingActionType = useMemo(
    () => parseOnboardingActionType(params.onboardingActionType),
    [params.onboardingActionType],
  );

  const handleLogSaved = useCallback(() => {
    if (!isOnboardingActionFlow) return;
    // The fast path creates a note or a log; both complete the onboarding first
    // action. Default to 'log' when the action type param is absent.
    markOnboardingFirstActionCompleted({
      actionType: onboardingActionType ?? 'log',
      farmId,
    });
  }, [isOnboardingActionFlow, onboardingActionType, farmId]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ReceiptLogScreen
        farmId={farmId}
        initialLogType={initialLogType}
        onClose={goBack}
        onLogSaved={handleLogSaved}
      />
    </>
  );
}
