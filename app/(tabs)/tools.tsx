import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { colors, m3, spacing, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';

// Calculator data (Irrigation Planning section)
const calculators = [
  {
    id: 'weather',
    title: 'Weather & Irrigation',
    description: 'Farm weather data, forecasts & irrigation needs',
    icon: 'sun.max.fill' as const,
    color: colors.warning,
    route: '/weather' as Href,
  },
  {
    id: 'mad',
    title: 'MAD Calculator',
    description: 'Maximum allowable deficit & tank requirements',
    icon: 'gauge' as const,
    color: colors.spray[500],
    route: '/calculator/mad' as Href,
  },
  {
    id: 'system-discharge',
    title: 'System Discharge',
    description: 'Irrigation system design & discharge rates',
    icon: 'drop.fill' as const,
    color: colors.primary[500],
    route: '/calculator/system-discharge' as Href,
  },
  {
    id: 'lai',
    title: 'LAI Calculator',
    description: 'Leaf area index & canopy management',
    icon: 'leaf.fill' as const,
    color: colors.success,
    route: '/calculator/lai' as Href,
  },
  {
    id: 'nutrients',
    title: 'Nutrient Calculator',
    description: 'Fertilizer requirements & application planning',
    icon: 'flask.fill' as const,
    color: colors.observation[500],
    route: '/calculator/nutrients' as Href,
  },
];

export default function ToolsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom + spacing[8], spacing[12]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing[4], paddingBottom: bottomPadding }}
      style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}
    >
      {/* Header */}
      <View style={{ marginBottom: spacing[4] }}>
        <Text style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.bodyMedium }}>
          Scientific calculators for precision vineyard management
        </Text>
      </View>

      {/* Calculators Section */}
      <View style={{ marginBottom: spacing[6] }}>
        <Text
          style={{
            color: m3.colorScheme.onSurfaceVariant,
            ...m3.typography.labelSmall,
            fontWeight: fontWeight.bold,
            letterSpacing: 1,
            marginBottom: spacing[3],
          }}
        >
          CALCULATORS
        </Text>
        {calculators.map((calc) => (
          <Pressable
            key={calc.id}
            onPress={() => router.push(calc.route)}
            accessibilityRole="button"
            accessibilityLabel={`${calc.title}. ${calc.description}`}
            style={{
              backgroundColor: m3.surface.surfaceContainerLow,
              borderRadius: m3.shape.cornerLarge,
              padding: spacing[4],
              marginBottom: spacing[3],
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
              overflow: 'hidden',
            }}
          >
            {({ pressed }) => (
              <>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: m3.shape.cornerMedium,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colorWithOpacity(calc.color, 0.12),
                  }}
                >
                  <SymbolIcon name={calc.icon} size={22} color={calc.color} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing[3] }}>
                  <Text
                    style={{
                      color: m3.colorScheme.onSurface,
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    {calc.title}
                  </Text>
                  <Text
                    style={{
                      color: m3.colorScheme.onSurfaceVariant,
                      ...m3.typography.labelSmall,
                      marginTop: 2,
                    }}
                    numberOfLines={2}
                  >
                    {calc.description}
                  </Text>
                </View>
                <SymbolIcon
                  name="chevron.right"
                  size={20}
                  color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
                />
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
              </>
            )}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
