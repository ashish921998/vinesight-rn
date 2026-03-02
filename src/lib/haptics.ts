/**
 * Centralized Haptic Utilities — Pi-Inspired Tactile Feedback
 *
 * Semantic haptic methods for consistent, delightful interactions.
 * Works on both iOS and Android via expo-haptics.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isHapticsAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

const fireAndForget = (promise: Promise<void>) => {
  void promise.catch(() => undefined);
};

/** Light tap — navigation, tab switches, list selection */
export const tapLight = () => {
  if (!isHapticsAvailable) return;
  fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
};

/** Medium tap — button presses, primary actions */
export const tapMedium = () => {
  if (!isHapticsAvailable) return;
  fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
};

/** Heavy tap — destructive or important confirmations */
export const tapHeavy = () => {
  if (!isHapticsAvailable) return;
  fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
};

/** Success notification — task completion, save success */
export const success = () => {
  if (!isHapticsAvailable) return;
  fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
};

/** Warning notification — attention needed */
export const warning = () => {
  if (!isHapticsAvailable) return;
  fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
};

/** Error notification — validation failure, errors */
export const error = () => {
  if (!isHapticsAvailable) return;
  fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
};

/** Selection changed — picker/toggle state change */
export const selectionChanged = () => {
  if (!isHapticsAvailable) return;
  fireAndForget(Haptics.selectionAsync());
};
