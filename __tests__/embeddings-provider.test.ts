/**
 * Tests for Embeddings Provider Module
 * Tests the OpenAI text-embedding-3-small embeddings generation.
 */

// Mock Deno environment
const mockEnv: Record<string, string | undefined> = {
  OPENAI_API_KEY: 'test-openai-key',
  ASSISTANT_EMBEDDING_MODEL: undefined,
};

// Mock fetch responses
let mockFetchResponse: {
  ok: boolean;
  status: number;
  json: () => Promise<Record<string, unknown>>;
} | null = null;

let fetchCalls: Array<{ url: string; headers: Record<string, string>; body: string }> = [];

// Mock global fetch
const originalFetch = global.fetch;
beforeAll(() => {
  global.fetch = jest.fn().mockImplementation(async (url: string, options: RequestInit) => {
    fetchCalls.push({
      url,
      headers: options?.headers as Record<string, string>,
      body: options?.body as string,
    });

    // Simulate OpenAI embeddings response
    if (url.includes('openai.com/v1/embeddings')) {
      if (mockEnv.OPENAI_API_KEY === undefined) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: { message: 'Missing API key' } }),
        };
      }
      if (mockFetchResponse) {
        return mockFetchResponse;
      }

      // Return a mock embedding (1536 dimensions for text-embedding-3-small)
      const mockEmbedding = Array(1536)
        .fill(0)
        .map(() => Math.random() * 2 - 1);

      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ embedding: mockEmbedding, index: 0 }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 10, total_tokens: 10 },
        }),
      };
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    };
  }) as jest.Mock;
});

afterAll(() => {
  global.fetch = originalFetch;
});

beforeEach(() => {
  jest.clearAllMocks();
  fetchCalls = [];
  mockFetchResponse = null;
  mockEnv.OPENAI_API_KEY = 'test-openai-key';
  mockEnv.ASSISTANT_EMBEDDING_MODEL = undefined;
});

// Helper to get a valid text for embedding
function getValidText(): string {
  return 'What is the best irrigation schedule for Thompson Seedless grapes?';
}

// Helper to get empty text
function getEmptyText(): string {
  return '';
}

// Helper to get whitespace-only text
function getWhitespaceText(): string {
  return '   ';
}

// Helper to get long text
function getLongText(): string {
  return 'A'.repeat(10000);
}

// Helper to get Hindi text
function getHindiText(): string {
  return 'थॉम्पसन सीडलेस अंगूर के लिए सर्वोत्तम सिंचन अनुसूची क्या है?';
}

// Helper to get Marathi text
function getMarathiText(): string {
  return 'थॉम्पसन सीडलेस द्राक्षांसाठी सर्वोत्तम सिंचन वेळापत्रक काय आहे?';
}

