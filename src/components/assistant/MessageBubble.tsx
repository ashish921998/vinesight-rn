/**
 * MessageBubble Component
 * Renders a single chat message with:
 * - User messages: right-aligned with primary container colors
 * - Assistant messages: left-aligned with surface variant colors
 * - Markdown rendering for assistant messages via react-native-markdown-display
 * - M3 themed colors — no hardcoded values
 */

import React, { useEffect, useMemo } from 'react';
import { Animated, Easing, View, Text, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTranslation } from 'react-i18next';
import { formatTime } from '@/i18n/format';
import { useM3 } from '@/styles/use-theme';
import { fontSize, radius, spacing } from '@/styles/theme';
import { CitationFooter } from './CitationFooter';
import { RichMessageContent } from './RichMessageContent';
import { MessageActions } from './MessageActions';
import { AIAvatar } from './AIAvatar';
import { useTypewriter } from '@/hooks/use-typewriter';
import type { ChatMessage, AssistantMessageAction } from '@/types/ai';

interface MessageBubbleProps {
  message: ChatMessage;
  isLoading?: boolean;
  /** When true, the assistant text reveals progressively (streaming feel). */
  isStreaming?: boolean;
  onActionPress?: (action: AssistantMessageAction) => void;
}

export const MessageBubble = React.memo(function MessageBubble({
  message,
  isLoading = false,
  isStreaming = false,
  onActionPress,
}: MessageBubbleProps) {
  const m3 = useM3();
  const { t } = useTranslation();

  const { text: revealedText, isRevealing } = useTypewriter(
    message.content,
    isStreaming && message.role === 'assistant',
  );

  if (message.role !== 'user' && message.role !== 'assistant') {
    return null;
  }

  const isUser = message.role === 'user';

  // Cellar Ledger design: User bubbles use primary, assistant use mist-1 with border
  // Use surfaceContainerLow which maps to mist-1 (surface[100])
  const bubbleStyle = {
    backgroundColor: isUser ? m3.colorScheme.primary : m3.surface.surfaceContainerLow,
    borderRadius: radius.lg,
    borderBottomRightRadius: isUser ? 4 : 16,
    borderBottomLeftRadius: isUser ? 16 : 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing[3],
    maxWidth: isUser ? ('82%' as const) : ('86%' as const),
    // Assistant bubbles get a 1px border (stone-3)
    ...(!isUser && {
      borderWidth: 1,
      borderColor: m3.colorScheme.outline,
    }),
  };

  // User text uses onPrimary for proper contrast on primary background
  const textColor = isUser ? m3.colorScheme.onPrimary : m3.colorScheme.onSurface;

  // Use plain objects for react-native-markdown-display styles (not StyleSheet.create)
  // to avoid the react-native/no-unused-styles lint false positives
  const markdownStyles = {
    body: {
      color: textColor,
      fontSize: fontSize.base,
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
      borderRadius: radius.xs,
      paddingHorizontal: 4,
      fontFamily: 'monospace',
      fontSize: fontSize.sm,
    },
    fence: {
      backgroundColor: m3.surface.surfaceContainer,
      borderRadius: radius.sm,
      padding: spacing[3],
      marginVertical: spacing[1],
    },
    code_block: {
      color: textColor,
      fontFamily: 'monospace',
      fontSize: fontSize.sm,
    },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: m3.colorScheme.primary,
      paddingLeft: spacing[3],
      marginVertical: spacing[1],
    },
    paragraph: {
      color: textColor,
      fontSize: fontSize.base,
      lineHeight: 22,
      marginTop: 0,
      marginBottom: spacing[1],
    },
    heading1: {
      color: textColor,
      fontSize: fontSize.xl,
      fontWeight: '700' as const,
      marginBottom: spacing[2],
    },
    heading2: {
      color: textColor,
      fontSize: fontSize.lg,
      fontWeight: '600' as const,
      marginBottom: spacing[2],
    },
    heading3: {
      color: textColor,
      fontSize: fontSize.base,
      fontWeight: '600' as const,
      marginBottom: spacing[1],
    },
  };

  const a11yLabel = isUser
    ? t('assistant.chat.userMessageA11y', { content: message.content })
    : t('assistant.chat.assistantMessageA11y', { content: message.content.slice(0, 100) });

  const isSafetyBlocked = !isUser && message.safety?.blocked === true;

  return (
    <View style={[styles.container, isUser ? styles.containerRight : styles.containerLeft]}>
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
      {isUser ? (
        <View style={bubbleStyle}>
          <Text
            accessibilityRole="text"
            accessibilityLabel={a11yLabel}
            style={{
              color: textColor,
              fontSize: fontSize.base,
              lineHeight: 22,
            }}
          >
            {message.content}
          </Text>
        </View>
      ) : (
        <React.Fragment>
          <View style={styles.assistantMessageRow}>
            <AIAvatar size={28} />
            <View style={bubbleStyle}>
              <View
                accessible
                accessibilityRole="text"
                accessibilityLabel={
                  isSafetyBlocked ? `${t('assistant.safety.blockedA11y')} ${a11yLabel}` : a11yLabel
                }
              >
                {/* While revealing, render plain <Text> rather than <Markdown>:
                    react-native-markdown-display re-parses the whole AST on every
                    change, so feeding it the growing string at ~60fps re-parses an
                    ever-larger document each tick (jank on low-end Android). Mount
                    <Markdown> once, after the reveal completes. */}
                {isRevealing ? (
                  <Text style={markdownStyles.body}>{`${revealedText} ▍`}</Text>
                ) : (
                  <Markdown style={markdownStyles}>{message.content}</Markdown>
                )}
              </View>
              {!isLoading && !isRevealing && message.cards && message.cards.length > 0 && (
                <RichMessageContent cards={message.cards} />
              )}
              {!isLoading && !isRevealing && message.citations && message.citations.length > 0 && (
                <CitationFooter citations={message.citations} />
              )}
              {isLoading && (
                <View style={styles.loadingRow} testID="typing-indicator">
                  <TypingDots color={m3.colorScheme.primary} />
                  <Text
                    style={{
                      color: m3.colorScheme.onSurfaceVariant,
                      fontSize: fontSize.sm,
                      marginLeft: spacing[2],
                    }}
                  >
                    {t('assistant.chat.thinking')}
                  </Text>
                </View>
              )}
            </View>
          </View>
          {!isRevealing && message.actions && message.actions.length > 0 && (
            <MessageActions actions={message.actions} onActionPress={onActionPress} />
          )}
        </React.Fragment>
      )}
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
});

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
    fontSize: fontSize.xs,
    marginTop: 4,
  },
  timestampLeft: {
    alignSelf: 'flex-start',
    marginLeft: 36,
  },
  assistantMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
  },
  typingDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timestampRight: {
    alignSelf: 'flex-end',
  },
  safetyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  safetyBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600' as const,
  },
});

