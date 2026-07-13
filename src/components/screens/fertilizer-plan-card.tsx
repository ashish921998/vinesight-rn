import React from 'react';
import { View, Text, Pressable, type TextStyle, type StyleProp } from 'react-native';
import type { TFunction } from 'i18next';
import { Symbol } from '@/components/ui/symbol';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatDate } from '@/i18n/format';
import { formatLocalDate, addDays } from '@/utils/date';
import type { FertilizerPlan, FertilizerPlanItem } from '@/types/fertilizer-plan';
import { format, isWaterConcentrationUnit, parseUnit, totalFor } from '@/lib/quantity';

type M3 = ReturnType<typeof useM3>;

export type PlanItemQuantityDisplay = {
  headline: string;
  subtitle: string | null;
  isDerivedTotal: boolean;
};

function formatStoredRate(input: FertilizerPlanItem): string | null {
  if (input.quantity === null || input.quantity === undefined) return null;
  return input.unit ? `${input.quantity} ${input.unit}` : `${input.quantity}`;
}

function countUnitLabel(unit: string): string {
  return unit.split('/')[0]?.trim() ?? '';
}

export function planItemQuantityDisplay(
  input: FertilizerPlanItem,
  areaAcres?: number | null,
): PlanItemQuantityDisplay | null {
  const rate = formatStoredRate(input);
  if (!rate) return null;
  if (input.quantity === null || input.quantity === undefined) return null;
  if (!input.unit) return { headline: rate, subtitle: null, isDerivedTotal: false };

  if (isWaterConcentrationUnit(input.unit)) {
    return { headline: rate, subtitle: null, isDerivedTotal: false };
  }

  const parsed = parseUnit(input.unit);
  const quantityBasis = parsed?.basis === 'total' ? 'per_acre' : undefined;
  if (!parsed || (parsed.basis !== 'per_acre' && quantityBasis !== 'per_acre')) {
    return { headline: rate, subtitle: null, isDerivedTotal: false };
  }

  const total = totalFor(
    { quantity: input.quantity, unit: input.unit, quantityBasis },
    { areaAcres },
  );

  if (!total) {
    return { headline: rate, subtitle: null, isDerivedTotal: false };
  }

  return {
    headline:
      total.measure === 'count'
        ? `${format(total.value, total.measure, { approx: true })} ${countUnitLabel(input.unit)}`.trim()
        : format(total.value, total.measure, { approx: true }),
    subtitle: rate,
    isDerivedTotal: true,
  };
}

/**
 * The one-line subtitle under the consultant name. Renders nothing when there
 * is no update date.
 */
