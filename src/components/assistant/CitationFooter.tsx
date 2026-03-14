/**
 * CitationFooter Component
 * Displays RAG citation sources below an assistant message.
 * Shows up to 3 citations with:
 * - Source title
 * - Optional confidence percentage
 * - Collapsible if more than 1 citation
 * M3 themed — no hardcoded colors.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeTokens } from '@/styles/use-theme';
import { spacing } from '@/styles/theme';
import { normalizeAssistantCitations } from '@/services/rag-citations';
import type { AssistantCitation } from '@/types/ai';

const MAX_VISIBLE_CITATIONS = 3;

interface CitationFooterProps {
  citations: AssistantCitation[];
}

export function CitationFooter({ citations }: CitationFooterProps) {
  const { m3 } = useThemeTokens();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const normalized = normalizeAssistantCitations(citations);
  if (normalized.length === 0) return null;

  const visible = expanded ? normalized.slice(0, MAX_VISIBLE_CITATIONS) : normalized.slice(0, 1);
  const hasMore = normalized.length > 1;

  return (
    <View
      style={[
        styles.container,
        {
          borderTopColor: m3.colorScheme.outlineVariant,
        },
      ]}
    >
      <Text
        style={[
          styles.sourcesLabel,
          {
            color: m3.colorScheme.onSurfaceVariant,
            ...m3.typography.labelSmall,
          },
        ]}
      >
        {t('assistant.citations.sourcesLabel')}
      </Text>

      {visible.map((citation, index) => (
        <CitationItem key={citation.id ?? `c-${index}`} citation={citation} index={index} />
      ))}

      {hasMore && (
        <TouchableOpacity
          onPress={() => setExpanded((prev) => !prev)}
          accessibilityRole="button"
          style={styles.toggleButton}
        >
          <Text
            style={[
              styles.toggleLabel,
              {
                color: m3.colorScheme.primary,
                ...m3.typography.labelSmall,
              },
            ]}
          >
            {expanded ? `▲ ${normalized.length - 1}` : `▼ +${normalized.length - 1}`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

interface CitationItemProps {
  citation: AssistantCitation;
  index: number;
}

function CitationItem({ citation, index }: CitationItemProps) {
  const { m3 } = useThemeTokens();
  const { t } = useTranslation();

  const confidenceText =
    citation.confidence != null
      ? ` · ${t('assistant.citations.confidencePct', { value: Math.round(citation.confidence * 100) })}`
      : '';

  return (
    <View style={styles.citationItem} accessible accessibilityRole="text">
      <Text
        style={[
          styles.citationNumber,
          {
            color: m3.colorScheme.primary,
            ...m3.typography.labelSmall,
          },
        ]}
      >
        {index + 1}.
      </Text>
      <Text
        style={[
          styles.citationTitle,
          {
            color: m3.colorScheme.onSurfaceVariant,
            ...m3.typography.labelSmall,
          },
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {citation.title}
        {confidenceText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[1],
  },
  sourcesLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[1],
  },
  citationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[1],
  },
  citationNumber: {
    minWidth: 14,
  },
  citationTitle: {
    flex: 1,
  },
  toggleButton: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    marginTop: spacing[1],
  },
  toggleLabel: {},
});
