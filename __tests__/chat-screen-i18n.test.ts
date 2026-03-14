/**
 * Tests for chat screen i18n keys.
 * Verifies all new assistant.chat keys exist in all 3 locales (en, hi, mr).
 */

import { en } from '@/i18n/locales/en';
import { hi } from '@/i18n/locales/hi';
import { mr } from '@/i18n/locales/mr';

describe('assistant.chat i18n keys', () => {
  const requiredChatKeys = [
    'welcomeTitle',
    'welcomeSubtitle',
    'sendA11y',
    'suggestionChipA11y',
    'userMessageA11y',
    'assistantMessageA11y',
  ] as const;

  describe('English locale', () => {
    it.each(requiredChatKeys)('has assistant.chat.%s', (key) => {
      expect(en.assistant.chat[key]).toBeDefined();
      expect(typeof en.assistant.chat[key]).toBe('string');
      expect(en.assistant.chat[key].length).toBeGreaterThan(0);
    });
  });

  describe('Hindi locale', () => {
    it.each(requiredChatKeys)('has assistant.chat.%s', (key) => {
      expect(hi.assistant.chat[key]).toBeDefined();
      expect(typeof hi.assistant.chat[key]).toBe('string');
      expect(hi.assistant.chat[key].length).toBeGreaterThan(0);
    });
  });

  describe('Marathi locale', () => {
    it.each(requiredChatKeys)('has assistant.chat.%s', (key) => {
      expect(mr.assistant.chat[key]).toBeDefined();
      expect(typeof mr.assistant.chat[key]).toBe('string');
      expect(mr.assistant.chat[key].length).toBeGreaterThan(0);
    });
  });

  describe('locale parity', () => {
    it('all 3 locales have the same assistant.chat keys', () => {
      const enKeys = Object.keys(en.assistant.chat).sort();
      const hiKeys = Object.keys(hi.assistant.chat).sort();
      const mrKeys = Object.keys(mr.assistant.chat).sort();
      expect(hiKeys).toEqual(enKeys);
      expect(mrKeys).toEqual(enKeys);
    });

    it('Hindi has different translations than English for welcomeTitle', () => {
      expect(hi.assistant.chat.welcomeTitle).not.toBe(en.assistant.chat.welcomeTitle);
    });

    it('Marathi has different translations than English for welcomeTitle', () => {
      expect(mr.assistant.chat.welcomeTitle).not.toBe(en.assistant.chat.welcomeTitle);
    });
  });
});
