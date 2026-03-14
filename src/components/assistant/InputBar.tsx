/**
 * InputBar Component
 * The chat input row with:
 * - Multi-line TextInput with maxHeight 120 (expands, then scrolls)
 * - Send button (paper-plane) when text is entered
 * - Mic button when input is empty
 * - Attachment button (always visible)
 * - Loading state disables send and shows spinner
 * - M3 themed — no hardcoded colors
 */

import React, { useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeTokens } from '@/styles/use-theme';
import { spacing } from '@/styles/theme';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';

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
}

export function InputBar({
  value,
  onChangeText,
  onSend,
  onVoicePress,
  onAttachPress,
  isLoading = false,
  disabled = false,
}: InputBarProps) {
  const { m3, isDark } = useThemeTokens();
  const { t } = useTranslation();
  const inputRef = useRef<TextInput>(null);

  const hasText = value.trim().length > 0;
  const canSend = hasText && !isLoading && !disabled;

  const containerBg = isDark ? m3.surface.surfaceContainer : m3.surface.surfaceContainerHigh;

  const inputBg = isDark ? m3.surface.surfaceContainerHigh : m3.colorScheme.surface;

  return (
    <View
      style={[
        styles.outerContainer,
        {
          backgroundColor: containerBg ?? m3.colorScheme.surface,
          borderTopColor: m3.colorScheme.outlineVariant,
        },
      ]}
    >
      {/* Attachment button */}
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onAttachPress}
        disabled={isLoading || disabled}
        accessibilityLabel={t('ai.chat.attachFileA11y')}
        accessibilityRole="button"
      >
        <SymbolIcon
          name="paperclip"
          size={22}
          color={isLoading || disabled ? m3.colorScheme.onSurfaceVariant : m3.colorScheme.onSurface}
        />
      </TouchableOpacity>

      {/* Text input */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={t('ai.input.placeholder')}
        placeholderTextColor={m3.colorScheme.onSurfaceVariant}
        multiline
        style={[
          styles.textInput,
          {
            backgroundColor: inputBg ?? m3.colorScheme.surface,
            color: m3.colorScheme.onSurface,
            borderColor: m3.colorScheme.outlineVariant,
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
        accessibilityLabel={t('ai.input.placeholder')}
      />

      {/* Send / Mic button */}
      {isLoading ? (
        <View style={styles.iconButton} accessibilityLabel={t('ai.chat.thinking')}>
          <ActivityIndicator size="small" color={m3.colorScheme.primary} />
        </View>
      ) : hasText ? (
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: m3.colorScheme.primary }]}
          onPress={onSend}
          disabled={!canSend}
          accessibilityLabel={t('assistant.chat.sendA11y')}
          accessibilityRole="button"
        >
          <SymbolIcon name="paperplane.fill" size={18} color={m3.colorScheme.onPrimary} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onVoicePress}
          disabled={disabled}
          accessibilityLabel={t('ai.chat.openVoiceModeA11y')}
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
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
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
    borderRadius: 20,
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
