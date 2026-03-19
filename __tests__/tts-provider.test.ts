/**
 * Tests for TTS Provider Module
 * Imports and executes the real generateSpeech() with mocked dependencies.
 *
 * Setup requirements:
 *  - __tests__/setup/deno-mock.js provides global.Deno and seeds process.env
 *  - jest.mock() replaces utils/index.ts to avoid Deno ESM URL imports in sub-utilities
 */

// Mock the shared utils (circuit breaker, timeout helpers) so we avoid loading
// the Deno Edge Function utilities that use ESM URLs.
jest.mock('../supabase/functions/ai-gateway/utils/index.ts', () => ({
  checkCircuitBreaker: jest.fn().mockReturnValue(true),
  recordProviderFailure: jest.fn(),
  recordProviderSuccess: jest.fn(),
  stringifyUnknown: jest.fn((v: unknown) => {
    if (v instanceof Error) return v.message;
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
  }),
  TTS_TIMEOUT_MS: 8000,
  withAbortTimeout: jest
    .fn()
    .mockImplementation(async (fn: (s: AbortSignal) => Promise<unknown>) =>
      fn(new AbortController().signal),
    ),
  // Unused but exported by the index – kept to avoid "not exported" runtime warnings
  LLM_TIMEOUT_MS: 15000,
  STT_TIMEOUT_MS: 12000,
  decodeBase64ToBytes: jest.fn(),
  detectAudioFormatFromHeader: jest.fn(),
  normalizeOpenAiAudioMime: jest.fn(),
  estimateBase64Bytes: jest.fn(),
  toOptionalNumber: jest.fn((v: unknown) => (typeof v === 'number' ? v : null)),
  toOptionalString: jest.fn((v: unknown) => (typeof v === 'string' && v ? v : null)),
  toRecord: jest.fn((v: unknown) => (v && typeof v === 'object' ? v : null)),
  safeNumber: jest.fn((v: unknown) => (typeof v === 'number' ? v : 0)),
  parseJsonObjectFromText: jest.fn(),
  resolveLocale: jest.fn((l: string) => (l === 'hi' || l === 'mr' ? l : 'en')),
  normalizeInputText: jest.fn((v: unknown) => (typeof v === 'string' ? v.trim() : '')),
  normalizeBase64Input: jest.fn((v: string) => v),
  generateTraceId: jest.fn(() => 'test-trace-id'),
  estimateTokens: jest.fn(() => 10),
  corsHeaders: {},
  jsonResponse: jest.fn(),
  corsOptionsResponse: jest.fn(),
  MAX_AUDIO_BASE64_LENGTH: 14000000,
  MIN_AUDIO_BASE64_LENGTH: 100,
  MIN_AUDIO_ESTIMATED_BYTES: 700,
  MAX_AUDIO_SIZE_MB: 10,
  MAX_TEXT_LENGTH: 5000,
  extractBearerToken: jest.fn(),
  resolveAuthenticatedUserId: jest.fn(),
  resolveConversationId: jest.fn(),
  readConversationRouteState: jest.fn(),
  writeConversationRouteState: jest.fn(),
  writeConversationTurn: jest.fn(),
}));

// Now load the real TTS module (uses the mocked utils above).
// require() is used intentionally here: TypeScript does not follow require() for type checking,
// which prevents it from descending into the Deno-specific provider files (excluded in tsconfig).
/* eslint-disable @typescript-eslint/no-require-imports */
const { generateSpeech } = require('../supabase/functions/ai-gateway/providers/tts.ts') as {
  generateSpeech: (input: {
    text: string;
    locale: 'en' | 'hi' | 'mr';
    providerFallbackEnabled: boolean;
    canPlayAudio: boolean;
  }) => Promise<{
    base64: string;
    mimeType: string;
    provider: string;
    fallbackReason?: string;
  } | null>;
};

// Helpers — reference the already-mocked utils module
const utils = require('../supabase/functions/ai-gateway/utils/index.ts') as {
  checkCircuitBreaker: jest.Mock;
  withAbortTimeout: jest.Mock;
  recordProviderFailure: jest.Mock;
  recordProviderSuccess: jest.Mock;
};
/* eslint-enable @typescript-eslint/no-require-imports */
const mockCheckCB = utils.checkCircuitBreaker;
const mockWithAbort = utils.withAbortTimeout;
const mockRecordFailure = utils.recordProviderFailure;
const mockRecordSuccess = utils.recordProviderSuccess;

