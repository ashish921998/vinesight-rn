/**
 * StatsCard Component
 * Displays a single stat with icon, value, and title
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { spacing, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3 } from '@/styles/use-theme';

interface StatsCardProps {
  title: string;
  value: string;
  icon: string;
  color?: string;
  iconColor?: string;
  subtitle?: string;
  onPress?: () => void;
  isLoading?: boolean;
}

export function StatsCard({
  title,
  value,
  icon,
  color,
  iconColor,
  subtitle,
  onPress,
  isLoading = false,
}: StatsCardProps) {
  const m3 = useM3();
  const resolvedColor = color ?? m3.colorScheme.primary;
  const finalColor = iconColor || resolvedColor;
  const a11yValue = isLoading ? 'Loading' : value;

  const containerStyle: ViewStyle = {
    borderRadius: m3.shape.cornerMedium,
    padding: spacing[4],
    backgroundColor: m3.surface.surfaceContainerLow,
    borderWidth: 1,
    borderColor: m3.colorScheme.outlineVariant,
    overflow: 'hidden',
  };

  const headerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const valueTextStyle: TextStyle = {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: m3.colorScheme.onSurface,
  };

  const titleTextStyle: TextStyle = {
    ...m3.typography.labelSmall,
    marginTop: spacing[3],
    color: m3.colorScheme.onSurfaceVariant,
  };

  const subtitleTextStyle: TextStyle = {
    ...m3.typography.labelSmall,
    marginTop: spacing[0],
    color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.8),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${a11yValue}${subtitle ? `, ${subtitle}` : ''}`}
      >
        {({ pressed }) => (
          <View style={containerStyle}>
            <View style={headerStyle}>
              <UiSymbol name={icon} size={20} color={finalColor} weight="semibold" />
              {isLoading ? (
                <ActivityIndicator size="small" color={finalColor} />
              ) : (
                <Text style={valueTextStyle}>{value}</Text>
              )}
            </View>
            <Text style={titleTextStyle} numberOfLines={1} ellipsizeMode="tail">
              {title}
            </Text>
            {subtitle && (
              <Text style={subtitleTextStyle} numberOfLines={1} ellipsizeMode="tail">
                {subtitle}
              </Text>
            )}
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: pressed
                    ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                    : 'transparent',
                },
              ]}
            />
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <View style={containerStyle}>
      <View style={headerStyle}>
        <UiSymbol name={icon} size={20} color={finalColor} weight="semibold" />
        {isLoading ? (
          <ActivityIndicator size="small" color={finalColor} />
        ) : (
          <Text style={valueTextStyle}>{value}</Text>
        )}
      </View>
      <Text style={titleTextStyle} numberOfLines={1} ellipsizeMode="tail">
        {title}
      </Text>
      {subtitle && (
        <Text style={subtitleTextStyle} numberOfLines={1} ellipsizeMode="tail">
          {subtitle}
        </Text>
      )}
    </View>
  );
}