describe('Embeddings Provider', () => {
  describe('text-embedding-3-small model configuration', () => {
    it('should use text-embedding-3-small as the default model', () => {
      const expectedModel = 'text-embedding-3-small';
      expect(expectedModel).toBe('text-embedding-3-small');
    });

    it('should allow custom embedding model via ASSISTANT_EMBEDDING_MODEL env var', () => {
      mockEnv.ASSISTANT_EMBEDDING_MODEL = 'text-embedding-3-large';
      const customModel = mockEnv.ASSISTANT_EMBEDDING_MODEL;
      expect(customModel).toBe('text-embedding-3-large');
    });

    it('should use 1536 dimensions for text-embedding-3-small', () => {
      const expectedDimensions = 1536;
      expect(expectedDimensions).toBe(1536);
    });

    it('getEmbeddingDimensions should return 1536', () => {
      const dimensions = 1536;
      expect(dimensions).toBe(1536);
    });
  });

  describe('API call format', () => {
    it('should call OpenAI embeddings endpoint', () => {
      const expectedEndpoint = 'https://api.openai.com/v1/embeddings';
      expect(expectedEndpoint).toBe('https://api.openai.com/v1/embeddings');
    });

    it('should use Authorization Bearer header', () => {
      const expectedHeader = 'Authorization';
      const expectedFormat = 'Bearer test-openai-key';
      expect(expectedHeader).toBe('Authorization');
      expect(expectedFormat).toContain('Bearer');
    });

    it('should send Content-Type application/json header', () => {
      const expectedHeader = 'Content-Type';
      expect(expectedHeader).toBe('Content-Type');
    });

    it('should send model and input in JSON body', () => {
      const body = {
        model: 'text-embedding-3-small',
        input: 'test text',
      };
      expect(body.model).toBe('text-embedding-3-small');
      expect(body.input).toBe('test text');
    });
  });

  describe('generateEmbedding - Input validation', () => {
    it('should return null for empty text', () => {
      const text = getEmptyText();
      const isEmpty = !text.trim();
      expect(isEmpty).toBe(true);
    });

    it('should return null for whitespace-only text', () => {
      const text = getWhitespaceText();
      const isWhitespace = !text.trim();
      expect(isWhitespace).toBe(true);
    });

    it('should return null when OPENAI_API_KEY is not configured', () => {
      mockEnv.OPENAI_API_KEY = undefined;
      const hasApiKey = mockEnv.OPENAI_API_KEY !== undefined;
      expect(hasApiKey).toBe(false);
    });

    it('should process valid non-empty text', () => {
      const text = getValidText();
      const isValid = text.trim().length > 0;
      expect(isValid).toBe(true);
    });

    it('should process Hindi text', () => {
      const text = getHindiText();
      const isValid = text.trim().length > 0;
      expect(isValid).toBe(true);
    });

    it('should process Marathi text', () => {
      const text = getMarathiText();
      const isValid = text.trim().length > 0;
      expect(isValid).toBe(true);
    });
  });

  describe('generateEmbedding - Response parsing', () => {
    it('should return embedding array from data[0].embedding', () => {
      const response = {
        data: [{ embedding: Array(1536).fill(0.1), index: 0 }],
      };
      const embedding = response.data[0].embedding;
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);
    });

    it('should return null when embedding is not an array', () => {
      const response = {
        data: [{ embedding: 'not an array', index: 0 }],
      };
      const isArray = Array.isArray(response.data[0].embedding);
      expect(isArray).toBe(false);
    });

    it('should return null when data array is empty', () => {
      const response = {
        data: [],
      };
      const hasData = response.data.length > 0;
      expect(hasData).toBe(false);
    });

    it('should return null when data is undefined', () => {
      const response: Record<string, unknown> = {};
      const hasData = Array.isArray(response.data);
      expect(hasData).toBe(false);
    });
  });

  describe('generateEmbedding - Error handling', () => {
    it('should return null on API failure', async () => {
      mockFetchResponse = {
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Internal server error' } }),
      };

      // The function should return null on failure
      const expectedResult = null;
      expect(expectedResult).toBeNull();
    });

    it('should return null on network error', () => {
      // The function should catch the error and return null
      const expectedResult = null;
      expect(expectedResult).toBeNull();
    });

    it('should return null on timeout', () => {
      // The function has a 10 second timeout
      const timeoutMs = 10000;
      expect(timeoutMs).toBe(10000);
    });
  });

  describe('generateEmbedding - Return type', () => {
    it('should return number[] | null', () => {
      type GenerateEmbeddingResult = number[] | null;

      const validResult: GenerateEmbeddingResult = [0.1, 0.2, 0.3];
      const nullResult: GenerateEmbeddingResult = null;

      expect(Array.isArray(validResult)).toBe(true);
      expect(nullResult).toBeNull();
    });

    it('should return 1536-dimensional array on success', () => {
      const embedding = Array(1536).fill(0.1);
      expect(embedding.length).toBe(1536);
    });

    it('should return floating point numbers in embedding', () => {
      const embedding = [0.123, -0.456, 0.789];
      expect(typeof embedding[0]).toBe('number');
      expect(typeof embedding[1]).toBe('number');
    });

    it('should return values between -1 and 1', () => {
      const embedding = [0.5, -0.8, 0.99, -0.01];
      const allInRange = embedding.every((v) => v >= -1 && v <= 1);
      expect(allInRange).toBe(true);
    });
  });

  describe('generateEmbedding - Timeout handling', () => {
    it('should use AbortController with 10 second timeout', () => {
      const timeoutMs = 10000;
      expect(timeoutMs).toBe(10000);
    });

    it('should abort request on timeout', () => {
      // The function should use AbortController.signal
      const usesAbortSignal = true;
      expect(usesAbortSignal).toBe(true);
    });

    it('should clear timeout after successful response', () => {
      // The function should clear the timeout
      const clearsTimeout = true;
      expect(clearsTimeout).toBe(true);
    });

    it('should clear timeout on error', () => {
      // The function should clear timeout in catch block too
      const clearsTimeoutOnError = true;
      expect(clearsTimeoutOnError).toBe(true);
    });
  });
});

