import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useNotificationStore, useAuthStore } from '@/stores';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import {
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  type ThemeColors,
  getM3Theme,
} from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import {
  fetchNotificationPreferences,
  upsertNotificationPreferences,
} from '@/services/notification-preferences';
import type { NotificationCategoryPreferences } from '@/stores/notification-store';

interface NotificationCategory {
  key: keyof NotificationCategoryPreferences;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export default function NotificationPreferencesScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
  const styles = useMemo(() => createStyles(colors, m3), [colors, m3]);
  const { t } = useTranslation();

  const user = useAuthStore((s) => s.user);
  const userId = user?.id;

  // Existing notification preferences (read-only summary)
  const dailyWaterReminderEnabled = useNotificationStore((s) => s.dailyWaterReminderEnabled);
  const lowWaterAlertsEnabled = useNotificationStore((s) => s.lowWaterAlertsEnabled);
  const taskRemindersEnabled = useNotificationStore((s) => s.taskRemindersEnabled);

  // Push notification category preferences
  const vineAlertsEnabled = useNotificationStore((s) => s.vineAlertsEnabled);
  const setVineAlertsEnabled = useNotificationStore((s) => s.setVineAlertsEnabled);

  const diseaseDetectionEnabled = useNotificationStore((s) => s.diseaseDetectionEnabled);
  const setDiseaseDetectionEnabled = useNotificationStore((s) => s.setDiseaseDetectionEnabled);

  const weatherAlertsEnabled = useNotificationStore((s) => s.weatherAlertsEnabled);
  const setWeatherAlertsEnabled = useNotificationStore((s) => s.setWeatherAlertsEnabled);

  const generalUpdatesEnabled = useNotificationStore((s) => s.generalUpdatesEnabled);
  const setGeneralUpdatesEnabled = useNotificationStore((s) => s.setGeneralUpdatesEnabled);

  const harvestRemindersEnabled = useNotificationStore((s) => s.harvestRemindersEnabled);
  const setHarvestRemindersEnabled = useNotificationStore((s) => s.setHarvestRemindersEnabled);

  const irrigationAlertsEnabled = useNotificationStore((s) => s.irrigationAlertsEnabled);
  const setIrrigationAlertsEnabled = useNotificationStore((s) => s.setIrrigationAlertsEnabled);

  const setCategoryPreferences = useNotificationStore((s) => s.setCategoryPreferences);
  const getCategoryPreferences = useNotificationStore((s) => s.getCategoryPreferences);

  // Track whether we've hydrated from server to avoid overwriting server data
  const hydratedFromServer = useRef(false);

