/**
 * FarmsPaneB — B v2 redesign of the farms pane inside Explore.
 *
 * Hero: cross-farm season timeline with TODAY flag.
 * List: dense rows with water status / day count / harvest countdown.
 *
 * Receives data + handlers as props; owns no fetching state.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, FlatList, type RefreshControlProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, EmptyState, LoadingState } from '@/components/ui';
import { GUIDED_TOUR_TARGET_IDS, GuidedTourTarget } from '@/features/guided-tour';
import {
  HeroPanel,
  StatStrip,
  ChipRow,
  ListRowB,
  MetaColumn,
  AttentionDot,
  type ChipDef,
} from '@/components/ui/explore-primitives';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { parseDbDateToLocalDate } from '@/utils/date';
import { formatNumber } from '@/i18n/format';
import { useM3, useIsDark } from '@/styles/use-theme';
import type { Farm } from '@/types';
import { isLowWater } from '@/types';

export type FarmFilter = 'all' | 'healthy' | 'needs_attention';

const SEASON_LENGTH_DAYS = 130;
const LIGHT_ACCENTS = ['#355847', '#A56B4F', '#D0A14A', '#4F7A5A'] as const;
const DARK_ACCENTS = ['#4A8B6B', '#9A6A52', '#C49843', '#5A8B65'] as const;

function getFarmAccentColor(farmId: number | undefined, isDark: boolean): string {
  const palette = isDark ? DARK_ACCENTS : LIGHT_ACCENTS;
  const idx = farmId != null ? ((farmId * 2654435761) >>> 0) % palette.length : 0;
  return palette[idx];
}

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
  activeFilter: FarmFilter;
  onFilterChange: (filter: FarmFilter) => void;
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
  activeFilter,
  onFilterChange,
  onAddFarm,
  onFarmPress,
  onEditFarm,
  listBottomPadding,
  refreshControl,
  addFarmTargetEnabled = false,
}: FarmsPaneBProps) {
  const m3 = useM3();
  const isDark = useIsDark();
  const { t } = useTranslation();

  // ── Filter + search ─────────────────────────────────────────────────────
  const filteredFarms = useMemo<Farm[]>(() => {
    if (!farms) return [];
    const query = searchQuery.toLowerCase().trim();
    const afterSearch = query
      ? farms.filter(
          (f) =>
            f.name.toLowerCase().includes(query) ||
            f.crop?.toLowerCase().includes(query) ||
            f.crop_variety?.toLowerCase().includes(query) ||
            f.region?.toLowerCase().includes(query),
        )
      : farms;
    if (activeFilter === 'healthy') return afterSearch.filter((f) => !isLowWater(f));
    if (activeFilter === 'needs_attention') return afterSearch.filter(isLowWater);
    return afterSearch;
  }, [farms, searchQuery, activeFilter]);

  const counts = useMemo(() => {
    const all = farms?.length ?? 0;
    const healthy = farms?.filter((f) => !isLowWater(f)).length ?? 0;
    const needs = farms?.filter(isLowWater).length ?? 0;
    return { all, healthy, needs };
  }, [farms]);

  const totalArea = useMemo(
    () => (farms ?? []).reduce((sum, f) => sum + (f.area || 0), 0),
    [farms],
  );

  // ── Season context ──────────────────────────────────────────────────────
  // Median day-since-pruning across farms gives a single "season day" to pin
  // the TODAY flag. Falls back to half-season when no farm has a pruning date.
  const seasonDay = useMemo<number>(() => {
    if (!farms || farms.length === 0) return Math.floor(SEASON_LENGTH_DAYS / 2);
    const days = farms
      .map((f) => getDaysSincePruning(f.date_of_pruning, today))
      .filter((d): d is number => typeof d === 'number')
      .sort((a, b) => a - b);
    if (days.length === 0) return Math.floor(SEASON_LENGTH_DAYS / 2);
    const mid = Math.floor(days.length / 2);
    return days.length % 2 === 0 ? Math.round((days[mid - 1] + days[mid]) / 2) : days[mid];
  }, [farms, today]);

  const seasonRatio = Math.max(0, Math.min(1, seasonDay / SEASON_LENGTH_DAYS));

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
      const accent = getFarmAccentColor(item.id, isDark);
      const days = getDaysSincePruning(item.date_of_pruning, today);
      const ratio = days != null ? Math.min(1, days / SEASON_LENGTH_DAYS) : 0;
      const pastHarvest = days != null && days >= SEASON_LENGTH_DAYS;
      const daysToHarvest = days != null && !pastHarvest ? SEASON_LENGTH_DAYS - days : null;
      const lowWater = isLowWater(item);

      const stage =
        days == null
          ? t('explore.farms.stage.notStarted', { defaultValue: 'Not started' })
          : days < SEASON_LENGTH_DAYS * 0.35
            ? t('farmCard.season.pruning', { defaultValue: 'Pruning' })
            : days < SEASON_LENGTH_DAYS * 0.65
              ? t('farmCard.season.bloom', { defaultValue: 'Bloom' })
              : !pastHarvest
                ? t('farmCard.season.veraison', { defaultValue: 'Veraison' })
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
        <ListRowB
          accentColor={accent}
          accessibilityLabel={`${item.name}, ${stage}`}
          onPress={() => onFarmPress(item)}
          onLongPress={() => onEditFarm(item)}
          body={
            <View>
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
                {lowWater ? <AttentionDot /> : null}
              </View>
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
              <StatStrip
                stats={[
                  {
                    icon: '💧',
                    label: lowWater
                      ? t('explore.farms.water.low', { defaultValue: 'Low' })
                      : t('explore.farms.water.ok', { defaultValue: 'OK' }),
                    tone: lowWater ? 'low' : 'ok',
                  },
                  days != null
                    ? {
                        icon: '⏱',
                        label: 'D',
                        number: days,
                        suffix: `/${SEASON_LENGTH_DAYS}`,
                      }
                    : {
                        icon: '⏱',
                        label: t('explore.farms.noPruningDate', { defaultValue: 'No pruning' }),
                      },
                  pastHarvest
                    ? {
                        icon: '⚑',
                        label: t('explore.farms.pastHarvest', { defaultValue: 'Past D130' }),
                      }
                    : daysToHarvest != null
                      ? {
                          icon: '⚑',
                          label: t('explore.farms.harvestIn', { defaultValue: 'Harvest ' }),
                          number: daysToHarvest,
                          suffix: 'd',
                        }
                      : { icon: '⚑', label: '—' },
                ]}
              />
            </View>
          }
          meta={
            <MetaColumn
              label={stage}
              tone="default"
              gauge={{ value: ratio, fill: accent, width: 72 }}
            />
          }
        />
      );
    },
    [onFarmPress, onEditFarm, isDark, today, t, m3],
  );

  // ── Filter chips ───────────────────────────────────────────────────────
  const chips: ChipDef<FarmFilter>[] = useMemo(
    () => [
      {
        key: 'all',
        label: t('farms.filter.all', { defaultValue: 'All' }),
        count: counts.all,
      },
      {
        key: 'healthy',
        label: t('farms.filter.healthy', { defaultValue: 'Healthy' }),
        count: counts.healthy,
      },
      {
        key: 'needs_attention',
        label: t('farms.filter.needsAttention', { defaultValue: 'Needs water' }),
        count: counts.needs,
      },
    ],
    [t, counts.all, counts.healthy, counts.needs],
  );

  const heroLabelMemo = useMemo(
    () =>
      t('explore.farms.heroLabel', {
        defaultValue: 'Season · {{count}} farms · {{area}} ha',
        count: counts.all,
        area: formatNumber(totalArea, { maximumFractionDigits: 1 }),
      }),
    [t, counts.all, totalArea],
  );
  const heroValueMemo = useMemo(
    () =>
      t('explore.farms.heroValue', {
        defaultValue: 'Day {{day}} / {{total}}',
        day: seasonDay,
        total: SEASON_LENGTH_DAYS,
      }),
    [t, seasonDay],
  );

  // ── Header ─────────────────────────────────────────────────────────────
  const header = useMemo(
    () => (
      <View>
        <HeroPanel label={heroLabelMemo} value={heroValueMemo}>
          {counts.all > 0 && (
            <SeasonTimeline
              farms={farms ?? []}
              today={today}
              seasonRatio={seasonRatio}
              isDark={isDark}
              t={t}
            />
          )}
        </HeroPanel>
        {counts.all > 0 && (
          <ChipRow chips={chips} active={activeFilter} onChange={onFilterChange} />
        )}
      </View>
    ),

    [
      heroLabelMemo,
      heroValueMemo,
      farms,
      today,
      seasonRatio,
      isDark,
      t,
      chips,
      activeFilter,
      onFilterChange,
      counts.all,
    ],
  );

  return (
    <FlatList
      data={filteredFarms}
      renderItem={renderFarm}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={header}
      ListEmptyComponent={renderEmpty}
      contentContainerStyle={{
        paddingTop: spacing[1] + 2,
        paddingBottom: listBottomPadding ?? spacing[16],
        flexGrow: 1,
      }}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Season timeline
// ──────────────────────────────────────────────────────────────────────────

const TIMELINE_HEIGHT = 52;
const TIMELINE_HORIZONTAL_PAD = 6;
const AXIS_Y = 36;
const TICK_TOP = 30;
const TICK_HEIGHT = 12;
const TICK_LABEL_Y = 44;
const TODAY_TOP = 10;
const TODAY_HEIGHT = 30;

interface SeasonTimelineProps {
  farms: Farm[];
  today: Date;
  seasonRatio: number;
  isDark: boolean;
  t: ReturnType<typeof useTranslation>['t'];
}

function SeasonTimeline({ farms, today, seasonRatio, isDark, t }: SeasonTimelineProps) {
  const m3 = useM3();
  const [trackWidth, setTrackWidth] = React.useState(0);

  const usableWidth = Math.max(0, trackWidth - 2 * TIMELINE_HORIZONTAL_PAD);

  function xFor(ratio: number): number {
    return TIMELINE_HORIZONTAL_PAD + Math.max(0, Math.min(1, ratio)) * usableWidth;
  }

  const milestones = [
    { ratio: 0, label: t('farmCard.season.pruning', { defaultValue: 'Pruning' }) },
    { ratio: 0.35, label: t('farmCard.season.bloom', { defaultValue: 'Bloom' }) },
    { ratio: 0.65, label: t('farmCard.season.veraison', { defaultValue: 'Veraison' }) },
    { ratio: 1, label: t('farmCard.season.harvest', { defaultValue: 'Harvest' }) },
  ];

  const todayX = TIMELINE_HORIZONTAL_PAD + seasonRatio * usableWidth;

  const farmDots = useMemo(() => {
    return farms
      .map((f) => {
        const days = getDaysSincePruning(f.date_of_pruning, today);
        if (days == null) return null;
        const ratio = Math.min(1, days / SEASON_LENGTH_DAYS);
        return {
          x: TIMELINE_HORIZONTAL_PAD + ratio * usableWidth,
          color: getFarmAccentColor(f.id, isDark),
        };
      })
      .filter((x): x is { x: number; color: string } => x != null);
  }, [farms, today, isDark, usableWidth]);

  const railColor = colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.3);
  const tickColor = colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.35);
  const labelColor = colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.75);
  const todayColor = m3.colorScheme.error;

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={{ height: TIMELINE_HEIGHT, position: 'relative' }}
    >
      {/* Axis */}
      <View
        style={{
          position: 'absolute',
          left: TIMELINE_HORIZONTAL_PAD,
          right: TIMELINE_HORIZONTAL_PAD,
          top: AXIS_Y,
          height: 2,
          backgroundColor: railColor,
          borderRadius: radius.none,
        }}
      />

      {/* Milestone ticks + labels */}
      {milestones.map((m, i) => {
        const x = xFor(m.ratio);
        return (
          <React.Fragment key={i}>
            <View
              style={{
                position: 'absolute',
                top: TICK_TOP,
                height: TICK_HEIGHT,
                width: 1,
                backgroundColor: tickColor,
                left: x,
              }}
            />
            <Text
              style={{
                position: 'absolute',
                top: TICK_LABEL_Y,
                fontSize: fontSize['2xs'],
                fontWeight: fontWeight.semibold,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: labelColor,
                width: 56,
                textAlign: i === 0 ? 'left' : i === milestones.length - 1 ? 'right' : 'center',
                left: i === 0 ? x : i === milestones.length - 1 ? x - 56 : x - 28,
              }}
              numberOfLines={1}
            >
              {m.label}
            </Text>
          </React.Fragment>
        );
      })}

      {/* TODAY flag + line */}
      {trackWidth > 0 ? (
        <>
          <View
            style={{
              position: 'absolute',
              top: TODAY_TOP,
              height: TODAY_HEIGHT,
              width: 2,
              backgroundColor: todayColor,
              borderRadius: radius.none,
              left: todayX - 1,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              // Keep a 4px margin so the rounded panel corner doesn't clip the flag.
              left: Math.max(4, Math.min(trackWidth - 60 - 4, todayX - 30)),
              width: 60,
              alignItems:
                todayX - 30 < 4
                  ? 'flex-start'
                  : todayX + 30 > trackWidth - 4
                    ? 'flex-end'
                    : 'center',
            }}
          >
            <View
              style={{
                backgroundColor: todayColor,
                paddingHorizontal: spacing[1] + 2,
                paddingVertical: 2,
                borderRadius: borderRadius.xs / 2,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: fontSize['2xs'],
                  fontWeight: fontWeight.bold,
                  color: '#fff',
                  letterSpacing: 0.4,
                }}
              >
                {t('explore.farms.todayFlag', {
                  defaultValue: 'TODAY',
                })}
              </Text>
            </View>
          </View>
        </>
      ) : null}

      {/* Farm dots (no labels — color-coded to match the row accent below). */}
      {trackWidth > 0
        ? farmDots.map((dot, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                width: 10,
                height: 10,
                borderRadius: radius.xs,
                borderWidth: 2,
                borderColor: m3.surface.surfaceContainerHighest,
                backgroundColor: dot.color,
                left: dot.x - 5,
                top: AXIS_Y - 5,
              }}
            />
          ))
        : null}
    </View>
  );
}
