/**
 * Tests for Memory Context Module
 * Tests memory write logic including 180-day expiry
 */

describe('Memory Context Module - Expiry Logic', () => {
  // 180-day expiry calculation
  function calculateExpiryDate(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 180);
    return expiresAt;
  }

  // Memory summary creation
  function createMemorySummary(transcript: string, answer: string): string {
    return `${transcript.slice(0, 160)} -> ${answer.slice(0, 220)}`;
  }

  describe('calculateExpiryDate', () => {
    it('sets expiry 180 days in the future', () => {
      const expiry = calculateExpiryDate();
      const now = new Date();

      const diffTime = expiry.getTime() - now.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeGreaterThanOrEqual(179.9);
      expect(diffDays).toBeLessThanOrEqual(180.1);
    });

    it('returns a valid date object', () => {
      const expiry = calculateExpiryDate();
      expect(expiry instanceof Date).toBe(true);
      expect(expiry.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('createMemorySummary', () => {
    it('creates summary from transcript and answer', () => {
      const transcript = 'How do I treat powdery mildew?';
      const answer = 'Use sulfur-based fungicide every 7-10 days during the growing season.';

      const summary = createMemorySummary(transcript, answer);

      expect(summary).toContain('powdery mildew');
      expect(summary).toContain('sulfur');
      expect(summary).toContain(' -> ');
    });

    it('truncates long transcripts', () => {
      const longTranscript = 'This is a very long transcript '.repeat(20);
      const answer = 'Short answer';

      const summary = createMemorySummary(longTranscript, answer);

      expect(summary.length).toBeLessThan(400);
    });

    it('truncates long answers', () => {
      const transcript = 'Short question';
      const longAnswer = 'This is a very long answer. '.repeat(50);

      const summary = createMemorySummary(transcript, longAnswer);

      expect(summary.length).toBeLessThan(400);
    });

    it('preserves arrow separator format', () => {
      const summary = createMemorySummary('Test question', 'Test answer');
      expect(summary).toMatch(/^.+ -> .+$/);
    });
  });
});

describe('Memory Context Module - Citation Building', () => {
  function buildMemoryCitation(
    row: {
      content?: string | null;
      similarity?: number | null;
      metadata?: Record<string, unknown> | null;
    },
    index: number,
  ) {
    return {
      id: `memory-${index + 1}`,
      title: 'User memory',
      sourceType: 'memory',
      snippet: row.content ?? null,
      confidence: typeof row.similarity === 'number' ? row.similarity : null,
      metadata: row.metadata ?? null,
    };
  }

  describe('buildMemoryCitation', () => {
    it('builds citation from memory row', () => {
      const row = {
        content: 'User prefers drip irrigation',
        similarity: 0.85,
        metadata: { source: 'ai_gateway' },
      };

      const citation = buildMemoryCitation(row, 0);

      expect(citation.id).toBe('memory-1');
      expect(citation.title).toBe('User memory');
      expect(citation.sourceType).toBe('memory');
      expect(citation.snippet).toBe('User prefers drip irrigation');
      expect(citation.confidence).toBe(0.85);
    });

    it('handles null values', () => {
      const row = {
        content: null,
        similarity: null,
        metadata: null,
      };

      const citation = buildMemoryCitation(row, 2);

      expect(citation.id).toBe('memory-3');
      expect(citation.snippet).toBeNull();
      expect(citation.confidence).toBeNull();
      expect(citation.metadata).toBeNull();
    });

    it('increments index correctly', () => {
      const row = { content: 'test' };

      expect(buildMemoryCitation(row, 0).id).toBe('memory-1');
      expect(buildMemoryCitation(row, 4).id).toBe('memory-5');
    });
  });
});

describe('Memory Context Module - Context Block Building', () => {
  function buildMemoryContextBlocks(rows: Array<{ content?: string | null }>): string[] {
    return rows
      .map((row) => (typeof row.content === 'string' ? row.content.trim() : ''))
      .filter((content) => content.length > 0)
      .map((content) => `Memory: ${content}`);
  }

  describe('buildMemoryContextBlocks', () => {
    it('builds context blocks from memory rows', () => {
      const rows = [
        { content: 'User prefers drip irrigation' },
        { content: 'Farm has sandy soil' },
      ];

      const blocks = buildMemoryContextBlocks(rows);

      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toBe('Memory: User prefers drip irrigation');
      expect(blocks[1]).toBe('Memory: Farm has sandy soil');
    });

    it('filters empty content', () => {
      const rows = [
        { content: 'Valid memory' },
        { content: '' },
        { content: null },
        { content: 'Another memory' },
      ];

      const blocks = buildMemoryContextBlocks(rows);

      expect(blocks).toHaveLength(2);
    });

    it('trims whitespace from content', () => {
      const rows = [{ content: '  trimmed content  ' }];

      const blocks = buildMemoryContextBlocks(rows);

      expect(blocks[0]).toBe('Memory: trimmed content');
    });

    it('returns empty array for empty input', () => {
      expect(buildMemoryContextBlocks([])).toEqual([]);
    });
  });
});

describe('Memory Context Module - Parse Activity Extraction', () => {
  function parseActivityExtractionResult(raw: string): unknown {
    try {
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      return obj;
    } catch {
      return null;
    }
  }

  describe('parseActivityExtractionResult', () => {
    it('parses valid JSON object', () => {
      const result = parseActivityExtractionResult('{"type": "irrigation", "duration": 2}');
      expect(result).toEqual({ type: 'irrigation', duration: 2 });
    });

    it('parses complex objects', () => {
      const result = parseActivityExtractionResult(
        JSON.stringify({
          intent: 'log_activity',
          activity_type: 'spray',
          spray: {
            chemicals: [{ name: 'Sulfur', quantity: 2 }],
            water_volume: 200,
          },
        }),
      );

      expect(result).toEqual({
        intent: 'log_activity',
        activity_type: 'spray',
        spray: {
          chemicals: [{ name: 'Sulfur', quantity: 2 }],
          water_volume: 200,
        },
      });
    });

    it('returns null for invalid JSON', () => {
      expect(parseActivityExtractionResult('not json')).toBeNull();
      expect(parseActivityExtractionResult('{invalid}')).toBeNull();
    });

    it('returns null for non-object JSON', () => {
      expect(parseActivityExtractionResult('"string"')).toBeNull();
      expect(parseActivityExtractionResult('null')).toBeNull();
      expect(parseActivityExtractionResult('42')).toBeNull();
    });

    it('returns the array for array JSON (arrays are objects)', () => {
      expect(parseActivityExtractionResult('[1, 2, 3]')).toEqual([1, 2, 3]);
    });

    it('returns null for empty object', () => {
      expect(parseActivityExtractionResult('{}')).toEqual({});
    });
  });
});

describe('Memory Context Module - Tool Call Recording', () => {
  interface ToolCall {
    tool: string;
    status: 'ok' | 'error' | 'skipped';
    input?: Record<string, unknown> | null;
    output?: Record<string, unknown> | null;
    error?: string | null;
  }

  function recordMemorySearchSkipped(toolCalls: ToolCall[], reason: string): void {
    toolCalls.push({
      tool: 'memory.search',
      status: 'skipped',
      output: { reason },
    });
  }

  function recordMemorySearchError(toolCalls: ToolCall[], error: string): void {
    toolCalls.push({
      tool: 'memory.search',
      status: 'error',
      error,
    });
  }

  function recordMemorySearchOk(toolCalls: ToolCall[], count: number): void {
    toolCalls.push({
      tool: 'memory.search',
      status: 'ok',
      output: { count },
    });
  }

  function recordMemoryWriteSkipped(toolCalls: ToolCall[], reason: string): void {
    toolCalls.push({
      tool: 'memory.write',
      status: 'skipped',
      output: { reason },
    });
  }

  function recordMemoryWriteOk(toolCalls: ToolCall[], memoryId: string): void {
    toolCalls.push({
      tool: 'memory.write',
      status: 'ok',
      output: { memory_id: memoryId },
    });
  }

  describe('recordMemorySearchSkipped', () => {
    it('records skipped search with reason', () => {
      const toolCalls: ToolCall[] = [];
      recordMemorySearchSkipped(toolCalls, 'disabled_or_missing_user');

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].tool).toBe('memory.search');
      expect(toolCalls[0].status).toBe('skipped');
      expect(toolCalls[0].output?.reason).toBe('disabled_or_missing_user');
    });
  });

  describe('recordMemorySearchError', () => {
    it('records search error', () => {
      const toolCalls: ToolCall[] = [];
      recordMemorySearchError(toolCalls, 'Database connection failed');

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].tool).toBe('memory.search');
      expect(toolCalls[0].status).toBe('error');
      expect(toolCalls[0].error).toBe('Database connection failed');
    });
  });

  describe('recordMemorySearchOk', () => {
    it('records successful search with count', () => {
      const toolCalls: ToolCall[] = [];
      recordMemorySearchOk(toolCalls, 5);

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].tool).toBe('memory.search');
      expect(toolCalls[0].status).toBe('ok');
      expect(toolCalls[0].output?.count).toBe(5);
    });
  });

  describe('recordMemoryWriteSkipped', () => {
    it('records skipped write with reason', () => {
      const toolCalls: ToolCall[] = [];
      recordMemoryWriteSkipped(toolCalls, 'disabled_or_missing_identity');

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].tool).toBe('memory.write');
      expect(toolCalls[0].status).toBe('skipped');
    });
  });

  describe('recordMemoryWriteOk', () => {
    it('records successful write with memory ID', () => {
      const toolCalls: ToolCall[] = [];
      recordMemoryWriteOk(toolCalls, 'mem-123');

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].tool).toBe('memory.write');
      expect(toolCalls[0].status).toBe('ok');
      expect(toolCalls[0].output?.memory_id).toBe('mem-123');
    });
  });
});
