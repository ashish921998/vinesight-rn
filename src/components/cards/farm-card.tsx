/**
 * FarmCard Component
 * Design D (Season Timeline) with Design A urgency signals.
 * Shows: season progress bar, day counter, water status, harvest estimate.
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
import { useM3, useThemeColors } from '@/styles/use-theme';

interface FarmCardProps {
  farm: Farm;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const SEASON_LENGTH_DAYS = 130;

const MILESTONES = [
  { pct: 0, labelKey: 'farmCard.season.pruning' },
  { pct: 35, labelKey: 'farmCard.season.bloom' },
  { pct: 65, labelKey: 'farmCard.season.veraison' },
  { pct: 100, labelKey: 'farmCard.season.harvest' },
] as const;

function useDaysSincePruning(dateOfPruning: string | null | undefined): number | null {
  return useMemo(() => {
    if (!dateOfPruning) return null;
    const pruningDate = parseDbDateToLocalDate(dateOfPruning);
    if (!pruningDate) return null;
    const today = new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const pruneUtc = Date.UTC(
      pruningDate.getFullYear(),
      pruningDate.getMonth(),
      pruningDate.getDate(),
    );
    const diff = Math.floor((todayUtc - pruneUtc) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : null;
  }, [dateOfPruning]);
}

function useEstimatedHarvestLabel(
  dateOfPruning: string | null | undefined,
  locale: string,
): string | null {
  return useMemo(() => {
    if (!dateOfPruning) return null;
    const pruningDate = parseDbDateToLocalDate(dateOfPruning);
    if (!pruningDate) return null;
    const harvest = new Date(
      pruningDate.getFullYear(),
      pruningDate.getMonth(),
      pruningDate.getDate() + SEASON_LENGTH_DAYS,
    );
    return harvest.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  }, [dateOfPruning, locale]);
}

export function FarmCard({ farm, onPress, onEdit, onDelete }: FarmCardProps) {
  const m3 = useM3();
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();

  const daysSincePruning = useDaysSincePruning(farm.date_of_pruning);
  const estimatedHarvestLabel = useEstimatedHarvestLabel(farm.date_of_pruning, i18n.language);
  const lowWater = isLowWater(farm);

  const todayPct =
    daysSincePruning != null ? Math.min(100, (daysSincePruning / SEASON_LENGTH_DAYS) * 100) : null;

  const accentColor = lowWater ? m3.colorScheme.error : colors.primary[500];

  const waterStatusColor = lowWater ? m3.colorScheme.error : colors.surface[500];

  const waterLabel =
    farm.remaining_water != null
      ? `${farm.remaining_water > 0 ? '+' : ''}${farm.remaining_water.toFixed(0)} mm`
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
      {/* Left accent strip */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: accentColor,
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
              {[farm.region, farm.area != null ? `${farm.area} ac` : null, farm.crop_variety]
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
                        ? colorWithOpacity(colors.primary[500], 0.24)
                        : colorWithOpacity(colors.primary[500], 0.1),
                    })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('farmCard.a11y.editFarm', { name: farm.name })}
                  >
                    <UiSymbol name="pencil" size={14} color={colors.primary[500]} />
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

        {/* Season timeline */}
        {todayPct != null && (
          <View style={{ marginTop: spacing[4] }}>
            <View style={{ position: 'relative', height: 40 }}>
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

              {/* Fill */}
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 12,
                  width: `${todayPct}%`,
                  height: 4,
                  borderRadius: 99,
                  backgroundColor: colors.primary[500],
                }}
              />

              {/* Milestone dots + labels */}
              {MILESTONES.map((milestone) => {
                const passed = milestone.pct <= todayPct;
                return (
                  <View
                    key={milestone.pct}
                    style={{
                      position: 'absolute',
                      left: `${milestone.pct}%`,
                      top: 8,
                      transform: [
                        { translateX: milestone.pct === 0 ? 0 : milestone.pct === 100 ? -8 : -4 },
                      ],
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
                        backgroundColor: passed ? colors.primary[500] : colors.surface[200],
                        borderWidth: 2,
                        borderColor: passed ? colors.primary[500] : colors.surface[300],
                        marginLeft: milestone.pct === 0 ? 0 : milestone.pct === 100 ? 0 : 0,
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
                        textAlign:
                          milestone.pct === 0 ? 'left' : milestone.pct === 100 ? 'right' : 'center',
                      }}
                    >
                      {t(milestone.labelKey)}
                    </Text>
                  </View>
                );
              })}

              {/* Today marker */}
              <View
                style={{
                  position: 'absolute',
                  left: `${todayPct}%`,
                  top: 6,
                  transform: [{ translateX: -7 }],
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: colors.surface[100],
                  borderWidth: 3,
                  borderColor: colors.primary[500],
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.18,
                  shadowRadius: 3,
                  elevation: 2,
                }}
              />
            </View>
          </View>
        )}

        {/* Stat strip */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[4],
            marginTop: spacing[3],
            paddingTop: spacing[3],
            borderTopWidth: 1,
            borderTopColor: colorWithOpacity(colors.surface[300], 0.6),
            borderStyle: 'dashed',
          }}
        >
          {/* Water status */}
          {waterLabel != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <UiSymbol name="drop.fill" size={12} color={waterStatusColor} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: fontWeight.semibold,
                  color: waterStatusColor,
                }}
              >
                {waterLabel}
              </Text>
            </View>
          )}

          {/* Harvest estimate */}
          {estimatedHarvestLabel != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <UiSymbol name="calendar" size={12} color={colors.surface[500]} />
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

          {/* Status badge */}
          <View style={{ marginLeft: 'auto' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                height: 20,
                paddingHorizontal: spacing[2],
                borderRadius: borderRadius.full,
                backgroundColor: lowWater
                  ? colorWithOpacity(m3.colorScheme.error, 0.12)
                  : colorWithOpacity(colors.primary[500], 0.12),
              }}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: lowWater ? m3.colorScheme.error : colors.primary[500],
                }}
              />
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: fontWeight.bold,
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                  color: lowWater ? m3.colorScheme.error : colors.primary[500],
                }}
              >
                {lowWater ? t('farmCard.status.needsAttention') : t('farmCard.status.healthy')}
              </Text>
            </View>
          </View>
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
}
