/**
 * StatsCard Component
 * Displays a single stat with icon, value, and title
 * Cellar Ledger design: metric tile style with tinted icon circle
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
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3, useThemeColors } from '@/styles/use-theme';

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
  const colors = useThemeColors();
  const resolvedColor = color ?? m3.colorScheme.primary;
  const finalColor = iconColor || resolvedColor;
  const a11yValue = isLoading
    ? 'Loading'
    : `${value}${valueSuffix ? ` ${valueSuffix}` : ''}${valueUnit ? ` ${valueUnit}` : ''}`;

  // Cellar Ledger: mist-1 card bg, stone-3 border, 16px radius, no shadows
  const containerStyle: ViewStyle = {
    borderRadius: borderRadius.lg, // 16px
    padding: spacing[4],
    backgroundColor: colors.surface[100], // mist-1
    borderWidth: 1,
    borderColor: colors.surface[300], // stone-3
    overflow: 'hidden',
  };

  const headerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  // Cellar Ledger: tinted icon circle 36x36, borderRadius 10, 12% opacity category bg
  const iconContainerStyle: ViewStyle = {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colorWithOpacity(finalColor, 0.12),
  };

  // Cellar Ledger: large value 24px/700
  const valueTextStyle: TextStyle = {
    fontSize: fontSize['2xl'], // 24px
    fontWeight: fontWeight.bold, // 700
    color: colors.surface[900], // ink
  };

  const valueRowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'baseline',
  };

  const valueContainerStyle: ViewStyle = {
    alignItems: 'flex-end',
  };

  const valueUnitTextStyle: TextStyle = {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colorWithOpacity(colors.surface[500], 0.8), // bark
  };

  const valueSuffixTextStyle: TextStyle = {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colorWithOpacity(colors.surface[500], 0.8), // bark
    marginLeft: spacing[1],
  };

  // Cellar Ledger: uppercase label (11px/600, letterSpacing 0.8)
  const titleTextStyle: TextStyle = {
    fontSize: 11,
    fontWeight: fontWeight.semibold, // 600
    marginTop: spacing[3],
    color: colors.surface[500], // bark
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  };

  const subtitleTextStyle: TextStyle = {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginTop: spacing[1],
    color: colorWithOpacity(colors.surface[500], 0.8), // bark
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
              <View style={iconContainerStyle}>
                <UiSymbol name={icon} size={20} color={finalColor} weight="semibold" />
              </View>
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
                    ? colorWithOpacity(colors.surface[900], 0.12)
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
        <View style={iconContainerStyle}>
          <UiSymbol name={icon} size={20} color={finalColor} weight="semibold" />
        </View>
        {valueContent}
      </View>
      <Text style={titleTextStyle} numberOfLines={1} ellipsizeMode="tail">
        {title}
      </Text>
      {subtitle && <Text style={subtitleTextStyle}>{subtitle}</Text>}
    </View>
  );
}
