/**
 * Memory Context Module
 * Handles memory search and write operations for conversation context.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { generateEmbedding } from '../providers/index.ts';
import { estimateTokens } from '../utils/index.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';

// Lazy-initialized Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
}

export interface MemorySearchRow {
  content?: string | null;
  similarity?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface Citation {
  id: string;
  title: string;
  sourceType: 'farm_record' | 'kb_doc' | 'memory' | 'external';
  url?: string | null;
  snippet?: string | null;
  confidence?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface ToolCall {
  tool: string;
  status: 'ok' | 'error' | 'skipped';
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  error?: string | null;
}

/**
 * Search memory context for related information
 */
export async function searchMemoryContext(input: {
  query: string;
  userId: string | null;
  farmId: number | null;
  enabled: boolean;
  embedding?: number[] | null;
  embeddingTokenCounter?: { value: number };
  toolCalls: ToolCall[];
}): Promise<{ contextBlocks: string[]; citations: Citation[] }> {
  const client = getSupabaseClient();
  if (!input.enabled || !input.userId || !input.query.trim()) {
    input.toolCalls.push({
      tool: 'memory.search',
      status: 'skipped',
      input: { enabled: input.enabled },
      output: { reason: 'disabled_or_missing_user' },
    });
    return { contextBlocks: [], citations: [] };
  }

  let embedding: number[] | null = null;
  if (input.embedding !== undefined) {
    embedding = input.embedding;
  } else {
    embedding = await generateEmbedding(input.query);
    if (embedding && input.embeddingTokenCounter) {
      input.embeddingTokenCounter.value += estimateTokens(input.query);
    }
  }
  if (!embedding) {
    input.toolCalls.push({
      tool: 'memory.search',
      status: 'error',
      input: { queryLength: input.query.length },
      error: 'embedding_unavailable',
    });
    return { contextBlocks: [], citations: [] };
  }

  if (!client) {
    input.toolCalls.push({
      tool: 'memory.search',
      status: 'error',
      error: 'supabase_client_unavailable',
    });
    return { contextBlocks: [], citations: [] };
  }

  const { data, error } = await client.rpc('match_assistant_memories', {
    query_embedding: embedding,
    match_count: 5,
    p_user_id: input.userId,
    p_farm_id: input.farmId,
  });

  if (error) {
    input.toolCalls.push({
      tool: 'memory.search',
      status: 'error',
      error: error.message,
    });
    return { contextBlocks: [], citations: [] };
  }

  const rows: MemorySearchRow[] = Array.isArray(data) ? (data as MemorySearchRow[]) : [];
  input.toolCalls.push({
    tool: 'memory.search',
    status: 'ok',
    output: { count: rows.length },
  });

  const contextBlocks = rows
    .map((row) => (typeof row.content === 'string' ? row.content.trim() : ''))
    .filter((content) => content.length > 0)
    .map((content) => `Memory: ${content}`);

  return {
    contextBlocks,
    citations: rows.map(
      (row, idx: number) =>
        ({
          id: `memory-${idx + 1}`,
          title: 'User memory',
          sourceType: 'memory',
          snippet: row.content ?? null,
          confidence: typeof row.similarity === 'number' ? row.similarity : null,
          metadata: row.metadata ?? null,
        }) satisfies Citation,
    ),
  };
}

/**
 * Write memory entry after advisory response
 */
export async function writeMemory(input: {
  conversationId: string | null;
  userId: string | null;
  farmId: number | null;
  transcript: string;
  answer: string;
  enabled: boolean;
  embeddingTokenCounter?: { value: number };
  toolCalls: ToolCall[];
}): Promise<Array<Record<string, unknown>>> {
  const client = getSupabaseClient();
  if (!input.enabled || !input.userId || !input.conversationId) {
    input.toolCalls.push({
      tool: 'memory.write',
      status: 'skipped',
      output: { reason: 'disabled_or_missing_identity' },
    });
    return [];
  }

  const summary = `${input.transcript.slice(0, 160)} -> ${input.answer.slice(0, 220)}`;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 180);

  const embedding = await generateEmbedding(summary);
  if (embedding && input.embeddingTokenCounter) {
    input.embeddingTokenCounter.value += estimateTokens(summary);
  }
  if (!embedding) {
    input.toolCalls.push({
      tool: 'memory.write',
      status: 'skipped',
      output: { reason: 'embedding_generation_failed' },
    });
    return [];
  }

  if (!client) {
    input.toolCalls.push({
      tool: 'memory.write',
      status: 'error',
      error: 'supabase_client_unavailable',
    });
    return [];
  }

  const payload = {
    conversation_id: input.conversationId,
    user_id: input.userId,
    farm_id: input.farmId,
    memory_type: 'summary',
    content: summary,
    metadata: {
      source: 'ai_gateway',
      transcript_preview: input.transcript.slice(0, 80),
    },
    importance: 0.45,
    expires_at: expiresAt.toISOString(),
  };

  const { data, error } = await client
    .from('assistant_memories')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    input.toolCalls.push({
      tool: 'memory.write',
      status: 'error',
      error: error.message,
    });
    return [];
  }

  const memoryId = data?.id;
  if (memoryId) {
    const { error: embedError } = await client.from('assistant_memory_embeddings').insert({
      memory_id: memoryId,
      embedding,
    });
    if (embedError) {
      await client.from('assistant_memories').delete().eq('id', memoryId);
      input.toolCalls.push({
        tool: 'memory.write',
        status: 'error',
        error: `Failed to insert embedding, cleaned up orphaned memory: ${embedError.message}`,
      });
      return [];
    }
  }

  input.toolCalls.push({
    tool: 'memory.write',
    status: 'ok',
    output: { memory_id: memoryId ?? null },
  });

  return [
    {
      memory_id: memoryId ?? null,
      memory_type: 'summary',
      expires_at: expiresAt.toISOString(),
    },
  ];
}

/**
 * Parse activity extraction result from LLM JSON response
 */
export function parseActivityExtractionResult(raw: string): unknown {
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    return obj;
  } catch {
    return null;
  }
}
