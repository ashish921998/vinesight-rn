/**
 * FarmCard Component
 * Design D (Season Timeline): per-farm accent colour, dashed stat strip,
 * season progress bar, day counter, water status, harvest estimate.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, GestureResponderEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import type { Farm } from '../../types';
import { isLowWater } from '../../types';
import { spacing, borderRadius, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { parseDbDateToLocalDate } from '@/utils/date';
import { formatNumber, formatDate } from '@/i18n/format';
import { useM3, useThemeColors, useIsDark } from '@/styles/use-theme';

// ── Per-farm accent palette ──────────────────────────────────────────────────
// Light and dark variants of 4 distinct brand colours:
//   0 → primary green  1 → terracotta  2 → ochre  3 → success green
const LIGHT_ACCENTS = ['#355847', '#A56B4F', '#D0A14A', '#4F7A5A'] as const;
const DARK_ACCENTS = ['#4A8B6B', '#9A6A52', '#C49843', '#5A8B65'] as const;

/**
 * Returns a stable, visually-distinct accent colour for a given farm.
 * The colour is derived from the farm's numeric id so it never changes
 * between renders or sessions.
 */
function getFarmAccentColor(farmId: number | undefined, isDark: boolean): string {
  const palette = isDark ? DARK_ACCENTS : LIGHT_ACCENTS;
  // Use unsigned 32-bit Knuth multiplicative hash so nearby IDs scatter well.
  const idx = farmId != null ? ((farmId * 2654435761) >>> 0) % palette.length : 0;
  return palette[idx];
}

