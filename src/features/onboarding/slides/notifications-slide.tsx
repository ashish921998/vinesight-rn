import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { useIsDark, useM3 } from '@/styles/use-theme';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { triggerHapticMedium, triggerHapticSuccess } from '@/utils/haptics';

interface NotificationsSlideProps {
  isActive: boolean;
  onFinish: (notificationsEnabled: boolean) => void | Promise<void>;
}

const NOTIFICATION_STATS = [
  { icon: 'xmark.seal.fill' as const, i18nKey: 'onboarding.notifications.stats.lateSpray' },
  {
    icon: 'drop.triangle.fill' as const,
    i18nKey: 'onboarding.notifications.stats.missedIrrigation',
  },
  { icon: 'person.fill.xmark' as const, i18nKey: 'onboarding.notifications.stats.unclearLabour' },
] as const;
const NOTIFICATION_ACCENT_COLOR = '#408059';

export function NotificationsSlide({ isActive, onFinish }: NotificationsSlideProps) {
  const { t } = useTranslation();
  const isDark = useIsDark();
  const m3 = useM3();
  const [isRequesting, setIsRequesting] = useState(false);

  const bellCircleStyle = useMemo(
    () => ({
      backgroundColor: colorWithOpacity(NOTIFICATION_ACCENT_COLOR, isDark ? 0.15 : 0.08),
    }),
    [isDark],
  );

  const statRowStyle = useMemo(
    () => ({
      backgroundColor: isDark
        ? colorWithOpacity(m3.surface.surfaceContainerHigh, 0.6)
        : colorWithOpacity(m3.colorScheme.surfaceVariant, 0.7),
      borderColor: colorWithOpacity(m3.colorScheme.outline, 0.12),
    }),
    [
      isDark,
      m3.colorScheme.outline,
      m3.colorScheme.surfaceVariant,
      m3.surface.surfaceContainerHigh,
    ],
  );

  const handleEnable = useCallback(async () => {
    if (isRequesting) return;
    setIsRequesting(true);
    triggerHapticMedium();

    try {
      const Notifications = await import('expo-notifications');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();

      if (existingStatus === 'granted') {
        triggerHapticSuccess();
        await onFinish(true);
        return;
      }

      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        triggerHapticSuccess();
        await onFinish(true);
      } else {
        await onFinish(false);
      }
    } catch (err) {
      if (__DEV__) {
        console.error('[Notifications Slide] Error requesting notification permissions:', err);
      }
      await onFinish(false);
    } finally {
      setIsRequesting(false);
    }
  }, [isRequesting, onFinish]);

  return (
    <View style={[styles.container, { backgroundColor: m3.colorScheme.background }]}>
      <View
        style={[
          styles.panel,
          {
            backgroundColor: colorWithOpacity(
              isDark ? m3.surface.surfaceContainerHigh : m3.colorScheme.surface,
              isDark ? 0.62 : 0.94,
            ),
            borderColor: colorWithOpacity(m3.colorScheme.outline, 0.12),
          },
        ]}
      >
        <Animated.View
          entering={isActive ? FadeInDown.duration(500) : undefined}
          style={styles.iconContainer}
        >
          <View style={[styles.bellCircle, bellCircleStyle]}>
            <SymbolIcon name="bell.badge.fill" size={34} color={NOTIFICATION_ACCENT_COLOR} />
          </View>
        </Animated.View>

        <Animated.View
          entering={isActive ? FadeInDown.delay(150).duration(500) : undefined}
          style={styles.header}
        >
          <Text style={[styles.eyebrow, { color: m3.colorScheme.primary }]}>
            {t('onboarding.notifications.eyebrow')}
          </Text>
          <Text style={[styles.title, { color: m3.colorScheme.onSurface }]}>
            {t('onboarding.notifications.slideTitle')}
          </Text>
          <Text style={[styles.subtitle, { color: m3.colorScheme.onSurfaceVariant }]}>
            {t('onboarding.notifications.slideSubtitle')}
          </Text>
        </Animated.View>

        <Animated.View
          entering={isActive ? FadeInDown.delay(350).duration(500) : undefined}
          style={styles.statsContainer}
        >
          {NOTIFICATION_STATS.map((stat) => (
            <View key={stat.i18nKey} style={[styles.statRow, statRowStyle]}>
              <View
                style={[
                  styles.statIcon,
                  { backgroundColor: colorWithOpacity(NOTIFICATION_ACCENT_COLOR, 0.1) },
                ]}
              >
                <SymbolIcon name={stat.icon} size={18} color={NOTIFICATION_ACCENT_COLOR} />
              </View>
              <Text style={[styles.statText, { color: m3.colorScheme.onSurface }]}>
                {t(stat.i18nKey)}
              </Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View
          entering={isActive ? FadeInDown.delay(470).duration(500) : undefined}
          style={[
            styles.assuranceBar,
            { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08) },
          ]}
        >
          <SymbolIcon name="checkmark.shield.fill" size={18} color={m3.colorScheme.primary} />
          <Text style={[styles.assuranceText, { color: m3.colorScheme.onSurface }]}>
            {t('onboarding.notifications.assurance')}
          </Text>
        </Animated.View>

        <Animated.View
          entering={isActive ? FadeInDown.delay(550).duration(500) : undefined}
          style={styles.ctaContainer}
        >
          <Pressable
            onPress={handleEnable}
            disabled={isRequesting}
            style={({ pressed }) => [
              styles.ctaButton,
              {
                backgroundColor: NOTIFICATION_ACCENT_COLOR,
                opacity: isRequesting ? 0.72 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <SymbolIcon name="bell.badge.fill" size={18} color="#ffffff" />
            <Text style={styles.ctaText}>
              {isRequesting
                ? t('onboarding.notifications.checkingPermissions')
                : t('onboarding.notifications.enableAlerts')}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[20],
    paddingBottom: spacing[24],
  },
  panel: {
    borderWidth: 1,
    borderRadius: borderRadius['4xl'],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[6],
    gap: spacing[4],
  },
  iconContainer: {
    alignItems: 'flex-start',
  },
  bellCircle: {
    width: 80,
    height: 80,
    borderRadius: borderRadius['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    gap: spacing[2],
  },
  eyebrow: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  statsContainer: {
    gap: spacing[3],
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 20,
  },
  assuranceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  assuranceText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  ctaContainer: {
    gap: spacing[3],
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  ctaText: {
    color: '#ffffff',
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
});
