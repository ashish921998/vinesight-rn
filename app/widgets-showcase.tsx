import React from 'react';
import { Redirect, Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View, Text, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TestWidget } from '@widgets/foundation/TestWidget';
import { WidgetTemplate } from '@widgets/templates/WidgetTemplate';
import { WeatherWidget } from '@widgets/dashboard/WeatherWidget';
import { VineyardHealthWidget } from '@widgets/dashboard/VineyardHealthWidget';
import { TaskSummaryWidget } from '@widgets/dashboard/TaskSummaryWidget';
import { QuickStatsWidget } from '@widgets/dashboard/QuickStatsWidget';
import { Symbol } from '@/components/ui/symbol';
import { fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

const SHOWCASE_WEATHER = {
  temperature: 28,
  conditionKey: 'widgets.weather.conditions.partlyCloudy',
  humidity: 65,
  wind: 12,
  icon: 'partly-sunny' as const,
};

const SHOWCASE_FORECAST = [
  {
    labelKey: 'widgets.weather.days.today',
    high: 28,
    low: 19,
    icon: 'sunny' as const,
    conditionKey: 'widgets.weather.conditions.sunny',
  },
  {
    labelKey: 'widgets.weather.days.tomorrow',
    high: 30,
    low: 21,
    icon: 'cloudy' as const,
    conditionKey: 'widgets.weather.conditions.cloudy',
  },
  {
    labelKey: 'widgets.weather.days.dayAfter',
    high: 26,
    low: 18,
    icon: 'rainy' as const,
    conditionKey: 'widgets.weather.conditions.rainy',
  },
];

const ScaffoldingCard: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => {
  const m3 = useM3();
  return (
    <View
      style={{
        backgroundColor: m3.surface.surfaceContainerLow,
        borderRadius: m3.shape.cornerLarge,
        borderWidth: 1,
        borderColor: m3.colorScheme.outlineVariant,
        padding: spacing[4],
      }}
    >
      <Text style={{ ...m3.typography.labelLarge, color: m3.colorScheme.onSurfaceVariant }}>
        {title}
      </Text>
      <View style={{ marginTop: spacing[2] }}>{children}</View>
    </View>
  );
};

export default function WidgetsShowcaseScreen() {
  const insets = useSafeAreaInsets();
  const m3 = useM3();
  const router = useRouter();

  if (!__DEV__) {
    return <Redirect href="/(tabs)/tools" />;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Custom JS header (avoids iOS 26 native bar-button glass capsule) */}
      <View style={{ paddingTop: insets.top, backgroundColor: m3.colorScheme.surface }}>
        <View
          style={{
            height: 56,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing[2],
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.xl,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              backgroundColor: 'transparent',
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            {({ pressed }) => (
              <View
                style={{
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Symbol name="chevron.left" size={22} color={m3.colorScheme.onSurface} />
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      borderRadius: radius.xl,
                      backgroundColor: pressed
                        ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                        : 'transparent',
                    },
                  ]}
                />
              </View>
            )}
          </Pressable>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              numberOfLines={1}
              style={{
                color: m3.colorScheme.onSurface,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
              }}
            >
              Widget Showcase
            </Text>
          </View>

          <View style={{ width: 44, height: 44 }} />
        </View>
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}
        contentContainerStyle={{
          paddingHorizontal: spacing[4],
          paddingTop: spacing[4],
          paddingBottom: Math.max(insets.bottom + spacing[10], spacing[12]),
        }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={{ marginBottom: spacing[4] }}>
          <Text style={{ ...m3.typography.headlineSmall, color: m3.colorScheme.onSurface }}>
            Widget Showcase
          </Text>
          <Text
            style={{
              ...m3.typography.bodyMedium,
              color: m3.colorScheme.onSurfaceVariant,
              marginTop: spacing[1],
            }}
          >
            Validate shared widget rendering on {Platform.OS}.
          </Text>
        </View>

        <View style={{ gap: spacing[3] }}>
          <WeatherWidget
            testID="showcase-weather"
            currentWeather={SHOWCASE_WEATHER}
            forecast={SHOWCASE_FORECAST}
          />
          <VineyardHealthWidget testID="showcase-health" />
          <TaskSummaryWidget testID="showcase-tasks" />
          <QuickStatsWidget testID="showcase-stats" />
        </View>

        <View style={{ marginTop: spacing[6] }}>
          <Text
            style={{
              ...m3.typography.titleMedium,
              color: m3.colorScheme.onSurfaceVariant,
              marginBottom: spacing[3],
            }}
          >
            Scaffolding
          </Text>
          <View style={{ gap: spacing[3] }}>
            <ScaffoldingCard title="TestWidget">
              <TestWidget testID="showcase-test-widget" />
            </ScaffoldingCard>
            <ScaffoldingCard title="WidgetTemplate">
              <WidgetTemplate />
            </ScaffoldingCard>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
