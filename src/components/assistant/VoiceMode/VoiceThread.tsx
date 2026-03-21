/**
 * VoiceThread Component
 * Displays the voice conversation thread (transcripts and AI responses).
 * Each turn shows:
 * - User: right-aligned pill bubble with enter animation
 * - Assistant: left-aligned pill bubble with enter animation
 * The list is scrollable and auto-scrolls to the latest message.
 * Empty state shows a pulsing mic icon with placeholder text.
 * M3 themed — no hardcoded colors.
 */

import React, { useEffect, useRef } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeInUp,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useThemeTokens } from '@/styles/use-theme';
import { spacing } from '@/styles/theme';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';

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
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [messages]);

  if (messages.length === 0) {
    return <EmptyState testID={testID} />;
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      testID={testID}
    >
      {messages.map((message, index) => (
        <Animated.View
          key={message.id}
          entering={FadeInUp.duration(300).delay(Math.min(index * 50, 200))}
        >
          <VoiceMessageBubble message={message} />
        </Animated.View>
      ))}
    </ScrollView>
  );
}

function EmptyState({ testID }: { testID?: string }) {
  const { m3 } = useThemeTokens();
  const { t } = useTranslation();
  const pulseScale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      pulseScale.value = 1;
      return;
    }
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [pulseScale, reduceMotion]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View style={styles.emptyContainer} testID={testID}>
      <Animated.View style={[styles.emptyIconContainer, pulseStyle]}>
        <SymbolIcon name="mic.fill" size={32} color={m3.colorScheme.onSurfaceVariant} />
      </Animated.View>
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

function VoiceMessageBubble({ message }: { message: VoiceModeMessage }) {
  const { m3 } = useThemeTokens();
  const { t } = useTranslation();
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
      accessibilityLabel={
        isUser
          ? t('assistant.chat.userMessageA11y', { content: message.text })
          : t('assistant.chat.assistantMessageA11y', { content: message.text })
      }
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
    gap: spacing[3],
  },
  emptyIconContainer: {
    opacity: 0.4,
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
