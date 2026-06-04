/**
 * MessageList Component
 * Scrollable list of chat messages with:
 * - Auto-scroll to bottom on new messages
 * - Keyboard dismiss on drag
 * - Empty/welcome state when no messages
 * - Loading bubble while assistant is responding
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { FlatList, View, Text, StyleSheet, type ListRenderItemInfo } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useM3 } from '@/styles/use-theme';
import { spacing } from '@/styles/theme';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { MessageBubble, LoadingBubble } from './MessageBubble';
import type { ChatMessage, AssistantMessageAction } from '@/types/ai';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  /** Id of the assistant message that should reveal progressively (streaming feel). */
  streamingMessageId?: string | null;
  onActionPress?: (action: AssistantMessageAction) => void;
}

export function MessageList({
  messages,
  isLoading,
  streamingMessageId,
  onActionPress,
}: MessageListProps) {
  const m3 = useM3();
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    if ((messages.length > 0 || isLoading) && flatListRef.current) {
      // Small delay to allow render to complete before scrolling
      const timeout = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [messages.length, isLoading]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ChatMessage>) => (
      <MessageBubble
        message={item}
        isStreaming={item.id === streamingMessageId}
        onActionPress={onActionPress}
      />
    ),
    [onActionPress, streamingMessageId],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const ListFooter = useCallback(() => {
    if (!isLoading) return null;
    return <LoadingBubble />;
  }, [isLoading]);

  if (messages.length === 0 && !isLoading) {
    return <WelcomeState />;
  }

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListFooterComponent={ListFooter}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.contentContainer, { paddingBottom: spacing[4] }]}
      style={{ backgroundColor: m3.colorScheme.surface }}
      showsVerticalScrollIndicator={false}
      onContentSizeChange={() => {
        if (messages.length > 0 || isLoading) {
          flatListRef.current?.scrollToEnd({ animated: false });
        }
      }}
    />
  );
}

function WelcomeState() {
  const m3 = useM3();
  const { t } = useTranslation();

  return (
    <View style={[styles.welcomeContainer, { backgroundColor: m3.colorScheme.surface }]}>
      <View style={styles.welcomeIconContainer}>
        <SymbolIcon name="sparkles" size={56} color={m3.colorScheme.primary} />
      </View>
      <Text
        style={[
          styles.welcomeTitle,
          {
            color: m3.colorScheme.onSurface,
            ...m3.typography.headlineSmall,
          },
        ]}
      >
        {t('assistant.chat.welcomeTitle')}
      </Text>
      <Text
        style={[
          styles.welcomeSubtitle,
          {
            color: m3.colorScheme.onSurfaceVariant,
            ...m3.typography.bodyMedium,
          },
        ]}
      >
        {t('assistant.chat.welcomeSubtitle')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flexGrow: 1,
    paddingTop: spacing[2],
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
    paddingBottom: spacing[12],
  },
  welcomeIconContainer: {
    marginBottom: spacing[4],
    opacity: 0.9,
  },
  welcomeTitle: {
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  welcomeSubtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
});
