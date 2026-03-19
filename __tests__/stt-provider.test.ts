/**
 * Tests for STT Provider Module
 * Imports and executes the real transcribeAudio() with mocked dependencies.
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
  STT_TIMEOUT_MS: 12000,
  withAbortTimeout: jest
    .fn()
    .mockImplementation(async (fn: (s: AbortSignal) => Promise<unknown>) =>
      fn(new AbortController().signal),
    ),
  // Unused but exported — kept to avoid "not exported" runtime warnings
  TTS_TIMEOUT_MS: 8000,
  LLM_TIMEOUT_MS: 15000,
  decodeBase64ToBytes: jest.fn().mockImplementation((b64: string) => {
    // Simple base64 decoder for tests
    try {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    } catch {
      return new Uint8Array(100);
    }
  }),
  detectAudioFormatFromHeader: jest.fn().mockReturnValue(null),
  normalizeOpenAiAudioMime: jest
    .fn()
    .mockReturnValue({ mime: 'audio/mpeg', filename: 'audio.mp3' }),
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

// Now load the real STT module (uses the mocked utils above).
// require() is used intentionally here: TypeScript does not follow require() for type checking,
// which prevents it from descending into the Deno-specific provider files (excluded in tsconfig).
/* eslint-disable @typescript-eslint/no-require-imports */
const { transcribeAudio, isSarvamSttEnabled, getSarvamSttModel } =
  require('../supabase/functions/ai-gateway/providers/stt.ts') as {
    transcribeAudio: (input: {
      base64Audio: string;
      mimeType: string;
      locale: 'en' | 'hi' | 'mr';
      providerFallbackEnabled: boolean;
    }) => Promise<{
      transcript: string;
      confidence: number | null;
      provider: string;
      fallbackReason?: string;
    }>;
    isSarvamSttEnabled: () => boolean;
    getSarvamSttModel: () => string;
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

  // Default: Sarvam returns a valid transcription response
  mockFetchImpl.mockImplementation(async (url: string) => {
    if (String(url).includes('sarvam.ai/speech-to-text')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          transcript: 'Hello, this is a test transcript from Sarvam',
          confidence: 0.95,
        }),
      };
    }
    if (String(url).includes('openai.com/v1/audio/transcriptions')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ text: 'Hello, this is a test transcript from OpenAI' }),
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
});

// Helper to make a minimal valid base64 audio payload
function makeAudioBase64(size = 1000): string {
  return btoa(new Array(size).fill('A').join(''));
}

// ============================================================
// MARK: - Tests
// ============================================================

