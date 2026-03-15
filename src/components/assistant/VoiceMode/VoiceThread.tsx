/**
 * VoiceThread Component
 * Displays the voice conversation thread (transcripts and AI responses).
 * Each turn shows:
 * - User: "You: <transcript>" in a pill bubble
 * - Assistant: "AI: <response>" in a different colored bubble
 * The list is scrollable and auto-scrolls to the latest message.
 * M3 themed — no hardcoded colors.
 */

import React, { useEffect, useRef } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeTokens } from '@/styles/use-theme';
import { spacing } from '@/styles/theme';

export interface VoiceModeMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface VoiceThreadProps {
  messages: VoiceModeMessage[];
  testID?: string;
}

export function VoiceThread({ messages, testID }: VoiceThreadProps) {
  const { m3 } = useThemeTokens();
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      // Small delay to let layout finish before scrolling
      const timer = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <View style={styles.emptyContainer} testID={testID}>
        <Text
          style={[
            styles.emptyText,
            {
              color: m3.colorScheme.onSurfaceVariant,
              ...m3.typography.bodyMedium,
            },
          ]}
        >
          {t('assistant.chat.transcriptPlaceholder')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      testID={testID}
    >
      {messages.map((message) => (
        <VoiceMessageBubble key={message.id} message={message} t={t} m3={m3} />
      ))}
    </ScrollView>
  );
}

interface VoiceMessageBubbleProps {
  message: VoiceModeMessage;
  t: (key: string) => string;
  m3: ReturnType<typeof useThemeTokens>['m3'];
}

function VoiceMessageBubble({ message, m3 }: VoiceMessageBubbleProps) {
  const isUser = message.role === 'user';

  const bubbleBg = isUser
    ? m3.colorScheme.primaryContainer
    : (m3.colorScheme.secondaryContainer ?? m3.colorScheme.surfaceVariant);
  const bubbleText = isUser
    ? m3.colorScheme.onPrimaryContainer
    : (m3.colorScheme.onSecondaryContainer ?? m3.colorScheme.onSurfaceVariant);

  return (
    <View
      style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}
      accessibilityRole="text"
      accessibilityLabel={isUser ? `You said: ${message.text}` : `AI said: ${message.text}`}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          { backgroundColor: bubbleBg },
        ]}
      >
        <Text style={[styles.bubbleText, { color: bubbleText, ...m3.typography.bodyMedium }]}>
          {message.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: '100%',
  },
  contentContainer: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
  },
  messageRow: {
    width: '100%',
    flexDirection: 'row',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: 16,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    flexShrink: 1,
  },
});
