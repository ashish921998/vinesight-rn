import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { useM3 } from '@/styles/use-theme';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';

interface ValuePropsSlideProps {
  isActive: boolean;
}

const VALUE_PROPS = [
  {
    icon: 'xmark.seal.fill' as const,
    color: '#EF4444',
    title: 'Fewer rejected exports',
    description:
      'Untracked sprays become failed audits. Capture every action before it becomes a loss.',
  },
  {
    icon: 'drop.fill' as const,
    color: '#3B82F6',
    title: 'Stop wasting water',
    description:
      'Watering from memory adds cost quickly. Timed records keep irrigation disciplined.',
  },
  {
    icon: 'clock.fill' as const,
    color: '#F59E0B',
    title: 'Save team hours',
    description:
      'When worker logs and field activity stay aligned, payroll disputes stop consuming evenings.',
  },
  {
    icon: 'indianrupeesign.circle.fill' as const,
    color: 'primary' as const,
    title: 'Protect seasonal margin',
    description:
      'Small operational misses stack up. Better records preserve money already earned in the field.',
  },
];

export function ValuePropsSlide({ isActive }: ValuePropsSlideProps) {
  const m3 = useM3();
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (isActive && !hasTriggered.current) {
      hasTriggered.current = true;
    }
  }, [isActive]);

  return (
    <View style={[styles.container, { backgroundColor: m3.colorScheme.background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={[
            styles.panel,
            {
              backgroundColor: colorWithOpacity(m3.surface.surfaceContainerHigh, 0.7),
              borderColor: colorWithOpacity(m3.colorScheme.outline, 0.12),
            },
          ]}
        >
          <View style={styles.header}>
            <View
              style={[
                styles.sectionBadge,
                { backgroundColor: colorWithOpacity(m3.colorScheme.tertiary, 0.16) },
              ]}
            >
              <Text style={[styles.sectionBadgeText, { color: m3.colorScheme.tertiary }]}>
                Where margins disappear
              </Text>
            </View>
            <Text style={[styles.title, { color: m3.colorScheme.onSurface }]}>
              The leaks are operational, not seasonal.
            </Text>
            <Text style={[styles.subtitle, { color: m3.colorScheme.onSurfaceVariant }]}>
              VineSight closes the quiet gaps that turn into rejected fruit, overtime disputes, and
              water waste.
            </Text>
          </View>

          <View style={styles.cardsContainer}>
            {VALUE_PROPS.map((prop, index) => {
              const resolvedColor = prop.color === 'primary' ? m3.colorScheme.primary : prop.color;
              return (
                <Animated.View
                  key={prop.title}
                  entering={
                    isActive
                      ? FadeInDown.delay(index * 120)
                          .duration(450)
                          .springify()
                          .damping(14)
                      : undefined
                  }
                  style={[
                    styles.card,
                    {
                      backgroundColor: colorWithOpacity(m3.colorScheme.surface, 0.82),
                      borderColor: colorWithOpacity(m3.colorScheme.outline, 0.1),
                    },
                  ]}
                >
                  <View style={styles.cardInner}>
                    <View style={styles.cardLeading}>
                      <View
                        style={[
                          styles.iconCircle,
                          { backgroundColor: colorWithOpacity(resolvedColor, 0.12) },
                        ]}
                      >
                        <SymbolIcon name={prop.icon} size={22} color={resolvedColor} />
                      </View>
                      <View
                        style={[
                          styles.rule,
                          { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.18) },
                        ]}
                      />
                    </View>

                    <View style={styles.cardText}>
                      <Text style={[styles.cardEyebrow, { color: resolvedColor }]}>
                        Priority risk
                      </Text>
                      <Text style={[styles.cardTitle, { color: m3.colorScheme.onSurface }]}>
                        {prop.title}
                      </Text>
                      <Text
                        style={[styles.cardDescription, { color: m3.colorScheme.onSurfaceVariant }]}
                      >
                        {prop.description}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </View>

          <View
            style={[
              styles.footerStrip,
              { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08) },
            ]}
          >
            <SymbolIcon name="chart.line.uptrend.xyaxis" size={18} color={m3.colorScheme.primary} />
            <Text style={[styles.footerText, { color: m3.colorScheme.onSurface }]}>
              Teams that log work as it happens operate faster when harvest pressure hits.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
  },
  scrollContent: {
    paddingBottom: spacing[6],
  },
  panel: {
    borderWidth: 1,
    borderRadius: borderRadius['4xl'],
    padding: spacing[4],
    gap: spacing[4],
  },
  header: {
    gap: spacing[2],
  },
  sectionBadge: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  sectionBadgeText: {
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
    fontSize: fontSize.sm,
    lineHeight: 22,
  },
  cardsContainer: {
    gap: spacing[2],
  },
  card: {
    borderRadius: borderRadius['2xl'],
    borderWidth: 1,
    padding: spacing[3],
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  cardLeading: {
    alignItems: 'center',
    gap: spacing[2],
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rule: {
    width: 1,
    height: 56,
  },
  cardText: {
    flex: 1,
    gap: spacing[1],
  },
  cardEyebrow: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  cardDescription: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  footerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  footerText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 20,
    fontWeight: fontWeight.medium,
  },
});
