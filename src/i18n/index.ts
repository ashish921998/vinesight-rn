import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import { en } from './locales/en';
import { mr } from './locales/mr';
import { DEFAULT_LANGUAGE, isSupportedLanguage, type SupportedLanguageCode } from './languages';
import { devCheckKeyParity, devCheckMrGlossaryUsage } from './dev-checks';

export function getDeviceLanguage(): SupportedLanguageCode {
  const locales = Localization.getLocales();
  const primary = locales[0]?.languageCode;
  if (primary && isSupportedLanguage(primary)) return primary;
  return DEFAULT_LANGUAGE;
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    mr: { translation: mr },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  compatibilityJSON: 'v4',
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
  returnEmptyString: false,
});

if (__DEV__) {
  devCheckKeyParity(en, mr);
  devCheckMrGlossaryUsage(mr);
}

export function setAppLanguage(code: SupportedLanguageCode): void {
  if (i18n.language !== code) {
    void i18n.changeLanguage(code);
  }
}

export default i18n;
