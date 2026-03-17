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
  valueUnit?: string;
  valueSuffix?: string;
  valueUnitStyle?: TextStyle;
  valueSuffixStyle?: TextStyle;
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
  valueUnit,
  valueSuffix,
  valueUnitStyle,
  valueSuffixStyle,
  onPress,
  isLoading = false,
}: StatsCardProps) {
  const m3 = useM3();
  const resolvedColor = color ?? m3.colorScheme.primary;
  const finalColor = iconColor || resolvedColor;
  const a11yValue = isLoading
    ? 'Loading'
    : `${value}${valueSuffix ? ` ${valueSuffix}` : ''}${valueUnit ? ` ${valueUnit}` : ''}`;

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

  const valueRowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'baseline',
  };

  const valueContainerStyle: ViewStyle = {
    alignItems: 'flex-end',
  };

  const valueUnitTextStyle: TextStyle = {
    ...m3.typography.labelSmall,
    color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.8),
  };

  const valueSuffixTextStyle: TextStyle = {
    ...m3.typography.labelSmall,
    color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.8),
    marginLeft: spacing[1],
  };

  const titleTextStyle: TextStyle = {
    ...m3.typography.labelSmall,
    marginTop: spacing[3],
    color: m3.colorScheme.onSurfaceVariant,
  };

  const subtitleTextStyle: TextStyle = {
    ...m3.typography.labelSmall,
    marginTop: spacing[1],
    color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.8),
    lineHeight: fontSize.sm * 1.3,
  };

  const valueContent = isLoading ? (
    <ActivityIndicator size="small" color={finalColor} />
  ) : (
    <View style={valueContainerStyle}>
      <View style={valueRowStyle}>
        <Text style={valueTextStyle}>{value}</Text>
        {valueSuffix ? (
          <Text style={[valueSuffixTextStyle, valueSuffixStyle]} numberOfLines={1}>
            {valueSuffix}
          </Text>
        ) : null}
      </View>
      {valueUnit ? (
        <Text style={[valueUnitTextStyle, valueUnitStyle]} numberOfLines={1}>
          {valueUnit}
        </Text>
      ) : null}
    </View>
  );

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
              {valueContent}
            </View>
            <Text style={titleTextStyle} numberOfLines={1} ellipsizeMode="tail">
              {title}
            </Text>
            {subtitle && <Text style={subtitleTextStyle}>{subtitle}</Text>}
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
        {valueContent}
      </View>
      <Text style={titleTextStyle} numberOfLines={1} ellipsizeMode="tail">
        {title}
      </Text>
      {subtitle && <Text style={subtitleTextStyle}>{subtitle}</Text>}
    </View>
  );
}
