jest.mock('../supabase/functions/ai-gateway/utils/index.ts', () => ({
  checkCircuitBreaker: jest.fn().mockReturnValue(true),
  recordProviderFailure: jest.fn(),
  recordProviderSuccess: jest.fn(),
  stringifyUnknown: jest.fn((value: unknown) =>
    value instanceof Error ? value.message : JSON.stringify(value),
  ),
  STT_TIMEOUT_MS: 12000,
  TTS_TIMEOUT_MS: 8000,
  LLM_TIMEOUT_MS: 15000,
  withAbortTimeout: jest.fn((fn: (signal: AbortSignal) => Promise<unknown>) =>
    fn(new AbortController().signal),
  ),
  decodeBase64ToBytes: jest.fn(() => new Uint8Array([1, 2, 3])),
  toOptionalNumber: jest.fn((value: unknown) => (typeof value === 'number' ? value : null)),
  toOptionalString: jest.fn((value: unknown) =>
    typeof value === 'string' && value ? value : null,
  ),
  toRecord: jest.fn((value: unknown) => (value && typeof value === 'object' ? value : null)),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const providerUtils = require('../supabase/functions/ai-gateway/utils/index.ts');
const {
  chatCompletion,
  extractIntent,
  getAdvisoryModel,
} = require('../supabase/functions/ai-gateway/providers/llm.ts');
const { transcribeAudio } = require('../supabase/functions/ai-gateway/providers/stt.ts');
const { generateSpeech } = require('../supabase/functions/ai-gateway/providers/tts.ts');
const {
  generateEmbedding,
  getEmbeddingDimensions,
} = require('../supabase/functions/ai-gateway/providers/embeddings.ts');
/* eslint-enable @typescript-eslint/no-require-imports */

const originalFetch = global.fetch;

afterAll(() => {
  global.fetch = originalFetch;
});

describe('Sarvam-only providers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    providerUtils.checkCircuitBreaker.mockReturnValue(true);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses Sarvam chat completions for advisory responses', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Irrigate early in the morning.' } }],
        usage: { prompt_tokens: 20, completion_tokens: 8 },
      }),
    });

    const result = await chatCompletion({
      prompt: 'When should I irrigate?',
      locale: 'en',
      contextBlocks: [],
    });
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];

    expect(url).toBe('https://api.sarvam.ai/v1/chat/completions');
    expect(options.headers['api-subscription-key']).toBe('test-sarvam-key');
    expect(result.text).toBe('Irrigate early in the morning.');
    expect(getAdvisoryModel()).toBe('sarvam-105b');
  });

  it('surfaces Sarvam chat errors and empty responses', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Unauthorized' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '   ' } }] }),
      });

    await expect(
      chatCompletion({ prompt: 'Help', locale: 'en', contextBlocks: [] }),
    ).rejects.toThrow('Unauthorized');
    await expect(
      chatCompletion({ prompt: 'Help', locale: 'en', contextBlocks: [] }),
    ).rejects.toThrow('Sarvam returned an empty response');
  });

  it('rejects image attachments instead of silently dropping them', async () => {
    await expect(
      chatCompletion({
        prompt: 'What is on this leaf?',
        locale: 'en',
        contextBlocks: [],
        imageAttachments: [
          { name: 'leaf.jpg', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,AQID' },
        ],
      }),
    ).rejects.toThrow('Image attachments are not supported');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses Sarvam JSON mode for intent extraction', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"intent":"log_activity"}' } }] }),
    });

    const result = await extractIntent({
      transcript: 'Log irrigation',
      locale: 'en',
      farmNames: [],
    });
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(options.body).response_format).toEqual({ type: 'json_object' });
    expect(result).toBe('{"intent":"log_activity"}');
  });

  it('returns an empty intent when Sarvam extraction fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Unavailable' } }),
    });

    await expect(
      extractIntent({ transcript: 'Log irrigation', locale: 'en', farmNames: [] }),
    ).resolves.toBe('');
  });

  it('uses Sarvam for speech recognition', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ transcript: 'नमस्कार', language_code: 'mr-IN' }),
    });

    const result = await transcribeAudio({
      base64Audio: 'AQID',
      mimeType: 'audio/wav',
      providerFallbackEnabled: true,
    });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      'https://api.sarvam.ai/speech-to-text',
    );
    expect(result).toMatchObject({
      transcript: 'नमस्कार',
      provider: 'sarvam',
      detectedLanguage: 'mr-IN',
    });
    expect(providerUtils.recordProviderSuccess).toHaveBeenCalledWith('sarvam_stt');
  });

  it('surfaces Sarvam speech recognition errors and records provider failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'Unavailable' }),
    });

    await expect(
      transcribeAudio({
        base64Audio: 'AQID',
        mimeType: 'audio/wav',
        providerFallbackEnabled: false,
      }),
    ).rejects.toThrow('Unavailable');
    expect(providerUtils.recordProviderFailure).toHaveBeenCalledWith('sarvam_stt');
  });

  it('rejects empty transcripts and an open STT circuit without calling a fallback', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ transcript: '   ' }),
    });

    await expect(
      transcribeAudio({
        base64Audio: 'AQID',
        mimeType: 'audio/wav',
        providerFallbackEnabled: true,
      }),
    ).rejects.toThrow('stt_empty_transcript');

    jest.clearAllMocks();
    providerUtils.checkCircuitBreaker.mockReturnValue(false);
    await expect(
      transcribeAudio({
        base64Audio: 'AQID',
        mimeType: 'audio/wav',
        providerFallbackEnabled: true,
      }),
    ).rejects.toThrow('Sarvam STT circuit breaker is open');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses Sarvam for speech synthesis', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ audios: ['c2FydmFt'] }),
    });

    const result = await generateSpeech({
      text: 'Hello',
      locale: 'en',
      providerFallbackEnabled: true,
      canPlayAudio: true,
    });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      'https://api.sarvam.ai/text-to-speech',
    );
    expect(result).toMatchObject({ provider: 'sarvam', base64: 'c2FydmFt' });
    expect(providerUtils.recordProviderSuccess).toHaveBeenCalledWith('sarvam_tts');
  });

  it('formats Marathi TTS requests and truncates provider input', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ audios: ['c2FydmFt'] }),
    });

    await generateSpeech({
      text: 'अ'.repeat(2600),
      locale: 'mr',
      providerFallbackEnabled: false,
      canPlayAudio: true,
    });
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.target_language_code).toBe('mr-IN');
    expect(body.text).toHaveLength(2500);
  });

  it('returns text-only output when audio cannot play or Sarvam TTS fails', async () => {
    await expect(
      generateSpeech({
        text: 'Hello',
        locale: 'en',
        providerFallbackEnabled: false,
        canPlayAudio: false,
      }),
    ).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();

    jest.spyOn(console, 'warn').mockImplementation();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Unavailable' }),
    });
    await expect(
      generateSpeech({
        text: 'Hello',
        locale: 'en',
        providerFallbackEnabled: false,
        canPlayAudio: true,
      }),
    ).resolves.toBeNull();
    expect(providerUtils.recordProviderFailure).toHaveBeenCalledWith('sarvam_tts');
  });

  it('does not call an external embeddings provider', async () => {
    global.fetch = jest.fn();
    await expect(generateEmbedding('vineyard context')).resolves.toBeNull();
    expect(getEmbeddingDimensions()).toBe(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
