import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseWidgetProps, StatusType } from '@widgets/shared/types';
import { useM3 } from '@/styles/use-theme';
import { spacing, borderRadius, shadows, fontSize, fontWeight, colors } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';

export interface VineyardHealthWidgetProps extends BaseWidgetProps {
  title?: string;
  metrics?: HealthMetric[];
  overallStatus?: { status: StatusType; label: string };
}

interface HealthMetric {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  status: StatusType;
}

const DEMO_METRICS: HealthMetric[] = [
  { id: 'water', icon: 'water', label: 'Water Status', value: '72%', status: 'optimal' },
  {
    id: 'disease',
    icon: 'shield-checkmark',
    label: 'Disease Risk',
    value: 'Minimal',
    status: 'optimal',
  },
  { id: 'growth', icon: 'leaf', label: 'Growth Stage', value: 'Véraison', status: 'info' },
  { id: 'soil', icon: 'earth', label: 'Soil Moisture', value: '45%', status: 'due' },
];

const OVERALL_STATUS = 'optimal' as StatusType;
const OVERALL_LABEL = 'Optimal';

const getStatusDotColor = (status: StatusType): string => {
  switch (status) {
    case 'optimal':
      return colors.water.good;
    case 'critical':
      return colors.water.critical;
    case 'due':
      return colors.water.medium;
    case 'delayed':
      return colors.water.low;
    case 'info':
      return colors.secondary[500];
  }
};

const getBadgeColors = (status: StatusType, scheme: ReturnType<typeof useM3>['colorScheme']) => {
  switch (status) {
    case 'optimal':
      return { bg: colorWithOpacity(scheme.primary, 0.12), text: scheme.primary };
    case 'critical':
      return { bg: colorWithOpacity(scheme.error, 0.12), text: scheme.error };
    case 'due':
      return { bg: colorWithOpacity(scheme.warning, 0.12), text: scheme.warning };
    case 'delayed':
      return { bg: colorWithOpacity(scheme.outline, 0.12), text: scheme.outline };
    case 'info':
      return { bg: colorWithOpacity(scheme.secondary, 0.12), text: scheme.secondary };
  }
};

export const VineyardHealthWidget: React.FC<VineyardHealthWidgetProps> = ({
  testID,
  accessibilityLabel = 'Vineyard Health Widget',
  style,
  title = 'Vineyard Health',
  metrics = DEMO_METRICS,
  overallStatus = { status: OVERALL_STATUS, label: OVERALL_LABEL },
}) => {
  const m3 = useM3();
  const badge = getBadgeColors(overallStatus.status, m3.colorScheme);

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.card,
        {
          backgroundColor: m3.surface.surfaceContainerLow,
          borderColor: m3.colorScheme.outlineVariant,
        },
        style,
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text
          style={[styles.title, { color: m3.colorScheme.onSurface }]}
          accessibilityRole="header"
        >
          {title}
        </Text>
        <View
          style={[styles.badge, { backgroundColor: badge.bg }]}
          accessibilityLabel={`Overall status: ${overallStatus.label}`}
        >
          <Text style={[styles.badgeText, { color: badge.text }]}>{overallStatus.label}</Text>
        </View>
      </View>

      {/* Metrics */}
      <View style={styles.metricsList}>
        {metrics.map((metric, index) => {
          const dotColor = getStatusDotColor(metric.status);
          const isLast = index === metrics.length - 1;

          return (
            <View
              key={metric.id}
              style={[
                styles.metricRow,
                !isLast && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: m3.colorScheme.outlineVariant,
                },
              ]}
              accessibilityLabel={`${metric.label}: ${metric.value}`}
            >
              <View style={styles.metricLeft}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08) },
                  ]}
                >
                  <Ionicons name={metric.icon} size={16} color={m3.colorScheme.primary} />
                </View>
                <Text style={[styles.metricLabel, { color: m3.colorScheme.onSurface }]}>
                  {metric.label}
                </Text>
              </View>
              <View style={styles.metricRight}>
                <Text style={[styles.metricValue, { color: m3.colorScheme.onSurfaceVariant }]}>
                  {metric.value}
                </Text>
                <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: borderRadius['2xl'],
    padding: spacing[4],
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  badge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  metricsList: {
    gap: 0,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  metricLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  metricRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  metricValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.normal,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
  },
});
