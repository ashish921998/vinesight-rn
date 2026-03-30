import React, { useCallback, useMemo } from 'react';
import { View, Text, Pressable, Modal, FlatList, ScrollView, Platform } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  Layout as ReanimatedLayout,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/format';
import * as Haptics from 'expo-haptics';
import { Symbol as Icon } from '@/components/ui/symbol';
import { borderRadius, fontSize, fontWeight, spacing, shadows } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { convertAreaFromAcres } from '@/utils/preferences';
import type { ReportType } from '@/types/report';
import type { Farm } from '@/types';

interface ReportTypeOption {
  value: ReportType;
  labelKey: string;
  icon: string;
}

export type ReportSeasonPresetKey = 'active' | 'most-recent' | 'previous' | 'this-year';

export interface ReportSeasonOption {
  id: number;
  label: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
}

export interface ReportSeasonPresetOption {
  key: ReportSeasonPresetKey;
  labelKey: string;
  disabled?: boolean;
}

interface ReportFiltersPanelProps {
  farms: Farm[];
  selectedFarmId: number | null;
  selectedFarm: Farm | null;
  areaUnit: 'acres' | 'hectares';
  showFarmPicker: boolean;
  onToggleFarmPicker: () => void;
  onSelectFarm: (farmId: number | null) => void;
  showSeasonPicker: boolean;
  onToggleSeasonPicker: () => void;
  seasonOptions: ReportSeasonOption[];
  selectedSeasonId: number | null;
  selectedSeasonLabel: string;
  seasonWindowLabel?: string | null;
  onSelectSeason: (seasonId: number | null) => void;
  seasonPresetOptions: ReportSeasonPresetOption[];
  onApplySeasonPreset: (preset: ReportSeasonPresetKey) => void;
  showNoActiveSeasonInfo: boolean;
  dateFrom: string;
  dateTo: string;
  onOpenFromDate: () => void;
  onOpenToDate: () => void;
  reportType: ReportType;
  reportTypes: ReportTypeOption[];
  onSelectReportType: (reportType: ReportType) => void;
  panelStyle: object;
}

/* ─────────── Segmented Control ─────────── */

/* Inset padding for the pill inside the segmented track. */
const SEGMENT_INSET = 2;

function SegmentedControl({
  options,
  activeValue,
  onChange,
}: {
  options: ReportTypeOption[];
  activeValue: ReportType;
  onChange: (value: ReportType) => void;
}) {
  const colors = useThemeColors();
  const m3 = useM3();
  const { t } = useTranslation();

  const activeIndex = useMemo(
    () => options.findIndex((o) => o.value === activeValue),
    [options, activeValue],
  );

  /* ── 2×2 grid when we have exactly 4 options ── */
  const useGrid = options.length === 4;
  const rows = useGrid ? [options.slice(0, 2), options.slice(2, 4)] : [options];

  const containerWidth = useSharedValue(0);

  /* Columns per row (2 for grid, N for single row). */
  const cols = useGrid ? 2 : options.length;

  /* Map activeIndex → row/col for grid. */
  const activeRow = useGrid ? Math.floor(activeIndex / 2) : 0;
  const activeCol = useGrid ? activeIndex % 2 : activeIndex;

  const pillStyle = useAnimatedStyle(() => {
    if (containerWidth.value === 0 || cols === 0) {
      return { opacity: 0 };
    }
    const segW = containerWidth.value / cols;
    return {
      opacity: 1,
      width: segW - SEGMENT_INSET * 2,
      transform: [{ translateX: withSpring(activeCol * segW, { damping: 18, stiffness: 200 }) }],
    };
  }, [activeCol, cols]);

  const renderRow = (rowOptions: ReportTypeOption[], rowIndex: number) => (
    <View
      key={rowIndex}
      style={{
        flexDirection: 'row',
        position: 'relative',
      }}
    >
      {/* Animated pill – only in the row that contains the active item */}
      {rowIndex === activeRow ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: SEGMENT_INSET,
              bottom: SEGMENT_INSET,
              left: SEGMENT_INSET,
              backgroundColor: colors.surface[100],
              borderRadius: borderRadius.lg - SEGMENT_INSET,
              borderCurve: 'continuous',
              ...shadows.sm,
            },
            pillStyle,
          ]}
        />
      ) : null}

      {rowOptions.map((option) => {
        const active = option.value === activeValue;
        return (
          <Pressable
            key={option.value}
            onPress={async () => {
              if (!active) {
                if (Platform.OS === 'ios') {
                  await Haptics.selectionAsync();
                }
                onChange(option.value);
              }
            }}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing[1],
              paddingVertical: spacing[2] + 2,
              paddingHorizontal: spacing[1],
              zIndex: 1,
            }}
          >
            <Icon
              name={option.icon}
              size={13}
              color={active ? m3.colorScheme.primary : m3.colorScheme.onSurfaceVariant}
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={{
                fontSize: fontSize.xs,
                fontWeight: active ? fontWeight.semibold : fontWeight.medium,
                color: active ? m3.colorScheme.primary : m3.colorScheme.onSurfaceVariant,
                flexShrink: 1,
              }}
            >
              {t(option.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View
      onLayout={(e) => {
        containerWidth.value = e.nativeEvent.layout.width;
      }}
      style={{
        backgroundColor: colors.surface[200],
        borderRadius: borderRadius.lg,
        borderCurve: 'continuous',
        padding: SEGMENT_INSET,
      }}
    >
      {rows.map((rowOpts, idx) => renderRow(rowOpts, idx))}
    </View>
  );
}

/* ─────────── Sheet Handle ─────────── */

function SheetHandle({ color }: { color: string }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: spacing[2], paddingBottom: spacing[1] }}>
      <View
        style={{
          width: 36,
          height: 5,
          borderRadius: borderRadius.full,
          backgroundColor: colorWithOpacity(color, 0.3),
        }}
      />
    </View>
  );
}

