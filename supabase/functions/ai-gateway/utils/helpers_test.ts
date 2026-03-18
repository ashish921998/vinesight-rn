import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  coerceSupportedLocale,
  resolveEffectiveAssistantLocale,
  resolveLocaleFromBcp47,
} from './helpers.ts';

Deno.test('resolveEffectiveAssistantLocale prefers fresh STT locale for audio turns', () => {
  assertEquals(
    resolveEffectiveAssistantLocale({
      inputMode: 'audio',
      detectedLanguage: 'mr-IN',
      routeStateDetectedLocale: 'hi',
      locale: 'en',
    }),
    'mr',
  );
});

Deno.test(
  'resolveEffectiveAssistantLocale falls back to app locale for audio turns without detection',
  () => {
    assertEquals(
      resolveEffectiveAssistantLocale({
        inputMode: 'audio',
        detectedLanguage: null,
        routeStateDetectedLocale: 'mr',
        locale: 'en',
      }),
      'en',
    );
  },
);

Deno.test('resolveEffectiveAssistantLocale reuses persisted locale for non-audio turns', () => {
  assertEquals(
    resolveEffectiveAssistantLocale({
      inputMode: 'text',
      detectedLanguage: null,
      routeStateDetectedLocale: 'hi',
      locale: 'en',
    }),
    'hi',
  );
});

Deno.test('coerceSupportedLocale validates persisted values', () => {
  assertEquals(coerceSupportedLocale('mr'), 'mr');
  assertEquals(coerceSupportedLocale('fr'), null);
  assertEquals(coerceSupportedLocale(42), null);
});

Deno.test('resolveLocaleFromBcp47 maps supported prefixes only', () => {
  assertEquals(resolveLocaleFromBcp47('hi-IN'), 'hi');
  assertEquals(resolveLocaleFromBcp47('fr-FR'), null);
});