/**
 * LoadingBubble - shows a 3-dot typing indicator for when the assistant is responding.
 * Matches the AITyping primitive in the design.
 */
export function LoadingBubble() {
  const m3 = useM3();
  const { t } = useTranslation();

  return (
    <View
      style={[styles.container, styles.containerLeft]}
      accessible
      accessibilityLabel={t('assistant.chat.thinking')}
    >
      <View style={styles.assistantMessageRow}>
        <AIAvatar size={28} />
        <View
          style={{
            backgroundColor: m3.surface.surfaceContainerLow,
            borderRadius: radius.lg,
            borderBottomLeftRadius: 4,
            paddingHorizontal: spacing[3] + 2,
            paddingVertical: spacing[2] + 2,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderWidth: 1,
            borderColor: m3.colorScheme.outline,
          }}
          testID="typing-indicator"
        >
          <TypingDots color={m3.colorScheme.primary} />
        </View>
      </View>
    </View>
  );
}

/**
 * TypingDots — three primary-colored dots that bob up and down,
 * matching the @keyframes vsBob animation in vs-ai-primitives.jsx.
 */
function TypingDots({ color }: { color: string }) {
  const dot1 = useMemo(() => new Animated.Value(0), []);
  const dot2 = useMemo(() => new Animated.Value(0), []);
  const dot3 = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    const makeLoop = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 480,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 480,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

    const animation = Animated.parallel([
      makeLoop(dot1, 0),
      makeLoop(dot2, 180),
      makeLoop(dot3, 360),
    ]);
    animation.start();
    return () => animation.stop();
  }, [dot1, dot2, dot3]);

  const dotStyle = (value: Animated.Value) => ({
    width: 7,
    height: 7,
    borderRadius: radius.xs,
    backgroundColor: color,
    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
    transform: [
      {
        translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }),
      },
    ],
  });

  return (
    <View style={styles.typingDotsRow}>
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
}
