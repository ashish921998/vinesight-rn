/**
 * Explore B v2 — shared visual primitives
 *
 * HeroPanel: gradient panel with a head row (label left, value right).
 * StatStrip: inline stats with bullet separators ("💧 OK · ⏱ D47/130 · ⚑ Harvest 83d").
 * Gauge: fixed-width progress bar with optional reorder-threshold tick.
 * ChipRow: horizontal filter chips. One selected at a time.
 * ListRowB: dense row layout — 4px accent | content | right meta.
 * AttentionDot: small amber dot used inline with a name.
 *
 * Used by FarmsPaneB and WarehousePaneB inside (tabs)/explore.tsx.
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3, useIsDark } from '@/styles/use-theme';

// ──────────────────────────────────────────────────────────────────────────
// Shared style constants (stable references for React.memo)
// ──────────────────────────────────────────────────────────────────────────

const HERO_PANEL_CONTAINER = {
  marginHorizontal: spacing[4],
  marginBottom: spacing[2],
  borderRadius: borderRadius.md - 2,
  paddingHorizontal: spacing[3],
  paddingTop: spacing[1] + 2,
  paddingBottom: spacing[2],
} as const;

const HERO_PANEL_HEADER_ROW: ViewStyle = {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 2,
  gap: spacing[2],
};

const HERO_PANEL_LABEL_TEXT = {
  flex: 1,
  fontSize: fontSize['2xs'],
  letterSpacing: 0.8,
  textTransform: 'uppercase' as const,
  fontWeight: fontWeight.bold,
};

const HERO_PANEL_VALUE_TEXT: TextStyle = {
  fontSize: fontSize.xs,
  fontWeight: fontWeight.bold,
  fontVariant: ['tabular-nums'],
};

const STAT_STRIP_CONTAINER: ViewStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  marginTop: spacing[1],
  gap: spacing[2],
};

const STAT_STRIP_SEPARATOR_TEXT = {
  fontSize: fontSize['2xs'],
  fontWeight: fontWeight.normal,
};

const STAT_STRIP_STAT_TEXT = {
  fontSize: fontSize['2xs'],
  fontWeight: fontWeight.semibold,
  flexShrink: 0,
};

const STAT_STRIP_NUMBER_TEXT: TextStyle = {
  fontVariant: ['tabular-nums'],
  fontWeight: fontWeight.bold,
};

// ──────────────────────────────────────────────────────────────────────────
// HeroPanel
// ──────────────────────────────────────────────────────────────────────────

interface HeroPanelProps {
  label: string;
  value?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function HeroPanel({ label, value, children, style }: HeroPanelProps) {
  const m3 = useM3();
  const isDark = useIsDark();

  const gradient: [string, string] = isDark
    ? [m3.surface.surfaceContainerHigh, m3.surface.surfaceContainer]
    : ['#EFE6D4', '#F8F2E4'];

  const labelStyle = { ...HERO_PANEL_LABEL_TEXT, color: m3.colorScheme.onSurfaceVariant };
  const valueStyle = { ...HERO_PANEL_VALUE_TEXT, color: m3.colorScheme.onSurface };

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[HERO_PANEL_CONTAINER, style]}
    >
      <View style={HERO_PANEL_HEADER_ROW}>
        <Text numberOfLines={1} style={labelStyle}>
          {label}
        </Text>
        {value ? <Text style={valueStyle}>{value}</Text> : null}
      </View>
      {children}
    </LinearGradient>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// StatStrip
// ──────────────────────────────────────────────────────────────────────────

export type StatTone = 'default' | 'ok' | 'low';

export interface StatItem {
  /** Optional leading glyph (single character / emoji). Skipped if empty. */
  icon?: string;
  /** Static label text rendered before any number. */
  label?: string;
  /** Highlighted number rendered in tabular-nums. */
  number?: string | number;
  /** Trailing label text after the number. */
  suffix?: string;
  /** Color tone — picks color from the M3 palette. */
  tone?: StatTone;
}

interface StatStripProps {
  stats: StatItem[];
  style?: StyleProp<ViewStyle>;
}

