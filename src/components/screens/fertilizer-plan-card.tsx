import React from 'react';
import { View, Text, Pressable, type TextStyle, type StyleProp } from 'react-native';
import type { TFunction } from 'i18next';
import { Symbol } from '@/components/ui/symbol';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { formatDate } from '@/i18n/format';
import type { FertilizerPlan } from '@/types/fertilizer-plan';

type M3 = ReturnType<typeof useM3>;

/**
 * Consultant/title label shown at the head of every plan card: the plan's own
 * title if set, otherwise a "Plan by {consultant}" fallback (or an unknown-author
 * label). Single source of truth for both the current and previous-plan headers.
 */
export function planTitle(plan: FertilizerPlan, t: TFunction): string {
  return (
    plan.title?.trim() ||
    (plan.consultant_name
      ? t('farmDetails.fertilizerPlan.consultantLabel', { name: plan.consultant_name })
      : t('farmDetails.fertilizerPlan.consultantUnknown'))
  );
}

/** Uppercase micro-heading used for the "Current", "Previous plans", and schedule sections. */
export function SectionLabel({
  children,
  color,
  style,
}: {
  children: React.ReactNode;
  color: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        {
          fontSize: fontSize.xs + 1,
          fontWeight: fontWeight.semibold,
          color,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** The recommended-schedule list for a plan's items (or an empty-state line). */
export function PlanSchedule({ plan, m3, t }: { plan: FertilizerPlan; m3: M3; t: TFunction }) {
  if (plan.items.length === 0) {
    return (
      <Text style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.bodyMedium }}>
        {t('farmDetails.fertilizerPlan.noInputs')}
      </Text>
    );
  }
  return (
    <View style={{ gap: spacing[3] }}>
      <SectionLabel color={m3.colorScheme.onSurfaceVariant} style={{ marginTop: spacing[1] }}>
        {t('farmDetails.fertilizerPlan.recommendedSchedule', 'Recommended Schedule')}
      </SectionLabel>
      {plan.items.map((input, index) => (
        <View
          key={input.id}
          style={{
            backgroundColor: m3.surface.s100,
            borderWidth: 1,
            borderColor: m3.surface.s300,
            borderRadius: borderRadius.md,
            marginBottom: spacing[3],
            flexDirection: 'row',
            overflow: 'hidden',
          }}
        >
          {/* 5px left strip */}
          <View style={{ width: 5, backgroundColor: m3.primary.p500, flexShrink: 0 }} />
          <View style={{ flex: 1, padding: spacing[3] + 2 }}>
            <View style={{ marginBottom: spacing[1] }}>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: m3.surface.s900,
                }}
              >
                {input.name || t('farmDetails.fertilizerPlan.unknownInput')}
              </Text>
            </View>
            {input.quantity !== null && input.quantity !== undefined && (
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  color: m3.surface.s900,
                  marginBottom: spacing[1],
                }}
              >
                {input.quantity}
                {input.unit ? ` ${input.unit}` : ''}{' '}
                {t('farmDetails.fertilizerPlan.perAcre', '/ acre')}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: spacing[4] }}>
              <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
                {input.application_date
                  ? formatDate(new Date(input.application_date), { month: 'short', day: 'numeric' })
                  : `${t('farmDetails.fertilizerPlan.week', 'Week')} ${index + 1}`}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * A historical plan, rendered as a collapsible card: title + a "created · N inputs"
 * subtitle, expanding to reveal the plan notes and its full schedule.
 */
export function PreviousPlanCard({
  plan,
  m3,
  t,
  expanded,
  onToggle,
}: {
  plan: FertilizerPlan;
  m3: M3;
  t: TFunction;
  expanded: boolean;
  onToggle: () => void;
}) {
  const subtitle = [
    plan.created_at
      ? t('farmDetails.fertilizerPlan.createdLabel', {
          defaultValue: 'Created {{date}}',
          date: formatDate(new Date(plan.created_at), {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
        })
      : '',
    plan.items.length > 0
      ? t('farmDetails.fertilizerPlan.inputsCount', { count: plan.items.length })
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      style={{
        borderRadius: m3.shape.cornerLarge,
        backgroundColor: m3.surface.surfaceContainerLow,
        borderWidth: 1,
        borderColor: m3.colorScheme.outlineVariant,
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={{ padding: spacing[4] }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing[2],
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: m3.colorScheme.onSurface,
                ...m3.typography.bodyMedium,
                fontWeight: fontWeight.semibold,
              }}
            >
              {planTitle(plan, t)}
            </Text>
            {subtitle ? (
              <Text
                style={{
                  color: m3.colorScheme.onSurfaceVariant,
                  ...m3.typography.labelSmall,
                  marginTop: spacing[1],
                }}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Symbol
            name={expanded ? 'chevron.up' : 'chevron.down'}
            size={18}
            color={m3.colorScheme.onSurfaceVariant}
          />
        </View>
      </Pressable>
      {expanded ? (
        <View style={{ paddingHorizontal: spacing[4], paddingBottom: spacing[4] }}>
          {plan.notes ? (
            <Text
              style={{
                color: m3.colorScheme.onSurfaceVariant,
                ...m3.typography.bodyMedium,
                marginBottom: spacing[2],
              }}
            >
              {plan.notes}
            </Text>
          ) : null}
          <PlanSchedule plan={plan} m3={m3} t={t} />
        </View>
      ) : null}
    </View>
  );
}
