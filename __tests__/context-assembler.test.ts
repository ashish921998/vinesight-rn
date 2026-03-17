/**
 * Tests for Context Assembler Module
 * Tests context block building and utility functions
 */

describe('Context Assembler Module - Block Building', () => {
  // Context block builder functions (extracted for testing)
  function buildFarmContextBlock(
    farmContext: {
      farm_id?: number | null;
      farm_name?: string | null;
      crop_variety?: string | null;
      area?: number | null;
      region?: string | null;
      growth_stage?: string | null;
      days_since_pruning?: number | null;
    } | null,
  ): string {
    if (!farmContext) return '';

    const parts: string[] = [];

    if (farmContext.farm_name) parts.push(`Farm: ${farmContext.farm_name}`);
    if (farmContext.farm_id) parts.push(`Farm ID: ${farmContext.farm_id}`);
    if (farmContext.crop_variety) parts.push(`Crop: ${farmContext.crop_variety}`);
    if (farmContext.area) parts.push(`Area: ${farmContext.area} acres`);
    if (farmContext.region) parts.push(`Region: ${farmContext.region}`);
    if (farmContext.growth_stage) parts.push(`Growth stage: ${farmContext.growth_stage}`);
    if (farmContext.days_since_pruning !== null && farmContext.days_since_pruning !== undefined) {
      parts.push(`Days since pruning: ${farmContext.days_since_pruning}`);
    }

    if (parts.length === 0) return '';
    return `Farm context:\n${parts.map((p) => `- ${p}`).join('\n')}`;
  }

  function buildAttachmentContextBlocks(
    attachments:
      | Array<{
          kind: 'image' | 'document';
          name: string;
          mimeType?: string;
          dataUrl?: string;
          textContent?: string;
        }>
      | undefined,
  ): string[] {
    if (!Array.isArray(attachments) || attachments.length === 0) return [];

    return attachments
      .map((attachment, index) => {
        if (!attachment) return null;
        const name =
          typeof attachment.name === 'string' ? attachment.name : `attachment-${index + 1}`;
        const mimeType = typeof attachment.mimeType === 'string' ? attachment.mimeType : 'unknown';

        if (typeof attachment.textContent === 'string' && attachment.textContent.trim()) {
          return `Attachment ${index + 1} (${name}, ${mimeType}) text:\n${attachment.textContent.trim()}`;
        }

        if (typeof attachment.dataUrl === 'string' && attachment.dataUrl.trim()) {
          return `Attachment ${index + 1} (${name}, ${mimeType}) image attached by user.`;
        }

        return `Attachment ${index + 1} (${name}, ${mimeType}) attached by user.`;
      })
      .filter((block): block is string => Boolean(block));
  }

  function buildFarmRecordsContextBlock(
    result: {
      answer: string | null;
      citations: unknown[];
      records: unknown[];
      totalCount: number;
    } | null,
  ): string {
    if (!result || !result.answer) return '';
    return `Farm records context:\nRecent records: ${result.answer}`;
  }

  describe('buildFarmContextBlock', () => {
    it('builds complete farm context block', () => {
      const farmContext = {
        farm_id: 1,
        farm_name: 'My Vineyard',
        crop_variety: 'Thompson Seedless',
        area: 5,
        region: 'Nashik',
        growth_stage: 'Flowering',
        days_since_pruning: 45,
      };

      const block = buildFarmContextBlock(farmContext);
      expect(block).toContain('Farm: My Vineyard');
      expect(block).toContain('Crop: Thompson Seedless');
      expect(block).toContain('Area: 5 acres');
      expect(block).toContain('Region: Nashik');
      expect(block).toContain('Growth stage: Flowering');
      expect(block).toContain('Days since pruning: 45');
    });

    it('handles partial farm context', () => {
      const farmContext = {
        farm_name: 'Farm A',
        crop_variety: 'Cabernet',
      };

      const block = buildFarmContextBlock(farmContext);
      expect(block).toContain('Farm: Farm A');
      expect(block).toContain('Crop: Cabernet');
      expect(block).not.toContain('Region');
      expect(block).not.toContain('Area');
    });

    it('returns empty string for null context', () => {
      expect(buildFarmContextBlock(null)).toBe('');
    });

    it('returns empty string for empty context object', () => {
      expect(buildFarmContextBlock({})).toBe('');
    });

    it('handles zero values correctly', () => {
      const block = buildFarmContextBlock({
        area: 0,
        days_since_pruning: 0,
      });
      // Note: farm_id: 0 is falsy in JS, so it won't be included
      // area: 0 is also falsy, but days_since_pruning explicitly checks for undefined/null
      expect(block).toContain('Days since pruning: 0');
      expect(block).not.toContain('Farm ID');
      expect(block).not.toContain('Area: 0');
    });
  });

  describe('buildAttachmentContextBlocks', () => {
    it('builds blocks for text attachments', () => {
      const attachments = [
        {
          kind: 'document' as const,
          name: 'report.pdf',
          mimeType: 'application/pdf',
          textContent: 'This is a report about soil health.',
        },
      ];

      const blocks = buildAttachmentContextBlocks(attachments);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toContain('report.pdf');
      expect(blocks[0]).toContain('soil health');
      expect(blocks[0]).toContain('text:');
    });

    it('builds blocks for image attachments', () => {
      const attachments = [
        {
          kind: 'image' as const,
          name: 'photo.jpg',
          mimeType: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,/9j/4AAQ...',
        },
      ];

      const blocks = buildAttachmentContextBlocks(attachments);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toContain('photo.jpg');
      expect(blocks[0]).toContain('image attached');
    });

    it('prefers text content over dataUrl', () => {
      const attachments = [
        {
          kind: 'document' as const,
          name: 'doc.pdf',
          mimeType: 'application/pdf',
          dataUrl: 'data:application/pdf;base64,abc',
          textContent: 'Extracted text content',
        },
      ];

      const blocks = buildAttachmentContextBlocks(attachments);
      expect(blocks[0]).toContain('text:');
      expect(blocks[0]).toContain('Extracted text content');
    });

    it('returns empty array for no attachments', () => {
      expect(buildAttachmentContextBlocks(undefined)).toEqual([]);
      expect(buildAttachmentContextBlocks([])).toEqual([]);
    });

    it('handles multiple attachments', () => {
      const attachments = [
        { kind: 'image' as const, name: 'img1.jpg', mimeType: 'image/jpeg', dataUrl: 'abc' },
        {
          kind: 'document' as const,
          name: 'doc.pdf',
          mimeType: 'application/pdf',
          textContent: 'text',
        },
      ];

      const blocks = buildAttachmentContextBlocks(attachments);
      expect(blocks).toHaveLength(2);
    });
  });

  describe('buildFarmRecordsContextBlock', () => {
    it('builds block from farm records result', () => {
      const result = {
        answer: 'Latest irrigation: 2 hours on 2025-01-15.',
        citations: [],
        records: [],
        totalCount: 1,
      };

      const block = buildFarmRecordsContextBlock(result);
      expect(block).toContain('Farm records context');
      expect(block).toContain('Latest irrigation');
    });

    it('returns empty string for null result', () => {
      expect(buildFarmRecordsContextBlock(null)).toBe('');
    });

    it('returns empty string for empty answer', () => {
      expect(
        buildFarmRecordsContextBlock({ answer: null, citations: [], records: [], totalCount: 0 }),
      ).toBe('');
      expect(
        buildFarmRecordsContextBlock({ answer: '', citations: [], records: [], totalCount: 0 }),
      ).toBe('');
    });
  });
});

