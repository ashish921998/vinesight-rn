/**
 * RAG Context Module
 * Handles agronomy knowledge base search for context enrichment.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { estimateTokens, generateEmbedding } from '../utils/index.ts';

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

export interface AgronomySearchRow {
  content?: string | null;
  similarity?: number | null;
  doc_title?: string | null;
  doc_source_url?: string | null;
  chunk_id?: string | null;
  locale?: string | null;
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
 * Search RAG context for agronomy knowledge
 */
export async function searchRagContext(input: {
  query: string;
  locale: 'en' | 'hi' | 'mr';
  enabled: boolean;
  embedding?: number[] | null;
  embeddingTokenCounter?: { value: number };
  toolCalls: ToolCall[];
}): Promise<{ contextBlocks: string[]; citations: Citation[] }> {
  const client = getSupabaseClient();
  if (!input.enabled || !input.query.trim()) {
    input.toolCalls.push({
      tool: 'agronomy_kb.search',
      status: 'skipped',
      input: { enabled: input.enabled },
      output: { reason: 'disabled_or_empty_query' },
    });
    return { contextBlocks: [], citations: [] };
  }

  let embedding: number[] | null = null;
  if (input.embedding !== undefined) {
    embedding = input.embedding;
  } else {
    if (input.embeddingTokenCounter) {
      input.embeddingTokenCounter.value += estimateTokens(input.query);
    }
    embedding = await generateEmbedding(input.query);
  }
  if (!embedding) {
    input.toolCalls.push({
      tool: 'agronomy_kb.search',
      status: 'error',
      input: { queryLength: input.query.length },
      error: 'embedding_unavailable',
    });
    return { contextBlocks: [], citations: [] };
  }

  if (!client) {
    input.toolCalls.push({
      tool: 'agronomy_kb.search',
      status: 'error',
      error: 'supabase_client_unavailable',
    });
    return { contextBlocks: [], citations: [] };
  }

  const { data, error } = await client.rpc('match_agronomy_chunks', {
    query_embedding: embedding,
    match_count: 5,
    p_locale: input.locale,
  });

  if (error) {
    input.toolCalls.push({
      tool: 'agronomy_kb.search',
      status: 'error',
      error: error.message,
    });
    return { contextBlocks: [], citations: [] };
  }

  const rows: AgronomySearchRow[] = Array.isArray(data) ? (data as AgronomySearchRow[]) : [];
  input.toolCalls.push({
    tool: 'agronomy_kb.search',
    status: 'ok',
    output: { count: rows.length },
  });

  const contextBlocks = rows
    .map((row) => (typeof row.content === 'string' ? row.content.trim() : ''))
    .filter((content) => content.length > 0)
    .map((content) => `Agronomy KB: ${content}`);

  return {
    contextBlocks,
    citations: rows.map(
      (row, idx: number) =>
        ({
          id: `kb-${idx + 1}`,
          title: row.doc_title ?? 'Agronomy knowledge',
          sourceType: 'kb_doc',
          url: row.doc_source_url ?? null,
          snippet: row.content ?? null,
          confidence: typeof row.similarity === 'number' ? row.similarity : null,
          metadata: {
            chunk_id: row.chunk_id ?? null,
            locale: row.locale ?? null,
          },
        }) satisfies Citation,
    ),
  };
}
