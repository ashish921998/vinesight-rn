/**
 * Embeddings Provider Module
 * Semantic embeddings are disabled until Sarvam offers a documented embedding API.
 */

const EMBEDDING_MODEL = 'disabled';

/**
 * Generate embedding for text
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  void text;
  return null;
}

/**
 * Get configured embedding model
 */
export function getEmbeddingModel(): string {
  return EMBEDDING_MODEL;
}

/**
 * Get embedding dimensions. Zero means semantic embeddings are disabled.
 */
export function getEmbeddingDimensions(): number {
  return 0;
}
