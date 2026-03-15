/**
 * ConversationSidebar Component
 * A slide-in drawer that shows conversation history.
 * Features:
 * - Slides in from the left over the chat screen
 * - Lists past conversations (preview text + date)
 * - 'New Chat' button at top
 * - Delete conversation with confirmation dialog
 * - Loading state (spinner while fetching)
 * - Empty state when no conversations
 * - Scrollable list
 * - M3 themed, all strings via i18n
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useThemeTokens } from '@/styles/use-theme';
import { spacing, borderRadius } from '@/styles/theme';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { assistantMemoryService } from '@/services/assistant-memory';
import type { AssistantConversationSummary } from '@/services/assistant-memory';
import { formatDate } from '@/i18n/format';

const SIDEBAR_WIDTH = Math.min(Dimensions.get('window').width * 0.82, 320);
const ANIMATION_DURATION = 220;

export interface ConversationSidebarProps {
  visible: boolean;
  farmId?: number | null;
  onClose: () => void;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
}

export function ConversationSidebar({
  visible,
  farmId,
  onClose,
  onSelectConversation,
  onNewChat,
}: ConversationSidebarProps) {
  const { m3 } = useThemeTokens();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [conversations, setConversations] = useState<AssistantConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const slideAnimRef = useRef(new Animated.Value(-SIDEBAR_WIDTH));
  const backdropAnimRef = useRef(new Animated.Value(0));
  const [modalVisible, setModalVisible] = useState(false);
  const visibleRef = useRef(visible);
  const animRunIdRef = useRef(0);

  // Fetch conversations when sidebar becomes visible
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setConversations([]);
    setLoadError(false);
    setIsLoading(true);
    assistantMemoryService
      .listConversations(farmId != null ? { farmId } : undefined)
      .then((data) => {
        if (!cancelled) {
          setConversations(data);
          setLoadError(false);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [visible, farmId]);

  // Slide-in / slide-out animation
  useEffect(() => {
    visibleRef.current = visible;
    const runId = ++animRunIdRef.current;

    if (visible) {
      setModalVisible(true);
      Animated.parallel([
        Animated.timing(slideAnimRef.current, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnimRef.current, {
          toValue: 0.5,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnimRef.current, {
          toValue: -SIDEBAR_WIDTH,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnimRef.current, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (runId === animRunIdRef.current && !visibleRef.current) {
          setModalVisible(false);
        }
      });
    }
  }, [visible]);

  const handleDeleteConversation = useCallback(
    (conversation: AssistantConversationSummary) => {
      Alert.alert(t('ai.chat.deleteChat'), t('ai.chat.deleteChatConfirm'), [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await assistantMemoryService.deleteConversation(conversation.id);
              if (success) {
                setConversations((prev) => prev.filter((c) => c.id !== conversation.id));
              } else {
                Alert.alert(t('ai.chat.deleteChatFailed'));
              }
            } catch (error) {
              console.error('Failed to delete conversation:', error);
              Alert.alert(t('ai.chat.deleteChatFailed'));
            }
          },
        },
      ]);
    },
    [t],
  );

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      onSelectConversation(conversationId);
      onClose();
    },
    [onSelectConversation, onClose],
  );

  const handleNewChat = useCallback(() => {
    onNewChat();
    onClose();
  }, [onNewChat, onClose]);

  const renderConversationItem = useCallback(
    ({ item }: { item: AssistantConversationSummary }) => {
      const displayDate = item.lastMessageAt ?? item.updatedAt;
      const preview = item.lastMessage ?? '';
      return (
        <TouchableOpacity
          style={[styles.conversationItem, { borderBottomColor: m3.colorScheme.outlineVariant }]}
          onPress={() => handleSelectConversation(item.id)}
          accessibilityRole="button"
          accessibilityLabel={preview || item.id}
        >
          <View style={styles.conversationContent}>
            <Text
              style={[
                styles.conversationPreview,
                { color: m3.colorScheme.onSurface, ...m3.typography.bodyMedium },
              ]}
              numberOfLines={2}
            >
              {preview}
            </Text>
            <Text
              style={[
                styles.conversationDate,
                { color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelSmall },
              ]}
            >
              {formatDate(displayDate)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteConversation(item)}
            accessibilityLabel={t('ai.chat.deleteChatHint')}
            accessibilityRole="button"
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <SymbolIcon name="trash" size={16} color={m3.colorScheme.onSurfaceVariant} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [m3, t, handleSelectConversation, handleDeleteConversation],
  );

  const keyExtractor = useCallback((item: AssistantConversationSummary) => item.id, []);

  const sidebarBg = m3.surface.surfaceContainerLow ?? m3.colorScheme.surface;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.modalRoot}>
        {/* Semi-transparent backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              backgroundColor: m3.colorScheme.scrim ?? '#000000',
              // eslint-disable-next-line react-hooks/refs
              opacity: backdropAnimRef.current,
            },
          ]}
        >
          <TouchableOpacity
            testID="sidebar-backdrop"
            style={styles.backdropPressable}
            onPress={onClose}
            accessibilityLabel={t('ai.chat.close')}
            accessibilityRole="button"
          />
        </Animated.View>

        {/* Sidebar panel */}
        <Animated.View
          style={[
            styles.sidebar,
            {
              width: SIDEBAR_WIDTH,
              backgroundColor: sidebarBg,
              paddingTop: insets.top + spacing[2],
              paddingBottom: insets.bottom + spacing[2],
              // eslint-disable-next-line react-hooks/refs
              transform: [{ translateX: slideAnimRef.current }],
            },
          ]}
        >
          {/* Header row */}
          <View
            style={[styles.sidebarHeader, { borderBottomColor: m3.colorScheme.outlineVariant }]}
          >
            <Text
              style={[
                styles.sidebarTitle,
                { color: m3.colorScheme.onSurface, ...m3.typography.titleMedium },
              ]}
            >
              {t('ai.chat.history')}
            </Text>
            <TouchableOpacity
              testID="sidebar-close-button"
              style={styles.closeButton}
              onPress={onClose}
              accessibilityLabel={t('ai.chat.close')}
              accessibilityRole="button"
            >
              <SymbolIcon name="xmark" size={18} color={m3.colorScheme.onSurface} />
            </TouchableOpacity>
          </View>

          {/* New Chat button */}
          <TouchableOpacity
            style={[
              styles.newChatButton,
              {
                backgroundColor: m3.colorScheme.primaryContainer,
                borderColor: m3.colorScheme.outlineVariant,
              },
            ]}
            onPress={handleNewChat}
            accessibilityRole="button"
            accessibilityLabel={t('ai.chat.newChat')}
          >
            <SymbolIcon
              name="square.and.pencil"
              size={16}
              color={m3.colorScheme.onPrimaryContainer}
            />
            <Text
              style={[
                styles.newChatLabel,
                { color: m3.colorScheme.onPrimaryContainer, ...m3.typography.bodyMedium },
              ]}
            >
              {t('ai.chat.newChat')}
            </Text>
          </TouchableOpacity>

          {/* Conversations list */}
          {isLoading ? (
            <View style={styles.centerContainer} testID="conversations-loading">
              <ActivityIndicator size="small" color={m3.colorScheme.primary} />
            </View>
          ) : loadError ? (
            <View style={styles.centerContainer} testID="conversations-load-error">
              <Text
                style={[
                  styles.emptyText,
                  { color: m3.colorScheme.error, ...m3.typography.bodyMedium },
                ]}
              >
                {t('ai.chat.loadHistoryFailed')}
              </Text>
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text
                style={[
                  styles.emptyText,
                  { color: m3.colorScheme.onSurfaceVariant, ...m3.typography.bodyMedium },
                ]}
              >
                {t('ai.chat.noPreviousChats')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={keyExtractor}
              renderItem={renderConversationItem}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropPressable: {
    flex: 1,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sidebarTitle: {
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing[2],
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[4],
    marginVertical: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    gap: spacing[2],
  },
  newChatLabel: {
    flexShrink: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing[4],
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[2],
  },
  conversationContent: {
    flex: 1,
    gap: spacing[1],
  },
  conversationPreview: {
    lineHeight: 20,
  },
  conversationDate: {
    lineHeight: 16,
  },
  deleteButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  emptyText: {
    textAlign: 'center',
  },
});
