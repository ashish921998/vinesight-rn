import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useIsDark, useM3 } from '@/styles/use-theme';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { springs, timing } from '@/styles/motion';
import { colorWithOpacity } from '@/utils/color';
import { triggerHaptic } from '@/utils/haptics';
import { telemetry } from '@/services/telemetry';
import { Symbol as Icon } from '@/components/ui/symbol';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useMountEffect } from '@/hooks/use-mount-effect';
import appLogoDark from '../../../assets/icons/ios-dark.png';
import appLogoLight from '../../../assets/icons/ios-light.png';

const FEATURES = [
  {
    icon: 'checklist' as const,
    tintKey: 'primary' as const,
    titleKey: 'welcome.features.log.title' as const,
    descKey: 'welcome.features.log.description' as const,
  },
  {
    icon: 'doc.text.fill' as const,
    tintKey: 'secondary' as const,
    titleKey: 'welcome.features.export.title' as const,
    descKey: 'welcome.features.export.description' as const,
  },
  {
    icon: 'person.2.fill' as const,
    tintKey: 'tertiary' as const,
    titleKey: 'welcome.features.team.title' as const,
    descKey: 'welcome.features.team.description' as const,
  },
];

export function WelcomeScreen() {
  const m3 = useM3();
  const isDark = useIsDark();
  const router = useRouter();
  const { t } = useTranslation();
  const markWelcomeSeen = useOnboardingStore((state) => state.markWelcomeSeen);
  const appLogo = isDark ? appLogoDark : appLogoLight;

  const logoScale = useSharedValue(0.4);
  const logoOpacity = useSharedValue(0);

  useMountEffect(() => {
    triggerHaptic();
    logoScale.value = withSpring(1, springs.momentum);
    logoOpacity.value = withTiming(1, timing.enter);
    telemetry.capture('welcome_screen_viewed');
  });

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const handleContinue = (action: 'get_started' | 'log_in') => {
    markWelcomeSeen();
    telemetry.capture(`welcome_${action}`);
    router.replace('/(auth)/phone-login');
  };

  const resolveTint = (key: 'primary' | 'secondary' | 'tertiary') =>
    key === 'primary'
      ? m3.colorScheme.primary
      : key === 'secondary'
        ? m3.colorScheme.secondary
        : m3.colorScheme.tertiary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: m3.colorScheme.background }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.orb,
            styles.orbTop,
            { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1) },
          ]}
        />
        <View
          style={[
            styles.orb,
            styles.orbBottom,
            { backgroundColor: colorWithOpacity(m3.colorScheme.tertiary, 0.12) },
          ]}
        />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Animated.View style={[styles.logoWrapper, logoAnimatedStyle]}>
            <View
              style={[
                styles.logoCircle,
                {
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
                  borderColor: colorWithOpacity(m3.colorScheme.primary, 0.2),
                },
              ]}
            >
              <Image
                source={appLogo as ImageSourcePropType}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(300).duration(400).springify().damping(16)}
            style={[styles.wordmark, { color: m3.colorScheme.onSurface }]}
          >
            {t('welcome.title')}
          </Animated.Text>

          <Animated.View
            entering={FadeInDown.delay(500).duration(400)}
            style={[
              styles.kickerPill,
              { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1) },
            ]}
          >
            <Text style={[styles.kickerText, { color: m3.colorScheme.primary }]}>
              {t('welcome.kicker')}
            </Text>
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(650).duration(450).springify().damping(18)}
            style={[styles.headline, { color: m3.colorScheme.onSurface }]}
          >
            {t('welcome.headline')}
          </Animated.Text>

          <Animated.Text
            entering={FadeInDown.delay(850).duration(400)}
            style={[styles.subtitle, { color: m3.colorScheme.onSurfaceVariant }]}
          >
            {t('welcome.subtitle')}
          </Animated.Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((feature, index) => {
            const tint = resolveTint(feature.tintKey);
            return (
              <Animated.View
                key={feature.titleKey}
                entering={FadeInDown.delay(1000 + index * 130)
                  .duration(400)
                  .springify()
                  .damping(16)}
                style={[
                  styles.featureCard,
                  {
                    backgroundColor: colorWithOpacity(m3.colorScheme.surface, 0.9),
                    borderColor: colorWithOpacity(m3.colorScheme.outline, 0.12),
                  },
                ]}
              >
                <View
                  style={[styles.featureIcon, { backgroundColor: colorWithOpacity(tint, 0.12) }]}
                >
                  <Icon name={feature.icon} size={22} color={tint} />
                </View>
                <View style={styles.featureText}>
                  <Text style={[styles.featureTitle, { color: m3.colorScheme.onSurface }]}>
                    {t(feature.titleKey)}
                  </Text>
                  <Text style={[styles.featureDesc, { color: m3.colorScheme.onSurfaceVariant }]}>
                    {t(feature.descKey)}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      <Animated.View entering={FadeInDown.delay(1500).duration(400)} style={styles.footer}>
        <Pressable
          onPress={() => handleContinue('get_started')}
          style={({ pressed }) => [
            styles.ctaButton,
            {
              backgroundColor: pressed
                ? colorWithOpacity(m3.colorScheme.primary, 0.88)
                : m3.colorScheme.primary,
            },
          ]}
        >
          <Text style={[styles.ctaText, { color: m3.colorScheme.onPrimary }]}>
            {t('welcome.cta.getStarted')}
          </Text>
        </Pressable>

        <Pressable onPress={() => handleContinue('log_in')} hitSlop={{ top: 12, bottom: 12 }}>
          <Text style={[styles.secondaryCta, { color: m3.colorScheme.onSurfaceVariant }]}>
            {t('welcome.cta.hasAccount')}{' '}
            <Text style={{ fontWeight: fontWeight.semibold, color: m3.colorScheme.primary }}>
              {t('welcome.cta.logIn')}
            </Text>
          </Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  orb: {
    position: 'absolute',
    borderRadius: borderRadius.full,
  },
  orbTop: {
    width: 260,
    height: 260,
    top: -80,
    right: -60,
  },
  orbBottom: {
    width: 320,
    height: 320,
    bottom: -40,
    left: -120,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[6],
    gap: spacing[8],
  },
  header: {
    alignItems: 'center',
    gap: spacing[3],
  },
  logoWrapper: {
    marginBottom: spacing[1],
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  logoImage: {
    width: 56,
    height: 56,
  },
  wordmark: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
  },
  kickerPill: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  kickerText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  headline: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: fontSize.base,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 340,
  },
  features: {
    gap: spacing[3],
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderRadius: borderRadius['2xl'],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  featureDesc: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
    gap: spacing[4],
    alignItems: 'center',
  },
  ctaButton: {
    width: '100%',
    paddingVertical: spacing[4],
    borderRadius: borderRadius['2xl'],
    alignItems: 'center',
  },
  ctaText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  secondaryCta: {
    fontSize: fontSize.sm,
  },
});