// ============================================================
// MARK: - Fetch Mock
// ============================================================

const originalFetch = global.fetch;
let mockFetchImpl: jest.Mock;

beforeAll(() => {
  mockFetchImpl = jest.fn();
  global.fetch = mockFetchImpl;
});

afterAll(() => {
  global.fetch = originalFetch;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckCB.mockReturnValue(true);
  mockWithAbort.mockImplementation(async (fn: (s: AbortSignal) => Promise<unknown>) =>
    fn(new AbortController().signal),
  );

  // Default: Sarvam returns a valid audio response
  mockFetchImpl.mockImplementation(async (url: string) => {
    if (String(url).includes('sarvam.ai/text-to-speech')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ audios: ['ZmFrZS1zYXJ2YW0tYXVkaW8='] }),
      };
    }
    if (String(url).includes('openai.com/v1/audio/speech')) {
      const fakeAudio = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => fakeAudio.buffer,
        json: async () => ({}),
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
});

// ============================================================
// MARK: - Tests
// ============================================================

describe('generateSpeech — real module function', () => {
  describe('canPlayAudio=false', () => {
    it('returns null immediately without calling fetch', async () => {
      const result = await generateSpeech({
        text: 'Hello',
        locale: 'en',
        providerFallbackEnabled: true,
        canPlayAudio: false,
      });
      expect(result).toBeNull();
      expect(mockFetchImpl).not.toHaveBeenCalled();
    });
  });

  describe('Sarvam primary provider', () => {
    it('calls Sarvam TTS endpoint and returns base64 + mimeType + provider', async () => {
      const result = await generateSpeech({
        text: 'Test speech output',
        locale: 'en',
        providerFallbackEnabled: true,
        canPlayAudio: true,
      });

      expect(result).not.toBeNull();
      expect(mockFetchImpl).toHaveBeenCalled();
      const sarvamCall = mockFetchImpl.mock.calls.find((c: unknown[]) =>
        String(c[0]).includes('sarvam.ai'),
      );
      expect(sarvamCall).toBeDefined();
      expect(result?.mimeType).toBe('audio/mpeg');
      expect(result?.provider).toBe('sarvam');
      expect(typeof result?.base64).toBe('string');
      expect(result?.base64.length).toBeGreaterThan(0);
    });

    it('uses api-subscription-key header for Sarvam', async () => {
      await generateSpeech({
        text: 'Hello',
        locale: 'hi',
        providerFallbackEnabled: true,
        canPlayAudio: true,
      });

      const sarvamCall = mockFetchImpl.mock.calls.find((c: unknown[]) =>
        String(c[0]).includes('sarvam.ai'),
      );
      expect(sarvamCall).toBeDefined();
      const headers = (sarvamCall?.[1] as RequestInit)?.headers as Record<string, string>;
      expect(headers?.['api-subscription-key']).toBeDefined();
      expect(headers?.['api-subscription-key']).toBe('test-sarvam-key');
    });

    it('sends locale-specific language code for Hindi', async () => {
      await generateSpeech({
        text: 'हिंदी पाठ',
        locale: 'hi',
        providerFallbackEnabled: true,
        canPlayAudio: true,
      });

      const sarvamCall = mockFetchImpl.mock.calls.find((c: unknown[]) =>
        String(c[0]).includes('sarvam.ai'),
      );
      const body = JSON.parse((sarvamCall?.[1] as RequestInit)?.body as string);
      expect(body.target_language_code).toBe('hi-IN');
    });

    it('sends locale-specific language code for Marathi', async () => {
      await generateSpeech({
        text: 'मराठी पाठ',
        locale: 'mr',
        providerFallbackEnabled: true,
        canPlayAudio: true,
      });

      const sarvamCall = mockFetchImpl.mock.calls.find((c: unknown[]) =>
        String(c[0]).includes('sarvam.ai'),
      );
      const body = JSON.parse((sarvamCall?.[1] as RequestInit)?.body as string);
      expect(body.target_language_code).toBe('mr-IN');
    });

    it('records success after Sarvam succeeds', async () => {
      await generateSpeech({
        text: 'Hello',
        locale: 'en',
        providerFallbackEnabled: true,
        canPlayAudio: true,
      });
      expect(mockRecordSuccess).toHaveBeenCalledWith('sarvam_tts');
    });
  });

  describe('OpenAI fallback', () => {
    it('falls back to OpenAI when Sarvam fails and fallback is enabled', async () => {
      // Sarvam fails
      mockFetchImpl.mockImplementation(async (url: string) => {
        if (String(url).includes('sarvam.ai')) {
          return { ok: false, status: 500, json: async () => ({ error: 'server error' }) };
        }
        if (String(url).includes('openai.com')) {
          const fakeAudio = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
          return {
            ok: true,
            status: 200,
            arrayBuffer: async () => fakeAudio.buffer,
            json: async () => ({}),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });

      const result = await generateSpeech({
        text: 'Hello',
        locale: 'en',
        providerFallbackEnabled: true,
        canPlayAudio: true,
      });

      expect(result).not.toBeNull();
      expect(result?.provider).toContain('openai');
      expect(mockRecordFailure).toHaveBeenCalledWith('sarvam_tts');
    });

    it('returns null (no audio) when Sarvam fails and fallback is disabled', async () => {
      mockFetchImpl.mockImplementation(async (url: string) => {
        if (String(url).includes('sarvam.ai')) {
          return { ok: false, status: 500, json: async () => ({ error: 'server error' }) };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });

      const result = await generateSpeech({
        text: 'Hello',
        locale: 'en',
        providerFallbackEnabled: false,
        canPlayAudio: true,
      });

      expect(result).toBeNull();
    });
  });

  describe('circuit breaker integration', () => {
    it('skips Sarvam and falls back to OpenAI when circuit breaker is open', async () => {
      mockCheckCB.mockImplementation((provider: string) => provider.startsWith('openai'));

      const result = await generateSpeech({
        text: 'Hello',
        locale: 'en',
        providerFallbackEnabled: true,
        canPlayAudio: true,
      });

      // Sarvam should NOT be called, OpenAI should be called
      const sarvamCalls = mockFetchImpl.mock.calls.filter((c: unknown[]) =>
        String(c[0]).includes('sarvam.ai'),
      );
      expect(sarvamCalls).toHaveLength(0);
      expect(result).not.toBeNull();
      // When circuit is open, fallbackReason='sarvam_tts_circuit_open' → provider becomes 'openai_fallback'
      expect(result?.provider).toBe('openai_fallback');
      expect(result?.fallbackReason).toBe('sarvam_tts_circuit_open');
    });

    it('returns null when circuit is open and fallback is disabled', async () => {
      mockCheckCB.mockReturnValue(false);
      const result = await generateSpeech({
        text: 'Hello',
        locale: 'en',
        providerFallbackEnabled: false,
        canPlayAudio: true,
      });
      expect(result).toBeNull();
      const sarvamCalls = mockFetchImpl.mock.calls.filter((c: unknown[]) =>
        String(c[0]).includes('sarvam.ai'),
      );
      expect(sarvamCalls).toHaveLength(0);
    });
  });

  describe('graceful degradation', () => {
    it('returns null when both providers fail', async () => {
      mockFetchImpl.mockRejectedValue(new Error('network error'));

      const result = await generateSpeech({
        text: 'Hello',
        locale: 'en',
        providerFallbackEnabled: true,
        canPlayAudio: true,
      });

      expect(result).toBeNull();
    });
  });

  describe('text truncation', () => {
    it('truncates text over 2500 chars sent to Sarvam', async () => {
      const longText = 'A'.repeat(5000);
      await generateSpeech({
        text: longText,
        locale: 'en',
        providerFallbackEnabled: true,
        canPlayAudio: true,
      });

      const sarvamCall = mockFetchImpl.mock.calls.find((c: unknown[]) =>
        String(c[0]).includes('sarvam.ai'),
      );
      const body = JSON.parse((sarvamCall?.[1] as RequestInit)?.body as string);
      expect(body.text.length).toBeLessThanOrEqual(2500);
    });
  });
});
