/**
 * MessageActions Component
 * Renders action buttons below an AI message bubble.
 * M3 themed — no hardcoded colors.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
// import { useTranslation } from 'react-i18next';
import { useM3 } from '@/styles/use-theme';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import type { AssistantMessageAction } from '@/types/ai';

interface MessageActionsProps {
  actions: AssistantMessageAction[];
  onActionPress?: (action: AssistantMessageAction) => void;
  disabled?: boolean;
}

export function MessageActions({ actions, onActionPress, disabled = false }: MessageActionsProps) {
  const m3 = useM3();
  // const { t } = useTranslation();

  if (!actions || actions.length === 0) return null;

  return (
    <View style={styles.container}>
      {actions.map((action) => (
        <TouchableOpacity
          key={`action-${action.label}`}
          style={[
            styles.button,
            {
              borderColor: m3.colorScheme.outline,
            },
            disabled && styles.buttonDisabled,
          ]}
          onPress={() => onActionPress?.(action)}
          disabled={disabled}
          accessibilityLabel={action.label}
          accessibilityRole="button"
        >
          {action.icon && (
            <SymbolIcon
              name={action.icon}
              size={12}
              color={disabled ? m3.colorScheme.onSurfaceVariant : m3.colorScheme.onSurface}
            />
          )}
          <Text
            style={[
              styles.buttonText,
              {
                color: disabled ? m3.colorScheme.onSurfaceVariant : m3.colorScheme.onSurface,
              },
            ]}
          >
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1],
    marginTop: spacing[1],
    paddingLeft: 36, // align with bubble after avatar
  },
  button: {
    height: 30,
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: 'transparent',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
});
