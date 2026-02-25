import * as Haptics from 'expo-haptics';

import { isIOS } from '@/hooks';

const fireAndForget = (promise: Promise<void>) => {
  void promise.catch(() => undefined);
};

export const triggerHaptic = () => {
  if (isIOS) {
    fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  }
};

export const triggerHapticMedium = () => {
  if (isIOS) {
    fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  }
};

export const triggerHapticSuccess = () => {
  if (isIOS) {
    fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  }
};

export const triggerHapticWarning = () => {
  if (isIOS) {
    fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  }
};

export const triggerHapticError = () => {
  if (isIOS) {
    fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  }
};
