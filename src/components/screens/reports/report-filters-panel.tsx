import React, { useCallback } from 'react';
import { View, Text, Pressable, Platform, Modal, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  allowFarmSwitching: boolean;
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
}

const DAY_MONTH: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
const DAY_MONTH_YEAR: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

/**
 * The report's scope, stated in the document and adjusted in a temporary sheet.
 *
 * Filters should not resize the report or duplicate its scope inside the main
 * scroll path. Date controls dismiss this sheet before opening their platform
 * picker, avoiding stacked modals.
 */
export function ReportFiltersPanel({
  farms,
  selectedFarmId,
  selectedFarm,
  allowFarmSwitching,
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
}: ReportFiltersPanelProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

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

  const areaLabel = selectedFarm
    ? `${formatNumber(selectedFarm.area)} ${t(`units.${areaUnit}`)}`
    : null;
  const scopeLabel = [selectedSeasonLabel, areaLabel].filter(Boolean).join('  ·  ');

  const microLabelStyle = {
    fontSize: fontSize.xs,
    color: m3.colorScheme.onSurfaceVariant,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase' as const,
    letterSpacing: 0,
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
        paddingHorizontal: spacing[2] + 2,
        borderRadius: radius.full,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: selected ? m3.colorScheme.primary : m3.colorScheme.outlineVariant,
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

  const showFarmSwitcher = allowFarmSwitching && farms.length > 1;

  const closeSheet = useCallback(() => setExpanded(false), []);

  return (
    <View>
      <Pressable
        onPress={toggleExpand}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={t('reports.filters.title')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[3],
          minHeight: 72,
          paddingVertical: spacing[2],
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.semibold,
              color: m3.colorScheme.primary,
              textTransform: 'uppercase',
              letterSpacing: 0,
            }}
          >
            {selectedFarm?.name ?? t('reports.title')}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            style={{
              fontSize: fontSize.lg,
              lineHeight: 24,
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.onSurface,
              fontVariant: ['tabular-nums'],
            }}
          >
            {windowLabel}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: fontSize.xs,
              color: m3.colorScheme.onSurfaceVariant,
            }}
          >
            {scopeLabel}
          </Text>
        </View>

        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: expanded
              ? colorWithOpacity(m3.colorScheme.primary, 0.35)
              : m3.colorScheme.outlineVariant,
            backgroundColor: expanded
              ? colorWithOpacity(m3.colorScheme.primary, 0.1)
              : m3.colorScheme.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="slider.horizontal.3" size={16} color={m3.colorScheme.primary} />
        </View>
      </Pressable>

      <Modal
        visible={expanded}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={closeSheet}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            accessible={false}
            onPress={closeSheet}
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.32) },
            ]}
          />
          <View
            accessibilityViewIsModal
            style={{
              maxHeight: '82%',
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              borderCurve: 'continuous',
              backgroundColor: m3.colorScheme.surface,
              paddingBottom: insets.bottom,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                minHeight: 58,
                paddingHorizontal: spacing[4],
                flexDirection: 'row',
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: m3.colorScheme.outlineVariant,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                    color: m3.colorScheme.onSurface,
                  }}
                >
                  {t('reports.filters.title')}
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                  {windowLabel} · {selectedSeasonLabel}
                </Text>
              </View>
              <Pressable
                onPress={closeSheet}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                style={{
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="xmark" size={16} color={m3.colorScheme.onSurface} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing[4], padding: spacing[4] }}
            >
              {showFarmSwitcher ? (
                <View style={{ gap: spacing[2], paddingBottom: spacing[1] }}>
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
                      style={{
                        flex: 1,
                        fontSize: fontSize.xs,
                        color: m3.colorScheme.onSurfaceVariant,
                      }}
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
                        <Text
                          style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurfaceVariant }}
                        >
                          {t('reports.dateRange.to', 'to')}
                        </Text>
                      ) : null}
                      <Pressable
                        onPress={() => {
                          closeSheet();
                          onPress();
                        }}
                        accessibilityRole="button"
                        style={{
                          flex: 1,
                          backgroundColor: m3.colorScheme.surface,
                          borderWidth: 1,
                          borderColor: m3.colorScheme.outlineVariant,
                          borderRadius: radius.md,
                          borderCurve: 'continuous',
                          minHeight: 40,
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
                  style={({ pressed }) => ({
                    alignSelf: 'flex-start',
                    minHeight: 28,
                    justifyContent: 'center',
                    opacity: pressed ? 0.65 : 1,
                  })}
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
            </ScrollView>

            <View
              style={{
                paddingHorizontal: spacing[4],
                paddingTop: spacing[2],
                paddingBottom: spacing[3],
                borderTopWidth: 1,
                borderTopColor: m3.colorScheme.outlineVariant,
              }}
            >
              <Pressable
                onPress={closeSheet}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  minHeight: 46,
                  borderRadius: radius.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: pressed
                    ? colorWithOpacity(m3.colorScheme.primary, 0.82)
                    : m3.colorScheme.primary,
                })}
              >
                <Text
                  style={{
                    color: m3.colorScheme.onPrimary,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {t('common.done')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
