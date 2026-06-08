/**
 * EmptyState — shared interaction-state component for empty/no-results screens.
 *
 * Warm Cellar Ledger styling: a centered column with an icon inside a rounded
 * surface circle, a title, an optional muted description, and an optional
 * primary action button (rendered only when both actionLabel and onAction are
 * provided). All sizing/colors come from design tokens — no raw literals.
 */

import React from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { Button } from '@/components/ui/button';
import { componentRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3 } from '@/styles/use-theme';

const ICON_CIRCLE_SIZE = 96;
const ICON_SIZE = 48;

interface EmptyStateProps {
  /** SF-Symbol-style icon name rendered inside the surface circle. */
  icon: string;
  /** Primary heading. */
  title: string;
  /** Optional muted supporting line. */
  description?: string;
  /** Label for the primary action button. */
  actionLabel?: string;
  /** Press handler for the primary action button. */
  onAction?: () => void;
  /**
   * Custom action node rendered in place of the default Button — use when the
   * action needs extra wrapping (e.g. a guided-tour anchor). Takes precedence
   * over actionLabel/onAction.
   */
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  action,
}: EmptyStateProps) {
  const m3 = useM3();
  const showAction = Boolean(actionLabel) && Boolean(onAction);

  return (
    <View style={containerStyle}>
      <View
        style={{
          width: ICON_CIRCLE_SIZE,
          height: ICON_CIRCLE_SIZE,
          borderRadius: componentRadius.avatar,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing[6],
          backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
        }}
      >
        <SymbolIcon name={icon} size={ICON_SIZE} color={m3.colorScheme.primary} />
      </View>
      <Text
        style={{
          fontSize: fontSize.xl,
          fontWeight: fontWeight.semibold,
          textAlign: 'center',
          color: m3.colorScheme.onSurface,
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{
            fontSize: fontSize.base,
            textAlign: 'center',
            marginTop: spacing[2],
            color: m3.colorScheme.onSurfaceVariant,
          }}
        >
          {description}
        </Text>
      ) : null}
      {action ? (
        <View style={{ marginTop: spacing[6], alignSelf: 'center' }}>{action}</View>
      ) : showAction ? (
        <View style={{ marginTop: spacing[6], alignSelf: 'center' }}>
          <Button
            title={actionLabel as string}
            onPress={onAction}
            fullWidth={false}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          />
        </View>
      ) : null}
    </View>
  );
}

const containerStyle: ViewStyle = {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  padding: spacing[8],
};
