import { useCallback } from 'react';
import { BackHandler, ToastAndroid } from 'react-native';
import { useFocusEffect } from 'expo-router';
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
 * @param intervalMs Window in which a second back press exits the app.
 */
export function useHomeBackExit(intervalMs = 2000) {
  const { t } = useTranslation();

  useFocusEffect(
    useCallback(() => {
      let lastPressAt = 0;

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
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
        return true; // always swallow — never pop out of the professional home
      });

      return () => subscription.remove();
    }, [t, intervalMs]),
  );
}
