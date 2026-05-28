import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3, useThemeColors } from '@/styles/use-theme';

interface ToolItem {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  color: string;
  route: Href;
  categoryKey?: string;
}

const ToolCard: React.FC<{ item: ToolItem; onPress: () => void }> = ({ item, onPress }) => {
  const { t } = useTranslation();
  const m3 = useM3();
  const colors = useThemeColors();
  const title = t(item.titleKey);
  const description = t(item.descriptionKey);
  const category = item.categoryKey ? t(item.categoryKey) : '';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      style={{
        backgroundColor: colors.surface[100],
        borderRadius: borderRadius.md,
        padding: spacing[4],
        flexDirection: 'column',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: colors.surface[300],
        overflow: 'hidden',
      }}
    >
      {({ pressed }) => (
        <>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: borderRadius.lg,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colorWithOpacity(item.color, 0.12),
              marginBottom: spacing[3],
            }}
          >
            <SymbolIcon name={item.icon} size={20} color={item.color} />
          </View>
          <Text
            style={{
              color: m3.colorScheme.onSurface,
              fontSize: 15,
              fontWeight: fontWeight.semibold,
              marginBottom: 2,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={{
              color: colors.surface[500],
              fontSize: 13,
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            {description}
          </Text>
          {category ? (
            <Text
              style={{
                color: colors.surface[500],
                fontSize: 10,
                fontWeight: fontWeight.semibold,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginTop: spacing[2],
              }}
            >
              {category}
            </Text>
          ) : null}
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
};

export default function ToolsScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
  const { t } = useTranslation();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom + spacing[8], spacing[12]);
  const calculators = useMemo(
    (): ToolItem[] => [
      {
        id: 'mad',
        titleKey: 'tools.items.madCalculator',
        descriptionKey: 'tools.descriptions.madCalculator',
        icon: 'gauge',
        color: colors.irrigation[500],
        route: '/calculator/mad',
        categoryKey: 'tools.categories.irrigation',
      },
      {
        id: 'system-discharge',
        titleKey: 'tools.items.systemDischarge',
        descriptionKey: 'tools.descriptions.systemDischarge',
        icon: 'drop.fill',
        color: colors.irrigation[500],
        route: '/calculator/system-discharge',
        categoryKey: 'tools.categories.irrigation',
      },
      {
        id: 'lai',
        titleKey: 'tools.items.laiCalculator',
        descriptionKey: 'tools.descriptions.laiCalculator',
        icon: 'leaf.fill',
        color: colors.success,
        route: '/calculator/lai',
        categoryKey: 'tools.categories.crop',
      },
      {
        id: 'nutrients',
        titleKey: 'tools.items.nutrientCalculator',
        descriptionKey: 'tools.descriptions.nutrientCalculator',
        icon: 'flask.fill',
        color: colors.fertigation[500],
        route: '/calculator/nutrients',
        categoryKey: 'tools.categories.fertility',
      },
      {
        id: 'tank-mix',
        titleKey: 'tools.items.tankMixCalculator',
        descriptionKey: 'tools.descriptions.tankMixCalculator',
        icon: 'spraycan.fill',
        color: colors.spray[500],
        route: '/calculator/tank-mix' as Href,
        categoryKey: 'tools.categories.spray',
      },
      {
        id: 'safe-to-spray',
        titleKey: 'tools.items.safeToSprayChecker',
        descriptionKey: 'tools.descriptions.safeToSprayChecker',
        icon: 'checkmark.shield.fill',
        color: colors.warning,
        route: '/spray-safe-checker' as Href,
        categoryKey: 'tools.categories.spray',
      },
      {
        id: 'weather',
        titleKey: 'tools.items.weatherIrrigation',
        descriptionKey: 'tools.descriptions.weatherIrrigation',
        icon: 'sun.max.fill',
        color: colors.warning,
        route: '/weather',
        categoryKey: 'tools.categories.weather',
      },
      {
        id: 'spray-catalog',
        titleKey: 'tools.items.sprayCatalog',
        descriptionKey: 'tools.descriptions.sprayCatalog',
        icon: 'list.bullet.rectangle.portrait.fill',
        color: colors.observation[500],
        route: '/spray-catalog' as Href,
        categoryKey: 'tools.categories.spray',
      },
    ],
    [colors],
  );
  const developerTools = useMemo(
    (): ToolItem[] =>
      __DEV__
        ? [
            {
              id: 'widget-showcase',
              titleKey: 'developerTools.widgetShowcase.title',
              descriptionKey: 'developerTools.widgetShowcase.description',
              icon: 'square.grid.2x2.fill',
              color: colors.primary[500],
              route: '/widgets-showcase',
            },
          ]
        : [],
    [colors],
  );

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: spacing[4],
        paddingTop: insets.top + spacing[3],
        paddingBottom: bottomPadding,
      }}
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
            color: colors.surface[400],
            fontSize: fontSize.xs,
            fontWeight: fontWeight.semibold,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: spacing[3],
          }}
        >
          {t('tools.sections.calculators')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
          {calculators.map((calc) => (
            <View key={calc.id} style={{ width: '47%' }}>
              <ToolCard item={calc} onPress={() => router.push(calc.route)} />
            </View>
          ))}
        </View>
      </View>

      {developerTools.length > 0 ? (
        <View>
          <Text
            style={{
              color: colors.surface[400],
              fontSize: fontSize.xs,
              fontWeight: fontWeight.semibold,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: spacing[3],
            }}
          >
            {t('developerTools.section')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
            {developerTools.map((tool) => (
              <View key={tool.id} style={{ width: '47%' }}>
                <ToolCard item={tool} onPress={() => router.push(tool.route)} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
