import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isIos = Platform.OS === 'ios';

export const triggerHaptic = () => {
  if (isIos) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
};

export const triggerHapticMedium = () => {
  if (isIos) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
};

export const triggerHapticSuccess = () => {
  if (isIos) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
};

export const triggerHapticWarning = () => {
  if (isIos) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
};

export const triggerHapticError = () => {
  if (isIos) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
};
