import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseWidgetProps, StatusType, LoadingState } from '@widgets/shared/types';
import { useM3 } from '@/styles/use-theme';
import { spacing, borderRadius, shadows, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';

export interface VineyardHealthWidgetProps extends BaseWidgetProps {
  title?: string;
  metrics?: HealthMetric[];
  overallStatus?: { status: StatusType; labelKey: string };
  loadingState?: LoadingState;
  onRetry?: () => void;
}

export interface HealthMetric {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  labelKey: string;
  valueKey?: string;
  value?: string;
  status: StatusType;
}

const DEMO_METRICS: HealthMetric[] = [
  {
    id: 'water',
    icon: 'water',
    labelKey: 'widgets.vineyardHealth.metrics.waterStatus',
    value: '72%',
    status: 'optimal',
  },
  {
    id: 'disease',
    icon: 'shield-checkmark',
    labelKey: 'widgets.vineyardHealth.metrics.diseaseRisk',
    valueKey: 'widgets.vineyardHealth.values.minimal',
    status: 'optimal',
  },
  {
    id: 'growth',
    icon: 'leaf',
    labelKey: 'widgets.vineyardHealth.metrics.growthStage',
    valueKey: 'widgets.vineyardHealth.values.veraison',
    status: 'info',
  },
  {
    id: 'soil',
    icon: 'earth',
    labelKey: 'widgets.vineyardHealth.metrics.soilMoisture',
    value: '45%',
    status: 'due',
  },
];

const OVERALL_STATUS = 'optimal' as StatusType;
const OVERALL_LABEL_KEY = 'widgets.vineyardHealth.overallStatus';

const getStatusDotColor = (
  status: StatusType,
  scheme: ReturnType<typeof useM3>['colorScheme'],
): string => {
  switch (status) {
    case 'optimal':
      return scheme.primary;
    case 'critical':
      return scheme.error;
    case 'due':
      return scheme.warning;
    case 'delayed':
      return scheme.outline;
    case 'info':
      return scheme.secondary;
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
  title,
  metrics = DEMO_METRICS,
  overallStatus = { status: OVERALL_STATUS, labelKey: OVERALL_LABEL_KEY },
  loadingState = 'idle',
  onRetry,
}) => {
  const { t } = useTranslation();
  const m3 = useM3();
  const badge = getBadgeColors(overallStatus.status, m3.colorScheme);

  if (loadingState === 'loading') {
    return (
      <View
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.card,
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
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.card,
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

  if (loadingState === 'idle' && metrics.length === 0) {
    return (
      <View
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.card,
          styles.centered,
          {
            backgroundColor: m3.surface.surfaceContainerLow,
            borderColor: m3.colorScheme.outlineVariant,
          },
          style,
        ]}
      >
        <Ionicons
          name="heart-outline"
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
          testID={`${testID || 'vineyard-health-widget'}-title`}
          style={[styles.title, { color: m3.colorScheme.onSurface }]}
          accessibilityRole="header"
        >
          {title ?? t('widgets.vineyardHealth.title')}
        </Text>
        <View
          testID={`${testID || 'vineyard-health-widget'}-overall-status`}
          style={[styles.badge, { backgroundColor: badge.bg }]}
          accessibilityLabel={`Overall status: ${t(overallStatus.labelKey)}`}
        >
          <Text style={[styles.badgeText, { color: badge.text }]}>{t(overallStatus.labelKey)}</Text>
        </View>
      </View>

      {/* Metrics */}
      <View style={styles.metricsList}>
        {metrics.map((metric, index) => {
          const dotColor = getStatusDotColor(metric.status, m3.colorScheme);
          const isLast = index === metrics.length - 1;
          const value = metric.valueKey ? t(metric.valueKey) : metric.value;

          return (
            <View
              key={metric.id}
              testID={`${testID || 'vineyard-health-widget'}-metric-${metric.id}`}
              style={[
                styles.metricRow,
                !isLast && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: m3.colorScheme.outlineVariant,
                },
              ]}
              accessibilityLabel={`${t(metric.labelKey)}: ${value}`}
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
                <Text
                  testID={`${testID || 'vineyard-health-widget'}-metric-${metric.id}-label`}
                  style={[styles.metricLabel, { color: m3.colorScheme.onSurface }]}
                >
                  {t(metric.labelKey)}
                </Text>
              </View>
              <View style={styles.metricRight}>
                <Text
                  testID={`${testID || 'vineyard-health-widget'}-metric-${metric.id}-value`}
                  style={[styles.metricValue, { color: m3.colorScheme.onSurfaceVariant }]}
                >
                  {value}
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
