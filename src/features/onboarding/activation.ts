import { telemetry } from '@/services/telemetry';
import { useOnboardingStore } from '@/stores/onboarding-store';
import type { OnboardingActionType } from '@/types/onboarding';

const ONBOARDING_BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'yes']);

export const parseOnboardingActionType = (
  value?: string | string[],
): OnboardingActionType | null => {
  if (value == null) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'log' || raw === 'note' || raw === 'task') return raw;
  return null;
};

export const parseOnboardingFlag = (value?: string | string[]): boolean => {
  if (value == null) return false;
  const raw = (Array.isArray(value) ? value[0] : value).trim().toLowerCase();
  return ONBOARDING_BOOLEAN_TRUE_VALUES.has(raw);
};

export const markOnboardingFirstActionCompleted = ({
  actionType,
  farmId,
}: {
  actionType: OnboardingActionType;
  farmId: number | null;
}): boolean => {
  const onboardingStore = useOnboardingStore.getState();
  if (onboardingStore.activation.firstActionCompletedAt) {
    return false;
  }

  if (!onboardingStore.activation.farmCreated) {
    onboardingStore.markFarmCreated(farmId);
  }
  onboardingStore.markFirstActionCompleted(actionType);

  telemetry.capture('onboarding_first_action_completed', {
    action_type: actionType,
    farm_id: farmId,
  });

  return true;
};