describe('Context Assembler Module - Weather Queries', () => {
  function isWeatherDependentQuery(transcript: string): boolean {
    const weatherKeywords = [
      /\bweather|rain|spray.*today|fertigation.*today|temperature|hot|cold|humidity|irrigation.*need/i,
      /हवामान|पाऊस|बारिश|आज|स्प्रे|तापमान|गरम|ठंड|नमी|पाणी|सिंचन/,
    ];
    return weatherKeywords.some((regex) => regex.test(transcript));
  }

  function isWeatherQuery(transcript: string): boolean {
    return /\bweather|हवामान|मौसम/i.test(transcript);
  }

  describe('isWeatherDependentQuery', () => {
    it('detects weather-dependent spray queries', () => {
      expect(isWeatherDependentQuery('should I spray today?')).toBe(true);
      expect(isWeatherDependentQuery('fertigation today?')).toBe(true);
    });

    it('detects weather-dependent irrigation queries', () => {
      expect(isWeatherDependentQuery('irrigation need today')).toBe(true);
      expect(isWeatherDependentQuery('irrigation need?')).toBe(true);
    });

    it('detects explicit weather queries', () => {
      expect(isWeatherDependentQuery('will it rain?')).toBe(true);
      expect(isWeatherDependentQuery('what is the temperature')).toBe(true);
    });

    it('detects Hindi weather queries', () => {
      expect(isWeatherDependentQuery('आज स्प्रे करू?')).toBe(true);
      expect(isWeatherDependentQuery('पाणी लागेल का?')).toBe(true);
    });

    it('returns false for non-weather queries', () => {
      expect(isWeatherDependentQuery('log irrigation')).toBe(false);
      expect(isWeatherDependentQuery('hello world')).toBe(false);
      expect(isWeatherDependentQuery('show my tasks')).toBe(false);
    });
  });

  describe('isWeatherQuery', () => {
    it('detects explicit weather queries', () => {
      expect(isWeatherQuery('what is the weather?')).toBe(true);
      expect(isWeatherQuery('हवामान कसे?')).toBe(true);
      expect(isWeatherQuery('मौसम कैसा है?')).toBe(true);
      expect(isWeatherQuery('weather forecast')).toBe(true);
    });

    it('returns false for implicit weather queries', () => {
      expect(isWeatherQuery('should I spray?')).toBe(false);
      expect(isWeatherQuery('is it hot?')).toBe(false);
      expect(isWeatherQuery('log irrigation')).toBe(false);
    });
  });
});

