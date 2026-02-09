import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isIos = Platform.OS === 'ios';

const fireAndForget = (promise: Promise<void>) => {
  void promise.catch(() => undefined);
};

export const triggerHaptic = () => {
  if (isIos) {
    fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  }
};

export const triggerHapticMedium = () => {
  if (isIos) {
    fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  }
};

export const triggerHapticSuccess = () => {
  if (isIos) {
    fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  }
};

export const triggerHapticWarning = () => {
  if (isIos) {
    fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  }
};

export const triggerHapticError = () => {
  if (isIos) {
    fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  }
};