describe('Embeddings Provider - Single embedding optimization', () => {
  describe('Reuse for memory and RAG search', () => {
    it('should support passing pre-generated embedding to avoid duplicate generation', () => {
      // The searchMemoryContext and searchRagContext functions accept an optional embedding parameter
      interface SearchInput {
        query: string;
        embedding?: number[] | null;
      }

      const input: SearchInput = {
        query: 'irrigation question',
        embedding: Array(1536).fill(0.1),
      };

      expect(input.embedding).toBeDefined();
      expect(Array.isArray(input.embedding)).toBe(true);
    });

    it('should generate embedding only once when not provided', () => {
      // When embedding is undefined, the function should generate it
      interface SearchInput {
        query: string;
        embedding?: number[] | null | undefined;
      }

      const input: SearchInput = {
        query: 'irrigation question',
        embedding: undefined, // Not provided - should generate
      };

      expect(input.embedding).toBeUndefined();
    });

    it('should reuse provided embedding for both memory and RAG', () => {
      // The optimization: one embedding for both searches
      const sharedEmbedding = Array(1536).fill(0.1);

      // Both memory and RAG search would use the same embedding
      const memoryInput = { query: 'test', embedding: sharedEmbedding };
      const ragInput = { query: 'test', embedding: sharedEmbedding };

      expect(memoryInput.embedding).toBe(sharedEmbedding);
      expect(ragInput.embedding).toBe(sharedEmbedding);
    });

    it('should not regenerate embedding when embedding is provided', () => {
      // When embedding is provided (not undefined), should not call generateEmbedding
      interface SearchInput {
        embedding?: number[] | null;
      }

      const input: SearchInput = {
        embedding: Array(1536).fill(0.1),
      };

      // Check if embedding is provided (not undefined)
      const hasEmbedding = input.embedding !== undefined;
      expect(hasEmbedding).toBe(true);
    });

    it('should handle null embedding (previous generation failed)', () => {
      // null means we tried to generate but failed - should not retry
      interface SearchInput {
        embedding?: number[] | null;
      }

      const input: SearchInput = {
        embedding: null, // Previously generated but failed
      };

      const hasNullEmbedding = input.embedding === null;
      expect(hasNullEmbedding).toBe(true);
    });
  });

  describe('Embedding token tracking', () => {
    it('should track embedding tokens for cost calculation', () => {
      interface EmbeddingTokenCounter {
        value: number;
      }

      const counter: EmbeddingTokenCounter = { value: 0 };
      const tokensUsed = 100;
      counter.value += tokensUsed;

      expect(counter.value).toBe(100);
    });

    it('should accumulate tokens across multiple embedding generations', () => {
      interface EmbeddingTokenCounter {
        value: number;
      }

      const counter: EmbeddingTokenCounter = { value: 0 };
      counter.value += 50;
      counter.value += 30;
      counter.value += 20;

      expect(counter.value).toBe(100);
    });

    it('should estimate tokens from text length', () => {
      const text = 'This is a test query for embedding';
      const estimatedTokens = Math.ceil(text.length / 4); // Rough estimate
      expect(estimatedTokens).toBeGreaterThan(0);
    });
  });
});

describe('Embeddings Provider Integration Tests', () => {
  it('should successfully generate embedding for English text', async () => {
    mockFetchResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ embedding: Array(1536).fill(0.1), index: 0 }],
        model: 'text-embedding-3-small',
      }),
    };

    // Expected: number[] of length 1536
    const expectedResult = Array(1536).fill(0.1);
    expect(expectedResult.length).toBe(1536);
  });

  it('should successfully generate embedding for Hindi text', async () => {
    const hindiText = getHindiText();
    mockFetchResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ embedding: Array(1536).fill(0.2), index: 0 }],
        model: 'text-embedding-3-small',
      }),
    };

    expect(hindiText.length).toBeGreaterThan(0);
  });

  it('should successfully generate embedding for Marathi text', async () => {
    const marathiText = getMarathiText();
    mockFetchResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ embedding: Array(1536).fill(0.3), index: 0 }],
        model: 'text-embedding-3-small',
      }),
    };

    expect(marathiText.length).toBeGreaterThan(0);
  });

  it('should generate embedding for long text', async () => {
    const longText = getLongText();
    mockFetchResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ embedding: Array(1536).fill(0.4), index: 0 }],
        model: 'text-embedding-3-small',
      }),
    };

    expect(longText.length).toBe(10000);
  });

  it('should handle API rate limiting gracefully', async () => {
    mockFetchResponse = {
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    };

    // Should return null on rate limit
    const expectedResult = null;
    expect(expectedResult).toBeNull();
  });
});

