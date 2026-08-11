/**
 * Embeddings Provider Module
 * Handles text embeddings via OpenAI text-embedding-3-small.
 */

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')?.trim() ?? '';
const EMBEDDING_MODEL =
  Deno.env.get('ASSISTANT_EMBEDDING_MODEL')?.trim() || 'text-embedding-3-small';

/**
 * Generate embedding for text
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY || !text.trim()) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) return null;
    const embedding = data?.data?.[0]?.embedding;
    return Array.isArray(embedding) ? embedding : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get configured embedding model
 */
export function getEmbeddingModel(): string {
  return EMBEDDING_MODEL;
}

/**
 * Get embedding dimensions for text-embedding-3-small.
 */
export function getEmbeddingDimensions(): number {
  return 1536;
}
