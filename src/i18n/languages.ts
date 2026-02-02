export type SupportedLanguageCode = 'en' | 'mr' | 'hi';

export const SUPPORTED_LANGUAGES: ReadonlyArray<{ code: SupportedLanguageCode; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'mr', label: 'मराठी' },
  { code: 'hi', label: 'हिंदी' },
];

export const DEFAULT_LANGUAGE: SupportedLanguageCode = 'en';

export function isSupportedLanguage(code: string): code is SupportedLanguageCode {
  return code === 'en' || code === 'mr' || code === 'hi';
}
