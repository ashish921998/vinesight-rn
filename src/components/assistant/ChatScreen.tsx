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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Text,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useM3 } from '@/styles/use-theme';
import { useLanguageStore } from '@/stores/language-store';
import { useModalStore } from '@/stores/modal-store';
import { useFarms } from '@/hooks/use-farms';
import { borderRadius, fontSize, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { AIAvatar } from './AIAvatar';
import { useAssistant } from '@/hooks/use-assistant';
import type { AssistantFarmContext } from '@/hooks/use-assistant';
import type { AIMessageAttachmentInput } from '@/types/ai';
import { AssistantGatewayError, AssistantGatewayErrorCode } from '@/services/assistant-gateway';
import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { SuggestionChips } from './SuggestionChips';
import { ConversationSidebar } from './ConversationSidebar';
import { FarmSelectModal } from '@/components/modals/farm-select-modal';
import { useAssistantFarmStore } from '@/stores/assistant-farm-store';
import { buildFarmSuggestions } from './farm-suggestions';
import type { Farm } from '@/types';
import { ActivityConfirmCard } from './ActivityConfirmCard';
import { VoiceModeModal } from './VoiceMode/VoiceModeModal';
import { useVoiceMode } from '@/hooks/use-voice-mode';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';

/** Maximum size for inline text content (100KB) */
const MAX_INLINE_TEXT_BYTES = 100_000;

interface ChatScreenProps {
  initialFarmId?: string;
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return 'unknown_error';
}

function supportsInlineDocumentRead(mimeType?: string): boolean {
  if (!mimeType) return false;
  const normalizedMimeType = mimeType.toLowerCase();
  return (
    normalizedMimeType.startsWith('text/') ||
    normalizedMimeType === 'application/json' ||
    normalizedMimeType === 'application/xml' ||
    normalizedMimeType.endsWith('+json') ||
    normalizedMimeType.endsWith('+xml')
  );
}

function normalizeInlineDocumentText(rawText: string, mimeType?: string): string {
  const normalizedMimeType = mimeType?.toLowerCase() ?? '';
  if (normalizedMimeType === 'application/json' || normalizedMimeType.endsWith('+json')) {
    try {
      return JSON.stringify(JSON.parse(rawText), null, 2);
    } catch {
      return rawText;
    }
  }
  return rawText;
}

function ensureUtf8ByteLimit(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(text).length <= maxBytes) {
    return text;
  }

  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (encoder.encode(text.slice(0, mid)).length <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return text.slice(0, low);
}

function AssistantHomeLanding({
  farm,
  onQuickActionPress,
  disabled,
}: {
  farm?: { name?: string } | null;
  onQuickActionPress: (text: string) => void;
  disabled?: boolean;
}) {
  const m3 = useM3();
  const { t } = useTranslation();
  const activeFarmName = farm?.name;
  const greeting = activeFarmName
    ? t('assistant.home.greetingFarm', { name: activeFarmName })
    : t('assistant.home.greeting');
  const suggestions = buildFarmSuggestions(farm as Farm | null | undefined, t);

  return (
    <ScrollView
      style={[styles.homeScroll, { backgroundColor: m3.colorScheme.surface }]}
      contentContainerStyle={styles.homeContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Centered greeting — single, friendly, ChatGPT/Claude style */}
      <View style={styles.homeGreetingBlock}>
        <AIAvatar size={48} iconSize={22} />
        <Text
          style={[
            styles.homeGreeting,
            { color: m3.colorScheme.onSurface, ...m3.typography.headlineSmall },
          ]}
        >
          {greeting}
        </Text>
        <Text
          style={[
            styles.homeSubtitle,
            { color: m3.colorScheme.onSurfaceVariant, ...m3.typography.bodyMedium },
          ]}
        >
          {t('assistant.home.subtitle')}
        </Text>
      </View>

      {/* A few tappable example questions, tailored to the active farm */}
      <View style={styles.suggestionList}>
        {suggestions.map((item) => {
          const text = item.text;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.suggestionRow,
                {
                  backgroundColor: m3.surface.surfaceContainerLow ?? m3.colorScheme.surfaceVariant,
                  borderColor: m3.colorScheme.outlineVariant,
                },
                disabled && styles.suggestionRowDisabled,
              ]}
              onPress={() => onQuickActionPress(text)}
              disabled={disabled}
              accessibilityLabel={text}
              accessibilityRole="button"
            >
              <SymbolIcon name={item.icon} size={18} color={m3.colorScheme.primary} />
              <Text
                style={[
                  styles.suggestionText,
                  { color: m3.colorScheme.onSurface, ...m3.typography.bodyMedium },
                ]}
                numberOfLines={2}
              >
                {text}
              </Text>
              <SymbolIcon name="arrow.up.right" size={14} color={m3.colorScheme.onSurfaceVariant} />
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

export function ChatScreen({ initialFarmId }: ChatScreenProps = {}) {
  const m3 = useM3();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const language = useLanguageStore((s) => s.language) ?? 'en';
  const router = useRouter();
  const { setAddEntry } = useModalStore();
  const { data: farms } = useFarms();
  const tabBarInset = useTabBarInset();

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [attachModalVisible, setAttachModalVisible] = useState(false);
  const [farmModalVisible, setFarmModalVisible] = useState(false);
  // The farm the user explicitly picked this session (via the picker or by
  // opening a past conversation). null until they make a choice.
  const [pickedFarmId, setPickedFarmId] = useState<number | null>(null);
  const lastFarmId = useAssistantFarmStore((s) => s.lastFarmId);
  const setLastFarmId = useAssistantFarmStore((s) => s.setLastFarmId);

  const initialFarmIdNum =
    initialFarmId != null && initialFarmId !== '' ? Number(initialFarmId) : null;

  // Resolve the active farm with sensible defaults so a farmer never lands on
  // an empty "pick a farm" screen: explicit pick → route param → last used →
  // first farm. Only a user with zero farms ends up with no active farm.
  const activeFarm = useMemo(() => {
    if (!farms || farms.length === 0) return null;
    const candidates = [pickedFarmId, initialFarmIdNum, lastFarmId];
    for (const id of candidates) {
      if (id == null) continue;
      const match = farms.find((f) => f.id === id);
      if (match) return match;
    }
    return farms[0] ?? null;
  }, [farms, pickedFarmId, initialFarmIdNum, lastFarmId]);

  // Remember the resolved farm so the next visit opens straight into it.
  useEffect(() => {
    if (activeFarm?.id != null && activeFarm.id !== lastFarmId) {
      setLastFarmId(activeFarm.id);
    }
  }, [activeFarm?.id, lastFarmId, setLastFarmId]);

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
    conversationId,
    isLoading,
    inputText,
    setInputText,
    suggestions,
    streamingMessageId,
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
    addMessage,
    syncConversationId,
    setVoiceLogAction,
  } = useAssistant({ language, farmContext });

  const {
    voiceState,
    voiceMessages,
    isVoiceModeVisible,
    openVoiceMode,
    handleOrbPress,
    handleClose: handleCloseVoiceMode,
    voiceModeError,
    clearVoiceModeError,
    noSpeechLabel,
  } = useVoiceMode({
    conversationId,
    language,
    farmContext,
    onNewMessage: addMessage,
    onConversationIdChange: syncConversationId,
    onVoiceLogAction: setVoiceLogAction,
  });

  const handleSend = useCallback(() => {
    void sendMessage();
  }, [sendMessage]);

  const handleSendSuggestion = useCallback(
    (text: string) => {
      void sendMessage(text);
    },
    [sendMessage],
  );

  const handleMessageAction = useCallback(
    (action: { actionType: string; payload?: string }) => {
      if (action.actionType === 'navigate' && action.payload) {
        router.push(action.payload as never);
      } else if (action.actionType === 'prompt' && action.payload) {
        void sendMessage(action.payload);
      }
    },
    [router, sendMessage],
  );

  const handleOpenSidebar = useCallback(() => {
    setSidebarVisible(true);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSidebarVisible(false);
  }, []);

  // Keep the current farm context for the new chat — farmers usually keep
  // asking about the same farm, and they can switch any time via the picker.
  const handleStartNewConversation = useCallback(() => {
    startNewConversation();
  }, [startNewConversation]);

  const handleSelectConversation = useCallback(
    (conversationId: string, conversationFarmId?: number | null) => {
      if (conversationFarmId != null) {
        setPickedFarmId(conversationFarmId);
      }
      void loadConversation(conversationId);
    },
    [loadConversation],
  );

  const handlePickFarm = useCallback(
    (farmId: number) => {
      setPickedFarmId(farmId);
      setLastFarmId(farmId);
      setFarmModalVisible(false);
    },
    [setLastFarmId],
  );

  const handleRetry = useCallback(() => {
    void retryLastMessage();
  }, [retryLastMessage]);

  const handlePickImage = useCallback(async () => {
    try {
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

      if (asset.base64 && asset.base64.length > 13_000_000) {
        Alert.alert(t('assistant.attachments.imageTooLarge'));
        return;
      }

      if (!asset.base64) {
        Alert.alert(t('assistant.attachments.imageReadError'));
        return;
      }

      const attachment: AIMessageAttachmentInput = {
        kind: 'image',
        name: asset.fileName ?? 'image.jpg',
        mimeType,
        dataUrl: `data:${mimeType};base64,${asset.base64}`,
      };

      addAttachment(attachment);
    } catch (error) {
      if (__DEV__) {
        console.warn('Image picker failed:', getSafeErrorMessage(error));
      }
      Alert.alert(t('assistant.attachments.imageReadError'));
    }
  }, [addAttachment, t]);

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/plain',
          'text/csv',
          'application/json',
          'application/xml',
          'text/xml',
          'text/markdown',
          'text/x-markdown',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (!asset) return;

      let textContent: string | undefined;
      let resolvedAssetSize = asset.size;
      if (resolvedAssetSize === undefined && supportsInlineDocumentRead(asset.mimeType)) {
        try {
          const info = await FileSystem.getInfoAsync(asset.uri);
          if (info.exists && typeof info.size === 'number') {
            resolvedAssetSize = info.size;
          }
        } catch {
          // Fall through - unresolved size keeps the asset out of inline read
        }
      }
      // Guard against large assets - only read small text files inline
      if (
        supportsInlineDocumentRead(asset.mimeType) &&
        resolvedAssetSize !== undefined &&
        resolvedAssetSize <= MAX_INLINE_TEXT_BYTES
      ) {
        try {
          const rawText = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: 'utf8',
          });
          textContent = normalizeInlineDocumentText(rawText, asset.mimeType);
          // Enforce max length if needed
          textContent = ensureUtf8ByteLimit(textContent, MAX_INLINE_TEXT_BYTES);
        } catch {
          // Fall through - attach without text content
        }
      }

      if (!textContent) {
        textContent = [
          `Document attached: ${asset.name ?? 'document'}`,
          `MIME type: ${asset.mimeType ?? 'application/octet-stream'}`,
          'Full document text could not be extracted on device.',
        ].join('\n');
      }

      const attachment: AIMessageAttachmentInput = {
        kind: 'document',
        name: asset.name ?? 'document',
        mimeType: asset.mimeType ?? 'application/octet-stream',
        textContent,
      };

      addAttachment(attachment);
    } catch (error) {
      if (__DEV__) {
        console.warn('Document picker failed:', getSafeErrorMessage(error));
      }
      Alert.alert(t('assistant.attachments.fileReadError'));
    }
  }, [addAttachment, t]);

  const handleAttachPress = useCallback(() => {
    setAttachModalVisible(true);
  }, []);

  const handleAttachImage = useCallback(() => {
    setAttachModalVisible(false);
    void handlePickImage();
  }, [handlePickImage]);

  const handleAttachDocument = useCallback(() => {
    setAttachModalVisible(false);
    void handlePickDocument();
  }, [handlePickDocument]);

  // Handle voice log confirmation
  const handleVoiceLogConfirm = useCallback(() => {
    if (!voiceLogAction?.draft) return;
    const { draft } = voiceLogAction;
    const prefill = voiceLogAction.prefill ?? undefined;
    const initialIrrigationDurationHours =
      draft.type === 'irrigation' ? (draft.irrigation?.durationHours ?? null) : null;

    setAddEntry({
      tabs: ['log'],
      initialTab: 'log',
      initialFarmId: draft.farmId,
      initialLogType: draft.type,
      initialIrrigationDurationHours,
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
    openVoiceMode();
  }, [openVoiceMode]);

  // Only genuinely-farmless users get the "add a farm" prompt; everyone else
  // gets an auto-resolved active farm.
  const hasNoFarms = farms !== undefined && farms.length === 0;
  const hasMessages = messages.length > 0;

  const errorGuidance = useMemo(() => {
    if (error == null) return null;
    if (hasNoFarms) return t('assistant.error.guidance.addFarm');

    if (error instanceof AssistantGatewayError) {
      if (
        error.code === AssistantGatewayErrorCode.INVALID_RESPONSE ||
        error.code === AssistantGatewayErrorCode.SERVER_ERROR ||
        error.code === AssistantGatewayErrorCode.TIMEOUT ||
        error.code === AssistantGatewayErrorCode.NETWORK_ERROR
      ) {
        return t('assistant.error.guidance.retryWithDetails');
      }
      if (
        error.code === AssistantGatewayErrorCode.INVALID_REQUEST ||
        error.code === AssistantGatewayErrorCode.AUDIO_VALIDATION_FAILED ||
        error.code === AssistantGatewayErrorCode.EMPTY_TRANSCRIPT
      ) {
        return t('assistant.error.guidance.provideContext');
      }
    }

    const normalizedErrorMessage = getSafeErrorMessage(error).toLowerCase();
    if (
      normalizedErrorMessage.includes('missing') ||
      normalizedErrorMessage.includes('required') ||
      normalizedErrorMessage.includes('farm')
    ) {
      return t('assistant.error.guidance.provideContext');
    }

    return t('assistant.error.guidance.retryWithDetails');
  }, [error, hasNoFarms, t]);

  const showSuggestionsBelow = hasMessages && suggestions.length > 0;

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: m3.colorScheme.surface,
          paddingBottom: Platform.OS === 'ios' ? tabBarInset : 0,
        },
      ]}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? tabBarInset : 0}
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
            accessibilityLabel={t('assistant.chat.openHistoryHint')}
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
            onPress={handleStartNewConversation}
            accessibilityLabel={t('assistant.chat.newConversation')}
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

        {/* Farm picker pill — one tap to switch the farm in context */}
        {activeFarm && (
          <TouchableOpacity
            style={[
              styles.farmPill,
              {
                backgroundColor: m3.surface.surfaceContainerLow,
                borderBottomColor: m3.colorScheme.outlineVariant,
              },
            ]}
            onPress={() => setFarmModalVisible(true)}
            disabled={farms == null || farms.length < 2}
            accessibilityRole="button"
            accessibilityLabel={`${t('assistant.context.activeFarmLabel')}: ${activeFarm.name}. ${t('assistant.context.changeFarm')}`}
            testID="assistant-farm-pill"
          >
            <View
              style={[
                styles.farmPillIconWrap,
                { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.14) },
              ]}
            >
              <SymbolIcon name="leaf.fill" size={15} color={m3.colorScheme.primary} />
            </View>
            <Text
              style={[
                styles.farmPillName,
                { color: m3.colorScheme.onSurface, ...m3.typography.labelLarge },
              ]}
              numberOfLines={1}
            >
              {activeFarm.name}
            </Text>
            {farms != null && farms.length > 1 && (
              <SymbolIcon
                name="chevron.up.chevron.down"
                size={13}
                color={m3.colorScheme.onSurfaceVariant}
              />
            )}
          </TouchableOpacity>
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
            {errorGuidance ? (
              <Text
                style={[
                  styles.errorGuidanceText,
                  {
                    color: m3.colorScheme.onErrorContainer,
                    ...m3.typography.labelSmall,
                  },
                ]}
              >
                {errorGuidance}
              </Text>
            ) : null}
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
          {!hasMessages && !isLoading ? (
            <AssistantHomeLanding
              farm={activeFarm}
              onQuickActionPress={handleSendSuggestion}
              disabled={isLoading}
            />
          ) : (
            <MessageList
              messages={messages}
              isLoading={isLoading}
              streamingMessageId={streamingMessageId}
              onActionPress={handleMessageAction}
            />
          )}
        </View>

        {/* Voice log confirmation card */}
        {voiceLogAction != null && voiceLogAction.kind === 'ready' && (
          <ActivityConfirmCard
            voiceLogAction={voiceLogAction}
            onConfirm={handleVoiceLogConfirm}
            onCancel={handleVoiceLogCancel}
          />
        )}

        {showSuggestionsBelow && (
          <SuggestionChips
            suggestions={suggestions}
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
        farmId={activeFarm?.id ?? null}
        onClose={handleCloseSidebar}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleStartNewConversation}
      />

      {/* Farm picker */}
      <FarmSelectModal
        visible={farmModalVisible}
        title={t('assistant.context.pickFarm')}
        farms={farms ?? []}
        selectedFarmId={activeFarm?.id ?? null}
        onSelect={handlePickFarm}
        onClose={() => setFarmModalVisible(false)}
      />

      {/* Voice mode modal */}
      <VoiceModeModal
        visible={isVoiceModeVisible}
        voiceState={voiceState}
        messages={voiceMessages}
        onOrbPress={handleOrbPress}
        onClose={handleCloseVoiceMode}
        voiceModeError={voiceModeError}
        onClearError={clearVoiceModeError}
        noSpeechLabel={noSpeechLabel}
      />

      {/* Attachment picker modal */}
      <Modal
        visible={attachModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachModalVisible(false)}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <Pressable style={styles.attachModalOverlay} onPress={() => setAttachModalVisible(false)}>
          <Pressable
            style={[
              styles.attachModalSheet,
              {
                backgroundColor: m3.colorScheme.surface,
                paddingBottom: spacing[6] + insets.bottom,
              },
            ]}
            onPress={() => {}}
          >
            <View style={styles.attachModalHandle}>
              <View
                style={[
                  styles.attachModalHandleBar,
                  { backgroundColor: m3.colorScheme.outlineVariant },
                ]}
              />
            </View>
            <Text
              style={[
                styles.attachModalTitle,
                { color: m3.colorScheme.onSurface, ...m3.typography.titleMedium },
              ]}
            >
              {t('assistant.attachments.title')}
            </Text>
            <View style={styles.attachModalOptions}>
              <TouchableOpacity
                style={[
                  styles.attachModalOption,
                  { backgroundColor: m3.colorScheme.primaryContainer },
                ]}
                onPress={handleAttachImage}
                accessibilityLabel={t('assistant.attachments.image')}
                accessibilityRole="button"
              >
                <SymbolIcon name="photo" size={28} color={m3.colorScheme.onPrimaryContainer} />
                <Text
                  style={[
                    styles.attachModalOptionLabel,
                    { color: m3.colorScheme.onPrimaryContainer, ...m3.typography.labelLarge },
                  ]}
                >
                  {t('assistant.attachments.image')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.attachModalOption,
                  { backgroundColor: m3.colorScheme.secondaryContainer },
                ]}
                onPress={handleAttachDocument}
                accessibilityLabel={t('assistant.attachments.file')}
                accessibilityRole="button"
              >
                <SymbolIcon
                  name="doc.text.fill"
                  size={28}
                  color={m3.colorScheme.onSecondaryContainer}
                />
                <Text
                  style={[
                    styles.attachModalOptionLabel,
                    { color: m3.colorScheme.onSecondaryContainer, ...m3.typography.labelLarge },
                  ]}
                >
                  {t('assistant.attachments.file')}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.attachModalCancel, { backgroundColor: m3.colorScheme.surfaceVariant }]}
              onPress={() => setAttachModalVisible(false)}
              accessibilityLabel={t('assistant.chat.close')}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.attachModalCancelText,
                  { color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelLarge },
                ]}
              >
                {t('assistant.chat.close')}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  homeScroll: {
    flex: 1,
  },
  homeContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[6],
  },
  homeGreetingBlock: {
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  homeGreeting: {
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  homeSubtitle: {
    textAlign: 'center',
  },
  suggestionList: {
    gap: spacing[2],
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3] + 2,
  },
  suggestionRowDisabled: {
    opacity: 0.55,
  },
  suggestionText: {
    flex: 1,
    lineHeight: 20,
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
  farmPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  farmPillIconWrap: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmPillName: {
    flex: 1,
    fontWeight: '600' as const,
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
  errorGuidanceText: {
    lineHeight: 18,
  },
  errorBannerActions: {
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'flex-end',
  },
  errorBannerButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
  },
  errorBannerButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600' as const,
  },
  attachModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  attachModalSheet: {
    borderTopLeftRadius: borderRadius['3xl'],
    borderTopRightRadius: borderRadius['3xl'],
    paddingHorizontal: spacing[5],
  },
  attachModalHandle: {
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  attachModalHandleBar: {
    width: 36,
    height: 4,
    borderRadius: radius.xs,
  },
  attachModalTitle: {
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  attachModalOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[4],
    marginBottom: spacing[4],
  },
  attachModalOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    gap: spacing[2],
  },
  attachModalOptionLabel: {
    textAlign: 'center',
  },
  attachModalCancel: {
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
  },
  attachModalCancelText: {
    textAlign: 'center',
  },
});