export const StatStrip = React.memo(function StatStrip({ stats, style }: StatStripProps) {
  const m3 = useM3();

  function toneColor(tone: StatTone | undefined): string {
    if (tone === 'ok') return m3.colorScheme.primary;
    if (tone === 'low') return m3.colorScheme.error;
    return m3.colorScheme.onSurfaceVariant;
  }

  const separatorColor = colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.45);

  return (
    <View style={[STAT_STRIP_CONTAINER, style]}>
      {stats.map((stat, index) => {
        const color = toneColor(stat.tone);
        const statStyle = { ...STAT_STRIP_STAT_TEXT, color };
        const numberStyle = { ...STAT_STRIP_NUMBER_TEXT, color: m3.colorScheme.onSurface };
        const separatorStyle = { ...STAT_STRIP_SEPARATOR_TEXT, color: separatorColor };

        return (
          <React.Fragment key={index}>
            {index > 0 ? <Text style={separatorStyle}>·</Text> : null}
            <Text style={statStyle}>
              {stat.icon ? `${stat.icon} ` : ''}
              {stat.label ?? ''}
              {stat.number != null ? <Text style={numberStyle}>{String(stat.number)}</Text> : null}
              {stat.suffix ?? ''}
            </Text>
          </React.Fragment>
        );
      })}
    </View>
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Gauge
// ──────────────────────────────────────────────────────────────────────────

interface GaugeProps {
  /** 0..1 fill ratio. Clamped. */
  value: number;
  /** Fill color. */
  fill: string;
  /** Track color. Defaults to a faint surface tint. */
  trackColor?: string;
  /** Optional reorder threshold marker (0..1). Renders a dark tick at this position. */
  threshold?: number;
  /** Total width of the bar in px. */
  width?: number;
  style?: StyleProp<ViewStyle>;
}

export const Gauge = React.memo(function Gauge({
  value,
  fill,
  trackColor,
  threshold,
  width = 72,
  style,
}: GaugeProps) {
  const m3 = useM3();
  const ratio = Math.max(0, Math.min(1, value));
  const track = trackColor ?? colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.15);
  const tickColor = colorWithOpacity(m3.colorScheme.onSurface, 0.5);

  return (
    <View
      style={[
        {
          width,
          height: 5,
          borderRadius: radius.full,
          backgroundColor: track,
          overflow: 'hidden',
          position: 'relative',
        },
        style,
      ]}
    >
      <View
        style={{
          width: `${ratio * 100}%`,
          height: '100%',
          backgroundColor: fill,
          borderRadius: radius.full,
        }}
      />
      {threshold != null ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            bottom: -2,
            width: 1.5,
            left: `${Math.max(0, Math.min(1, threshold)) * 100}%`,
            backgroundColor: tickColor,
          }}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
});

// ──────────────────────────────────────────────────────────────────────────
// ChipRow
// ──────────────────────────────────────────────────────────────────────────

export interface ChipDef<T extends string = string> {
  key: T;
  label: string;
  count?: number;
}

interface ChipRowProps<T extends string = string> {
  chips: ChipDef<T>[];
  active: T;
  onChange: (key: T) => void;
}

export function ChipRow<T extends string = string>({ chips, active, onChange }: ChipRowProps<T>) {
  const m3 = useM3();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: spacing[2],
        paddingHorizontal: spacing[4],
        paddingBottom: spacing[1] + 2,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {chips.map((chip) => {
        const isActive = active === chip.key;
        return (
          <Pressable
            key={chip.key}
            onPress={() => onChange(chip.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isActive }}
            accessibilityLabel={chip.count != null ? `${chip.label}, ${chip.count}` : chip.label}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              height: 28,
              paddingHorizontal: spacing[3],
              borderRadius: borderRadius.full,
              backgroundColor: isActive
                ? m3.colorScheme.primary
                : pressed
                  ? m3.surface.surfaceContainer
                  : m3.surface.surfaceContainerLow,
              borderWidth: 1,
              borderColor: isActive ? m3.colorScheme.primary : m3.colorScheme.outlineVariant,
            })}
          >
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
                color: isActive
                  ? m3.colorScheme.onPrimary
                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.85),
              }}
            >
              {chip.count != null && chip.count > 0 ? `${chip.label} · ${chip.count}` : chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AttentionDot
// ──────────────────────────────────────────────────────────────────────────

export function AttentionDot({ size = 8 }: { size?: number }) {
  const m3 = useM3();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: m3.colorScheme.error,
        marginLeft: spacing[1] + 2,
      }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

// ──────────────────────────────────────────────────────────────────────────
// ListRowB
// ──────────────────────────────────────────────────────────────────────────

interface ListRowBProps {
  /** Vertical color bar (4px wide) shown on the left edge. */
  accentColor: string;
  /** Main row body (title + sub + StatStrip live here). */
  body: React.ReactNode;
  /** Optional right meta column (stage label + Gauge). */
  meta?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  /** When true, the row has no bottom border (e.g. last item). */
  noBorder?: boolean;
}

export const ListRowB = React.memo(function ListRowB({
  accentColor,
  body,
  meta,
  onPress,
  onLongPress,
  accessibilityLabel,
  noBorder,
}: ListRowBProps) {
  const m3 = useM3();

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing[5],
        paddingVertical: spacing[2] + 2,
        borderBottomWidth: noBorder ? 0 : 1,
        borderBottomColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.18),
        gap: spacing[2] + 2,
      }}
    >
      <View
        style={{
          width: 4,
          alignSelf: 'stretch',
          backgroundColor: accentColor,
          borderRadius: radius.xs,
          minHeight: 56,
        }}
      />
      <View style={{ flex: 1 }}>{body}</View>
      {meta ? <View style={{ minWidth: 86, alignItems: 'flex-end' }}>{meta}</View> : null}
    </View>
  );

  if (!onPress && !onLongPress) {
    return content;
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: colorWithOpacity(m3.colorScheme.primary, 0.08) }}
    >
      {content}
    </Pressable>
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

interface MetaColumnProps {
  /** Uppercase stage label, e.g. "Bloom" / "Veraison" / "Low". */
  label: string;
  /** Tone for the stage label color. */
  tone?: StatTone;
  /** Pass-through to Gauge. */
  gauge: Omit<GaugeProps, 'width'> & { width?: number };
}

/** Common right-meta column used in both panes: stage label stacked on a Gauge. */
export const MetaColumn = React.memo(function MetaColumn({
  label,
  tone = 'default',
  gauge,
}: MetaColumnProps) {
  const m3 = useM3();

  const color =
    tone === 'low'
      ? m3.colorScheme.error
      : tone === 'ok'
        ? m3.colorScheme.primary
        : m3.colorScheme.onSurface;

  const labelStyle: TextStyle = {
    fontSize: fontSize['2xs'],
    fontWeight: fontWeight.bold,
    color,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing[1],
  };

  return (
    <View style={{ alignItems: 'flex-end', gap: spacing[1] }}>
      <Text style={labelStyle}>{label}</Text>
      <Gauge {...gauge} width={gauge.width ?? 86} />
    </View>
  );
});