export function PlanByline({ plan, m3, t }: { plan: FertilizerPlan; m3: M3; t: TFunction }) {
  const segments = [
    plan.updated_at
      ? // Pass the raw string so formatDate applies its date-only UTC handling —
        // wrapping in new Date() shifts date-only values by timezone.
        t('farmDetails.fertilizerPlan.updatedLabel', {
          date: formatDate(plan.updated_at, { month: 'short', day: 'numeric' }),
        })
      : null,
  ].filter(Boolean);
  if (segments.length === 0) return null;
  return (
    <Text
      numberOfLines={1}
      style={{ color: m3.colorScheme.onSurfaceVariant, fontSize: fontSize.sm, marginTop: 2 }}
    >
      {segments.join(' · ')}
    </Text>
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

type ScheduleBucketKey = 'thisWeek' | 'upcoming' | 'earlier';

/**
 * Split a plan's items into time buckets relative to today: this week (today
 * through +6 days), upcoming, and earlier. Returns null when no item carries a
 * date — callers fall back to the flat sort_order list. Dateless items in an
 * otherwise dated plan land in "upcoming" so they are never silently dropped.
 *
 * Dates are compared as `YYYY-MM-DD` strings (lexicographic == chronological
 * for this form), anchored to the local calendar via the canonical date utils
 * so a date-only `application_date` never drifts by timezone.
 */
function bucketItems(
  items: FertilizerPlanItem[],
): { key: ScheduleBucketKey; items: FertilizerPlanItem[] }[] | null {
  if (!items.some((item) => item.application_date)) return null;
  const today = formatLocalDate(new Date());
  const weekAhead = addDays(today, 7) ?? today;
  const buckets: Record<ScheduleBucketKey, FertilizerPlanItem[]> = {
    thisWeek: [],
    upcoming: [],
    earlier: [],
  };
  for (const item of items) {
    const raw = item.application_date?.slice(0, 10) ?? null;
    // Only bucket dates in canonical `YYYY-MM-DD` form — that's the only shape
    // for which lexicographic comparison is chronological. A malformed value
    // (non-zero-padded, unexpected format) would otherwise be misclassified
    // into the wrong bucket, so fall back to `upcoming` rather than risk it.
    const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
    if (!date) buckets.upcoming.push(item);
    else if (date < today) buckets.earlier.push(item);
    else if (date < weekAhead) buckets.thisWeek.push(item);
    else buckets.upcoming.push(item);
  }
  // "What do I do now" first, history last (dimmed) — not strict chronology.
  return (['thisWeek', 'upcoming', 'earlier'] as const)
    .map((key) => ({ key, items: buckets[key] }))
    .filter((bucket) => bucket.items.length > 0);
}

/** One schedule item: name + date up top, the quantity as the visual anchor. */
function ScheduleItemCard({
  input,
  m3,
  t,
  dateLabel,
  dimmed,
  areaAcres,
  onLogTap,
}: {
  input: FertilizerPlanItem;
  m3: M3;
  t: TFunction;
  dateLabel: string | null;
  dimmed: boolean;
  areaAcres?: number | null;
  /** One-tap log button handler. Absent for history items and ppm plan items. */
  onLogTap?: (() => void) | null;
}) {
  const isPpm = isWaterConcentrationUnit(input.unit);
  const quantityDisplay = planItemQuantityDisplay(input, areaAcres);

  return (
    <View
      style={{
        borderRadius: m3.shape.cornerLarge,
        backgroundColor: m3.surface.surfaceContainerLow,
        borderWidth: 1,
        borderColor: m3.colorScheme.outlineVariant,
        padding: spacing[3] + 2,
        opacity: dimmed ? 0.55 : 1,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing[2],
        }}
      >
        <Text
          style={{
            flex: 1,
            color: m3.colorScheme.onSurface,
            ...m3.typography.bodyMedium,
            fontWeight: fontWeight.semibold,
          }}
        >
          {input.name || t('farmDetails.fertilizerPlan.unknownInput')}
        </Text>
        {dateLabel ? (
          <Text style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelSmall }}>
            {dateLabel}
          </Text>
        ) : null}
      </View>
      {quantityDisplay ? (
        <Text
          style={{
            color: m3.colorScheme.onSurface,
            fontSize: fontSize.xl,
            fontWeight: fontWeight.bold,
            marginTop: spacing[1],
          }}
        >
          {quantityDisplay.headline}
        </Text>
      ) : null}
      {quantityDisplay?.subtitle ? (
        <Text
          style={{
            color: m3.colorScheme.onSurfaceVariant,
            fontSize: fontSize.sm,
            marginTop: 2,
          }}
        >
          {t('farmDetails.fertilizerPlan.rateSubtitle', {
            rate: quantityDisplay.subtitle,
          })}
        </Text>
      ) : null}
      {input.notes ? (
        <Text
          style={{
            color: m3.colorScheme.onSurfaceVariant,
            fontSize: fontSize.sm,
            marginTop: spacing[1],
          }}
        >
          {input.notes}
        </Text>
      ) : null}

      {/* ppm items: explanatory notice instead of a log button — the dose
          cannot be prefilled without silently misrepresenting its meaning. */}
      {isPpm ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: spacing[2],
            gap: 5,
          }}
        >
          <Symbol name="info.circle" size={12} color={m3.colorScheme.onSurfaceVariant} />
          <Text style={{ flex: 1, fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
            {t(
              'farmDetails.fertilizerPlan.ppmNotice',
              "ppm doses can't be quick-added — enter manually",
            )}
          </Text>
        </View>
      ) : onLogTap != null ? (
        /* One-tap "Log this" button: one press navigates to the fertigation
           form with this item prefilled via the kernel (issue #197). */
        <Pressable
          onPress={onLogTap}
          accessibilityRole="button"
          accessibilityLabel={t('farmDetails.fertilizerPlan.logThisItem', {
            name: input.name || t('farmDetails.fertilizerPlan.unknownInput'),
            defaultValue: 'Log {{name}}',
          })}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            marginTop: spacing[2],
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[1] + 1,
            borderRadius: borderRadius.full,
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
            gap: 4,
          }}
        >
          <Symbol name="plus.circle" size={13} color={m3.colorScheme.primary} />
          <Text
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.semibold,
              color: m3.colorScheme.primary,
            }}
          >
            {t('farmDetails.fertilizerPlan.logThis', 'Log this')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Date label for an item card: its application date, or a Week-N fallback in
 * flat (undated) lists where the index still communicates sequence. */
function itemDateLabel(input: FertilizerPlanItem, index: number, t: TFunction): string {
  // Pass the raw date string so formatDate can apply its date-only UTC
  // handling — wrapping in new Date() shifts date-only values by timezone
  // and can render the wrong day.
  return input.application_date
    ? formatDate(input.application_date, { month: 'short', day: 'numeric' })
    : `${t('farmDetails.fertilizerPlan.week', 'Week')} ${index + 1}`;
}

/**
 * The schedule list for a plan's items (or an empty-state line).
 *
 * The `current` variant groups items into time buckets relative to today —
 * "This week" first (accented), then "Upcoming", then "Earlier" (dimmed) — so
 * the farmer's next action is always at the top. The `history` variant (and any
 * plan whose items carry no dates) renders the flat sort_order list, since
 * bucketing an old plan against today would dim everything.
 *
 * `onLogItem` fires when the farmer taps the one-tap log button on an item.
 * History items never render the button; ppm items show a notice instead.
 */
export function PlanSchedule({
  plan,
  m3,
  t,
  variant = 'current',
  areaAcres,
  onLogItem,
}: {
  plan: FertilizerPlan;
  m3: M3;
  t: TFunction;
  variant?: 'current' | 'history';
  areaAcres?: number | null;
  /** One-tap log callback; absent for history variant (past plans). */
  onLogItem?: (item: FertilizerPlanItem) => void;
}) {
  if (plan.items.length === 0) {
    return (
      <Text style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.bodyMedium }}>
        {t('farmDetails.fertilizerPlan.noInputs')}
      </Text>
    );
  }

  const buckets = variant === 'current' ? bucketItems(plan.items) : null;

  if (!buckets) {
    return (
      <View style={{ gap: spacing[3] }}>
        <SectionLabel color={m3.colorScheme.onSurfaceVariant} style={{ marginTop: spacing[1] }}>
          {variant === 'history'
            ? t('farmDetails.fertilizerPlan.pastSchedule', 'Schedule')
            : t('farmDetails.fertilizerPlan.recommendedSchedule', 'Recommended Schedule')}
        </SectionLabel>
        {plan.items.map((input, index) => (
          <ScheduleItemCard
            key={input.id}
            input={input}
            m3={m3}
            t={t}
            dateLabel={itemDateLabel(input, index, t)}
            dimmed={false}
            areaAcres={areaAcres}
            onLogTap={variant === 'current' && onLogItem != null ? () => onLogItem(input) : null}
          />
        ))}
      </View>
    );
  }

  const bucketMeta: Record<ScheduleBucketKey, { label: string; color: string; dimmed: boolean }> = {
    thisWeek: {
      label: t('farmDetails.fertilizerPlan.thisWeek', 'This week'),
      color: m3.primary.p500,
      dimmed: false,
    },
    upcoming: {
      label: t('farmDetails.fertilizerPlan.upcoming', 'Upcoming'),
      color: m3.colorScheme.onSurfaceVariant,
      dimmed: false,
    },
    earlier: {
      label: t('farmDetails.fertilizerPlan.earlier', 'Earlier'),
      color: m3.colorScheme.onSurfaceVariant,
      dimmed: true,
    },
  };

  return (
    <View style={{ gap: spacing[3] }}>
      {buckets.map((bucket) => (
        <View key={bucket.key} style={{ gap: spacing[3] }}>
          <SectionLabel color={bucketMeta[bucket.key].color} style={{ marginTop: spacing[1] }}>
            {bucketMeta[bucket.key].label}
          </SectionLabel>
          {bucket.items.map((input) => (
            <ScheduleItemCard
              key={input.id}
              input={input}
              m3={m3}
              t={t}
              dateLabel={
                input.application_date
                  ? formatDate(input.application_date, { month: 'short', day: 'numeric' })
                  : null
              }
              dimmed={bucketMeta[bucket.key].dimmed}
              areaAcres={areaAcres}
              onLogTap={onLogItem != null ? () => onLogItem(input) : null}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * A historical plan, rendered as a collapsible card: consultant + a
 * "created · N inputs" subtitle, expanding to reveal its notes and schedule.
 */
export function PreviousPlanCard({
  plan,
  m3,
  t,
  expanded,
  areaAcres,
  onToggle,
}: {
  plan: FertilizerPlan;
  m3: M3;
  t: TFunction;
  expanded: boolean;
  areaAcres?: number | null;
  onToggle: () => void;
}) {
  const subtitle = [
    plan.created_at
      ? t('farmDetails.fertilizerPlan.createdLabel', {
          defaultValue: 'Created {{date}}',
          // Pass the raw string so formatDate can apply its date-only UTC
          // handling if ever needed; for a full timestamptz this is equivalent
          // to wrapping in new Date() but stays consistent with the PR's other
          // date calls.
          date: formatDate(plan.created_at, {
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
              {plan.consultant_name
                ? t('farmDetails.fertilizerPlan.consultantLabel', {
                    name: plan.consultant_name,
                  })
                : t('farmDetails.fertilizerPlan.consultantUnknown')}
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
          <PlanSchedule plan={plan} m3={m3} t={t} variant="history" areaAcres={areaAcres} />
        </View>
      ) : null}
    </View>
  );
}
