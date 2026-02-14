import React from 'react';
import { Redirect } from 'expo-router';
import { ScrollView, View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TestWidget } from '@widgets/foundation/TestWidget';
import { WidgetTemplate } from '@widgets/templates/WidgetTemplate';
import { WeatherWidget } from '@widgets/dashboard/WeatherWidget';
import { VineyardHealthWidget } from '@widgets/dashboard/VineyardHealthWidget';
import { TaskSummaryWidget } from '@widgets/dashboard/TaskSummaryWidget';
import { QuickStatsWidget } from '@widgets/dashboard/QuickStatsWidget';
import { spacing } from '@/styles/theme';
import { useThemeTokens } from '@/styles/use-theme';

export default function WidgetsShowcaseScreen() {
  const insets = useSafeAreaInsets();
  const { m3 } = useThemeTokens();

  if (!__DEV__) {
    return <Redirect href="/(tabs)/tools" />;
  }

  return (
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
        <WeatherWidget testID="showcase-weather" />
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
              TestWidget
            </Text>
            <View style={{ marginTop: spacing[2] }}>
              <TestWidget testID="showcase-test-widget" />
            </View>
          </View>
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
              WidgetTemplate
            </Text>
            <View style={{ marginTop: spacing[2] }}>
              <WidgetTemplate />
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
