/**
 * Tests for LLM Provider Module
 * Imports and executes the real chatCompletion() and extractIntent() with mocked fetch.
 */

// Mock shared utils to avoid loading Deno ESM URL dependencies
jest.mock('../supabase/functions/ai-gateway/utils/index.ts', () => ({
  LLM_TIMEOUT_MS: 15000,
  withAbortTimeout: jest
    .fn()
    .mockImplementation(async (fn: (s: AbortSignal) => Promise<unknown>) =>
      fn(new AbortController().signal),
    ),
  stringifyUnknown: jest.fn((v: unknown) => {
    if (v instanceof Error) return v.message;
    if (v === null || v === undefined) return '';
    return typeof v === 'string' ? v : JSON.stringify(v);
  }),
  toOptionalNumber: jest.fn((v: unknown) => (typeof v === 'number' ? v : null)),
  toRecord: jest.fn((v: unknown) => (v && typeof v === 'object' ? v : null)),
  // Other utils not used by llm.ts but exported by index
  checkCircuitBreaker: jest.fn().mockReturnValue(true),
  recordProviderFailure: jest.fn(),
  recordProviderSuccess: jest.fn(),
  decodeBase64ToBytes: jest.fn(),
  detectAudioFormatFromHeader: jest.fn(),
  normalizeOpenAiAudioMime: jest.fn(),
  estimateBase64Bytes: jest.fn(),
  toOptionalString: jest.fn((v: unknown) => (typeof v === 'string' && v ? v : null)),
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
  TTS_TIMEOUT_MS: 8000,
  STT_TIMEOUT_MS: 12000,
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

// require() is used intentionally here: TypeScript does not follow require() for type checking,
// which prevents it from descending into the Deno-specific provider files.
/* eslint-disable @typescript-eslint/no-require-imports */
const { chatCompletion, extractIntent, getAdvisoryModel, getExtractionModel } =
  require('../supabase/functions/ai-gateway/providers/llm.ts') as {
    chatCompletion: (input: {
      prompt: string;
      locale: 'en' | 'hi' | 'mr';
      contextBlocks: string[];
      signal?: AbortSignal;
    }) => Promise<{ text: string; inputTokens: number; outputTokens: number }>;
    extractIntent: (input: {
      transcript: string;
      locale: 'en' | 'hi' | 'mr';
      farmNames: string[];
      contextFarmName?: string | null;
      signal?: AbortSignal;
    }) => Promise<string>;
    getAdvisoryModel: () => string;
    getExtractionModel: () => string;
  };
/* eslint-enable @typescript-eslint/no-require-imports */

// ============================================================
// MARK: - Fetch Mock
// ============================================================

const originalFetch = global.fetch;
let mockFetchImpl: jest.Mock;

const advisoryResponse = {
  choices: [{ message: { content: 'Based on your farm context, I recommend early irrigation.' } }],
  usage: { prompt_tokens: 150, completion_tokens: 40 },
};

const extractionResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          intent: 'log_activity',
          intent_confidence: 0.9,
          activity_type: 'irrigation',
          cancel: false,
          farm_name: null,
          date_iso: '2025-03-14',
          date_relative: 'today',
          confidence: 0.85,
          irrigation: { duration_hours: 3 },
          spray: { water_volume: null, chemicals: [] },
          harvest: { quantity: null, grade: null, price: null, buyer: null },
          expense: { cost: null, expense_type: null, remarks: null },
          fertigation: { water_volume: null, fertilizers: [] },
        }),
      },
    },
  ],
  usage: { prompt_tokens: 100, completion_tokens: 50 },
};

beforeAll(() => {
  mockFetchImpl = jest.fn();
  global.fetch = mockFetchImpl;
});