interface FarmCardProps {
  farm: Farm;
  today?: Date;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const SEASON_LENGTH_DAYS = 130;
const MILESTONE_LABEL_WIDTH = 72;

const MILESTONES = [
  { pct: 0, labelKey: 'farmCard.season.pruning' },
  { pct: 35, labelKey: 'farmCard.season.bloom' },
  { pct: 65, labelKey: 'farmCard.season.veraison' },
  { pct: 100, labelKey: 'farmCard.season.harvest' },
] as const;

function useDaysSincePruning(dateOfPruning: string | null | undefined, today: Date): number | null {
  return useMemo(() => {
    if (!dateOfPruning) return null;
    const pruningDate = parseDbDateToLocalDate(dateOfPruning);
    if (!pruningDate) return null;
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const pruneUtc = Date.UTC(
      pruningDate.getFullYear(),
      pruningDate.getMonth(),
      pruningDate.getDate(),
    );
    const diff = Math.floor((todayUtc - pruneUtc) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : null;
  }, [dateOfPruning, today]);
}

function useEstimatedHarvestLabel(
  dateOfPruning: string | null | undefined,
  locale: string,
): string | null {
  return useMemo(() => {
    void locale;
    if (!dateOfPruning) return null;
    const pruningDate = parseDbDateToLocalDate(dateOfPruning);
    if (!pruningDate) return null;
    const harvest = new Date(
      pruningDate.getFullYear(),
      pruningDate.getMonth(),
      pruningDate.getDate() + SEASON_LENGTH_DAYS,
    );
    return formatDate(harvest, { day: 'numeric', month: 'short' });
  }, [dateOfPruning, locale]);
}

export const FarmCard = React.memo(function FarmCard({
  farm,
  today = new Date(),
  onPress,
  onEdit,
  onDelete,
}: FarmCardProps) {
  const m3 = useM3();
  const colors = useThemeColors();
  const isDark = useIsDark();
  const { t, i18n } = useTranslation();

  const daysSincePruning = useDaysSincePruning(farm.date_of_pruning, today);
  const estimatedHarvestLabel = useEstimatedHarvestLabel(
    farm.date_of_pruning,
    i18n?.resolvedLanguage || i18n?.language || 'en',
  );
  const hasWaterData =
    typeof farm.remaining_water === 'number' &&
    Number.isFinite(farm.remaining_water) &&
    typeof farm.total_tank_capacity === 'number' &&
    Number.isFinite(farm.total_tank_capacity) &&
    farm.total_tank_capacity > 0;
  const lowWater = hasWaterData && isLowWater(farm);

  const todayPct =
    daysSincePruning != null ? Math.min(100, (daysSincePruning / SEASON_LENGTH_DAYS) * 100) : null;
  const boundedTodayPct = todayPct != null ? Math.max(0, Math.min(100, todayPct)) : null;
  const todayMarkerTranslateX =
    boundedTodayPct == null ? -7 : boundedTodayPct >= 99 ? -14 : boundedTodayPct <= 1 ? 0 : -7;

  // Design D: each farm gets a stable identity colour from the palette;
  // low-water farms override the left strip with error red so urgency is
  // immediately visible without sacrificing the per-farm accent on the timeline.
  const farmAccentColor = getFarmAccentColor(farm.id, isDark);
  const leftStripColor = lowWater ? m3.colorScheme.error : farmAccentColor;

  // Water label uses the accent colour (green) when OK, error red when low.
  const waterLabelColor = lowWater ? m3.colorScheme.error : colors.success;

  const waterLabel =
    typeof farm.remaining_water === 'number' && Number.isFinite(farm.remaining_water)
      ? t('farmCard.waterBalance.value', {
          value: `${farm.remaining_water >= 0 ? '+' : ''}${formatNumber(farm.remaining_water, {
            maximumFractionDigits: 0,
          })}`,
        })
      : null;

  const renderCardContent = (pressed: boolean) => (
    <View
      style={{
        borderRadius: borderRadius.md,
        backgroundColor: colors.surface[100],
        borderWidth: 1,
        borderColor: colors.surface[300],
        overflow: 'hidden',
      }}
    >
      {/* Left accent strip — farm identity colour or error when low water */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: leftStripColor,
          borderTopLeftRadius: borderRadius.md,
          borderBottomLeftRadius: borderRadius.md,
        }}
      />

      <View style={{ padding: spacing[4], paddingLeft: spacing[4] + 3 }}>
        {/* Row 1: Farm name + day counter */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <View style={{ flex: 1, marginRight: spacing[3] }}>
            <Text
              style={{
                fontSize: 17,
                fontWeight: fontWeight.bold,
                color: colors.surface[900],
                letterSpacing: -0.2,
                lineHeight: 22,
              }}
              numberOfLines={1}
            >
              {farm.name}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.surface[500],
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {[
                farm.region,
                farm.area != null
                  ? t('farmCard.area.acres', {
                      value: formatNumber(farm.area, { maximumFractionDigits: 1 }),
                    })
                  : null,
                farm.crop_variety,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>

          {/* Day counter + action buttons */}
          <View style={{ alignItems: 'flex-end', gap: spacing[2] }}>
            {/* Edit / delete */}
            {(onEdit || onDelete) && (
              <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                {onEdit && (
                  <Pressable
                    onPress={(e: GestureResponderEvent) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    style={({ pressed: p }) => ({
                      width: 28,
                      height: 28,
                      borderRadius: borderRadius.sm,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: p
                        ? colorWithOpacity(farmAccentColor, 0.24)
                        : colorWithOpacity(farmAccentColor, 0.1),
                    })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('farmCard.a11y.editFarm', { name: farm.name })}
                  >
                    <UiSymbol name="pencil" size={14} color={farmAccentColor} />
                  </Pressable>
                )}
                {onDelete && (
                  <Pressable
                    onPress={(e: GestureResponderEvent) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    style={({ pressed: p }) => ({
                      width: 28,
                      height: 28,
                      borderRadius: borderRadius.sm,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: p
                        ? colorWithOpacity(m3.colorScheme.error, 0.24)
                        : colorWithOpacity(m3.colorScheme.error, 0.1),
                    })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('farmCard.a11y.deleteFarm', { name: farm.name })}
                  >
                    <UiSymbol name="trash" size={14} color={m3.colorScheme.error} />
                  </Pressable>
                )}
              </View>
            )}

            {/* Day counter */}
            {daysSincePruning != null && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: fontWeight.bold,
                    color: colors.surface[900],
                    lineHeight: 26,
                    letterSpacing: -0.5,
                  }}
                >
                  {daysSincePruning}
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: fontWeight.medium,
                      color: colors.surface[500],
                    }}
                  >
                    d
                  </Text>
                </Text>
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: fontWeight.semibold,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: colors.surface[500],
                    marginTop: 2,
                  }}
                >
                  {t('farmCard.season.sincePruning')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Season timeline — fill uses the farm's own accent colour */}
        {boundedTodayPct != null && (
          <View style={{ marginTop: spacing[4] }}>
            <View style={{ position: 'relative', height: 44 }}>
              {/* Track */}
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 12,
                  height: 4,
                  borderRadius: 99,
                  backgroundColor: colors.surface[200],
                  borderWidth: 1,
                  borderColor: colors.surface[300],
                }}
              />

              {/* Fill — farm accent colour */}
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 12,
                  width: `${boundedTodayPct}%`,
                  height: 4,
                  borderRadius: 99,
                  backgroundColor: farmAccentColor,
                }}
              />

              {/* Milestone dots + labels */}
              {MILESTONES.map((milestone) => {
                const passed = milestone.pct <= boundedTodayPct;
                return (
                  <View
                    key={milestone.pct}
                    style={{
                      position: 'absolute',
                      left: `${milestone.pct}%`,
                      top: 8,
                      transform: [
                        {
                          translateX:
                            milestone.pct === 0
                              ? 0
                              : milestone.pct === 100
                                ? -MILESTONE_LABEL_WIDTH
                                : -MILESTONE_LABEL_WIDTH / 2,
                        },
                      ],
                      width: MILESTONE_LABEL_WIDTH,
                      alignItems:
                        milestone.pct === 0
                          ? 'flex-start'
                          : milestone.pct === 100
                            ? 'flex-end'
                            : 'center',
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: passed ? farmAccentColor : colors.surface[200],
                        borderWidth: 2,
                        borderColor: passed ? farmAccentColor : colors.surface[300],
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: fontWeight.semibold,
                        letterSpacing: 0.3,
                        textTransform: 'uppercase',
                        color: colors.surface[500],
                        marginTop: 5,
                        width: MILESTONE_LABEL_WIDTH,
                        textAlign:
                          milestone.pct === 0 ? 'left' : milestone.pct === 100 ? 'right' : 'center',
                      }}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {t(milestone.labelKey)}
                    </Text>
                  </View>
                );
              })}

              {/* Today marker — matches farm accent colour */}
              <View
                style={{
                  position: 'absolute',
                  left: `${boundedTodayPct}%`,
                  top: 6,
                  transform: [{ translateX: todayMarkerTranslateX }],
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: colors.surface[100],
                  borderWidth: 3,
                  borderColor: farmAccentColor,
                  shadowColor: m3.colorScheme.shadow,
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.18,
                  shadowRadius: 3,
                  elevation: 2,
                }}
              />
            </View>
          </View>
        )}

