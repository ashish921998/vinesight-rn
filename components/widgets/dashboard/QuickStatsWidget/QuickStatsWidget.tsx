import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseWidgetProps, TrendDirection } from '@widgets/shared/types';
import { useM3 } from '@/styles/use-theme';
import { spacing, borderRadius, shadows, fontSize, fontWeight, colors } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';

interface StatItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  trend: TrendDirection;
  trendValue: string;
}

const STATS: StatItem[] = [
  { icon: 'leaf-outline', label: 'Active Farms', value: '4', trend: 'up', trendValue: '+1' },
  {
    icon: 'people-outline',
    label: 'Workers Today',
    value: '12',
    trend: 'neutral',
    trendValue: '0',
  },
  {
    icon: 'water-outline',
    label: 'Water Reserve',
    value: '68%',
    trend: 'down',
    trendValue: '-5%',
  },
  {
    icon: 'cash-outline',
    label: 'Season Expenses',
    value: '₹2.4L',
    trend: 'up',
    trendValue: '+12%',
  },
];

export interface QuickStatsWidgetProps extends BaseWidgetProps {
  stats?: StatItem[];
}

export const QuickStatsWidget: React.FC<QuickStatsWidgetProps> = ({
  testID,
  accessibilityLabel,
  style,
  stats = STATS,
}) => {
  const m3 = useM3();

  const trendColor = (trend: TrendDirection) => {
    if (trend === 'up') return colors.success;
    if (trend === 'down') return colors.error;
    return m3.colorScheme.onSurfaceVariant;
  };

  const trendIcon = (trend: TrendDirection): keyof typeof Ionicons.glyphMap => {
    if (trend === 'up') return 'arrow-up';
    if (trend === 'down') return 'arrow-down';
    return 'remove';
  };

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
      <Text style={[styles.title, { color: m3.colorScheme.onSurface }]}>Quick Stats</Text>
      <View style={styles.grid}>
        {stats.map((stat) => {
          const color = trendColor(stat.trend);
          return (
            <View
              key={stat.label}
              accessibilityLabel={`${stat.label}: ${stat.value}, trend ${stat.trend} ${stat.trendValue}`}
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
                {stat.label}
              </Text>
              <View style={styles.trendRow}>
                <Ionicons name={trendIcon(stat.trend)} size={12} color={color} />
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
