import { useCallback } from 'react';
import { BackHandler, ToastAndroid } from 'react-native';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';

/**
 * Treats the current screen as an app "home" on Android.
 *
 * The professional directory is the root of the consultant experience, but the
 * post-auth navigation chain (OTP → replace('/') → Redirect → /professional)
 * does not guarantee a clean root-stack. That left the farmer app (`/(tabs)`)
 * reachable via the hardware back button: pressing back at the directory popped
 * the professional group and dumped the consultant into the farmer UI.
 *
 * This hook swallows the hardware back button while the screen is focused and
 * turns it into the standard "press back again to exit" home-screen behaviour,
 * so the professional module can never be escaped into the farmer app. Deeper
 * screens (farmer → farm → …) are pushed on the professional Stack, so while
 * they are focused this screen is NOT focused and the listener is detached —
 * normal back/pop still works there. That scoping is why this is bound with
 * `useFocusEffect` rather than a plain `useEffect`.
 *
 * A presented modal (e.g. `log/add`) can leave this screen focused underneath,
 * so the listener may still fire while a modal is open. Guard against that by
 * delegating to the local navigator whenever it has something on top to dismiss:
 * `useNavigation()` resolves to this screen's own Stack (the professional Stack),
 * so `canGoBack()` is true only when a modal/deeper screen covers the directory
 * — never because of leftover root-stack history, so the farmer-app escape stays
 * closed. Returning false lets React Navigation dismiss the modal as usual.
 *
 * @param intervalMs Window in which a second back press exits the app.
 * @param enabled Whether the current screen should behave as an app home.
 */
export function useHomeBackExit(intervalMs = 2000, enabled = true) {
  const { t } = useTranslation();
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;

      let lastPressAt = 0;

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        // A modal/deeper screen is on top of this home (still focused underneath,
        // e.g. the full-screen add-log composer): let the navigator dismiss it
        // instead of hijacking the press into the exit toast.
        if (navigation.canGoBack()) {
          return false;
        }

        const now = Date.now();
        if (now - lastPressAt < intervalMs) {
          BackHandler.exitApp();
          return true;
        }
        lastPressAt = now;
        ToastAndroid.show(
          t('common.pressBackAgainToExit', 'Press back again to exit'),
          ToastAndroid.SHORT,
        );
        return true; // at the professional root — never pop out into the farmer app
      });

      return () => subscription.remove();
    }, [enabled, t, navigation, intervalMs]),
  );
}
