import React, { useEffect, useMemo } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  Image,
  type ImageSourcePropType,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useIsDark, useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import appLogoDark from '../../../assets/icons/ios-dark.png';
import appLogoLight from '../../../assets/icons/ios-light.png';

export function GuidedTourCompletionCard({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const m3 = useM3();
  const isDark = useIsDark();
  const appLogo = isDark ? appLogoDark : appLogoLight;
  const reveal = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(reveal, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reveal]);

  const defer = (fn: () => void) => setTimeout(fn, 0);
  const cardOpacity = reveal.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const cardTranslateY = reveal.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <LinearGradient
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        colors={[
          colorWithOpacity('#000000', 0.56),
          colorWithOpacity('#000000', 0.46),
          colorWithOpacity('#000000', 0.56),
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View
        style={{ flex: 1, justifyContent: 'center', padding: spacing[5], zIndex: 2, elevation: 3 }}
      >
        <Animated.View
          style={{
            backgroundColor: m3.surface.surfaceContainer,
            borderRadius: borderRadius['2xl'],
            padding: spacing[5],
            maxWidth: 480,
            alignSelf: 'center',
            width: '100%',
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.outline, 0.24),
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
            overflow: 'hidden',
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslateY }],
          }}
        >
          <LinearGradient
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 156 }}
            colors={[
              colorWithOpacity(m3.colorScheme.primary, 0.14),
              colorWithOpacity(m3.colorScheme.secondary, 0.08),
              'transparent',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={{ alignItems: 'center', marginBottom: spacing[4] }}>
            <View
              style={{
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[1],
                borderRadius: borderRadius.full,
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
                borderWidth: 1,
                borderColor: colorWithOpacity(m3.colorScheme.primary, 0.26),
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[1],
                marginBottom: spacing[3],
              }}
            >
              <UiSymbol name="sparkles" size={12} color={m3.colorScheme.primary} />
              <Text
                style={{
                  color: m3.colorScheme.primary,
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.semibold,
                }}
              >
                {t('guidedTour.coachmark.title')}
              </Text>
            </View>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
                borderWidth: 1,
                borderColor: colorWithOpacity(m3.colorScheme.primary, 0.26),
              }}
            >
              <Image
                source={appLogo as ImageSourcePropType}
                style={{ width: 46, height: 46 }}
                resizeMode="contain"
              />
            </View>
          </View>

          <Text
            style={{
              color: m3.colorScheme.onSurface,
              fontSize: fontSize['3xl'],
              fontWeight: fontWeight.bold,
              textAlign: 'center',
            }}
          >
            {t('guidedTour.complete.title')}
          </Text>
          <Text
            style={{
              color: m3.colorScheme.onSurfaceVariant,
              marginTop: spacing[2],
              fontSize: fontSize.base,
              lineHeight: 22,
              textAlign: 'center',
            }}
          >
            {t('guidedTour.complete.body')}
          </Text>

          <View
            style={{
              marginTop: spacing[4],
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[2],
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[1],
              borderRadius: borderRadius.full,
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.outline, 0.36),
              backgroundColor: colorWithOpacity(m3.colorScheme.surface, 0.72),
            }}
          >
            <UiSymbol name="checkmark.seal.fill" size={14} color={m3.colorScheme.primary} />
            <Text style={{ color: m3.colorScheme.primary, fontWeight: fontWeight.semibold }}>
              {t('guidedTour.cta.done')}
            </Text>
          </View>

          <Pressable
            onPress={() => defer(onDone)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => ({
              marginTop: spacing[5],
              backgroundColor: pressed
                ? colorWithOpacity(m3.colorScheme.primary, 0.88)
                : m3.colorScheme.primary,
              borderRadius: borderRadius.xl,
              paddingVertical: spacing[3],
              alignItems: 'center',
              shadowColor: m3.colorScheme.primary,
              shadowOpacity: 0.2,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: 3,
              transform: [{ scale: pressed ? 0.992 : 1 }],
            })}
          >
            <Text
              style={{
                color: m3.colorScheme.onPrimary,
                fontWeight: fontWeight.semibold,
                fontSize: fontSize.base,
              }}
            >
              {t('guidedTour.cta.done')}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}
