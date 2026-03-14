/**
 * MessageBubble Component
 * Renders a single chat message with:
 * - User messages: right-aligned with primary container colors
 * - Assistant messages: left-aligned with surface variant colors
 * - Markdown rendering for assistant messages via react-native-markdown-display
 * - M3 themed colors — no hardcoded values
 */

import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTranslation } from 'react-i18next';
import { useThemeTokens } from '@/styles/use-theme';
import { spacing } from '@/styles/theme';
import { CitationFooter } from './CitationFooter';
import type { ChatMessage } from '@/types/ai';

interface MessageBubbleProps {
  message: ChatMessage;
  isLoading?: boolean;
}

export function MessageBubble({ message, isLoading = false }: MessageBubbleProps) {
  const { m3 } = useThemeTokens();
  const { t } = useTranslation();
  const isUser = message.role === 'user';

  const bubbleStyle = useMemo(
    () => ({
      backgroundColor: isUser ? m3.colorScheme.primaryContainer : m3.colorScheme.surfaceVariant,
      borderRadius: 16,
      borderBottomRightRadius: isUser ? 4 : 16,
      borderBottomLeftRadius: isUser ? 16 : 4,
      padding: spacing[3],
      maxWidth: '80%' as const,
    }),
    [isUser, m3.colorScheme.primaryContainer, m3.colorScheme.surfaceVariant],
  );

  const textColor = isUser ? m3.colorScheme.onPrimaryContainer : m3.colorScheme.onSurfaceVariant;

  // Use plain objects for react-native-markdown-display styles (not StyleSheet.create)
  // to avoid the react-native/no-unused-styles lint false positives
  const markdownStyles = useMemo(
    () => ({
      body: {
        color: textColor,
        fontSize: 15,
        lineHeight: 22,
      },
      strong: {
        color: textColor,
        fontWeight: '700' as const,
      },
      em: {
        color: textColor,
        fontStyle: 'italic' as const,
      },
      bullet_list: {
        color: textColor,
      },
      ordered_list: {
        color: textColor,
      },
      list_item: {
        color: textColor,
      },
      code_inline: {
        backgroundColor: m3.surface.surfaceContainerHigh,
        color: textColor,
        borderRadius: 4,
        paddingHorizontal: 4,
        fontFamily: 'monospace',
        fontSize: 13,
      },
      fence: {
        backgroundColor: m3.surface.surfaceContainer,
        borderRadius: 8,
        padding: spacing[3],
        marginVertical: spacing[1],
      },
      code_block: {
        color: textColor,
        fontFamily: 'monospace',
        fontSize: 13,
      },
      blockquote: {
        borderLeftWidth: 3,
        borderLeftColor: m3.colorScheme.primary,
        paddingLeft: spacing[3],
        marginVertical: spacing[1],
      },
      paragraph: {
        color: textColor,
        fontSize: 15,
        lineHeight: 22,
        marginTop: 0,
        marginBottom: spacing[1],
      },
      heading1: {
        color: textColor,
        fontSize: 20,
        fontWeight: '700' as const,
        marginBottom: spacing[2],
      },
      heading2: {
        color: textColor,
        fontSize: 18,
        fontWeight: '600' as const,
        marginBottom: spacing[2],
      },
      heading3: {
        color: textColor,
        fontSize: 16,
        fontWeight: '600' as const,
        marginBottom: spacing[1],
      },
    }),
    [
      textColor,
      m3.colorScheme.primary,
      m3.surface.surfaceContainerHigh,
      m3.surface.surfaceContainer,
    ],
  );

  const a11yLabel = isUser
    ? t('assistant.chat.userMessageA11y', { content: message.content })
    : t('assistant.chat.assistantMessageA11y', { content: message.content.slice(0, 100) });

  const isSafetyBlocked = !isUser && message.safety?.blocked === true;

  return (
    <View
      style={[styles.container, isUser ? styles.containerRight : styles.containerLeft]}
      accessible
      accessibilityLabel={isSafetyBlocked ? t('assistant.safety.blockedA11y') : a11yLabel}
      accessibilityRole="text"
    >
      {/* Safety warning badge — shown above blocked assistant messages */}
      {isSafetyBlocked && (
        <View
          style={[styles.safetyBadge, { backgroundColor: m3.colorScheme.errorContainer }]}
          testID="safety-warning-badge"
        >
          <Text style={[styles.safetyBadgeText, { color: m3.colorScheme.onErrorContainer }]}>
            ⚠️ {t('assistant.safety.blockedLabel')}
          </Text>
        </View>
      )}
      <View style={bubbleStyle}>
        {isUser ? (
          <Text
            style={{
              color: textColor,
              fontSize: 15,
              lineHeight: 22,
            }}
          >
            {message.content}
          </Text>
        ) : (
          <>
            <Markdown style={markdownStyles}>{message.content}</Markdown>
            {!isLoading && message.citations && message.citations.length > 0 && (
              <CitationFooter citations={message.citations} />
            )}
          </>
        )}
        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator
              size="small"
              color={m3.colorScheme.primary}
              accessibilityLabel={t('ai.chat.thinking')}
            />
            <Text
              style={{
                color: m3.colorScheme.onSurfaceVariant,
                fontSize: 13,
                marginLeft: spacing[2],
              }}
            >
              {t('ai.chat.thinking')}
            </Text>
          </View>
        )}
      </View>
      <Text
        style={[
          styles.timestamp,
          { color: m3.colorScheme.onSurfaceVariant },
          isUser ? styles.timestampRight : styles.timestampLeft,
        ]}
      >
        {formatTime(message.timestamp)}
      </Text>
    </View>
  );
}

function formatTime(date: Date): string {
  try {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing[1],
    marginHorizontal: spacing[4],
  },
  containerLeft: {
    alignItems: 'flex-start',
  },
  containerRight: {
    alignItems: 'flex-end',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[2],
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  timestampLeft: {
    alignSelf: 'flex-start',
  },
  timestampRight: {
    alignSelf: 'flex-end',
  },
  safetyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 8,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  safetyBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
});

/**
 * LoadingBubble - shows a typing indicator for when the assistant is responding
 */
export function LoadingBubble() {
  const { m3 } = useThemeTokens();
  const { t } = useTranslation();

  return (
    <View
      style={[styles.container, styles.containerLeft]}
      accessible
      accessibilityLabel={t('ai.chat.thinking')}
    >
      <View
        style={{
          backgroundColor: m3.colorScheme.surfaceVariant,
          borderRadius: 16,
          borderBottomLeftRadius: 4,
          padding: spacing[3],
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[2],
        }}
      >
        <ActivityIndicator size="small" color={m3.colorScheme.primary} />
        <Text
          style={{
            color: m3.colorScheme.onSurfaceVariant,
            fontSize: 14,
          }}
        >
          {t('ai.chat.thinking')}
        </Text>
      </View>
    </View>
  );
}