afterAll(() => {
  global.fetch = originalFetch;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================
// MARK: - chatCompletion tests
// ============================================================

describe('chatCompletion — real module function', () => {
  it('calls OpenAI chat completions endpoint and returns text', async () => {
    mockFetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => advisoryResponse,
    });

    const result = await chatCompletion({
      prompt: 'When should I irrigate?',
      locale: 'en',
      contextBlocks: [],
    });

    expect(result.text).toBe('Based on your farm context, I recommend early irrigation.');
    expect(typeof result.inputTokens).toBe('number');
    expect(typeof result.outputTokens).toBe('number');
    expect(mockFetchImpl).toHaveBeenCalledTimes(1);
    const [url] = mockFetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('openai.com/v1/chat/completions');
  });

  it('uses Authorization Bearer header with OpenAI key', async () => {
    mockFetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => advisoryResponse,
    });

    await chatCompletion({ prompt: 'Test', locale: 'en', contextBlocks: [] });

    const [, options] = mockFetchImpl.mock.calls[0] as [string, RequestInit];
    const headers = options?.headers as Record<string, string>;
    expect(headers?.['Authorization']).toMatch(/^Bearer test-openai-key$/);
  });

  it('includes Hindi language instruction for locale=hi', async () => {
    mockFetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => advisoryResponse,
    });

    await chatCompletion({ prompt: 'सिंचाई कब?', locale: 'hi', contextBlocks: [] });

    const [, options] = mockFetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options?.body as string);
    const systemContent = body.messages?.[0]?.content as string;
    expect(systemContent).toContain('Hindi');
  });

  it('includes Marathi language instruction for locale=mr', async () => {
    mockFetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => advisoryResponse,
    });

    await chatCompletion({ prompt: 'सिंचन कधी?', locale: 'mr', contextBlocks: [] });

    const [, options] = mockFetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options?.body as string);
    const systemContent = body.messages?.[0]?.content as string;
    expect(systemContent).toContain('Marathi');
  });

  it('includes context blocks in the system message', async () => {
    mockFetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => advisoryResponse,
    });

    await chatCompletion({
      prompt: 'Farm question',
      locale: 'en',
      contextBlocks: ['Farm: TestFarm', 'Crop: Grape'],
    });

    const [, options] = mockFetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options?.body as string);
    const systemContent = body.messages?.[0]?.content as string;
    expect(systemContent).toContain('Farm: TestFarm');
    expect(systemContent).toContain('Crop: Grape');
  });

  it('throws when OpenAI returns error response', async () => {
    mockFetchImpl.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Unauthorized' } }),
    });

    await expect(
      chatCompletion({ prompt: 'Test', locale: 'en', contextBlocks: [] }),
    ).rejects.toThrow('Unauthorized');
  });

  it('uses gpt-4o-mini as default model', () => {
    const model = getAdvisoryModel();
    expect(model).toBe('gpt-4o-mini');
  });
});

// ============================================================
// MARK: - extractIntent tests
// ============================================================

describe('extractIntent — real module function', () => {
  it('calls OpenAI with JSON response_format and returns JSON string', async () => {
    mockFetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => extractionResponse,
    });

    const result = await extractIntent({
      transcript: 'I irrigated for 3 hours',
      locale: 'en',
      farmNames: ['TestFarm'],
      contextFarmName: null,
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    const parsed = JSON.parse(result);
    expect(parsed.intent).toBe('log_activity');
    expect(parsed.activity_type).toBe('irrigation');
  });

  it('uses JSON mode (response_format.type = json_object)', async () => {
    mockFetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => extractionResponse,
    });

    await extractIntent({
      transcript: 'Log irrigation',
      locale: 'en',
      farmNames: [],
      contextFarmName: null,
    });

    const [, options] = mockFetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options?.body as string);
    expect(body.response_format?.type).toBe('json_object');
  });

  it('returns empty string when OpenAI returns error', async () => {
    mockFetchImpl.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server error' } }),
    });

    const result = await extractIntent({
      transcript: 'Test',
      locale: 'en',
      farmNames: [],
      contextFarmName: null,
    });

    expect(result).toBe('');
  });

  it('sends today_iso in the user message body', async () => {
    mockFetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => extractionResponse,
    });

    await extractIntent({
      transcript: 'Irrigated today',
      locale: 'en',
      farmNames: [],
      contextFarmName: null,
    });

    const [, options] = mockFetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options?.body as string);
    const userContent = JSON.parse(body.messages?.[1]?.content as string);
    expect(userContent.today_iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uses gpt-4o-mini as default extraction model', () => {
    const model = getExtractionModel();
    expect(model).toBe('gpt-4o-mini');
  });
});
