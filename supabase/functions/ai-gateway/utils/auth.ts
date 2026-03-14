/**
 * Auth Utilities
 * Authentication and user resolution for the ai-gateway.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

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

/**
 * Extract bearer token from request headers
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

/**
 * Resolve authenticated user ID from request
 */
export async function resolveAuthenticatedUserId(req: Request): Promise<string | null> {
  const bearerToken = extractBearerToken(req);
  if (!bearerToken) return null;

  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.auth.getUser(bearerToken);
  if (error) {
    console.warn('Failed to resolve authenticated user', error.message);
    return null;
  }

  return data.user?.id ?? null;
}

/**
 * Resolve or create conversation ID
 */
export async function resolveConversationId(
  inputConversationId: string | null,
  userId: string | null,
  farmId: number | null,
  locale: string,
): Promise<string | null> {
  if (!userId) return null;

  const client = getSupabaseClient();
  if (!client) return null;

  if (inputConversationId) {
    const { data, error } = await client
      .from('assistant_conversations')
      .select('id')
      .eq('id', inputConversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Failed to validate assistant conversation ownership', error.message);
      return null;
    }

    return data?.id ?? null;
  }

  const { data, error } = await client
    .from('assistant_conversations')
    .insert({
      user_id: userId,
      farm_id: farmId,
      locale,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('Failed to create assistant conversation', error.message);
    return null;
  }

  return data?.id ?? null;
}

/**
 * Write conversation turn to database
 */
export async function writeConversationTurn(input: {
  conversationId: string | null;
  userId: string | null;
  farmId: number | null;
  role: 'user' | 'assistant';
  content: string;
  inputMode?: 'text' | 'audio';
  traceId: string;
  latencyMs?: number;
  provider?: string | null;
  model?: string | null;
  citations?: unknown[];
  toolCalls?: unknown[];
  safetyFlags?: unknown;
}): Promise<string | null> {
  if (!input.conversationId || !input.userId || !input.content.trim()) return null;

  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('assistant_turns')
    .insert({
      conversation_id: input.conversationId,
      user_id: input.userId,
      farm_id: input.farmId,
      role: input.role,
      content: input.content,
      input_mode: input.inputMode ?? 'text',
      trace_id: input.traceId,
      latency_ms: input.latencyMs ?? null,
      provider: input.provider ?? null,
      model: input.model ?? null,
      citations: input.citations ?? null,
      tool_calls: input.toolCalls ?? null,
      safety_flags: input.safetyFlags ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('Failed to write assistant turn', error.message);
    return null;
  }

  return data?.id ?? null;
}

/**
 * Read conversation route state from metadata
 */
export async function readConversationRouteState(
  conversationId: string | null,
): Promise<Record<string, unknown>> {
  if (!conversationId) return {};

  const client = getSupabaseClient();
  if (!client) return {};

  const { data, error } = await client
    .from('assistant_conversations')
    .select('metadata')
    .eq('id', conversationId)
    .single();

  if (error) {
    console.warn('Failed to load assistant conversation metadata', error.message);
    return {};
  }

  const metadata = data?.metadata as Record<string, unknown> | null;
  return (metadata?.assistant_route_state as Record<string, unknown>) ?? {};
}

/**
 * Write conversation route state to metadata
 */
export async function writeConversationRouteState(
  conversationId: string | null,
  nextState: Record<string, unknown>,
): Promise<boolean> {
  if (!conversationId) return true;

  const client = getSupabaseClient();
  if (!client) return false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await client
      .from('assistant_conversations')
      .select('metadata, updated_at')
      .eq('id', conversationId)
      .single();

    if (error) {
      console.warn('Failed to reload conversation metadata for update', error.message);
      return false;
    }

    const row = (data ?? {}) as Record<string, unknown>;
    const currentMetadata = (row.metadata as Record<string, unknown>) ?? {};
    const mergedMetadata: Record<string, unknown> = {
      ...currentMetadata,
      assistant_route_state: nextState,
    };
    const originalUpdatedAt = row.updated_at as string | null;
    const nextUpdatedAt = new Date().toISOString();

    let updateQuery = client
      .from('assistant_conversations')
      .update({
        metadata: mergedMetadata,
        updated_at: nextUpdatedAt,
      })
      .eq('id', conversationId)
      .select('id');

    if (originalUpdatedAt) {
      updateQuery = updateQuery.eq('updated_at', originalUpdatedAt);
    }

    const { data: updatedRows, error: updateError } = await updateQuery;
    if (updateError) {
      console.warn('Failed to save assistant route state', updateError.message);
      return false;
    }
    if (Array.isArray(updatedRows) && updatedRows.length > 0) {
      return true;
    }
  }

  console.warn('Failed to save assistant route state due to concurrent update');
  return false;
}
