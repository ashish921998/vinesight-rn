/**
 * Tests for locale detection and resolution helpers.
 * Verifies the text-based Devanagari detection fallback and the
 * expanded resolveEffectiveAssistantLocale() priority chain.
 */

// The helpers module references DEVANAGARI_RE and other pure functions.
// We import directly — no Deno API calls involved.
import {
  detectLocaleFromText,
  resolveEffectiveAssistantLocale,
  resolveTtsLocale,
} from '../supabase/functions/ai-gateway/utils/helpers';

// ============================================================
// MARK: - detectLocaleFromText
// ============================================================

describe('detectLocaleFromText', () => {
  it('returns "hi" for Marathi Devanagari text', () => {
    expect(detectLocaleFromText('आज मी तीन स्प्रे केले')).toBe('hi');
  });

  it('returns "hi" for Hindi Devanagari text', () => {
    expect(detectLocaleFromText('आज मैंने तीन स्प्रे किए')).toBe('hi');
  });

  it('returns null for English text', () => {
    expect(detectLocaleFromText('I sprayed three times today')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(detectLocaleFromText(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectLocaleFromText('')).toBeNull();
  });

  it('returns null for short text (< 3 letter chars)', () => {
    expect(detectLocaleFromText('ab')).toBeNull();
  });

  it('returns "hi" for mixed text with >30% Devanagari', () => {
    // Mix of Devanagari and Latin where Devanagari dominates
    expect(detectLocaleFromText('आज spray केले तीन वेळा')).toBe('hi');
  });

  it('returns null for mixed text with <30% Devanagari', () => {
    // Mostly English with a tiny bit of Devanagari
    expect(detectLocaleFromText('I did the spray application today on the vineyard म')).toBeNull();
  });
});

// ============================================================
// MARK: - resolveEffectiveAssistantLocale (expanded fallback chain)
// ============================================================

describe('resolveEffectiveAssistantLocale', () => {
  describe('audio mode with STT detection', () => {
    it('uses STT-detected locale when available (priority 1)', () => {
      const result = resolveEffectiveAssistantLocale({
        inputMode: 'audio',
        detectedLanguage: 'mr-IN',
        routeStateDetectedLocale: null,
        locale: 'en',
        transcript: 'मराठी मजकूर',
      });
      expect(result).toBe('mr');
    });

    it('STT detection takes priority over route state', () => {
      const result = resolveEffectiveAssistantLocale({
        inputMode: 'audio',
        detectedLanguage: 'hi-IN',
        routeStateDetectedLocale: 'mr',
        locale: 'en',
        transcript: 'हिंदी पाठ',
      });
      expect(result).toBe('hi');
    });
  });

  describe('audio mode — STT fallback (no detectedLanguage)', () => {
    it('falls back to routeState when STT returns null (priority 2)', () => {
      const result = resolveEffectiveAssistantLocale({
        inputMode: 'audio',
        detectedLanguage: null,
        routeStateDetectedLocale: 'mr',
        locale: 'en',
        transcript: 'मराठी मजकूर',
      });
      expect(result).toBe('mr');
    });

    it('falls back to text-based detection when both STT and routeState are null (priority 3)', () => {
      const result = resolveEffectiveAssistantLocale({
        inputMode: 'audio',
        detectedLanguage: null,
        routeStateDetectedLocale: null,
        locale: 'en',
        transcript: 'आज मी तीन स्प्रे केले',
      });
      expect(result).toBe('hi');
    });

    it('falls back to app locale when transcript is English (priority 4)', () => {
      const result = resolveEffectiveAssistantLocale({
        inputMode: 'audio',
        detectedLanguage: null,
        routeStateDetectedLocale: null,
        locale: 'en',
        transcript: 'I sprayed three times today',
      });
      expect(result).toBe('en');
    });

    it('falls back to app locale when transcript is null', () => {
      const result = resolveEffectiveAssistantLocale({
        inputMode: 'audio',
        detectedLanguage: null,
        routeStateDetectedLocale: null,
        locale: 'en',
        transcript: null,
      });
      expect(result).toBe('en');
    });
  });

  describe('text mode', () => {
    it('uses routeState detected locale for text follow-ups', () => {
      const result = resolveEffectiveAssistantLocale({
        inputMode: 'text',
        detectedLanguage: null,
        routeStateDetectedLocale: 'mr',
        locale: 'en',
      });
      expect(result).toBe('mr');
    });

    it('falls back to app locale when no routeState', () => {
      const result = resolveEffectiveAssistantLocale({
        inputMode: 'text',
        detectedLanguage: null,
        routeStateDetectedLocale: null,
        locale: 'en',
      });
      expect(result).toBe('en');
    });
  });

  describe('backwards compatibility', () => {
    it('works without transcript parameter (optional)', () => {
      const result = resolveEffectiveAssistantLocale({
        inputMode: 'audio',
        detectedLanguage: 'mr-IN',
        routeStateDetectedLocale: null,
        locale: 'en',
      });
      expect(result).toBe('mr');
    });
  });
});

// ============================================================
// MARK: - resolveTtsLocale (unchanged, regression tests)
// ============================================================

describe('resolveTtsLocale', () => {
  it('keeps Marathi locale for Devanagari text', () => {
    expect(resolveTtsLocale('आज मी तीन स्प्रे केले', 'mr', 'mr')).toBe('mr');
  });

  it('switches to en when text is Latin but locale says mr', () => {
    expect(
      resolveTtsLocale('Three spray applications were done last month with Mancozeb', 'mr', 'mr'),
    ).toBe('en');
  });

  it('detects Devanagari when locale is en but text is Hindi', () => {
    expect(resolveTtsLocale('आज मैंने तीन स्प्रे किए हैं', 'en', 'hi')).toBe('hi');
  });

  it('returns effectiveLocale for mixed text within threshold', () => {
    // Text in the middle range (not >30% and not <5%) should keep effectiveLocale
    expect(resolveTtsLocale('Hello world', 'en', null)).toBe('en');
  });
});