  // Hydrate local state from server on mount
  useEffect(() => {
    if (!userId || hydratedFromServer.current) return;

    let cancelled = false;
    (async () => {
      const serverPrefs = await fetchNotificationPreferences(userId);
      if (cancelled || !serverPrefs) return;
      setCategoryPreferences(serverPrefs);
      hydratedFromServer.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, setCategoryPreferences]);

  // Sync to server whenever a category preference changes
  const syncToServer = useCallback(() => {
    if (!userId) return;
    const prefs = getCategoryPreferences();
    // Fire-and-forget — errors are logged inside the service
    void upsertNotificationPreferences(userId, prefs);
  }, [userId, getCategoryPreferences]);

  const handleToggle = useCallback(
    (setter: (enabled: boolean) => void) => (enabled: boolean) => {
      setter(enabled);
      // Use a microtask so the store is updated before we read it
      queueMicrotask(syncToServer);
    },
    [syncToServer],
  );

  const categories: NotificationCategory[] = [
    {
      key: 'vineAlertsEnabled',
      titleKey: 'notificationPreferences.categories.vineAlerts.title',
      descriptionKey: 'notificationPreferences.categories.vineAlerts.description',
      icon: 'leaf.fill',
      enabled: vineAlertsEnabled,
      onToggle: handleToggle(setVineAlertsEnabled),
    },
    {
      key: 'diseaseDetectionEnabled',
      titleKey: 'notificationPreferences.categories.diseaseDetection.title',
      descriptionKey: 'notificationPreferences.categories.diseaseDetection.description',
      icon: 'exclamationmark.shield.fill',
      enabled: diseaseDetectionEnabled,
      onToggle: handleToggle(setDiseaseDetectionEnabled),
    },
    {
      key: 'weatherAlertsEnabled',
      titleKey: 'notificationPreferences.categories.weatherAlerts.title',
      descriptionKey: 'notificationPreferences.categories.weatherAlerts.description',
      icon: 'cloud.sun.fill',
      enabled: weatherAlertsEnabled,
      onToggle: handleToggle(setWeatherAlertsEnabled),
    },
    {
      key: 'harvestRemindersEnabled',
      titleKey: 'notificationPreferences.categories.harvestReminders.title',
      descriptionKey: 'notificationPreferences.categories.harvestReminders.description',
      icon: 'basket.fill',
      enabled: harvestRemindersEnabled,
      onToggle: handleToggle(setHarvestRemindersEnabled),
    },
    {
      key: 'irrigationAlertsEnabled',
      titleKey: 'notificationPreferences.categories.irrigationAlerts.title',
      descriptionKey: 'notificationPreferences.categories.irrigationAlerts.description',
      icon: 'drop.fill',
      enabled: irrigationAlertsEnabled,
      onToggle: handleToggle(setIrrigationAlertsEnabled),
    },
    {
      key: 'generalUpdatesEnabled',
      titleKey: 'notificationPreferences.categories.generalUpdates.title',
      descriptionKey: 'notificationPreferences.categories.generalUpdates.description',
      icon: 'bell.fill',
      enabled: generalUpdatesEnabled,
      onToggle: handleToggle(setGeneralUpdatesEnabled),
    },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: t('notificationPreferences.title'),
          headerStyle: { backgroundColor: colors.surface[50] },
          headerTintColor: m3.colorScheme.onSurface,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Summary of existing toggles from Settings */}
        <View style={styles.section}>
          <Text
            style={styles.sectionHeader}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {t('notificationPreferences.sectionCurrent')}
          </Text>
          <View style={styles.sectionContent}>
            <View style={[styles.summaryItem, styles.borderBottom]}>
              <UISymbol name="drop.fill" size={18} color={colors.gray[500]} />
              <Text
                style={styles.summaryLabel}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.dailyWaterReminder')}
              </Text>
              <Text
                style={[
                  styles.summaryStatus,
                  { color: dailyWaterReminderEnabled ? m3.colorScheme.primary : colors.gray[400] },
                ]}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {dailyWaterReminderEnabled ? t('common.on') : t('common.off')}
              </Text>
            </View>
            <View style={[styles.summaryItem, styles.borderBottom]}>
              <UISymbol name="exclamationmark.triangle.fill" size={18} color={colors.gray[500]} />
              <Text
                style={styles.summaryLabel}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.lowWaterAlerts')}
              </Text>
              <Text
                style={[
                  styles.summaryStatus,
                  { color: lowWaterAlertsEnabled ? m3.colorScheme.primary : colors.gray[400] },
                ]}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {lowWaterAlertsEnabled ? t('common.on') : t('common.off')}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <UISymbol name="checklist" size={18} color={colors.gray[500]} />
              <Text
                style={styles.summaryLabel}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {t('settings.taskReminders')}
              </Text>
              <Text
                style={[
                  styles.summaryStatus,
                  { color: taskRemindersEnabled ? m3.colorScheme.primary : colors.gray[400] },
                ]}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {taskRemindersEnabled ? t('common.on') : t('common.off')}
              </Text>
            </View>
          </View>
          <Text
            style={styles.sectionNote}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {t('notificationPreferences.currentNote')}
          </Text>
        </View>

        {/* Push Notification Categories */}
        <View style={styles.section}>
          <Text
            style={styles.sectionHeader}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {t('notificationPreferences.sectionCategories')}
          </Text>
          <View style={styles.sectionContent}>
            {categories.map((category, index) => (
              <View
                key={category.key}
                style={[
                  styles.categoryItem,
                  index < categories.length - 1 && styles.borderBottom,
                ]}
              >
                <View style={styles.categoryIcon}>
                  <UISymbol name={category.icon} size={20} color={m3.colorScheme.primary} />
                </View>
                <View style={styles.categoryInfo}>
                  <Text
                    style={styles.categoryTitle}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {t(category.titleKey)}
                  </Text>
                  <Text
                    style={styles.categoryDescription}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {t(category.descriptionKey)}
                  </Text>
                </View>
                <Switch
                  value={category.enabled}
                  onValueChange={category.onToggle}
                  trackColor={{
                    false: colors.surface[300],
                    true: colorWithOpacity(m3.colorScheme.primary, 0.4),
                  }}
                  thumbColor={category.enabled ? m3.colorScheme.primary : colors.surface[100]}
                  accessibilityLabel={t(category.titleKey)}
                  accessibilityRole="switch"
                />
              </View>
            ))}
          </View>
          <Text
            style={styles.sectionNote}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {t('notificationPreferences.categoriesNote')}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const createStyles = (colors: ThemeColors, m3: ReturnType<typeof getM3Theme>) => ({
  container: { flex: 1, backgroundColor: colors.surface[50] } as ViewStyle,

  section: { marginTop: spacing[6], paddingHorizontal: spacing[4] } as ViewStyle,
  sectionHeader: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.surface[500],
    letterSpacing: 0.5,
    marginBottom: spacing[2],
    paddingHorizontal: spacing[2],
  } as TextStyle,
  sectionContent: {
    backgroundColor: colors.surface[100],
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
  } as ViewStyle,
  sectionNote: {
    fontSize: fontSize.xs,
    color: colors.surface[400],
    marginTop: spacing[2],
    paddingHorizontal: spacing[2],
  } as TextStyle,

  borderBottom: { borderBottomWidth: 1, borderBottomColor: colors.surface[200] } as ViewStyle,

  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
  } as ViewStyle,
  summaryLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.surface[900],
  } as TextStyle,
  summaryStatus: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  } as TextStyle,

  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  } as ViewStyle,
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  categoryInfo: {
    flex: 1,
    marginLeft: spacing[3],
    marginRight: spacing[3],
  } as ViewStyle,
  categoryTitle: {
    fontSize: fontSize.base,
    color: colors.surface[900],
    fontWeight: fontWeight.medium,
  } as TextStyle,
  categoryDescription: {
    fontSize: fontSize.xs,
    color: colors.surface[500],
    marginTop: 2,
  } as TextStyle,
});
