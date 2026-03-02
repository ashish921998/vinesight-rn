import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { spacing, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3, useThemeColors } from '@/styles/use-theme';

interface ToolItem {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  color: string;
  route: Href;
}

const ToolListItem: React.FC<{ item: ToolItem; onPress: () => void }> = ({ item, onPress }) => {
  const { t } = useTranslation();
  const m3 = useM3();
  const title = t(item.titleKey);
  const description = t(item.descriptionKey);

  return (
    <Pressable
      onPress={onPress}
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
              backgroundColor: colorWithOpacity(item.color, 0.12),
            }}
          >
            <SymbolIcon name={item.icon} size={22} color={item.color} />
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
        id: 'weather',
        titleKey: 'tools.items.weatherIrrigation',
        descriptionKey: 'tools.descriptions.weatherIrrigation',
        icon: 'sun.max.fill',
        color: colors.warning,
        route: '/weather',
      },
      {
        id: 'mad',
        titleKey: 'tools.items.madCalculator',
        descriptionKey: 'tools.descriptions.madCalculator',
        icon: 'gauge',
        color: colors.spray[500],
        route: '/calculator/mad',
      },
      {
        id: 'system-discharge',
        titleKey: 'tools.items.systemDischarge',
        descriptionKey: 'tools.descriptions.systemDischarge',
        icon: 'drop.fill',
        color: colors.primary[500],
        route: '/calculator/system-discharge',
      },
      {
        id: 'lai',
        titleKey: 'tools.items.laiCalculator',
        descriptionKey: 'tools.descriptions.laiCalculator',
        icon: 'leaf.fill',
        color: colors.success,
        route: '/calculator/lai',
      },
      {
        id: 'nutrients',
        titleKey: 'tools.items.nutrientCalculator',
        descriptionKey: 'tools.descriptions.nutrientCalculator',
        icon: 'flask.fill',
        color: colors.observation[500],
        route: '/calculator/nutrients',
      },
      {
        id: 'tank-mix',
        titleKey: 'tools.items.tankMixCalculator',
        descriptionKey: 'tools.descriptions.tankMixCalculator',
        icon: 'spraycan.fill',
        color: colors.spray[500],
        route: '/calculator/tank-mix' as Href,
      },
      {
        id: 'safe-to-spray',
        titleKey: 'tools.items.safeToSprayChecker',
        descriptionKey: 'tools.descriptions.safeToSprayChecker',
        icon: 'checkmark.shield.fill',
        color: colors.warning,
        route: '/spray-safe-checker' as Href,
      },
      {
        id: 'spray-catalog',
        titleKey: 'tools.items.sprayCatalog',
        descriptionKey: 'tools.descriptions.sprayCatalog',
        icon: 'list.bullet.rectangle.portrait.fill',
        color: colors.observation[500],
        route: '/spray-catalog' as Href,
      },
      {
        id: 'spray-cost',
        titleKey: 'tools.items.sprayCostCalculator',
        descriptionKey: 'tools.descriptions.sprayCostCalculator',
        icon: 'indianrupeesign.circle.fill',
        color: colors.primary[500],
        route: '/calculator/spray-cost' as Href,
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
        {calculators.map((calc) => (
          <ToolListItem key={calc.id} item={calc} onPress={() => router.push(calc.route)} />
        ))}
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
            {t('developerTools.section')}
          </Text>
          {developerTools.map((tool) => (
            <ToolListItem key={tool.id} item={tool} onPress={() => router.push(tool.route)} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
