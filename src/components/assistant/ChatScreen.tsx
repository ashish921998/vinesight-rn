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
import { useThemeTokens } from '@/styles/use-theme';
import { useLanguageStore } from '@/stores/language-store';
import { useModalStore } from '@/stores/modal-store';
import { useFarms } from '@/hooks/use-farms';
import { spacing, borderRadius } from '@/styles/theme';
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
import { ActivityConfirmCard } from './ActivityConfirmCard';
import { VoiceModeModal } from './VoiceMode/VoiceModeModal';
import { useVoiceMode } from '@/hooks/use-voice-mode';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';

/** Maximum size for inline text content (100KB) */
const MAX_INLINE_TEXT_BYTES = 100_000;

interface ChatScreenProps {
  initialFarmId?: string;
}

const ASSISTANT_QUICK_ACTIONS: ReadonlyArray<{
  id: 'waterStatus' | 'wageSummary' | 'weatherOutlook' | 'harvestReadiness';
  icon: string;
  title: string;
  description: string;
  prompt: string;
}> = [
  {
    id: 'waterStatus',
    icon: 'drop.fill',
    title: 'Water status',
    description: 'All farms this week',
    prompt: 'What is the water situation across all my farms this week?',
  },
  {
    id: 'wageSummary',
    icon: 'chart.bar.fill',
    title: 'Wage summary',
    description: 'This period',
    prompt: 'Summarize worker wages due this period.',
  },
  {
    id: 'weatherOutlook',
    icon: 'sun.max.fill',
    title: 'Weather outlook',
    description: 'Next 7 days',
    prompt: 'Show me the weather outlook for the next 7 days.',
  },
  {
    id: 'harvestReadiness',
    icon: 'basket.fill',
    title: 'Harvest readiness',
    description: 'Across all farms',
    prompt: 'Check harvest readiness across all my farms.',
  },
];

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
  activeFarmName,
  onQuickActionPress,
  disabled,
}: {
  activeFarmName?: string;
  onQuickActionPress: (text: string) => void;
  disabled?: boolean;
}) {
  const { m3 } = useThemeTokens();
  const briefingText = activeFarmName
    ? `${activeFarmName} is ready for today. Ask for water, wages, weather, or harvest next steps.`
    : 'Sunset needs irrigation before 11 AM. North Field is 14 mm below target.';

  return (
    <ScrollView
      style={[styles.homeScroll, { backgroundColor: m3.colorScheme.surface }]}
      contentContainerStyle={styles.homeContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.homeHeroRow}>
        <View>
          <Text
            style={[
              styles.homeEyebrow,
              { color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelSmall },
            ]}
          >
            Good morning
          </Text>
          <View style={styles.homeTitleRow}>
            <Text
              style={[
                styles.homeTitle,
                { color: m3.colorScheme.onSurface, ...m3.typography.headlineSmall },
              ]}
            >
              Assistant
            </Text>
            <View
              style={[
                styles.aiBadge,
                {
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
                  borderColor: colorWithOpacity(m3.colorScheme.primary, 0.22),
                },
              ]}
            >
              <SymbolIcon name="sparkles" size={11} color={m3.colorScheme.primary} />
              <Text style={[styles.aiBadgeText, { color: m3.colorScheme.primary }]}>AI</Text>
            </View>
          </View>
        </View>
        <AIAvatar size={38} iconSize={18} />
      </View>

      <View
        style={[
          styles.briefingBand,
          {
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.06),
            borderColor: colorWithOpacity(m3.colorScheme.primary, 0.16),
          },
        ]}
      >
        <AIAvatar size={30} iconSize={14} />
        <Text
          style={[
            styles.briefingText,
            { color: m3.colorScheme.onSurface, ...m3.typography.bodyMedium },
          ]}
        >
          {briefingText}
        </Text>
      </View>

      <Text
        style={[
          styles.quickActionLabel,
          { color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelSmall },
        ]}
      >
        Ask me
      </Text>
      <View style={styles.quickActionGrid}>
        {ASSISTANT_QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[
              styles.quickActionCard,
              {
                backgroundColor: m3.surface.surfaceContainerLow ?? m3.colorScheme.surfaceVariant,
                borderColor: m3.colorScheme.outlineVariant,
              },
              disabled && styles.jobCardDisabled,
            ]}
            onPress={() => onQuickActionPress(action.prompt)}
            disabled={disabled}
            accessibilityLabel={action.title}
            accessibilityRole="button"
          >
            <View style={styles.quickActionTitleRow}>
              <SymbolIcon name={action.icon} size={15} color={m3.colorScheme.primary} />
              <Text
                style={[
                  styles.quickActionTitle,
                  { color: m3.colorScheme.onSurface, ...m3.typography.labelLarge },
                ]}
              >
                {action.title}
              </Text>
            </View>
            <Text
              style={[
                styles.quickActionDescription,
                { color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelSmall },
              ]}
            >
              {action.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

export function ChatScreen({ initialFarmId }: ChatScreenProps = {}) {
  const { m3 } = useThemeTokens();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const language = useLanguageStore((s) => s.language) ?? 'en';
  const router = useRouter();
  const { setAddEntry } = useModalStore();
  const { data: farms } = useFarms();
  const tabBarInset = useTabBarInset();

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [attachModalVisible, setAttachModalVisible] = useState(false);
  // Tracks the effective farmId override and the prop value it was derived from.
  const [farmSelectionState, setFarmSelectionState] = useState<{
    overrideFarmId: string | null | undefined;
    sourceInitialFarmId?: string;
  }>({
    overrideFarmId: undefined,
    sourceInitialFarmId: initialFarmId,
  });
  const syncedOverrideFarmId =
    farmSelectionState.sourceInitialFarmId === initialFarmId
      ? farmSelectionState.overrideFarmId
      : undefined;
  const effectiveFarmId =
    syncedOverrideFarmId === undefined ? initialFarmId : (syncedOverrideFarmId ?? undefined);

  // Use the farm matching effectiveFarmId if provided, otherwise return null
  // No implicit fallback to first farm - explicit user selection required
  const activeFarm = useMemo(() => {
    if (effectiveFarmId && farms) {
      const match = farms.find((f) => String(f.id) === effectiveFarmId);
      if (match) return match;
    }
    return null;
  }, [farms, effectiveFarmId]);

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

  const handleStartNewConversation = useCallback(() => {
    setFarmSelectionState({
      overrideFarmId: null,
      sourceInitialFarmId: initialFarmId,
    });
    startNewConversation();
  }, [initialFarmId, startNewConversation]);

  const handleSelectConversation = useCallback(
    (conversationId: string, conversationFarmId?: number | null) => {
      setFarmSelectionState({
        overrideFarmId: conversationFarmId != null ? String(conversationFarmId) : null,
        sourceInitialFarmId: initialFarmId,
      });
      void loadConversation(conversationId);
    },
    [initialFarmId, loadConversation],
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

  // No-farm detection — distinguish between no farms existing vs no farm selected
  const hasNoFarms = farms !== undefined && farms.length === 0;
  const hasNoFarmSelected = farms !== undefined && farms.length > 0 && activeFarm === null;
  const hasMessages = messages.length > 0;

  const errorGuidance = useMemo(() => {
    if (error == null) return null;
    if (hasNoFarms) return t('assistant.error.guidance.addFarm');
    if (hasNoFarmSelected) return t('assistant.error.guidance.selectFarm');

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
  }, [error, hasNoFarmSelected, hasNoFarms, t]);

  const showSuggestionsBelow = hasMessages && suggestions.length > 0;

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: m3.colorScheme.surface, paddingBottom: tabBarInset },
      ]}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/explore')}
              style={[
                styles.noFarmBannerAction,
                { backgroundColor: colorWithOpacity(m3.colorScheme.onSecondaryContainer, 0.16) },
              ]}
              accessibilityLabel={t('assistant.noFarm.selectFarmButton')}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.noFarmBannerActionText,
                  { color: m3.colorScheme.onSecondaryContainer },
                ]}
              >
                {t('assistant.noFarm.selectFarmButton')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {activeFarm && (
          <View
            style={[
              styles.farmContextBanner,
              {
                backgroundColor: m3.surface.surfaceContainerLow,
                borderBottomColor: m3.colorScheme.outlineVariant,
              },
            ]}
            testID="assistant-farm-context-banner"
          >
            <View
              style={[
                styles.farmContextIconWrap,
                { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.14) },
              ]}
            >
              <SymbolIcon name="leaf.fill" size={16} color={m3.colorScheme.primary} />
            </View>
            <View style={styles.farmContextBody}>
              <Text
                style={[
                  styles.farmContextLabel,
                  { color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelSmall },
                ]}
              >
                {t('assistant.context.activeFarmLabel')}
              </Text>
              <Text
                style={[
                  styles.farmContextTitle,
                  { color: m3.colorScheme.onSurface, ...m3.typography.labelLarge },
                ]}
              >
                {activeFarm.name}
              </Text>
              <Text
                style={[
                  styles.farmContextMeta,
                  { color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelSmall },
                ]}
                numberOfLines={1}
              >
                {[activeFarm.crop_variety, activeFarm.region].filter(Boolean).join(' • ') ||
                  t('assistant.context.fallbackMeta')}
              </Text>
            </View>
            {activeFarm.id != null && (
              <TouchableOpacity
                onPress={() => router.push(`/farm/${activeFarm.id}`)}
                style={[
                  styles.farmContextAction,
                  { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.14) },
                ]}
                accessibilityLabel={t('assistant.context.openFarm')}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.farmContextActionText,
                    { color: m3.colorScheme.primary, ...m3.typography.labelSmall },
                  ]}
                >
                  {t('assistant.context.openFarm')}
                </Text>
              </TouchableOpacity>
            )}
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
              activeFarmName={activeFarm?.name}
              onQuickActionPress={handleSendSuggestion}
              disabled={isLoading}
            />
          ) : (
            <MessageList
              messages={messages}
              isLoading={isLoading}
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
    paddingHorizontal: spacing[4],
    paddingTop: spacing[1],
    paddingBottom: spacing[4],
  },
  homeHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing[1],
    paddingBottom: spacing[3],
  },
  homeEyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600' as const,
  },
  homeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: 2,
  },
  homeTitle: {
    letterSpacing: -0.4,
  },
  aiBadge: {
    height: 22,
    paddingHorizontal: 9,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
  },
  briefingBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing[4],
  },
  briefingText: {
    flex: 1,
    lineHeight: 20,
  },
  quickActionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600' as const,
    marginBottom: spacing[2],
  },
  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  quickActionCard: {
    width: '48.7%',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    gap: spacing[1],
  },
  quickActionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  quickActionTitle: {
    flex: 1,
    fontWeight: '600' as const,
  },
  quickActionDescription: {
    lineHeight: 16,
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
  noFarmBannerAction: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  noFarmBannerActionText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  farmContextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  farmContextIconWrap: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmContextBody: {
    flex: 1,
  },
  farmContextLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  farmContextTitle: {
    marginBottom: 1,
  },
  farmContextMeta: {
    fontSize: 11,
  },
  farmContextAction: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  farmContextActionText: {
    fontSize: 11,
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
    borderRadius: 6,
  },
  errorBannerButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  jobCardDisabled: {
    opacity: 0.55,
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
    borderRadius: 2,
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
