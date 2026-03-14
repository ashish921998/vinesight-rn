/**
 * ChatScreen Component
 * Main container for the AI chat interface.
 * Manages the overall chat layout with:
 * - Keyboard avoiding view
 * - Empty/welcome state when no messages
 * - Message list with auto-scroll
 * - Suggestion chips after assistant responds
 * - Input bar at bottom (with attachment support)
 * - Error banner with Retry/Dismiss on failure
 * - ActivityConfirmCard for voice log confirmations
 * - No-farm banner when user has no farms
 * - Sidebar toggle button in header
 * - ConversationSidebar drawer for history
 * Uses useAssistant hook for state management.
 * Connects to assistant-gateway.ts for API calls.
 * M3 themed, i18n for all strings.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Text,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useThemeTokens } from '@/styles/use-theme';
import { useLanguageStore } from '@/stores/language-store';
import { useModalStore } from '@/stores/modal-store';
import { useFarms } from '@/hooks/use-farms';
import { spacing } from '@/styles/theme';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { useAssistant } from '@/hooks/use-assistant';
import type { AssistantFarmContext } from '@/hooks/use-assistant';
import type { AIMessageAttachmentInput } from '@/types/ai';
import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { SuggestionChips } from './SuggestionChips';
import { ConversationSidebar } from './ConversationSidebar';
import { ActivityConfirmCard } from './ActivityConfirmCard';
import { VoiceModeModal } from './VoiceMode/VoiceModeModal';
import type { VoiceModeState, VoiceModeMessage } from './VoiceMode/VoiceModeModal';

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
  const router = useRouter();
  const { setAddEntry } = useModalStore();
  const { data: farms } = useFarms();

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [voiceModeVisible, setVoiceModeVisible] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceModeState>('idle');
  const [voiceMessages, setVoiceMessages] = useState<VoiceModeMessage[]>([]);

  // Auto-select the first farm from the list as the active farm for assistant context
  const activeFarm = useMemo(() => farms?.[0] ?? null, [farms]);

  // Build farm context from the active farm to include in assistant requests.
  // daysSincePruning is omitted here — it requires Date.now() which is impure in useMemo;
  // the backend computes it from date_of_pruning when needed.
  const farmContext = useMemo((): AssistantFarmContext | undefined => {
    if (!activeFarm) return undefined;
    return {
      farmId: activeFarm.id ?? null,
      farmName: activeFarm.name,
      cropVariety: activeFarm.crop_variety,
      area: activeFarm.area,
      region: activeFarm.region,
    };
  }, [activeFarm]);

  const {
    messages,
    isLoading,
    inputText,
    setInputText,
    suggestions,
    error,
    voiceLogAction,
    attachments,
    sendMessage,
    startNewConversation,
    loadConversation,
    retryLastMessage,
    clearError,
    dismissVoiceLogAction,
    addAttachment,
    removeAttachment,
  } = useAssistant({ language, farmContext });

  const handleSend = useCallback(() => {
    void sendMessage();
  }, [sendMessage]);

  const handleSendSuggestion = useCallback(
    (text: string) => {
      void sendMessage(text);
    },
    [sendMessage],
  );

  const handleOpenSidebar = useCallback(() => {
    setSidebarVisible(true);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSidebarVisible(false);
  }, []);

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      void loadConversation(conversationId);
    },
    [loadConversation],
  );

  const handleNewChatFromSidebar = useCallback(() => {
    startNewConversation();
  }, [startNewConversation]);

  const handleRetry = useCallback(() => {
    void retryLastMessage();
  }, [retryLastMessage]);

  // Handle image picker for attachments
  const handleAttachPress = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    if (!asset) return;

    const mimeType = asset.mimeType ?? 'image/jpeg';

    // Validate size: base64 should be under ~10MB decoded
    if (asset.base64 && asset.base64.length > 13_000_000) {
      Alert.alert(t('ai.attach.imageTooLarge'));
      return;
    }

    const attachment: AIMessageAttachmentInput = {
      kind: 'image',
      name: asset.fileName ?? 'image.jpg',
      mimeType,
      dataUrl: asset.uri,
      // Send as base64 in request
      ...(asset.base64 ? { dataUrl: `data:${mimeType};base64,${asset.base64}` } : {}),
    };

    addAttachment(attachment);
  }, [addAttachment, t]);

  // Handle voice log confirmation
  const handleVoiceLogConfirm = useCallback(() => {
    if (!voiceLogAction?.draft) return;
    const { draft } = voiceLogAction;
    const prefill = voiceLogAction.prefill ?? undefined;

    setAddEntry({
      tabs: ['log'],
      initialTab: 'log',
      initialFarmId: draft.farmId,
      initialLogType: draft.type,
      initialIrrigationDurationHours:
        draft.type === 'irrigation' ? draft.irrigation.durationHours : null,
      initialLogDate: draft.date,
      voiceLogPrefill: prefill,
      entrySource: 'voice_ai',
    });

    dismissVoiceLogAction();

    router.push({
      pathname: '/add-entry',
      params: {
        ...(draft.farmId != null ? { farmId: String(draft.farmId) } : {}),
        initialTab: 'log',
        tabs: 'log',
        initialLogType: draft.type,
        initialLogDate: draft.date,
      },
    });
  }, [voiceLogAction, setAddEntry, dismissVoiceLogAction, router]);

  const handleVoiceLogCancel = useCallback(() => {
    dismissVoiceLogAction();
  }, [dismissVoiceLogAction]);

  const handleOpenVoiceMode = useCallback(() => {
    setVoiceState('idle');
    setVoiceMessages([]);
    setVoiceModeVisible(true);
  }, []);

  const handleCloseVoiceMode = useCallback(() => {
    setVoiceModeVisible(false);
    setVoiceState('idle');
  }, []);

  // Orb press handler — state machine: idle→listening, listening→processing (no-op for now)
  // Full recording/STT integration is handled in vm-recording-and-stt feature.
  const handleOrbPress = useCallback(() => {
    setVoiceState((prev) => {
      if (prev === 'idle' || prev === 'error') return 'listening';
      if (prev === 'listening') return 'processing';
      if (prev === 'speaking') return 'listening';
      return 'idle';
    });
  }, []);

  // No-farm detection — distinguish between no farms existing vs no farm selected
  const hasNoFarms = farms !== undefined && farms.length === 0;
  const hasNoFarmSelected = farms !== undefined && farms.length > 0 && activeFarm === null;

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
          {/* Sidebar toggle button */}
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleOpenSidebar}
            accessibilityLabel={t('ai.chat.openHistoryHint')}
            accessibilityRole="button"
            testID="sidebar-toggle-button"
          >
            <SymbolIcon name="line.3.horizontal" size={22} color={m3.colorScheme.onSurface} />
          </TouchableOpacity>

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

          {/* New chat button */}
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={startNewConversation}
            accessibilityLabel={t('ai.chat.newConversation')}
            accessibilityRole="button"
          >
            <SymbolIcon name="square.and.pencil" size={22} color={m3.colorScheme.primary} />
          </TouchableOpacity>
        </View>

        {/* No-farm banner — shown when user has no farms at all */}
        {hasNoFarms && (
          <View
            style={[
              styles.noFarmBanner,
              {
                backgroundColor: m3.colorScheme.secondaryContainer,
                borderBottomColor: m3.colorScheme.outlineVariant,
              },
            ]}
            testID="no-farm-banner"
          >
            <SymbolIcon name="info.circle" size={16} color={m3.colorScheme.onSecondaryContainer} />
            <Text
              style={[
                styles.noFarmBannerText,
                {
                  color: m3.colorScheme.onSecondaryContainer,
                  ...m3.typography.labelSmall,
                },
              ]}
            >
              {t('assistant.noFarm.banner')}
            </Text>
          </View>
        )}

        {/* No-farm-selected banner — shown when farms exist but none is active */}
        {hasNoFarmSelected && (
          <View
            style={[
              styles.noFarmBanner,
              {
                backgroundColor: m3.colorScheme.secondaryContainer,
                borderBottomColor: m3.colorScheme.outlineVariant,
              },
            ]}
            testID="no-farm-selected-banner"
          >
            <SymbolIcon name="info.circle" size={16} color={m3.colorScheme.onSecondaryContainer} />
            <Text
              style={[
                styles.noFarmBannerText,
                {
                  color: m3.colorScheme.onSecondaryContainer,
                  ...m3.typography.labelSmall,
                },
              ]}
            >
              {t('assistant.noFarm.noFarmSelected')}
            </Text>
          </View>
        )}

        {/* Error banner */}
        {error != null && (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: m3.colorScheme.errorContainer,
                borderBottomColor: m3.colorScheme.outlineVariant,
              },
            ]}
            testID="error-banner"
          >
            <Text
              style={[
                styles.errorBannerText,
                {
                  color: m3.colorScheme.onErrorContainer,
                  ...m3.typography.labelSmall,
                },
              ]}
            >
              {t('assistant.error.failedRequest')}
            </Text>
            <View style={styles.errorBannerActions}>
              <TouchableOpacity
                onPress={handleRetry}
                style={[styles.errorBannerButton, { backgroundColor: m3.colorScheme.error }]}
                accessibilityLabel={t('assistant.error.a11y.retryButton')}
                accessibilityRole="button"
                testID="error-retry-button"
              >
                <Text style={[styles.errorBannerButtonText, { color: m3.colorScheme.onError }]}>
                  {t('assistant.error.retryButton')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={clearError}
                style={styles.errorBannerButton}
                accessibilityLabel={t('assistant.error.a11y.dismissButton')}
                accessibilityRole="button"
                testID="error-dismiss-button"
              >
                <Text
                  style={[styles.errorBannerButtonText, { color: m3.colorScheme.onErrorContainer }]}
                >
                  {t('assistant.error.dismissButton')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Message area */}
        <View style={styles.messageArea}>
          <MessageList messages={messages} isLoading={isLoading} />
        </View>

        {/* Voice log confirmation card */}
        {voiceLogAction != null && voiceLogAction.kind === 'ready' && (
          <ActivityConfirmCard
            voiceLogAction={voiceLogAction}
            onConfirm={handleVoiceLogConfirm}
            onCancel={handleVoiceLogCancel}
          />
        )}

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
          onVoicePress={handleOpenVoiceMode}
          onAttachPress={() => {
            void handleAttachPress();
          }}
          isLoading={isLoading}
          attachments={attachments}
          onRemoveAttachment={removeAttachment}
        />
      </KeyboardAvoidingView>

      {/* Conversation history sidebar */}
      <ConversationSidebar
        visible={sidebarVisible}
        onClose={handleCloseSidebar}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChatFromSidebar}
      />

      {/* Voice mode modal */}
      <VoiceModeModal
        visible={voiceModeVisible}
        voiceState={voiceState}
        messages={voiceMessages}
        onOrbPress={handleOrbPress}
        onClose={handleCloseVoiceMode}
      />
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
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[1],
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerIconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageArea: {
    flex: 1,
  },
  noFarmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[2],
  },
  noFarmBannerText: {
    flex: 1,
  },
  errorBanner: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[2],
  },
  errorBannerText: {
    flex: 1,
  },
  errorBannerActions: {
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'flex-end',
  },
  errorBannerButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 6,
  },
  errorBannerButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
});
