/**
 * Context Assembler Module
 * Orchestrates context building from multiple sources for the LLM.
 *
 * Context sources:
 * 1. Farm context (from request - farm_id, crop, growth stage, etc.)
 * 2. Farm records (queried from database - irrigation, spray, harvest, etc.)
 * 3. Memory context (pgvector search on assistant_memories)
 * 4. RAG context (pgvector search on agronomy_chunks)
 * 5. Attachment content (images, documents)
 * 6. Weather data (for weather-dependent advisory queries)
 *
 * All queries are farm-scoped (filter by farm_id when provided)
 * and user-scoped (filter by user_id for ownership).
 */

import { generateEmbedding } from '../providers/index.ts';
import { estimateTokens } from '../utils/index.ts';
import { searchMemoryContext, type Citation, type ToolCall } from './memory.ts';
import { searchRagContext } from './rag.ts';
import {
  fetchFarmDetails,
  fetchWeatherData,
  buildWeatherContextBlock,
  detectQueryType,
  detectActivity,
  queryFarmRecords,
  type FarmDataQueryResult,
  type WeatherData,
} from './farm-data.ts';

// ============================================================
// MARK: - Types
// ============================================================

export interface FarmContext {
  farm_id?: number | null;
  farm_name?: string | null;
  crop_variety?: string | null;
  area?: number | null;
  region?: string | null;
  growth_stage?: string | null;
  days_since_pruning?: number | null;
}

export interface Attachment {
  kind: 'image' | 'document';
  name: string;
  mimeType?: string;
  dataUrl?: string;
  textContent?: string;
  sourceUri?: string;
}

export interface AssemblerInput {
  transcript: string;
  farmContext: FarmContext | null;
  attachments?: Attachment[];
  userId: string | null;
  farmId: number | null;
  locale: 'en' | 'hi' | 'mr';
  memoryEnabled: boolean;
  ragEnabled: boolean;
  embeddingTokenCounter: { value: number };
  toolCalls: ToolCall[];
}

export interface AssemblerResult {
  contextBlocks: string[];
  citations: Citation[];
  sharedEmbedding: number[] | null;
  farmRecordsContext: FarmDataQueryResult | null;
  weatherData: {
    temperature: number;
    humidity: number;
    condition: string;
    precipitation: number;
    et0: number;
  } | null;
}

// ============================================================
// MARK: - Context Block Builders
// ============================================================

/**
 * Build attachment context blocks from user attachments
 */
