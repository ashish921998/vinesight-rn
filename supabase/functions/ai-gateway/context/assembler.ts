/**
 * Context Assembler Module
 * Orchestrates context building from multiple sources for the LLM.
 */

import { generateEmbedding } from '../providers/index.ts';
import { estimateTokens } from '../utils/index.ts';
import { searchMemoryContext, type Citation, type ToolCall } from './memory.ts';
import { searchRagContext } from './rag.ts';

/**
 * Build attachment context blocks from user attachments
 */
export function buildAttachmentContextBlocks(
  attachments:
    | Array<{
        kind: 'image' | 'document';
        name: string;
        mimeType?: string;
        dataUrl?: string;
        textContent?: string;
        sourceUri?: string;
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

/**
 * Build farm context block from farm context data
 */
export function buildFarmContextBlock(
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
  return `Farm context: ${JSON.stringify(farmContext)}`;
}

/**
 * Assemble full context for LLM
 */
export async function assembleContext(input: {
  transcript: string;
  farmContext: Record<string, unknown> | null;
  attachments?: Array<{
    kind: 'image' | 'document';
    name: string;
    mimeType?: string;
    dataUrl?: string;
    textContent?: string;
    sourceUri?: string;
  }>;
  userId: string | null;
  farmId: number | null;
  locale: 'en' | 'hi' | 'mr';
  memoryEnabled: boolean;
  ragEnabled: boolean;
  embeddingTokenCounter: { value: number };
  toolCalls: ToolCall[];
}): Promise<{
  contextBlocks: string[];
  citations: Citation[];
  sharedEmbedding: number[] | null;
}> {
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

  // Build context blocks
  const farmContextBlock = buildFarmContextBlock(
    farmContext as Parameters<typeof buildFarmContextBlock>[0],
  );
  const attachmentContextBlocks = buildAttachmentContextBlocks(attachments);

  const contextBlocks: string[] = [
    farmContextBlock,
    ...attachmentContextBlocks,
    ...memoryResult.contextBlocks,
    ...ragResult.contextBlocks,
  ].filter(Boolean);

  const citations: Citation[] = [...memoryResult.citations, ...ragResult.citations];

  return { contextBlocks, citations, sharedEmbedding };
}