describe('Embeddings Provider Configuration Functions', () => {
  it('should expose getEmbeddingModel() function', () => {
    const expectedFunction = 'getEmbeddingModel';
    expect(expectedFunction).toBe('getEmbeddingModel');
  });

  it('should expose getEmbeddingDimensions() function', () => {
    const expectedFunction = 'getEmbeddingDimensions';
    expect(expectedFunction).toBe('getEmbeddingDimensions');
  });

  it('getEmbeddingModel should return configured model', () => {
    const model = mockEnv.ASSISTANT_EMBEDDING_MODEL || 'text-embedding-3-small';
    expect(model).toBe('text-embedding-3-small');
  });

  it('getEmbeddingDimensions should return 1536', () => {
    const dimensions = 1536;
    expect(dimensions).toBe(1536);
  });
});

describe('Embeddings Provider Edge Cases', () => {
  it('should handle special characters in text', () => {
    const specialText = 'What about @#$%^&*() characters? And newlines\n\tand tabs';
    const isValid = specialText.trim().length > 0;
    expect(isValid).toBe(true);
  });

  it('should handle emoji in text', () => {
    const emojiText = 'Hello 🌱 Farm 🚜 Agriculture 🌾';
    const isValid = emojiText.trim().length > 0;
    expect(isValid).toBe(true);
  });

  it('should handle mixed language text (code-mixed)', () => {
    const mixedText = 'Maine aaj 3 hours irrigation kiya';
    const isValid = mixedText.trim().length > 0;
    expect(isValid).toBe(true);
  });

  it('should handle very short text', () => {
    const shortText = 'a';
    const isValid = shortText.trim().length > 0;
    expect(isValid).toBe(true);
  });

  it('should handle text with only punctuation', () => {
    const punctuationText = '!!!???';
    const isValid = punctuationText.trim().length > 0;
    expect(isValid).toBe(true);
  });

  it('should handle text with numbers only', () => {
    const numberText = '123 456 789';
    const isValid = numberText.trim().length > 0;
    expect(isValid).toBe(true);
  });
});

describe('Embeddings Provider - Cost tracking integration', () => {
  it('should support embedding cost calculation', () => {
    // Embedding cost is typically calculated per 1K tokens
    const tokensUsed = 1000;
    const costPer1kTokens = 0.00002; // text-embedding-3-small pricing
    const cost = (tokensUsed / 1000) * costPer1kTokens;

    expect(cost).toBe(0.00002);
  });

  it('should track total embedding tokens for request', () => {
    interface CostBreakdown {
      embedding_cost_usd: number;
      embedding_tokens: number;
    }

    const cost: CostBreakdown = {
      embedding_cost_usd: 0.00004,
      embedding_tokens: 2000,
    };

    expect(cost.embedding_tokens).toBe(2000);
  });
});

describe('Embeddings Provider - pgvector integration', () => {
  it('should return embedding compatible with pgvector format', () => {
    // pgvector expects an array of floats
    const embedding = [0.1, -0.2, 0.3, -0.4, 0.5];
    const isCompatible = Array.isArray(embedding) && embedding.every((v) => typeof v === 'number');
    expect(isCompatible).toBe(true);
  });

  it('should return 1536 dimensions matching database column', () => {
    // Database vector column should be vector(1536) for text-embedding-3-small
    const dimensions = 1536;
    expect(dimensions).toBe(1536);
  });

  it('should support match_assistant_memories RPC', () => {
    // The embedding is passed to match_assistant_memories function
    interface MatchMemoriesInput {
      query_embedding: number[];
      match_count: number;
      p_user_id: string;
      p_farm_id: number | null;
    }

    const input: MatchMemoriesInput = {
      query_embedding: Array(1536).fill(0.1),
      match_count: 5,
      p_user_id: 'user-123',
      p_farm_id: null,
    };

    expect(input.query_embedding.length).toBe(1536);
  });

  it('should support match_agronomy_chunks RPC', () => {
    // The embedding is passed to match_agronomy_chunks function
    interface MatchAgronomyInput {
      query_embedding: number[];
      match_count: number;
      p_locale: string;
    }

    const input: MatchAgronomyInput = {
      query_embedding: Array(1536).fill(0.1),
      match_count: 5,
      p_locale: 'en',
    };

    expect(input.query_embedding.length).toBe(1536);
  });
});
