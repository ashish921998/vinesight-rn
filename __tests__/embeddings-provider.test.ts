/**
 * Tests for Embeddings Provider Module
 * Imports and executes the real generateEmbedding() with mocked fetch.
 */

// embeddings.ts has NO imports from utils/index.ts — it only uses
// Deno.env.get() (mocked by deno-mock.js) and global fetch.

// require() is used intentionally here: TypeScript does not follow require() for type checking,
// which prevents it from descending into the Deno-specific provider files.
/* eslint-disable @typescript-eslint/no-require-imports */
const { generateEmbedding, getEmbeddingModel, getEmbeddingDimensions } =
  require('../supabase/functions/ai-gateway/providers/embeddings.ts') as {
    generateEmbedding: (text: string) => Promise<number[] | null>;
    getEmbeddingModel: () => string;
    getEmbeddingDimensions: () => number;
  };
/* eslint-enable @typescript-eslint/no-require-imports */

// ============================================================
// MARK: - Fetch Mock
// ============================================================

const originalFetch = global.fetch;
let mockFetchImpl: jest.Mock;

const mockEmbedding = Array.from({ length: 1536 }, (_, i) => (i % 100) / 100 - 0.5);

function embeddingResponse(embedding = mockEmbedding) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: [{ embedding, index: 0 }],
      model: 'text-embedding-3-small',
      usage: { prompt_tokens: 10, total_tokens: 10 },
    }),
  };
}

beforeAll(() => {
  mockFetchImpl = jest.fn();
  global.fetch = mockFetchImpl;
});

afterAll(() => {
  global.fetch = originalFetch;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchImpl.mockResolvedValue(embeddingResponse());
});

// ============================================================
// MARK: - Tests
// ============================================================

describe('generateEmbedding — real module function', () => {
  describe('happy path', () => {
    it('calls OpenAI embeddings endpoint and returns number array', async () => {
      const result = await generateEmbedding('What is the best irrigation schedule?');

      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
      expect(result!.length).toBe(1536);
      expect(mockFetchImpl).toHaveBeenCalledTimes(1);
      const [url] = mockFetchImpl.mock.calls[0] as [string];
      expect(url).toContain('openai.com/v1/embeddings');
    });

    it('uses Authorization Bearer header with OpenAI key', async () => {
      await generateEmbedding('Test text');

      const [, options] = mockFetchImpl.mock.calls[0] as [string, RequestInit];
      const headers = options?.headers as Record<string, string>;
      expect(headers?.['Authorization']).toMatch(/^Bearer test-openai-key$/);
    });

    it('sends correct model in request body', async () => {
      await generateEmbedding('Test text');

      const [, options] = mockFetchImpl.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options?.body as string);
      expect(body.model).toBe('text-embedding-3-small');
    });

    it('sends input text in request body', async () => {
      const text = 'Farm irrigation question';
      await generateEmbedding(text);

      const [, options] = mockFetchImpl.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options?.body as string);
      expect(body.input).toBe(text);
    });

    it('returns floating point numbers in the embedding', async () => {
      const result = await generateEmbedding('Test');
      expect(result).not.toBeNull();
      expect(result!.every((v) => typeof v === 'number')).toBe(true);
    });
  });

  describe('empty / whitespace input', () => {
    it('returns null for empty string', async () => {
      const result = await generateEmbedding('');
      expect(result).toBeNull();
      expect(mockFetchImpl).not.toHaveBeenCalled();
    });

    it('returns null for whitespace-only string', async () => {
      const result = await generateEmbedding('   ');
      expect(result).toBeNull();
      expect(mockFetchImpl).not.toHaveBeenCalled();
    });
  });

  describe('API error handling', () => {
    it('returns null when OpenAI returns non-ok response', async () => {
      mockFetchImpl.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Unauthorized' } }),
      });

      const result = await generateEmbedding('Test text');
      expect(result).toBeNull();
    });

    it('returns null when fetch throws a network error', async () => {
      mockFetchImpl.mockRejectedValueOnce(new Error('Network error'));
      const result = await generateEmbedding('Test text');
      expect(result).toBeNull();
    });

    it('returns null when response contains no embedding data', async () => {
      mockFetchImpl.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });

      const result = await generateEmbedding('Test');
      expect(result).toBeNull();
    });
  });

  describe('configuration', () => {
    it('uses text-embedding-3-small as default model', () => {
      const model = getEmbeddingModel();
      expect(model).toBe('text-embedding-3-small');
    });

    it('reports 1536 embedding dimensions', () => {
      const dims = getEmbeddingDimensions();
      expect(dims).toBe(1536);
    });
  });
});
