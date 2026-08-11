/**
 * FarmCard Component
 * Compact farm roster row with season progress and operational highlights.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, GestureResponderEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import type { Farm } from '../../types';
import { isLowWater } from '../../types';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { parseDbDateToLocalDate } from '@/utils/date';
import { formatNumber, formatDate } from '@/i18n/format';
import { useM3, useIsDark } from '@/styles/use-theme';

// Light and dark variants of four distinct farm identity colours.
const LIGHT_ACCENTS = ['#355847', '#A56B4F', '#D0A14A', '#4F7A5A'] as const;
const DARK_ACCENTS = ['#4A8B6B', '#9A6A52', '#C49843', '#5A8B65'] as const;

function getFarmAccentColor(farmId: number | undefined, isDark: boolean): string {
  const palette = isDark ? DARK_ACCENTS : LIGHT_ACCENTS;
  // Use an unsigned 32-bit Knuth multiplicative hash so nearby IDs scatter well.
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
  const farmAccentColor = getFarmAccentColor(farm.id, isDark);

  const waterLabel =
    typeof farm.remaining_water === 'number' && Number.isFinite(farm.remaining_water)
      ? t('farmCard.waterBalance.value', {
          value: `${farm.remaining_water >= 0 ? '+' : ''}${formatNumber(farm.remaining_water, {
            maximumFractionDigits: 0,
          })}`,
        })
      : null;

  const todayPct =
    daysSincePruning != null ? Math.min(100, (daysSincePruning / SEASON_LENGTH_DAYS) * 100) : null;
  const boundedTodayPct = todayPct != null ? Math.max(0, Math.min(100, todayPct)) : null;

  const subtitle =
    [farm.region, farm.crop_variety].filter(Boolean).join(' · ') ||
    t('farmCard.details.noDetails', { defaultValue: 'Farm details' });

  // Inline meta fragments — only the pieces that have data, joined by middots.
  // Keeps every tested string present but collapses the old two-tile / pill /
  // badge chrome into a single quiet line.
  const metaFragments: { key: string; node: React.ReactNode }[] = [];
  if (waterLabel != null) {
    metaFragments.push({
      key: 'water',
      node: (
        <Text style={{ color: lowWater ? m3.colorScheme.error : m3.surface.s500 }}>
          {waterLabel}
        </Text>
      ),
    });
  }
  if (estimatedHarvestLabel != null) {
    metaFragments.push({
      key: 'harvest',
      node: <Text style={{ color: m3.surface.s500 }}>{estimatedHarvestLabel}</Text>,
    });
  }
  if (daysSincePruning != null) {
    metaFragments.push({
      key: 'days',
      node: (
        <Text>
          <Text style={{ color: m3.surface.s500 }}>{daysSincePruning} </Text>
          <Text style={{ color: m3.surface.s500 }}>
            {t('farmCard.season.sincePruning', { defaultValue: 'since pruning' })}
          </Text>
        </Text>
      ),
    });
  }

  const renderCardContent = (pressed: boolean) => (
    <View
      style={{
        borderRadius: borderRadius.lg,
        backgroundColor: m3.surface.s100,
        borderWidth: 1,
        borderColor: m3.surface.s300,
        padding: spacing[4],
        overflow: 'hidden',
      }}
    >
      {/* Identity row: a small status dot replaces the avatar box + left strip. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: radius.full,
            backgroundColor: lowWater ? m3.colorScheme.error : farmAccentColor,
          }}
        />
        <Text
          style={{
            flex: 1,
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            color: m3.surface.s900,
            letterSpacing: -0.2,
          }}
          numberOfLines={1}
        >
          {farm.name}
        </Text>
        {(onEdit || onDelete) && (
          <View style={{ flexDirection: 'row', gap: spacing[1] }}>
            {onEdit && (
              <Pressable
                onPress={(event: GestureResponderEvent) => {
                  event.stopPropagation();
                  onEdit();
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: borderRadius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t('farmCard.a11y.editFarm', { name: farm.name })}
              >
                {({ pressed: ap }) => (
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: borderRadius.sm,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: ap ? colorWithOpacity(farmAccentColor, 0.18) : 'transparent',
                    }}
                  >
                    <UiSymbol name="pencil" size={15} color={m3.surface.s500} />
                  </View>
                )}
              </Pressable>
            )}
            {onDelete && (
              <Pressable
                onPress={(event: GestureResponderEvent) => {
                  event.stopPropagation();
                  onDelete();
                }}
                style={{ width: 28, height: 28, justifyContent: 'center', alignItems: 'center' }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t('farmCard.a11y.deleteFarm', { name: farm.name })}
              >
                {({ pressed: ap }) => (
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: borderRadius.sm,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: ap
                        ? colorWithOpacity(m3.colorScheme.error, 0.18)
                        : 'transparent',
                    }}
                  >
                    <UiSymbol name="trash" size={15} color={m3.surface.s500} />
                  </View>
                )}
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Subtitle: region · crop variety */}
      <Text
        style={{
          fontSize: fontSize.sm,
          color: m3.surface.s500,
          marginTop: 2,
          marginLeft: spacing[2] + 8,
        }}
        numberOfLines={1}
      >
        {subtitle}
      </Text>

      {/* Quiet inline meta line: water · harvest · days (only what exists). */}
      {metaFragments.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginTop: spacing[2],
            marginLeft: spacing[2] + 8,
            gap: spacing[2],
          }}
        >
          {metaFragments.map((frag, i) => (
            <View key={frag.key} style={{ flexDirection: 'row', alignItems: 'center' }}>
              {i > 0 && (
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: m3.surface.s400,
                    marginRight: spacing[2],
                  }}
                >
                  ·
                </Text>
              )}
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {frag.node}
              </Text>
            </View>
          ))}
          {lowWater && (
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                color: m3.colorScheme.error,
                marginLeft: spacing[1],
              }}
            >
              {t('farmCard.status.needsAttention')}
            </Text>
          )}
        </View>
      )}

      {/* Slim season progress bar — no milestone dots, no labels. */}
      {boundedTodayPct != null && (
        <View style={{ marginTop: spacing[3], marginLeft: spacing[2] + 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text
              style={{
                fontSize: fontSize['2xs'],
                fontWeight: fontWeight.semibold,
                color: m3.surface.s500,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {t('farmCard.season.progress', { defaultValue: 'Season progress' })}
            </Text>
            <Text
              style={{
                fontSize: fontSize['2xs'],
                fontWeight: fontWeight.bold,
                color: lowWater ? m3.colorScheme.error : farmAccentColor,
                fontVariant: ['tabular-nums'],
              }}
            >
              {Math.round(boundedTodayPct)}%
            </Text>
          </View>
          <View
            style={{
              height: 4,
              marginTop: spacing[2],
              borderRadius: radius.full,
              backgroundColor: m3.surface.s200,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${boundedTodayPct}%`,
                height: '100%',
                borderRadius: radius.full,
                backgroundColor: lowWater ? m3.colorScheme.error : farmAccentColor,
              }}
            />
          </View>
        </View>
      )}

      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
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
