/**
 * InputBar Component
 * The chat input row with:
 * - Multi-line TextInput with maxHeight 120 (expands, then scrolls)
 * - Send button (paper-plane) when text is entered
 * - Mic button when input is empty
 * - Attachment button (always visible)
 * - Attachment thumbnails row shown above input when images attached
 * - Loading state disables send and shows spinner
 * - M3 themed — no hardcoded colors
 */

import React, { useRef } from 'react';
import {
  View,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeTokens } from '@/styles/use-theme';
import { spacing } from '@/styles/theme';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import type { AIMessageAttachmentInput } from '@/types/ai';

const INPUT_MAX_HEIGHT = 120;
const INPUT_MIN_HEIGHT = 44;

interface InputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onVoicePress: () => void;
  onAttachPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  attachments?: AIMessageAttachmentInput[];
  onRemoveAttachment?: (index: number) => void;
}

export function InputBar({
  value,
  onChangeText,
  onSend,
  onVoicePress,
  onAttachPress,
  isLoading = false,
  disabled = false,
  attachments = [],
  onRemoveAttachment,
}: InputBarProps) {
  const { m3, isDark } = useThemeTokens();
  const { t } = useTranslation();
  const inputRef = useRef<TextInput>(null);

  const hasText = value.trim().length > 0;
  const canSend = hasText && !isLoading && !disabled;
  const canRemoveAttachment = onRemoveAttachment != null && !isLoading && !disabled;

  // Cellar Ledger: Input bar uses mist-1 (surfaceContainerLow) background with 1px border
  // Use surfaceContainerLow which maps to mist-1 (surface[100])
  const containerBg = m3.surface.surfaceContainerLow;
  const inputBg = isDark ? m3.surface.surfaceContainerLow : m3.colorScheme.surface;

  return (
    <View
      style={[
        styles.outerContainer,
        {
          backgroundColor: containerBg,
          borderTopColor: m3.colorScheme.outline,
          borderTopWidth: 1,
          paddingHorizontal: spacing[3],
          paddingTop: spacing[2],
          paddingBottom: spacing[1],
        },
      ]}
    >
      {/* Attachment thumbnails row */}
      {attachments.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.thumbnailsScroll}
          contentContainerStyle={styles.thumbnailsContent}
        >
          {attachments.map((attachment, index) => (
            <View key={index} style={styles.thumbnailWrapper}>
              {attachment.dataUrl != null ? (
                <Image
                  source={{ uri: attachment.dataUrl }}
                  style={[styles.thumbnail, { borderColor: m3.colorScheme.outline }]}
                  accessibilityLabel={t('assistant.attachments.thumbnailA11y')}
                />
              ) : (
                <View
                  style={[
                    styles.thumbnail,
                    styles.documentThumbnail,
                    { borderColor: m3.colorScheme.outline },
                  ]}
                  accessible
                  accessibilityLabel={`${t('assistant.attachments.documentA11y')}: ${attachment.name}`}
                >
                  <SymbolIcon
                    name="doc.text.fill"
                    size={16}
                    color={m3.colorScheme.onSurfaceVariant}
                  />
                  <Text
                    style={[styles.documentText, { color: m3.colorScheme.onSurfaceVariant }]}
                    numberOfLines={2}
                  >
                    {attachment.name}
                  </Text>
                </View>
              )}
              {onRemoveAttachment ? (
                <TouchableOpacity
                  style={[
                    styles.thumbnailRemoveBtn,
                    { backgroundColor: m3.colorScheme.error },
                    !canRemoveAttachment && styles.thumbnailRemoveBtnDisabled,
                  ]}
                  onPress={() => {
                    if (canRemoveAttachment) {
                      onRemoveAttachment(index);
                    }
                  }}
                  disabled={!canRemoveAttachment}
                  accessibilityLabel={t('assistant.attachments.removeA11y')}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canRemoveAttachment }}
                >
                  <SymbolIcon name="xmark" size={10} color={m3.colorScheme.onError} />
                </TouchableOpacity>
              ) : (
                <View
                  style={styles.thumbnailRemoveBtn}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              )}
            </View>
          ))}
        </ScrollView>
      )}
      {/* Input row: attachment button + text field + send/mic */}
      <View style={styles.inputRow}>
        {/* Attachment button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onAttachPress}
          disabled={isLoading || disabled}
          accessibilityLabel={t('assistant.attachments.attachFileA11y')}
          accessibilityRole="button"
        >
          <SymbolIcon
            name="paperclip"
            size={22}
            color={
              isLoading || disabled ? m3.colorScheme.onSurfaceVariant : m3.colorScheme.onSurface
            }
          />
        </TouchableOpacity>

        {/* Text input */}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={t('assistant.placeholder')}
          placeholderTextColor={m3.colorScheme.onSurfaceVariant}
          multiline
          style={[
            styles.textInput,
            {
              // Cellar Ledger: mist-0 bg, 1px stone-3 border, borderRadius 24
              backgroundColor: inputBg,
              color: m3.colorScheme.onSurface,
              borderColor: m3.colorScheme.outline,
              borderWidth: 1,
              borderRadius: 24,
              ...Platform.select({
                ios: {
                  maxHeight: INPUT_MAX_HEIGHT,
                  minHeight: INPUT_MIN_HEIGHT,
                },
                android: {
                  maxHeight: INPUT_MAX_HEIGHT,
                  minHeight: INPUT_MIN_HEIGHT,
                },
              }),
            },
          ]}
          editable={!isLoading && !disabled}
          returnKeyType="default"
          blurOnSubmit={false}
          scrollEnabled
          textAlignVertical="center"
          accessibilityLabel={t('assistant.placeholder')}
        />

        {/* Send / Mic button */}
        {isLoading ? (
          <View style={styles.iconButton} accessibilityLabel={t('assistant.chat.thinking')}>
            <ActivityIndicator size="small" color={m3.colorScheme.primary} />
          </View>
        ) : hasText ? (
          <TouchableOpacity
            style={[
              styles.sendButton,
              // Cellar Ledger: primary green circle
              { backgroundColor: m3.colorScheme.primary },
            ]}
            onPress={onSend}
            disabled={!canSend}
            accessibilityLabel={t('assistant.chat.sendA11y')}
            accessibilityRole="button"
          >
            <SymbolIcon name="paperplane.fill" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onVoicePress}
            disabled={disabled}
            accessibilityLabel={t('assistant.chat.openVoiceModeA11y')}
            accessibilityRole="button"
          >
            <SymbolIcon
              name="mic.fill"
              size={22}
              color={disabled ? m3.colorScheme.onSurfaceVariant : m3.colorScheme.primary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flexDirection: 'column',
    // Note: padding and border set inline for Cellar Ledger design
    gap: spacing[2],
  },
  thumbnailsScroll: {
    maxHeight: 80,
  },
  thumbnailsContent: {
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  documentThumbnail: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[1],
    gap: spacing[1],
  },
  documentText: {
    fontSize: 9,
    textAlign: 'center',
  },
  thumbnailRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailRemoveBtnDisabled: {
    opacity: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24, // Cellar Ledger: 24px radius (rounded)
    paddingHorizontal: spacing[4],
    paddingVertical: Platform.OS === 'ios' ? spacing[2] : spacing[1],
    fontSize: 15,
    lineHeight: 20,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
