export interface AssistantCitation {
  id?: string;
  title: string;
  sourceType: 'farm_record' | 'kb_doc' | 'memory' | 'external' | string;
  url?: string | null;
  snippet?: string | null;
  confidence?: number | null;
  metadata?: Record<string, unknown> | null;
}

function normalizeConfidence(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

export function normalizeAssistantCitations(input: unknown): AssistantCitation[] {
  if (!Array.isArray(input)) return [];

  const normalized: AssistantCitation[] = [];

  input.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const row = item as Record<string, unknown>;
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    if (!title) return;

    normalized.push({
      id: typeof row.id === 'string' ? row.id : `citation-${index + 1}`,
      title,
      sourceType:
        typeof row.sourceType === 'string'
          ? row.sourceType
          : typeof row.source_type === 'string'
            ? row.source_type
            : 'external',
      url:
        typeof row.url === 'string'
          ? row.url
          : typeof row.sourceUrl === 'string'
            ? row.sourceUrl
            : null,
      snippet: typeof row.snippet === 'string' ? row.snippet : null,
      confidence: normalizeConfidence(row.confidence),
      metadata:
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : null,
    });
  });

  return normalized;
}

export function buildCitationFooter(citations: AssistantCitation[]): string {
  if (citations.length === 0) return '';
  const top = citations.slice(0, 3);
  const lines = top.map((citation, idx) => {
    const confidence =
      citation.confidence !== null && citation.confidence !== undefined
        ? ` (${Math.round(citation.confidence * 100)}%)`
        : '';
    const sourceLink = citation.url ? ` - ${citation.url}` : '';
    return `${idx + 1}. ${citation.title}${confidence}${sourceLink}`;
  });
  return `\n\nSources:\n${lines.join('\n')}`;
}

export function appendCitationsToMessage(content: string, citations: AssistantCitation[]): string {
  const footer = buildCitationFooter(citations);
  if (!footer) return content;
  return `${content.trim()}${footer}`;
}
