import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { BackHandler, ToastAndroid } from 'react-native';
import { useTranslation } from 'react-i18next';

export function useAndroidBackHandler() {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    let lastBackPressAt = 0;
    const backPressIntervalMs = 1200;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      }

      const now = Date.now();
      if (now - lastBackPressAt < backPressIntervalMs) {
        BackHandler.exitApp();
        return true;
      }

      lastBackPressAt = now;
      ToastAndroid.show(
        t('common.pressBackAgainToExit', 'Press back again to exit'),
        ToastAndroid.SHORT,
      );
      return true;
    });

    return () => sub.remove();
  }, [router, t]);
}