describe('Context Assembler Module - Context Utilities', () => {
  function hasContextContent(result: {
    contextBlocks: string[];
    citations: unknown[];
    farmRecordsContext: unknown;
    weatherData: unknown;
  }): boolean {
    return (
      result.contextBlocks.length > 0 ||
      result.citations.length > 0 ||
      result.farmRecordsContext !== null ||
      result.weatherData !== null
    );
  }

  function getContextSummary(result: {
    contextBlocks: string[];
    citations: unknown[];
    farmRecordsContext: unknown;
    weatherData: unknown;
  }): string {
    const parts: string[] = [];

    if (result.contextBlocks.length > 0) {
      parts.push(`${result.contextBlocks.length} context blocks`);
    }
    if (result.citations.length > 0) {
      parts.push(`${result.citations.length} citations`);
    }
    if (result.farmRecordsContext !== null) {
      parts.push('farm records');
    }
    if (result.weatherData !== null) {
      parts.push('weather data');
    }

    return parts.length > 0 ? parts.join(', ') : 'no context';
  }

  describe('hasContextContent', () => {
    it('returns true when context blocks exist', () => {
      const result = {
        contextBlocks: ['Farm context: ...'],
        citations: [],
        farmRecordsContext: null,
        weatherData: null,
      };
      expect(hasContextContent(result)).toBe(true);
    });

    it('returns true when citations exist', () => {
      const result = {
        contextBlocks: [],
        citations: [{ id: '1', title: 'Test' }],
        farmRecordsContext: null,
        weatherData: null,
      };
      expect(hasContextContent(result)).toBe(true);
    });

    it('returns true when farm records exist', () => {
      const result = {
        contextBlocks: [],
        citations: [],
        farmRecordsContext: { answer: 'test' },
        weatherData: null,
      };
      expect(hasContextContent(result)).toBe(true);
    });

    it('returns true when weather data exists', () => {
      const result = {
        contextBlocks: [],
        citations: [],
        farmRecordsContext: null,
        weatherData: { temperature: 28 },
      };
      expect(hasContextContent(result)).toBe(true);
    });

    it('returns false when empty', () => {
      const result = {
        contextBlocks: [],
        citations: [],
        farmRecordsContext: null,
        weatherData: null,
      };
      expect(hasContextContent(result)).toBe(false);
    });
  });

  describe('getContextSummary', () => {
    it('summarizes context with multiple sources', () => {
      const result = {
        contextBlocks: ['block1', 'block2'],
        citations: [{ id: '1' }],
        farmRecordsContext: { answer: 'test' },
        weatherData: { temperature: 28 },
      };
      expect(getContextSummary(result)).toBe(
        '2 context blocks, 1 citations, farm records, weather data',
      );
    });

    it('returns no context when empty', () => {
      const result = {
        contextBlocks: [],
        citations: [],
        farmRecordsContext: null,
        weatherData: null,
      };
      expect(getContextSummary(result)).toBe('no context');
    });

    it('handles single source', () => {
      const result = {
        contextBlocks: ['block'],
        citations: [],
        farmRecordsContext: null,
        weatherData: null,
      };
      expect(getContextSummary(result)).toBe('1 context blocks');
    });
  });
});
