import React, { useEffect, useMemo } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

interface Props {
  onStart: () => void;
  onSkip: () => void;
}

export function GuidedTourWelcomeCard({ onStart, onSkip }: Props) {
  const { t } = useTranslation();
  const m3 = useM3();
  const reveal = useMemo(() => new Animated.Value(0), []);
  const pulse = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(reveal, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1250,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1250,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reveal]);

  const defer = (fn: () => void) => setTimeout(fn, 0);
  const cardOpacity = reveal.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const cardTranslateY = reveal.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.13] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.36, 0.14] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <LinearGradient
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        colors={[
          colorWithOpacity('#07150E', 0.78),
          colorWithOpacity(m3.colorScheme.primary, 0.45),
          colorWithOpacity('#000000', 0.72),
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View
        style={{ flex: 1, justifyContent: 'center', padding: spacing[5], zIndex: 2, elevation: 3 }}
      >
        <Animated.View
          style={{
            backgroundColor: m3.colorScheme.surface,
            borderRadius: borderRadius['2xl'],
            padding: spacing[6],
            maxWidth: 520,
            alignSelf: 'center',
            width: '100%',
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.primary, 0.28),
            shadowColor: '#000',
            shadowOpacity: 0.24,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 12 },
            elevation: 10,
            overflow: 'hidden',
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslateY }],
          }}
        >
          <LinearGradient
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 210 }}
            colors={[
              colorWithOpacity(m3.colorScheme.primary, 0.24),
              colorWithOpacity(m3.colorScheme.tertiary, 0.16),
              'transparent',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={{ alignItems: 'center', marginBottom: spacing[5] }}>
            <Animated.View
              style={{
                position: 'absolute',
                width: 98,
                height: 98,
                borderRadius: borderRadius.full,
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.2),
                transform: [{ scale: haloScale }],
                opacity: haloOpacity,
              }}
            />
            <View
              style={{
                width: 78,
                height: 78,
                borderRadius: borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.16),
                borderWidth: 1,
                borderColor: colorWithOpacity(m3.colorScheme.primary, 0.34),
              }}
            >
              <UiSymbol name="leaf.fill" size={34} color={m3.colorScheme.primary} />
            </View>
          </View>

          <Text
            style={{
              color: m3.colorScheme.onSurface,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
              textAlign: 'center',
            }}
          >
            {t('guidedTour.welcome.title')}
          </Text>
          <Text
            style={{
              color: m3.colorScheme.onSurfaceVariant,
              marginTop: spacing[3],
              fontSize: fontSize.base,
              lineHeight: 24,
              textAlign: 'center',
            }}
          >
            {t('guidedTour.welcome.body')}
          </Text>

          <View
            style={{
              marginTop: spacing[4],
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[2],
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              borderRadius: borderRadius.full,
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.primary, 0.3),
              backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
            }}
          >
            <UiSymbol name="clock.fill" size={14} color={m3.colorScheme.primary} />
            <Text style={{ color: m3.colorScheme.primary, fontWeight: fontWeight.semibold }}>
              {t('guidedTour.welcome.setupTime')}
            </Text>
          </View>

          <Pressable
            onPress={() => defer(onStart)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => ({
              marginTop: spacing[6],
              backgroundColor: pressed
                ? colorWithOpacity(m3.colorScheme.primary, 0.88)
                : m3.colorScheme.primary,
              borderRadius: borderRadius.xl,
              paddingVertical: spacing[3],
              alignItems: 'center',
              shadowColor: m3.colorScheme.primary,
              shadowOpacity: 0.26,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 8 },
              elevation: 4,
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
              {t('guidedTour.cta.letsGo')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => defer(onSkip)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => ({
              marginTop: spacing[3],
              alignItems: 'center',
              paddingVertical: spacing[2],
              borderRadius: borderRadius.lg,
              backgroundColor: pressed
                ? colorWithOpacity(m3.colorScheme.onSurface, 0.06)
                : 'transparent',
            })}
          >
            <Text style={{ color: m3.colorScheme.onSurfaceVariant, fontWeight: fontWeight.medium }}>
              {t('guidedTour.cta.skip')}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}