describe('transcribeAudio — real module function', () => {
  describe('Sarvam Saaras v3 primary provider', () => {
    it('calls Sarvam speech-to-text endpoint and returns transcript + provider', async () => {
      const result = await transcribeAudio({
        base64Audio: makeAudioBase64(),
        mimeType: 'audio/wav',
        locale: 'en',
        providerFallbackEnabled: true,
      });

      expect(result.transcript).toBe('Hello, this is a test transcript from Sarvam');
      expect(result.provider).toBe('sarvam');
      expect(result.confidence).toBe(0.95);

      const sarvamCall = mockFetchImpl.mock.calls.find((c: unknown[]) =>
        String(c[0]).includes('sarvam.ai/speech-to-text'),
      );
      expect(sarvamCall).toBeDefined();
    });

    it('uses api-subscription-key header for Sarvam (not Authorization)', async () => {
      await transcribeAudio({
        base64Audio: makeAudioBase64(),
        mimeType: 'audio/wav',
        locale: 'hi',
        providerFallbackEnabled: true,
      });

      const sarvamCall = mockFetchImpl.mock.calls.find((c: unknown[]) =>
        String(c[0]).includes('sarvam.ai'),
      );
      expect(sarvamCall).toBeDefined();
      const headers = (sarvamCall?.[1] as RequestInit)?.headers as Record<string, string>;
      expect(headers?.['api-subscription-key']).toBe('test-sarvam-key');
      expect(headers?.['Authorization']).toBeUndefined();
    });

    it('sends language_code=unknown for auto language detection', async () => {
      await transcribeAudio({
        base64Audio: makeAudioBase64(),
        mimeType: 'audio/wav',
        locale: 'mr',
        providerFallbackEnabled: true,
      });

      const sarvamCall = mockFetchImpl.mock.calls.find((c: unknown[]) =>
        String(c[0]).includes('sarvam.ai/speech-to-text'),
      );
      expect(sarvamCall).toBeDefined();
      const body = sarvamCall?.[1] as RequestInit;
      // The body is FormData — verify language_code was set to 'unknown'
      const formData = body?.body as FormData;
      expect(formData?.get?.('language_code')).toBe('unknown');
    });

    it('sends saaras:v3 as the model', async () => {
      await transcribeAudio({
        base64Audio: makeAudioBase64(),
        mimeType: 'audio/wav',
        locale: 'en',
        providerFallbackEnabled: true,
      });

      const sarvamCall = mockFetchImpl.mock.calls.find((c: unknown[]) =>
        String(c[0]).includes('sarvam.ai/speech-to-text'),
      );
      const formData = (sarvamCall?.[1] as RequestInit)?.body as FormData;
      expect(formData?.get?.('model')).toBe('saaras:v3');
    });

    it('records success after Sarvam succeeds', async () => {
      await transcribeAudio({
        base64Audio: makeAudioBase64(),
        mimeType: 'audio/wav',
        locale: 'en',
        providerFallbackEnabled: true,
      });
      expect(mockRecordSuccess).toHaveBeenCalledWith('sarvam_stt');
    });

    it('returns transcript from alternate response field (text)', async () => {
      mockFetchImpl.mockImplementation(async (url: string) => {
        if (String(url).includes('sarvam.ai')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ text: 'Transcript from text field', confidence: 0.88 }),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });

      const result = await transcribeAudio({
        base64Audio: makeAudioBase64(),
        mimeType: 'audio/wav',
        locale: 'en',
        providerFallbackEnabled: true,
      });

      expect(result.transcript).toBe('Transcript from text field');
      expect(result.provider).toBe('sarvam');
    });
  });

  describe('auto language detection', () => {
    it('transcribes code-mixed Hindi-English speech (Hinglish)', async () => {
      mockFetchImpl.mockImplementation(async (url: string) => {
        if (String(url).includes('sarvam.ai')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              transcript: 'Aaj maine 3 ghanta irrigation kiya',
              confidence: 0.88,
            }),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });

      const result = await transcribeAudio({
        base64Audio: makeAudioBase64(),
        mimeType: 'audio/wav',
        locale: 'hi',
        providerFallbackEnabled: true,
      });

      expect(result.transcript).toBe('Aaj maine 3 ghanta irrigation kiya');
      expect(result.provider).toBe('sarvam');
    });

    it('transcribes Marathi speech', async () => {
      mockFetchImpl.mockImplementation(async (url: string) => {
        if (String(url).includes('sarvam.ai')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              transcript: 'आज मी तीन तास सिंचन केले',
              confidence: 0.85,
            }),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });

      const result = await transcribeAudio({
        base64Audio: makeAudioBase64(),
        mimeType: 'audio/wav',
        locale: 'mr',
        providerFallbackEnabled: true,
      });

      expect(result.transcript).toBe('आज मी तीन तास सिंचन केले');
      expect(result.provider).toBe('sarvam');
    });
  });

  describe('OpenAI Whisper fallback', () => {
    it('falls back to OpenAI Whisper when Sarvam fails and fallback is enabled', async () => {
      mockFetchImpl.mockImplementation(async (url: string) => {
        if (String(url).includes('sarvam.ai')) {
          return { ok: false, status: 500, json: async () => ({ error: 'server error' }) };
        }
        if (String(url).includes('openai.com')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ text: 'Fallback transcript from OpenAI' }),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });

      const result = await transcribeAudio({
        base64Audio: makeAudioBase64(),
        mimeType: 'audio/wav',
        locale: 'en',
        providerFallbackEnabled: true,
      });

      expect(result.transcript).toBe('Fallback transcript from OpenAI');
      expect(result.provider).toBe('openai_fallback');
      expect(result.fallbackReason).toBe('sarvam_stt_failed');
      expect(mockRecordFailure).toHaveBeenCalledWith('sarvam_stt');
    });

    it('throws when Sarvam fails and fallback is disabled', async () => {
      mockFetchImpl.mockImplementation(async (url: string) => {
        if (String(url).includes('sarvam.ai')) {
          return { ok: false, status: 500, json: async () => ({ error: 'server error' }) };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });

      await expect(
        transcribeAudio({
          base64Audio: makeAudioBase64(),
          mimeType: 'audio/wav',
          locale: 'en',
          providerFallbackEnabled: false,
        }),
      ).rejects.toThrow();
    });
  });

  describe('circuit breaker integration', () => {
    it('skips Sarvam and falls back to OpenAI when circuit breaker is open', async () => {
      mockCheckCB.mockImplementation((provider: string) => provider.startsWith('openai'));

      const result = await transcribeAudio({
        base64Audio: makeAudioBase64(),
        mimeType: 'audio/wav',
        locale: 'en',
        providerFallbackEnabled: true,
      });

      // Sarvam should NOT be called
      const sarvamCalls = mockFetchImpl.mock.calls.filter((c: unknown[]) =>
        String(c[0]).includes('sarvam.ai'),
      );
      expect(sarvamCalls).toHaveLength(0);

      // OpenAI should be called
      const openAiCalls = mockFetchImpl.mock.calls.filter((c: unknown[]) =>
        String(c[0]).includes('openai.com'),
      );
      expect(openAiCalls.length).toBeGreaterThan(0);

      expect(result.provider).toBe('openai_fallback');
      expect(result.fallbackReason).toBe('sarvam_stt_circuit_open');
      expect(typeof result.fallbackReason).toBe('string');
      expect(result.fallbackReason).not.toBeUndefined();
    });

    it('records Sarvam failure and falls back on API error', async () => {
      mockFetchImpl.mockImplementation(async (url: string) => {
        if (String(url).includes('sarvam.ai')) {
          return { ok: false, status: 503, json: async () => ({ error: 'Service unavailable' }) };
        }
        if (String(url).includes('openai.com')) {
          return { ok: true, status: 200, json: async () => ({ text: 'OpenAI result' }) };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });

      await transcribeAudio({
        base64Audio: makeAudioBase64(),
        mimeType: 'audio/wav',
        locale: 'en',
        providerFallbackEnabled: true,
      });

      expect(mockRecordFailure).toHaveBeenCalledWith('sarvam_stt');
    });
  });

  describe('empty transcript handling', () => {
    it('throws stt_empty_transcript when Sarvam returns empty transcript', async () => {
      mockFetchImpl.mockImplementation(async (url: string) => {
        if (String(url).includes('sarvam.ai')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ transcript: '', confidence: null }),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });

      await expect(
        transcribeAudio({
          base64Audio: makeAudioBase64(),
          mimeType: 'audio/wav',
          locale: 'en',
          providerFallbackEnabled: true,
        }),
      ).rejects.toThrow('stt_empty_transcript');
    });

    it('throws stt_empty_transcript when Sarvam returns whitespace-only transcript', async () => {
      mockFetchImpl.mockImplementation(async (url: string) => {
        if (String(url).includes('sarvam.ai')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ transcript: '   ', confidence: null }),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });

      await expect(
        transcribeAudio({
          base64Audio: makeAudioBase64(),
          mimeType: 'audio/wav',
          locale: 'en',
          providerFallbackEnabled: true,
        }),
      ).rejects.toThrow('stt_empty_transcript');
    });

    it('throws stt_empty_transcript when OpenAI returns empty transcript', async () => {
      // Sarvam circuit open → go directly to OpenAI
      mockCheckCB.mockImplementation((provider: string) => provider.startsWith('openai'));

      mockFetchImpl.mockImplementation(async (url: string) => {
        if (String(url).includes('openai.com')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ text: '' }),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });

      await expect(
        transcribeAudio({
          base64Audio: makeAudioBase64(),
          mimeType: 'audio/wav',
          locale: 'en',
          providerFallbackEnabled: true,
        }),
      ).rejects.toThrow('stt_empty_transcript');
    });

    it('throws stt_empty_transcript when OpenAI returns whitespace-only transcript', async () => {
      mockCheckCB.mockImplementation((provider: string) => provider.startsWith('openai'));

      mockFetchImpl.mockImplementation(async (url: string) => {
        if (String(url).includes('openai.com')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ text: '  \n  ' }),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });

      await expect(
        transcribeAudio({
          base64Audio: makeAudioBase64(),
          mimeType: 'audio/wav',
          locale: 'en',
          providerFallbackEnabled: true,
        }),
      ).rejects.toThrow('stt_empty_transcript');
    });
  });

  describe('audio format support', () => {
    it('handles WAV format', async () => {
      const result = await transcribeAudio({
        base64Audio: makeAudioBase64(),
        mimeType: 'audio/wav',
        locale: 'en',
        providerFallbackEnabled: true,
      });
      expect(result.provider).toBe('sarvam');
      expect(result.transcript).toBeTruthy();
    });

    it('handles M4A/MP4 format via Sarvam (Saaras v3 supports it)', async () => {
      const result = await transcribeAudio({
        base64Audio: makeAudioBase64(),
        mimeType: 'audio/x-m4a',
        locale: 'en',
        providerFallbackEnabled: true,
      });
      // Saaras v3 supports M4A — should go to Sarvam, not bypass to OpenAI
      expect(result.provider).toBe('sarvam');
    });

    it('handles MP3 format', async () => {
      const result = await transcribeAudio({
        base64Audio: makeAudioBase64(),
        mimeType: 'audio/mpeg',
        locale: 'en',
        providerFallbackEnabled: true,
      });
      expect(result.provider).toBe('sarvam');
    });
  });

  describe('OpenAI primary (no Sarvam)', () => {
    it('returns provider=openai when calling OpenAI without fallback reason', async () => {
      // Force Sarvam circuit open → use OpenAI directly
      mockCheckCB.mockImplementation((provider: string) => provider.startsWith('openai'));

      const result = await transcribeAudio({
        base64Audio: makeAudioBase64(),
        mimeType: 'audio/wav',
        locale: 'en',
        providerFallbackEnabled: true,
      });

      expect(result.provider).toBe('openai_fallback');
      expect(result.transcript).toBe('Hello, this is a test transcript from OpenAI');
    });
  });

  describe('module utility functions', () => {
    it('isSarvamSttEnabled returns true by default', () => {
      expect(isSarvamSttEnabled()).toBe(true);
    });

    it('getSarvamSttModel returns saaras:v3', () => {
      expect(getSarvamSttModel()).toBe('saaras:v3');
    });
  });
});
