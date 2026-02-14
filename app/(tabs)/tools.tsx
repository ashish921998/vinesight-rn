import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { spacing, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3, useThemeColors } from '@/styles/use-theme';

export default function ToolsScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
  const { t } = useTranslation();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom + spacing[8], spacing[12]);
  const calculators = useMemo(
    () => [
      {
        id: 'weather',
        titleKey: 'tools.items.weatherIrrigation',
        descriptionKey: 'tools.descriptions.weatherIrrigation',
        icon: 'sun.max.fill' as const,
        color: colors.warning,
        route: '/weather' as Href,
      },
      {
        id: 'mad',
        titleKey: 'tools.items.madCalculator',
        descriptionKey: 'tools.descriptions.madCalculator',
        icon: 'gauge' as const,
        color: colors.spray[500],
        route: '/calculator/mad' as Href,
      },
      {
        id: 'system-discharge',
        titleKey: 'tools.items.systemDischarge',
        descriptionKey: 'tools.descriptions.systemDischarge',
        icon: 'drop.fill' as const,
        color: colors.primary[500],
        route: '/calculator/system-discharge' as Href,
      },
      {
        id: 'lai',
        titleKey: 'tools.items.laiCalculator',
        descriptionKey: 'tools.descriptions.laiCalculator',
        icon: 'leaf.fill' as const,
        color: colors.success,
        route: '/calculator/lai' as Href,
      },
      {
        id: 'nutrients',
        titleKey: 'tools.items.nutrientCalculator',
        descriptionKey: 'tools.descriptions.nutrientCalculator',
        icon: 'flask.fill' as const,
        color: colors.observation[500],
        route: '/calculator/nutrients' as Href,
      },
    ],
    [colors],
  );
  const developerTools = useMemo(
    () =>
      __DEV__
        ? [
            {
              id: 'widget-showcase',
              title: 'Widget Showcase',
              description: 'Preview widgets on iOS, Android, and Web from one screen.',
              icon: 'square.grid.2x2.fill' as const,
              color: colors.primary[500],
              route: '/widgets-showcase' as Href,
            },
          ]
        : [],
    [colors],
  );

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing[4], paddingBottom: bottomPadding }}
      style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}
    >
      {/* Header */}
      <View style={{ marginBottom: spacing[4] }}>
        <Text style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.bodyMedium }}>
          {t('tools.subtitle')}
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
          {t('tools.sections.calculators')}
        </Text>
        {calculators.map((calc) => {
          const title = t(calc.titleKey);
          const description = t(calc.descriptionKey);

          return (
            <Pressable
              key={calc.id}
              onPress={() => router.push(calc.route)}
              accessibilityRole="button"
              accessibilityLabel={`${title}. ${description}`}
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
                      {title}
                    </Text>
                    <Text
                      style={{
                        color: m3.colorScheme.onSurfaceVariant,
                        ...m3.typography.labelSmall,
                        marginTop: 2,
                      }}
                      numberOfLines={2}
                    >
                      {description}
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
          );
        })}
      </View>

      {developerTools.length > 0 ? (
        <View>
          <Text
            style={{
              color: m3.colorScheme.onSurfaceVariant,
              ...m3.typography.labelSmall,
              fontWeight: fontWeight.bold,
              letterSpacing: 1,
              marginBottom: spacing[3],
            }}
          >
            Developer
          </Text>
          {developerTools.map((tool) => (
            <Pressable
              key={tool.id}
              onPress={() => router.push(tool.route)}
              accessibilityRole="button"
              accessibilityLabel={`${tool.title}. ${tool.description}`}
              style={{
                backgroundColor: m3.surface.surfaceContainerLow,
                borderRadius: m3.shape.cornerLarge,
                padding: spacing[4],
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
                      backgroundColor: colorWithOpacity(tool.color, 0.12),
                    }}
                  >
                    <SymbolIcon name={tool.icon} size={22} color={tool.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing[3] }}>
                    <Text
                      style={{
                        color: m3.colorScheme.onSurface,
                        fontSize: fontSize.base,
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      {tool.title}
                    </Text>
                    <Text
                      style={{
                        color: m3.colorScheme.onSurfaceVariant,
                        ...m3.typography.labelSmall,
                        marginTop: 2,
                      }}
                      numberOfLines={2}
                    >
                      {tool.description}
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
      ) : null}
    </ScrollView>
  );
}
