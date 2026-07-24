import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BaseWidgetProps, LoadingState } from '@widgets/shared/types';
import { useM3 } from '@/styles/use-theme';
import { spacing, borderRadius, shadows, fontSize, fontWeight } from '@/styles/theme';
import { useTranslation } from 'react-i18next';

export interface WidgetTemplateProps extends BaseWidgetProps {
  loadingState?: LoadingState;
  onRetry?: () => void;
}

export const WidgetTemplate: React.FC<WidgetTemplateProps> = ({
  testID,
  accessibilityLabel = 'Widget Template',
  style,
  loadingState = 'idle',
  onRetry,
}) => {
  const { t } = useTranslation();
  const m3 = useM3();

  if (loadingState === 'loading') {
    return (
      <View
        testID={testID}
        accessibilityLabel={accessibilityLabel}
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
        accessibilityLabel={accessibilityLabel}
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

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
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
        {t('widgets.template.title')}
      </Text>
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
  },
});
