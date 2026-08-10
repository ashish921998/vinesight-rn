/**
 * FarmsPaneB — B v2 redesign of the farms pane inside Explore.
 *
 * List: dense rows with water status / day count / harvest countdown.
 *
 * Receives data + handlers as props; owns no fetching state.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, FlatList, Pressable, type RefreshControlProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, EmptyState, LoadingState } from '@/components/ui';
import { GUIDED_TOUR_TARGET_IDS, GuidedTourTarget } from '@/features/guided-tour';
import { fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { parseDbDateToLocalDate } from '@/utils/date';
import { formatNumber } from '@/i18n/format';
import { useM3 } from '@/styles/use-theme';
import type { Farm } from '@/types';
import { isLowWater } from '@/types';

const SEASON_LENGTH_DAYS = 130;

function daysBetween(later: Date, earlier: Date): number {
  const laterUtc = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  const earlierUtc = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.floor((laterUtc - earlierUtc) / (1000 * 60 * 60 * 24));
}

function getDaysSincePruning(dateOfPruning: string | null | undefined, today: Date): number | null {
  if (!dateOfPruning) return null;
  const pruningDate = parseDbDateToLocalDate(dateOfPruning);
  if (!pruningDate) return null;
  const diff = daysBetween(today, pruningDate);
  return diff >= 0 ? diff : null;
}

interface FarmsPaneBProps {
  farms: Farm[] | undefined;
  isLoading: boolean;
  today: Date;
  searchQuery: string;
  onAddFarm: () => void;
  onFarmPress: (farm: Farm) => void;
  onEditFarm: (farm: Farm) => void;
  /** Bottom padding for the list (accommodates FAB / nav bar). */
  listBottomPadding?: number;
  /** Refresh control passed through to the FlatList. */
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /** Enables the Add Farm guided-tour anchor in the empty state. */
  addFarmTargetEnabled?: boolean;
}

export function FarmsPaneB({
  farms,
  isLoading,
  today,
  searchQuery,
  onAddFarm,
  onFarmPress,
  onEditFarm,
  listBottomPadding,
  refreshControl,
  addFarmTargetEnabled = false,
}: FarmsPaneBProps) {
  const m3 = useM3();
  const { t } = useTranslation();

  // ── Search ──────────────────────────────────────────────────────────────
  const filteredFarms = useMemo<Farm[]>(() => {
    if (!farms) return [];
    const query = searchQuery.toLowerCase().trim();
    if (!query) return farms;
    return farms.filter(
      (f) =>
        f.name.toLowerCase().includes(query) ||
        f.crop?.toLowerCase().includes(query) ||
        f.crop_variety?.toLowerCase().includes(query) ||
        f.region?.toLowerCase().includes(query),
    );
  }, [farms, searchQuery]);

  // ── Empty + loading ─────────────────────────────────────────────────────
  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return <LoadingState label={t('common.loading')} />;
    }
    if (searchQuery.trim()) {
      return <EmptyState icon="magnifyingglass" title={t('common.noResultsFound')} />;
    }
    return (
      <EmptyState
        icon="leaf.fill"
        title={t('farms.empty.title')}
        description={t('farms.empty.subtitle')}
        action={
          <GuidedTourTarget
            targetId={GUIDED_TOUR_TARGET_IDS.ADD_FARM_PRIMARY}
            enabled={addFarmTargetEnabled}
            style={{ alignSelf: 'center' }}
          >
            <Button title={t('farms.addFarm')} onPress={onAddFarm} fullWidth={false} />
          </GuidedTourTarget>
        }
      />
    );
  }, [isLoading, searchQuery, t, addFarmTargetEnabled, onAddFarm]);

  // ── Row render ──────────────────────────────────────────────────────────
  const renderFarm = useCallback(
    ({ item }: { item: Farm }) => {
      const days = getDaysSincePruning(item.date_of_pruning, today);
      const pastHarvest = days != null && days >= SEASON_LENGTH_DAYS;
      const lowWater = isLowWater(item);

      const stage =
        days == null
          ? t('explore.farms.stage.notStarted', { defaultValue: 'Not started' })
          : days < SEASON_LENGTH_DAYS * 0.35
            ? t('farmCard.season.pruning', { defaultValue: 'Pruning' })
            : days < SEASON_LENGTH_DAYS * 0.65
              ? t('farmCard.season.bloom', { defaultValue: 'Bloom' })
              : !pastHarvest
                ? t('farmCard.season.veraison', { defaultValue: 'Véraison' })
                : t('farmCard.season.harvest', { defaultValue: 'Harvest' });

      const area = Number(item.area);
      const subtitleParts = [
        item.crop_variety,
        Number.isFinite(area)
          ? `${formatNumber(area, { maximumFractionDigits: 1 })} ha`
          : undefined,
        item.region,
      ].filter(Boolean);

      return (
        <Pressable
          onPress={() => onFarmPress(item)}
          onLongPress={() => onEditFarm(item)}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${stage}${lowWater ? `, ${t('explore.farms.water.low', { defaultValue: 'Low water' })}` : ''}`}
          android_ripple={{ color: colorWithOpacity(m3.colorScheme.primary, 0.08) }}
          style={{
            marginHorizontal: spacing[4],
            marginBottom: spacing[2],
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[3],
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: m3.colorScheme.outlineVariant,
            backgroundColor: m3.surface.surfaceContainerLow,
          }}
        >
          <View>
            {/* Name + inline needs-water flag. */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.bold,
                  color: m3.colorScheme.onSurface,
                  flexShrink: 1,
                }}
              >
                {item.name}
              </Text>
              {lowWater ? (
                <Text
                  style={{
                    marginLeft: spacing[2],
                    fontSize: fontSize['2xs'],
                    fontWeight: fontWeight.bold,
                    color: m3.colorScheme.error,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}
                >
                  {t('explore.farms.water.low', { defaultValue: 'Low water' })}
                </Text>
              ) : null}
            </View>

            {/* Subtitle: crop variety · area · region. */}
            <Text
              numberOfLines={1}
              style={{
                fontSize: fontSize.xs,
                color: m3.colorScheme.onSurfaceVariant,
                marginTop: 2,
              }}
            >
              {subtitleParts.join(' · ')}
            </Text>

            {/* Stage + day count as plain muted text (no colored bar). */}
            <Text
              style={{
                fontSize: fontSize['2xs'],
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.onSurfaceVariant,
                marginTop: spacing[1],
                fontVariant: ['tabular-nums'],
              }}
            >
              {days != null ? `${stage} · ${days}/${SEASON_LENGTH_DAYS}` : stage}
            </Text>
          </View>
        </Pressable>
      );
    },
    [onFarmPress, onEditFarm, today, t, m3],
  );

  return (
    <FlatList
      data={filteredFarms}
      renderItem={renderFarm}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={renderEmpty}
      contentContainerStyle={{
        paddingTop: spacing[1] + 2,
        paddingBottom: listBottomPadding ?? spacing[16],
        paddingHorizontal: 0,
        flexGrow: 1,
      }}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}