        {/* Stat strip — dashed separator (Design D) */}
        <View
          style={{
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: colorWithOpacity(colors.surface[300], 0.8),
            borderStyle: 'dashed',
            marginTop: spacing[3],
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[4],
            paddingTop: spacing[3],
          }}
        >
          {/* Water status — coloured drop icon + mm value */}
          {waterLabel != null && (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              accessibilityLabel={waterLabel}
            >
              <UiSymbol name="drop.fill" size={12} color={waterLabelColor} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: fontWeight.semibold,
                  color: waterLabelColor,
                }}
              >
                {waterLabel}
              </Text>
            </View>
          )}

          {/* Est. harvest date — leaf icon + date */}
          {estimatedHarvestLabel != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <UiSymbol name="leaf.fill" size={11} color={colors.surface[500]} />
              <Text
                style={{
                  fontSize: 12,
                  color: colors.surface[500],
                }}
              >
                {estimatedHarvestLabel}
              </Text>
            </View>
          )}

          {/* Low-water badge — trailing, only when urgency exists */}
          {lowWater && (
            <View style={{ marginLeft: 'auto' }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  height: 20,
                  paddingHorizontal: spacing[2],
                  borderRadius: borderRadius.full,
                  backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.1),
                }}
              >
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: m3.colorScheme.error,
                  }}
                />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: fontWeight.bold,
                    textTransform: 'uppercase',
                    letterSpacing: 0.3,
                    color: m3.colorScheme.error,
                  }}
                >
                  {t('farmCard.status.needsAttention')}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Press state overlay */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: pressed
              ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
              : 'transparent',
          },
        ]}
      />
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={farm.name}>
        {({ pressed }) => renderCardContent(pressed)}
      </Pressable>
    );
  }

  return renderCardContent(false);
});
