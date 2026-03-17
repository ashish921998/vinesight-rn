import * as Haptics from 'expo-haptics';

const fireAndForget = (promise: Promise<void>) => {
  void promise.catch(() => undefined);
};

export const triggerHaptic = () => {
  fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
};

export const triggerHapticMedium = () => {
  fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
};

export const triggerHapticSuccess = () => {
  fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
};

export const triggerHapticWarning = () => {
  fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
};

export const triggerHapticError = () => {
  fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
};
