/**
 * ChatScreen Component
 * Main container for the AI chat interface.
 * Manages the overall chat layout with:
 * - Keyboard avoiding view
 * - Empty/welcome state when no messages
 * - Message list with auto-scroll
 * - Suggestion chips after assistant responds
 * - Input bar at bottom
 * Uses useAssistant hook for state management.
 * Connects to assistant-gateway.ts for API calls.
 * M3 themed, i18n for all strings.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useThemeTokens } from '@/styles/use-theme';
import { useLanguageStore } from '@/stores/language-store';
import { spacing } from '@/styles/theme';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { useAssistant } from '@/hooks/use-assistant';
import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { SuggestionChips } from './SuggestionChips';

const DEFAULT_SUGGESTIONS = [
  'ai.defaultSuggestions.waterNeed',
  'ai.defaultSuggestions.diseases',
  'ai.defaultSuggestions.fertilizer',
  'ai.defaultSuggestions.pruning',
] as const;

export function ChatScreen() {
  const { m3 } = useThemeTokens();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language) ?? 'en';

  const {
    messages,
    isLoading,
    inputText,
    setInputText,
    suggestions,
    sendMessage,
    startNewConversation,
  } = useAssistant({ language });

  const handleSend = useCallback(() => {
    void sendMessage();
  }, [sendMessage]);

  const handleSendSuggestion = useCallback(
    (text: string) => {
      void sendMessage(text);
    },
    [sendMessage],
  );

  // Use suggestions from last response, or default suggestions for welcome state
  const hasMessages = messages.length > 0;
  const activeSuggestions = useMemo(() => {
    if (hasMessages && suggestions.length > 0) return suggestions;
    if (!hasMessages) return DEFAULT_SUGGESTIONS as unknown as string[];
    return [];
  }, [hasMessages, suggestions]);

  const showSuggestionsBelow = hasMessages && suggestions.length > 0;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: m3.colorScheme.surface }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: m3.colorScheme.surface,
              borderBottomColor: m3.colorScheme.outlineVariant,
            },
          ]}
        >
          <Text
            style={[
              styles.headerTitle,
              {
                color: m3.colorScheme.onSurface,
                ...m3.typography.titleMedium,
              },
            ]}
          >
            {t('tabs.aiAssistant')}
          </Text>
          <TouchableOpacity
            style={styles.newChatButton}
            onPress={startNewConversation}
            accessibilityLabel={t('ai.chat.newConversation')}
            accessibilityRole="button"
          >
            <SymbolIcon name="square.and.pencil" size={22} color={m3.colorScheme.primary} />
          </TouchableOpacity>
        </View>

        {/* Message area */}
        <View style={styles.messageArea}>
          <MessageList messages={messages} isLoading={isLoading} />
        </View>

        {/* Suggestion chips — shown after assistant responds OR as welcome defaults */}
        {!hasMessages && (
          <SuggestionChips
            suggestions={activeSuggestions}
            onSendSuggestion={handleSendSuggestion}
            disabled={isLoading}
          />
        )}
        {showSuggestionsBelow && (
          <SuggestionChips
            suggestions={activeSuggestions}
            onSendSuggestion={handleSendSuggestion}
            disabled={isLoading}
          />
        )}

        {/* Input bar */}
        <InputBar
          value={inputText}
          onChangeText={setInputText}
          onSend={handleSend}
          onVoicePress={() => {
            // Voice mode will be implemented in vm-voice-mode-core feature
          }}
          onAttachPress={() => {
            // Attachment picker will be implemented in ui-citations-errors-confirmations feature
          }}
          isLoading={isLoading}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    flex: 1,
  },
  newChatButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageArea: {
    flex: 1,
  },
});