/* ─────────── Main Component ─────────── */

export function ReportFiltersPanel({
  farms,
  selectedFarmId,
  selectedFarm,
  areaUnit,
  showFarmPicker,
  onToggleFarmPicker,
  onSelectFarm,
  showSeasonPicker,
  onToggleSeasonPicker,
  seasonOptions,
  selectedSeasonId,
  selectedSeasonLabel,
  seasonWindowLabel,
  onSelectSeason,
  seasonPresetOptions,
  onApplySeasonPreset,
  showNoActiveSeasonInfo,
  dateFrom,
  dateTo,
  onOpenFromDate,
  onOpenToDate,
  reportType,
  reportTypes,
  onSelectReportType,
  panelStyle,
}: ReportFiltersPanelProps) {
  const colors = useThemeColors();
  const m3 = useM3();
  const { t } = useTranslation();

  const [expanded, setExpanded] = React.useState(true);

  const toggleExpand = useCallback(async () => {
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpanded((prev) => !prev);
  }, []);

  /* ── Compact selector style ── */
  const compactSelectorStyle = useMemo(
    () => ({
      backgroundColor: colors.surface[50],
      borderWidth: 1,
      borderColor: colors.surface[200],
      borderRadius: borderRadius.lg,
      borderCurve: 'continuous' as const,
      minHeight: 44,
      paddingHorizontal: spacing[3],
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    }),
    [colors],
  );

  return (
    <View>
      <View style={[panelStyle, { gap: spacing[3], overflow: 'hidden' }]}>
        {/* ── Header with collapse toggle ── */}
        <Pressable
          onPress={toggleExpand}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <Icon name="slider.horizontal.3" size={16} color={m3.colorScheme.primary} />
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.onSurface,
              }}
            >
              {t('reports.reportType.label', 'Filters')}
            </Text>
          </View>
          <Icon
            name={expanded ? 'chevron.up' : 'chevron.down'}
            size={14}
            color={m3.colorScheme.onSurfaceVariant}
          />
        </Pressable>

        {/* ── Collapsed summary ── */}
        {!expanded ? (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing[2],
              alignItems: 'center',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[1],
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
                paddingHorizontal: spacing[2],
                paddingVertical: spacing[1],
                borderRadius: borderRadius.full,
                borderCurve: 'continuous',
              }}
            >
              <Icon name="leaf.fill" size={12} color={m3.colorScheme.primary} />
              <Text
                numberOfLines={1}
                style={{
                  fontSize: fontSize.xs,
                  color: m3.colorScheme.primary,
                  fontWeight: fontWeight.medium,
                  maxWidth: 100,
                }}
              >
                {selectedFarm?.name ?? '—'}
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[1],
                backgroundColor: colorWithOpacity(m3.colorScheme.secondary, 0.08),
                paddingHorizontal: spacing[2],
                paddingVertical: spacing[1],
                borderRadius: borderRadius.full,
                borderCurve: 'continuous',
              }}
            >
              <Icon name="calendar" size={12} color={m3.colorScheme.secondary} />
              <Text
                numberOfLines={1}
                style={{
                  fontSize: fontSize.xs,
                  color: m3.colorScheme.secondary,
                  fontWeight: fontWeight.medium,
                  maxWidth: 120,
                }}
              >
                {selectedSeasonLabel}
              </Text>
            </View>

            <Text
              style={{
                fontSize: fontSize.xs,
                fontVariant: ['tabular-nums'],
                color: m3.colorScheme.onSurfaceVariant,
              }}
            >
              {dateFrom} → {dateTo}
            </Text>
          </Animated.View>
        ) : null}

        {/* ── Expanded filters ── */}
        {expanded ? (
          <Animated.View
            entering={FadeInDown.duration(250).springify().damping(18)}
            layout={ReanimatedLayout.springify().damping(18)}
            style={{ gap: spacing[3] }}
          >
            {/* Farm + Season row */}
            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <View style={{ flex: 1, gap: spacing[1] }}>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: m3.colorScheme.onSurfaceVariant,
                    fontWeight: fontWeight.medium,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}
                >
                  {t('reports.selectFarmLabel')}
                </Text>
                <Pressable onPress={onToggleFarmPicker} style={compactSelectorStyle}>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 }}
                  >
                    <Icon name="leaf.fill" size={15} color={m3.colorScheme.primary} />
                    <Text
                      numberOfLines={1}
                      style={{
                        color: m3.colorScheme.onSurface,
                        fontWeight: fontWeight.semibold,
                        fontSize: fontSize.sm,
                        flex: 1,
                      }}
                    >
                      {selectedFarm?.name || t('reports.selectFarmPlaceholder')}
                    </Text>
                  </View>
                  <Icon
                    name="chevron.up.chevron.down"
                    size={13}
                    color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
                  />
                </Pressable>
              </View>

              <View style={{ flex: 1, gap: spacing[1] }}>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: m3.colorScheme.onSurfaceVariant,
                    fontWeight: fontWeight.medium,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}
                >
                  {t('reports.season.label')}
                </Text>
                <Pressable onPress={onToggleSeasonPicker} style={compactSelectorStyle}>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 }}
                  >
                    <Icon name="calendar" size={15} color={m3.colorScheme.primary} />
                    <Text
                      numberOfLines={1}
                      style={{
                        color: m3.colorScheme.onSurface,
                        fontWeight: fontWeight.semibold,
                        fontSize: fontSize.sm,
                        flex: 1,
                      }}
                    >
                      {selectedSeasonLabel || t('reports.season.placeholder')}
                    </Text>
                  </View>
                  <Icon
                    name="chevron.up.chevron.down"
                    size={13}
                    color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
                  />
                </Pressable>
              </View>
            </View>

            {/* Season window + presets */}
            <View style={{ gap: spacing[2] }}>
              {seasonWindowLabel ? (
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: m3.colorScheme.onSurfaceVariant,
                    fontWeight: fontWeight.medium,
                  }}
                >
                  {seasonWindowLabel}
                </Text>
              ) : null}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing[2], paddingRight: spacing[1] }}
              >
                {seasonPresetOptions.map((preset) => (
                  <Pressable
                    key={preset.key}
                    disabled={preset.disabled}
                    onPress={() => onApplySeasonPreset(preset.key)}
                    style={{
                      minHeight: 34,
                      borderRadius: borderRadius.full,
                      borderCurve: 'continuous',
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[1],
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: preset.disabled
                        ? colors.surface[200]
                        : colorWithOpacity(m3.colorScheme.primary, 0.3),
                      backgroundColor: preset.disabled
                        ? colors.surface[50]
                        : colorWithOpacity(m3.colorScheme.primary, 0.06),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        color: preset.disabled
                          ? m3.colorScheme.onSurfaceVariant
                          : m3.colorScheme.primary,
                        fontWeight: fontWeight.medium,
                      }}
                    >
                      {t(preset.labelKey)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {showNoActiveSeasonInfo ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[1],
                  }}
                >
                  <Icon name="info.circle" size={12} color={m3.colorScheme.onSurfaceVariant} />
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      color: m3.colorScheme.onSurfaceVariant,
                      flex: 1,
                    }}
                  >
                    {t('reports.season.noActiveInfo')}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Date range - Cellar Ledger design: mist-1 bg, 1px border, 10px radius */}
            <View style={{ gap: spacing[1] }}>
              <Text
                style={{
                  fontSize: fontSize.xs,
                  color: m3.colorScheme.onSurfaceVariant,
                  fontWeight: fontWeight.medium,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                {t('reports.dateRange.label')}
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[2],
                }}
              >
                <Pressable
                  onPress={onOpenFromDate}
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface[100], // mist-1 bg
                    borderWidth: 1,
                    borderColor: colors.surface[300], // 1px border
                    borderRadius: borderRadius.sm, // 10px radius
                    borderCurve: 'continuous',
                    minHeight: 44,
                    paddingHorizontal: spacing[3],
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[2],
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      color: m3.colorScheme.onSurfaceVariant,
                      fontWeight: fontWeight.medium,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {t('reports.dateRange.from', 'From')}
                  </Text>
                  <Text
                    style={{
                      color: m3.colorScheme.onSurface,
                      fontWeight: fontWeight.medium,
                      fontSize: fontSize.sm,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {dateFrom}
                  </Text>
                </Pressable>

                <Text
                  style={{
                    fontSize: fontSize.sm,
                    color: m3.colorScheme.onSurfaceVariant,
                    fontWeight: fontWeight.medium,
                  }}
                >
                  {t('reports.dateRange.to', 'to')}
                </Text>

                <Pressable
                  onPress={onOpenToDate}
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface[100], // mist-1 bg
                    borderWidth: 1,
                    borderColor: colors.surface[300], // 1px border
                    borderRadius: borderRadius.sm, // 10px radius
                    borderCurve: 'continuous',
                    minHeight: 44,
                    paddingHorizontal: spacing[3],
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[2],
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      color: m3.colorScheme.onSurfaceVariant,
                      fontWeight: fontWeight.medium,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {t('reports.dateRange.toLabel', 'To')}
                  </Text>
                  <Text
                    style={{
                      color: m3.colorScheme.onSurface,
                      fontWeight: fontWeight.medium,
                      fontSize: fontSize.sm,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {dateTo}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Export chips - PDF/CSV with active state */}
            <View style={{ gap: spacing[1] }}>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  color: m3.colorScheme.onSurfaceVariant,
                  fontWeight: fontWeight.medium,
                }}
              >
                {t('reports.exportAs', 'Export as')}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                <Pressable
                  style={{
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[1] + 2,
                    borderRadius: borderRadius.pill,
                    borderWidth: 1,
                    borderColor: colors.surface[300],
                    backgroundColor: colors.surface[100],
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    PDF
                  </Text>
                </Pressable>
                <Pressable
                  style={{
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[1] + 2,
                    borderRadius: borderRadius.pill,
                    borderWidth: 1,
                    borderColor: colors.surface[300],
                    backgroundColor: colors.surface[100],
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    CSV
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Report type segmented control */}
            <View style={{ gap: spacing[1] }}>
              <Text
                style={{
                  fontSize: fontSize.xs,
                  color: m3.colorScheme.onSurfaceVariant,
                  fontWeight: fontWeight.medium,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                {t('reports.reportType.label')}
              </Text>

              <SegmentedControl
                options={reportTypes}
                activeValue={reportType}
                onChange={onSelectReportType}
              />
            </View>
          </Animated.View>
        ) : null}
      </View>

      {/* ─────────── Farm Picker Modal ─────────── */}
      <Modal
        transparent
        visible={showFarmPicker}
        animationType="fade"
        onRequestClose={onToggleFarmPicker}
      >
        <Pressable
          onPress={onToggleFarmPicker}
          style={{
            flex: 1,
            backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.4),
            justifyContent: 'flex-end',
          }}
        >
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{
              maxHeight: '55%',
              backgroundColor: colors.surface[100],
              borderTopLeftRadius: borderRadius['3xl'],
              borderTopRightRadius: borderRadius['3xl'],
              borderCurve: 'continuous',
              paddingBottom: spacing[6],
            }}
            onStartShouldSetResponder={() => true}
          >
            <SheetHandle color={m3.colorScheme.onSurface} />

            <View
              style={{ paddingHorizontal: spacing[5], paddingTop: spacing[2], gap: spacing[1] }}
            >
              <Text
                style={{
                  color: m3.colorScheme.onSurface,
                  fontWeight: fontWeight.bold,
                  fontSize: fontSize.lg,
                }}
              >
                {t('reports.selectFarmLabel')}
              </Text>
            </View>

            <FlatList
              data={farms}
              keyExtractor={(item) => String(item.id ?? item.name)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: spacing[4],
                paddingTop: spacing[3],
                paddingBottom: spacing[2],
                gap: spacing[2],
              }}
              renderItem={({ item: farmItem }) => {
                const selected = farmItem.id === selectedFarmId;
                return (
                  <Pressable
                    onPress={() => onSelectFarm(farmItem.id ?? null)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing[3],
                      paddingVertical: spacing[3],
                      paddingHorizontal: spacing[4],
                      borderRadius: borderRadius.xl,
                      borderCurve: 'continuous',
                      backgroundColor: selected
                        ? colorWithOpacity(m3.colorScheme.primary, 0.1)
                        : pressed
                          ? colors.surface[200]
                          : colors.surface[50],
                    })}
                  >
                    <Icon
                      name="leaf.fill"
                      size={18}
                      color={selected ? m3.colorScheme.primary : m3.colorScheme.onSurfaceVariant}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: selected ? m3.colorScheme.primary : m3.colorScheme.onSurface,
                          fontWeight: selected ? fontWeight.semibold : fontWeight.medium,
                          fontSize: fontSize.base,
                        }}
                      >
                        {farmItem.name}
                      </Text>
                      <Text
                        style={{
                          color: m3.colorScheme.onSurfaceVariant,
                          fontSize: fontSize.xs,
                        }}
                      >
                        {formatNumber(convertAreaFromAcres(farmItem.area, areaUnit))}{' '}
                        {t(`units.${areaUnit}`)}
                      </Text>
                    </View>
                    {selected ? (
                      <Icon name="checkmark" size={18} color={m3.colorScheme.primary} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ─────────── Season Picker Modal ─────────── */}
      <Modal
        transparent
        visible={showSeasonPicker}
        animationType="fade"
        onRequestClose={onToggleSeasonPicker}
      >
        <Pressable
          onPress={onToggleSeasonPicker}
          style={{
            flex: 1,
            backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.4),
            justifyContent: 'flex-end',
          }}
        >
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{
              maxHeight: '55%',
              backgroundColor: colors.surface[100],
              borderTopLeftRadius: borderRadius['3xl'],
              borderTopRightRadius: borderRadius['3xl'],
              borderCurve: 'continuous',
              paddingBottom: spacing[6],
            }}
            onStartShouldSetResponder={() => true}
          >
            <SheetHandle color={m3.colorScheme.onSurface} />

            <View
              style={{ paddingHorizontal: spacing[5], paddingTop: spacing[2], gap: spacing[1] }}
            >
              <Text
                style={{
                  color: m3.colorScheme.onSurface,
                  fontWeight: fontWeight.bold,
                  fontSize: fontSize.lg,
                }}
              >
                {t('reports.season.label')}
              </Text>
            </View>

            <FlatList
              data={[
                {
                  id: -1,
                  label: t('reports.season.allSeasons'),
                  startDate: '',
                  endDate: null,
                  isActive: false,
                },
                ...seasonOptions,
              ]}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: spacing[4],
                paddingTop: spacing[3],
                paddingBottom: spacing[2],
                gap: spacing[2],
              }}
              renderItem={({ item }) => {
                const selected =
                  item.id === -1 ? selectedSeasonId == null : selectedSeasonId === item.id;
                return (
                  <Pressable
                    onPress={() => onSelectSeason(item.id === -1 ? null : item.id)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing[3],
                      paddingVertical: spacing[3],
                      paddingHorizontal: spacing[4],
                      borderRadius: borderRadius.xl,
                      borderCurve: 'continuous',
                      backgroundColor: selected
                        ? colorWithOpacity(m3.colorScheme.primary, 0.1)
                        : pressed
                          ? colors.surface[200]
                          : colors.surface[50],
                    })}
                  >
                    <Icon
                      name={item.isActive ? 'circle.inset.filled' : 'calendar'}
                      size={18}
                      color={selected ? m3.colorScheme.primary : m3.colorScheme.onSurfaceVariant}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: selected ? m3.colorScheme.primary : m3.colorScheme.onSurface,
                          fontWeight: selected ? fontWeight.semibold : fontWeight.medium,
                          fontSize: fontSize.base,
                        }}
                      >
                        {item.label}
                      </Text>
                      {item.id !== -1 ? (
                        <Text
                          style={{
                            color: m3.colorScheme.onSurfaceVariant,
                            fontSize: fontSize.xs,
                          }}
                        >
                          {item.startDate} — {item.endDate ?? t('reports.season.active')}
                        </Text>
                      ) : null}
                    </View>
                    {selected ? (
                      <Icon name="checkmark" size={18} color={m3.colorScheme.primary} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}
