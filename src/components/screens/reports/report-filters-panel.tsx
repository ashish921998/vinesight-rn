import React, { useCallback } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Animated, { FadeInDown, Layout as ReanimatedLayout } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { formatDate, formatNumber } from '@/i18n/format';
import * as Haptics from 'expo-haptics';
import { Symbol as Icon } from '@/components/ui/symbol';
import { fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import type { Farm } from '@/types';

export interface ReportSeasonOption {
  id: number;
  label: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
}

interface ReportFiltersPanelProps {
  farms: Farm[];
  selectedFarmId: number | null;
  selectedFarm: Farm | null;
  areaUnit: 'acres' | 'hectares';
  onSelectFarm: (farmId: number | null) => void;
  seasonOptions: ReportSeasonOption[];
  selectedSeasonId: number | null;
  selectedSeasonLabel: string;
  seasonWindowLabel?: string | null;
  onSelectSeason: (seasonId: number | null) => void;
  /** Calendar-year window across all seasons — the one range the season list can't express. */
  onApplyThisYear: () => void;
  showNoActiveSeasonInfo: boolean;
  unassignedRecordCount: number;
  dateFrom: string;
  dateTo: string;
  onOpenFromDate: () => void;
  onOpenToDate: () => void;
  panelStyle: object;
}

const DAY_MONTH: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
const DAY_MONTH_YEAR: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

/**
 * The report's scope, stated as one line and adjustable behind it.
 *
 * Collapsed is the default: the header reads as the document's identity ("Sassy
 * · 2 acres · 30 Apr – 29 Jul 2026 · All seasons") rather than as a control, so
 * the screen opens on the report instead of on a stack of pickers. Farm and
 * season are selected inline rather than in nested bottom sheets — a sheet
 * inside this scroll view would have to be a sheet-within-a-sheet.
 */
export function ReportFiltersPanel({
  farms,
  selectedFarmId,
  selectedFarm,
  areaUnit,
  onSelectFarm,
  seasonOptions,
  selectedSeasonId,
  selectedSeasonLabel,
  seasonWindowLabel,
  onSelectSeason,
  onApplyThisYear,
  showNoActiveSeasonInfo,
  unassignedRecordCount,
  dateFrom,
  dateTo,
  onOpenFromDate,
  onOpenToDate,
  panelStyle,
}: ReportFiltersPanelProps) {
  const m3 = useM3();
  const { t } = useTranslation();

  const [expanded, setExpanded] = React.useState(false);

  const toggleExpand = useCallback(async () => {
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpanded((prev) => !prev);
  }, []);

  /** Same year on both ends → state it once: "30 Apr – 29 Jul 2026". */
  const windowLabel = `${formatDate(
    dateFrom,
    dateFrom.slice(0, 4) === dateTo.slice(0, 4) ? DAY_MONTH : DAY_MONTH_YEAR,
  )} – ${formatDate(dateTo, DAY_MONTH_YEAR)}`;

  const identity = [
    selectedFarm?.name,
    selectedFarm ? `${formatNumber(selectedFarm.area)} ${t(`units.${areaUnit}`)}` : null,
    windowLabel,
    selectedSeasonLabel,
  ]
    .filter(Boolean)
    .join('  ·  ');

  const microLabelStyle = {
    fontSize: fontSize.xs,
    color: m3.colorScheme.onSurfaceVariant,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  };

  /** Selectable state — filled when chosen. Distinct from the action button below. */
  const renderChip = (
    key: string,
    label: string,
    selected: boolean,
    onPress: () => void,
    icon?: string,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[1],
        minHeight: 36,
        paddingHorizontal: spacing[3],
        borderRadius: radius.full,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: selected ? m3.colorScheme.primary : m3.surface.s300,
        backgroundColor: selected
          ? colorWithOpacity(m3.colorScheme.primary, 0.1)
          : pressed
            ? m3.surface.s200
            : 'transparent',
      })}
    >
      {selected ? <Icon name="checkmark" size={12} color={m3.colorScheme.primary} /> : null}
      {!selected && icon ? (
        <Icon name={icon} size={12} color={m3.colorScheme.onSurfaceVariant} />
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          fontSize: fontSize.xs,
          fontWeight: selected ? fontWeight.semibold : fontWeight.medium,
          color: selected ? m3.colorScheme.primary : m3.colorScheme.onSurfaceVariant,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={[panelStyle, { gap: spacing[3], overflow: 'hidden' }]}>
      <Pressable
        onPress={toggleExpand}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={t('reports.filters.title')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 36 }}
      >
        <Icon name="slider.horizontal.3" size={15} color={m3.colorScheme.primary} />
        <Text
          numberOfLines={2}
          style={{
            flex: 1,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: m3.colorScheme.onSurface,
          }}
        >
          {identity}
        </Text>
        <Icon
          name={expanded ? 'chevron.up' : 'chevron.down'}
          size={14}
          color={m3.colorScheme.onSurfaceVariant}
        />
      </Pressable>

      {expanded ? (
        <Animated.View
          entering={FadeInDown.duration(250)}
          layout={ReanimatedLayout.springify().dampingRatio(1)}
          style={{ gap: spacing[4] }}
        >
          {/* The farm arrives preselected from the `farmId` param — this screen
              is only reachable from a farm — so this row switches farms rather
              than selecting one, and it is pointless for anyone with one farm. */}
          {farms.length > 1 ? (
            <View style={{ gap: spacing[2] }}>
              <Text style={microLabelStyle}>{t('reports.switchFarmLabel')}</Text>
              <View
                accessibilityRole="radiogroup"
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}
              >
                {farms.map((farm) =>
                  renderChip(
                    String(farm.id ?? farm.name),
                    farm.name,
                    farm.id === selectedFarmId,
                    () => onSelectFarm(farm.id ?? null),
                    'leaf.fill',
                  ),
                )}
              </View>
            </View>
          ) : null}

          <View style={{ gap: spacing[2] }}>
            <Text style={microLabelStyle}>{t('reports.season.label')}</Text>
            <View
              accessibilityRole="radiogroup"
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}
            >
              {renderChip(
                'all-seasons',
                t('reports.season.allSeasons'),
                selectedSeasonId == null,
                () => onSelectSeason(null),
                'calendar',
              )}
              {/* Selecting a season already sets its window, which is what the
                  former "Active / Most recent / Previous season" preset buttons
                  did — they were three more taps to reach these same chips. */}
              {seasonOptions.map((season) =>
                renderChip(
                  String(season.id),
                  season.label,
                  selectedSeasonId === season.id,
                  () => onSelectSeason(season.id),
                  season.isActive ? 'circle.inset.filled' : 'calendar',
                ),
              )}
            </View>

            {seasonWindowLabel ? (
              <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                {seasonWindowLabel}
              </Text>
            ) : null}

            {showNoActiveSeasonInfo ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
                <Icon name="info.circle" size={12} color={m3.colorScheme.onSurfaceVariant} />
                <Text
                  style={{ flex: 1, fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}
                >
                  {t('reports.season.noActiveInfo')}
                </Text>
              </View>
            ) : null}

            {/* Season-filtered queries drop season_id-null rows with no trace;
                when any exist, say so — notice only, never merged into a
                specific season's totals. Tap switches to All seasons. */}
            {selectedSeasonId != null && unassignedRecordCount > 0 ? (
              <Pressable
                onPress={() => onSelectSeason(null)}
                accessibilityRole="button"
                accessibilityLabel={t('reports.season.unassignedNotice', {
                  count: unassignedRecordCount,
                })}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[1],
                  minHeight: 34,
                }}
              >
                <Icon name="info.circle" size={12} color={m3.colorScheme.primary} />
                <Text
                  style={{
                    flex: 1,
                    fontSize: fontSize.xs,
                    color: m3.colorScheme.primary,
                    fontWeight: fontWeight.medium,
                  }}
                >
                  {t('reports.season.unassignedNotice', { count: unassignedRecordCount })}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ gap: spacing[2] }}>
            <Text style={microLabelStyle}>{t('reports.dateRange.label')}</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              {(
                [
                  ['from', dateFrom, onOpenFromDate],
                  ['to', dateTo, onOpenToDate],
                ] as const
              ).map(([bound, value, onPress], index) => (
                <React.Fragment key={bound}>
                  {index === 1 ? (
                    <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurfaceVariant }}>
                      {t('reports.dateRange.to', 'to')}
                    </Text>
                  ) : null}
                  <Pressable
                    onPress={onPress}
                    accessibilityRole="button"
                    style={{
                      flex: 1,
                      backgroundColor: m3.surface.s100,
                      borderWidth: 1,
                      borderColor: m3.surface.s300,
                      borderRadius: radius.md,
                      borderCurve: 'continuous',
                      minHeight: 44,
                      paddingHorizontal: spacing[3],
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: m3.colorScheme.onSurface,
                        fontWeight: fontWeight.medium,
                        fontSize: fontSize.sm,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {formatDate(value, DAY_MONTH_YEAR)}
                    </Text>
                  </Pressable>
                </React.Fragment>
              ))}
            </View>

            {/* An action, not a state — so it is a text button, not a chip. */}
            <Pressable
              onPress={onApplyThisYear}
              accessibilityRole="button"
              hitSlop={8}
              style={{ minHeight: 34, justifyContent: 'center' }}
            >
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.semibold,
                  color: m3.colorScheme.primary,
                }}
              >
                {t('reports.season.presets.thisYear')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}
