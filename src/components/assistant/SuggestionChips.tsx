/**
 * SuggestionChips Component
 * Horizontal scroll of suggestion chips.
 * Tapping a chip sends that suggestion as a message.
 * M3 themed — no hardcoded colors.
 */

import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeTokens } from '@/styles/use-theme';
import { spacing } from '@/styles/theme';

interface SuggestionChipsProps {
  suggestions: readonly string[];
  onSendSuggestion: (text: string) => void;
  disabled?: boolean;
}

export function SuggestionChips({
  suggestions,
  onSendSuggestion,
  disabled = false,
}: SuggestionChipsProps) {
  const { m3 } = useThemeTokens();
  const { t } = useTranslation();

  if (suggestions.length === 0) return null;

  // Resolve i18n keys if the suggestion starts with a known prefix
  const resolveText = (suggestion: string): string => {
    if (suggestion.startsWith('ai.') || suggestion.startsWith('assistant.')) {
      return t(suggestion);
    }
    return suggestion;
  };

  return (
    <View style={[styles.container, { borderTopColor: m3.colorScheme.outline }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {suggestions.map((suggestion, index) => {
          const text = resolveText(suggestion);
          return (
            <TouchableOpacity
              key={`${suggestion}-${index}`}
              style={[
                styles.chip,
                {
                  // Cellar Ledger: pill shape with mist-1 bg and 1px stone-3 border
                  // Use surfaceContainerLow which maps to mist-1 (surface[100])
                  backgroundColor: m3.surface.surfaceContainerLow,
                  borderColor: m3.colorScheme.outline,
                  borderRadius: 999,
                },
                disabled && styles.chipDisabled,
              ]}
              onPress={() => !disabled && onSendSuggestion(text)}
              disabled={disabled}
              accessibilityLabel={t('assistant.chat.suggestionChipA11y', { text })}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    // Cellar Ledger: 13px/500 text with dark ink color
                    color: disabled ? m3.colorScheme.onSurfaceVariant : m3.colorScheme.onSurface,
                    fontSize: 13,
                    fontWeight: '500',
                  },
                ]}
                numberOfLines={1}
              >
                {text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  chip: {
    paddingHorizontal: spacing[4],
    paddingVertical: 7, // ~14px - matches wireframe padding
    borderRadius: 999, // Pill shape - set inline but also here for base
    borderWidth: 1, // 1px border - stone-3
    maxWidth: 220,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
