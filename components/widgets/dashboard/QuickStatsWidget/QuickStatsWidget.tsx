import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseWidgetProps, TrendDirection, LoadingState } from '@widgets/shared/types';
import { useM3 } from '@/styles/use-theme';
import { spacing, borderRadius, shadows, fontSize, fontWeight, colors } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';

interface StatItem {
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
  value: string;
  trend: TrendDirection;
  trendValue: string;
}

const STATS: StatItem[] = [
  {
    icon: 'leaf-outline',
    labelKey: 'widgets.quickStats.stats.activeFarms',
    value: '4',
    trend: 'up',
    trendValue: '+1',
  },
  {
    icon: 'people-outline',
    labelKey: 'widgets.quickStats.stats.workersToday',
    value: '12',
    trend: 'neutral',
    trendValue: '0',
  },
  {
    icon: 'water-outline',
    labelKey: 'widgets.quickStats.stats.waterReserve',
    value: '68%',
    trend: 'down',
    trendValue: '-5%',
  },
  {
    icon: 'cash-outline',
    labelKey: 'widgets.quickStats.stats.seasonExpenses',
    value: '₹2.4L',
    trend: 'up',
    trendValue: '+12%',
  },
];

const getTrendColor = (trend: TrendDirection, onSurfaceVariant: string) => {
  if (trend === 'up') return colors.success;
  if (trend === 'down') return colors.error;
  return onSurfaceVariant;
};

const getTrendIcon = (trend: TrendDirection): keyof typeof Ionicons.glyphMap => {
  if (trend === 'up') return 'arrow-up';
  if (trend === 'down') return 'arrow-down';
  return 'remove';
};

export interface QuickStatsWidgetProps extends BaseWidgetProps {
  stats?: StatItem[];
  loadingState?: LoadingState;
  onRetry?: () => void;
}

export const QuickStatsWidget: React.FC<QuickStatsWidgetProps> = ({
  testID,
  accessibilityLabel,
  style,
  stats = STATS,
  loadingState = 'idle',
  onRetry,
}) => {
  const { t } = useTranslation();
  const m3 = useM3();

  if (loadingState === 'loading') {
    return (
      <View
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? 'Quick stats loading'}
        style={[
          styles.container,
          styles.centered,
          {
            backgroundColor: m3.surface.surfaceContainerLow,
            borderColor: m3.colorScheme.outlineVariant,
          },
          style,
        ]}
      >
        <Text style={[styles.message, { color: m3.colorScheme.onSurfaceVariant }]}>
          {t('widgets.common.loading')}
        </Text>
      </View>
    );
  }

  if (loadingState === 'error') {
    return (
      <View
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? 'Quick stats error'}
        style={[
          styles.container,
          styles.centered,
          {
            backgroundColor: m3.surface.surfaceContainerLow,
            borderColor: m3.colorScheme.outlineVariant,
          },
          style,
        ]}
      >
        <Ionicons name="alert-circle" size={32} color={m3.colorScheme.error} style={styles.icon} />
        <Text style={[styles.message, { color: m3.colorScheme.error }]}>
          {t('widgets.common.error')}
        </Text>
        {onRetry && (
          <Pressable onPress={onRetry}>
            <Text style={[styles.retry, { color: m3.colorScheme.primary }]}>
              {t('widgets.common.retry')}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (loadingState === 'idle' && stats.length === 0) {
    return (
      <View
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? 'Quick stats empty'}
        style={[
          styles.container,
          styles.centered,
          {
            backgroundColor: m3.surface.surfaceContainerLow,
            borderColor: m3.colorScheme.outlineVariant,
          },
          style,
        ]}
      >
        <Ionicons
          name="stats-chart-outline"
          size={32}
          color={m3.colorScheme.onSurfaceVariant}
          style={styles.icon}
        />
        <Text style={[styles.message, { color: m3.colorScheme.onSurfaceVariant }]}>
          {t('widgets.common.empty')}
        </Text>
      </View>
    );
  }

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? 'Quick stats overview'}
      style={[
        styles.container,
        {
          backgroundColor: m3.surface.surfaceContainerLow,
          borderColor: m3.colorScheme.outlineVariant,
          ...shadows.sm,
        },
        style,
      ]}
    >
      <Text style={[styles.title, { color: m3.colorScheme.onSurface }]}>
        {t('widgets.quickStats.title')}
      </Text>
      <View style={styles.grid}>
        {stats.map((stat) => {
          const color = getTrendColor(stat.trend, m3.colorScheme.onSurfaceVariant);
          return (
            <View
              key={stat.labelKey}
              accessibilityLabel={`${t(stat.labelKey)}: ${stat.value}, trend ${stat.trend} ${stat.trendValue}`}
              style={[
                styles.card,
                {
                  backgroundColor: m3.surface.surfaceContainerLowest,
                  borderColor: m3.colorScheme.outlineVariant,
                },
              ]}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12) },
                ]}
              >
                <Ionicons name={stat.icon} size={20} color={m3.colorScheme.primary} />
              </View>
              <Text style={[styles.value, { color: m3.colorScheme.onSurface }]}>{stat.value}</Text>
              <Text style={[styles.label, { color: m3.colorScheme.onSurfaceVariant }]}>
                {t(stat.labelKey)}
              </Text>
              <View style={styles.trendRow}>
                <Ionicons name={getTrendIcon(stat.trend)} size={12} color={color} />
                <Text style={[styles.trendText, { color }]}>{stat.trendValue}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: borderRadius['2xl'],
    padding: spacing[4],
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  icon: {
    marginBottom: spacing[2],
  },
  message: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  retry: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginTop: spacing[3],
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing[3],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  card: {
    width: '48%',
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing[3],
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  value: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginBottom: spacing[1],
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginBottom: spacing[2],
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  trendText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});