export function buildAttachmentContextBlocks(attachments: Attachment[] | undefined): string[] {
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

/**
 * Build farm context block from farm context data
 */
export function buildFarmContextBlock(farmContext: FarmContext | null): string {
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

/**
 * Build farm records context block from query results
 */
export function buildFarmRecordsContextBlock(result: FarmDataQueryResult | null): string {
  if (!result || !result.answer) return '';

  const snippets: string[] = [`Recent records: ${result.answer}`];

  if (result.records.length > 0 && result.records.length <= 5) {
    snippets.push(
      `Record details:\n${result.records
        .map((r, i) => `${i + 1}. ${JSON.stringify(r)}`)
        .join('\n')}`,
    );
  }

  return `Farm records context:\n${snippets.join('\n')}`;
}

// ============================================================
// MARK: - Weather Context Detection
// ============================================================

/**
 * Check if query is weather-dependent
 */
export function isWeatherDependentQuery(transcript: string): boolean {
  const weatherKeywords = [
    /\bweather|rain|spray.*today|fertigation.*today|temperature|hot|cold|humidity|irrigation.*need/i,
    /हवामान|पाऊस|बारिश|आज|स्प्रे|तापमान|गरम|ठंड|नमी|पाणी|सिंचन/,
  ];

  return weatherKeywords.some((regex) => regex.test(transcript));
}

/**
 * Check if query specifically asks for weather
 */
export function isWeatherQuery(transcript: string): boolean {
  return /\bweather|हवामान|मौसम/i.test(transcript);
}

// ============================================================
// MARK: - Main Assembly Function
// ============================================================

/**
 * Assemble full context for LLM
 * This is the main entry point for context assembly.
 */
export async function assembleContext(input: AssemblerInput): Promise<AssemblerResult> {
  const {
    transcript,
    farmContext,
    attachments,
    userId,
    farmId,
    locale,
    memoryEnabled,
    ragEnabled,
    embeddingTokenCounter,
    toolCalls,
  } = input;

  // Generate shared embedding for memory and RAG search (optimization)
  let sharedEmbedding: number[] | null = null;
  if ((memoryEnabled || ragEnabled) && transcript.trim()) {
    embeddingTokenCounter.value += estimateTokens(transcript);
    sharedEmbedding = await generateEmbedding(transcript);
  }

  // Search memory context
  const memoryResult = await searchMemoryContext({
    query: transcript,
    userId,
    farmId,
    enabled: memoryEnabled,
    embedding: sharedEmbedding,
    embeddingTokenCounter,
    toolCalls,
  });

  // Search RAG context
  const ragResult = await searchRagContext({
    query: transcript,
    locale,
    enabled: ragEnabled,
    embedding: sharedEmbedding,
    embeddingTokenCounter,
    toolCalls,
  });

  // Query farm records for context (if query suggests farm data interest)
  let farmRecordsContext: FarmDataQueryResult | null = null;
  const queryType = detectQueryType(transcript);
  const activity = detectActivity(transcript);

  // Query farm records if the query is about farm data types
  if (queryType && queryType !== 'weather') {
    const recordsResult = await queryFarmRecords({
      transcript,
      userId,
      farmId,
      activity,
      locale,
      toolCalls,
    });
    if (recordsResult.answer) {
      farmRecordsContext = {
        answer: recordsResult.answer,
        citations: recordsResult.citations,
        records: [],
        totalCount: recordsResult.citations.length,
      };
    }
  }

  // Fetch weather data if weather-dependent query
  let weatherData: AssemblerResult['weatherData'] = null;
  let weatherCitation: Citation | null = null;

  if (isWeatherDependentQuery(transcript)) {
    // SECURITY: Validate farm ownership before fetching weather.
    // fetchFarmDetails now requires userId to prevent returning another user's farm coordinates.
    const farmDetails = await fetchFarmDetails(farmId, userId);
    // Only fetch weather when the farm has non-null coordinates.
    // If coordinates are missing we skip weather enrichment entirely — no hardcoded fallback.
    if (farmDetails && farmDetails.latitude !== null && farmDetails.longitude !== null) {
      const weatherResult = await fetchWeatherData({
        latitude: farmDetails.latitude,
        longitude: farmDetails.longitude,
        locale,
        toolCalls,
      });

      if (weatherResult.data) {
        weatherData = {
          temperature: weatherResult.data.temperature,
          humidity: weatherResult.data.humidity,
          condition: weatherResult.data.condition,
          precipitation: weatherResult.data.precipitation,
          et0: weatherResult.data.et0,
        };
        weatherCitation = weatherResult.citation;
      }
    }
  }

  // Build context blocks
  const farmContextBlock = buildFarmContextBlock(farmContext);
  const attachmentContextBlocks = buildAttachmentContextBlocks(attachments);
  const farmRecordsBlock = buildFarmRecordsContextBlock(farmRecordsContext);
  const weatherBlock = weatherData ? buildWeatherContextBlock(weatherData as WeatherData) : '';

  const contextBlocks: string[] = [
    farmContextBlock,
    farmRecordsBlock,
    weatherBlock,
    ...attachmentContextBlocks,
    ...memoryResult.contextBlocks,
    ...ragResult.contextBlocks,
  ].filter(Boolean);

  const citations: Citation[] = [
    // Farm-record citations (from queryFarmRecords) must be included first
    ...(farmRecordsContext?.citations ?? []),
    ...memoryResult.citations,
    ...ragResult.citations,
    ...(weatherCitation ? [weatherCitation] : []),
  ];

  return {
    contextBlocks,
    citations,
    sharedEmbedding,
    farmRecordsContext,
    weatherData,
  };
}

// ============================================================
// MARK: - Utility Functions
// ============================================================

/**
 * Check if context has meaningful content
 */
export function hasContextContent(result: AssemblerResult): boolean {
  return (
    result.contextBlocks.length > 0 ||
    result.citations.length > 0 ||
    result.farmRecordsContext !== null ||
    result.weatherData !== null
  );
}

/**
 * Get context summary for logging
 */
export function getContextSummary(result: AssemblerResult): string {
  const parts: string[] = [];

  if (result.contextBlocks.length > 0) {
    parts.push(`${result.contextBlocks.length} context blocks`);
  }
  if (result.citations.length > 0) {
    parts.push(`${result.citations.length} citations`);
  }
  if (result.farmRecordsContext) {
    parts.push('farm records');
  }
  if (result.weatherData) {
    parts.push('weather data');
  }

  return parts.length > 0 ? parts.join(', ') : 'no context';
}
