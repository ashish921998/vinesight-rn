import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFarms, useDeleteFarm, useFabBottomPosition, useReorderFarms } from '@/hooks';
import { FarmCard } from '@/components/cards';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { Button } from '@/components/ui';
import type { Farm } from '@/types';
import { isLowWater } from '@/types';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { formatNumber } from '@/i18n/format';
import { useM3 } from '@/styles/use-theme';
import { GUIDED_TOUR_TARGET_IDS, GuidedTourTarget } from '@/features/guided-tour';

/**
 * Returns the current growing-season label, e.g. "Season 2025–26".
 * Indian grape seasons run Oct–Mar, so Season 2025–26 starts Oct 2025.
 */
function getCurrentSeasonLabel(t: TFunction): string {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  const startYear = month >= 9 ? year : year - 1; // Oct+ → new season
  const endYY = String(startYear + 1).slice(-2);
  return t('farms.currentSeasonLabel', { startYear, endYY });
}

function FarmsSummaryLine({
  farms,
  m3,
  t,
  style,
}: {
  farms: Farm[];
  m3: ReturnType<typeof useM3>;
  t: TFunction;
  style?: TextStyle;
}) {
  const totalArea = farms.reduce((sum, f) => sum + (f.area || 0), 0);
  const needsAttentionCount = farms.filter(isLowWater).length;
  return (
    <Text style={[{ fontSize: 13, fontWeight: fontWeight.medium, lineHeight: 16 }, style]}>
      <Text style={{ color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7) }}>
        {`${t('farms.summary.count', { count: farms.length })} · ${t('farms.summary.area', { value: formatNumber(totalArea, { maximumFractionDigits: 1 }) })}`}
      </Text>
      {needsAttentionCount > 0 && (
        <Text style={{ color: m3.colorScheme.error, fontWeight: fontWeight.semibold }}>
          {` · ${t('farms.summary.needsAttention', { count: needsAttentionCount })}`}
        </Text>
      )}
    </Text>
  );
}

type FarmFilter = 'all' | 'healthy' | 'needs_attention';

interface SearchHeaderProps {
  searchQuery: string;
  isSearchFocused: boolean;
  onSearchChange: (text: string) => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  filteredFarms: Farm[];
  farms: Farm[] | undefined;
  onAddFarm: () => void;
  activeFilter: FarmFilter;
  onFilterChange: (filter: FarmFilter) => void;
  isReorderMode: boolean;
  canReorder: boolean;
  onToggleReorderMode: () => void;
}

const SearchHeader = React.memo<SearchHeaderProps>(
  ({
    searchQuery,
    isSearchFocused,
    onSearchChange,
    onSearchFocus,
    onSearchBlur,
    filteredFarms,
    farms,
    onAddFarm,
    activeFilter,
    onFilterChange,
    isReorderMode,
    canReorder,
    onToggleReorderMode,
  }) => {
    const m3 = useM3();
    const { t } = useTranslation();

    const searchBarStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: m3.surface.surfaceContainerLow,
      borderRadius: m3.shape.cornerMedium,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderWidth: 1,
      borderColor: isSearchFocused ? m3.colorScheme.primary : m3.colorScheme.outlineVariant,
    };

    const searchInputStyle: TextStyle = {
      flex: 1,
      marginLeft: spacing[3],
      fontSize: fontSize.base,
      color: m3.colorScheme.onSurface,
    };

    const showSearchBar = searchQuery.trim() || isSearchFocused;
    const isFilterActive = activeFilter !== 'all';

    // Chip counts derived from the full farm list (not the filtered subset)
    const allCount = farms?.length ?? 0;
    const healthyCount = farms?.filter((f) => !isLowWater(f)).length ?? 0;
    const needsAttentionCount = farms?.filter(isLowWater).length ?? 0;

    const FILTER_CHIPS: { key: FarmFilter; label: string; count: number }[] = [
      { key: 'all', label: t('farms.filter.all', { defaultValue: 'All' }), count: allCount },
      {
        key: 'healthy',
        label: t('farms.filter.healthy', { defaultValue: 'Healthy' }),
        count: healthyCount,
      },
      {
        key: 'needs_attention',
        label: t('farms.filter.needsAttention', { defaultValue: 'Needs attention' }),
        count: needsAttentionCount,
      },
    ];

    return (
      <View
        style={{
          paddingHorizontal: spacing[5],
          paddingBottom: spacing[3],
        }}
      >
        {/* Header: Title + Actions */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: spacing[2],
            paddingBottom: spacing[3],
          }}
        >
          {/* Screen Title with season eyebrow (Design D) */}
          <View>
            {farms && farms.length > 0 && !showSearchBar && (
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: fontWeight.semibold,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7),
                  marginBottom: 2,
                }}
              >
                {getCurrentSeasonLabel(t)}
              </Text>
            )}
            <Text
              style={{
                fontSize: 28,
                fontWeight: fontWeight.bold,
                color: m3.colorScheme.onSurface,
                letterSpacing: -0.4,
                lineHeight: 34,
              }}
            >
              {t('farms.title', { defaultValue: 'Farms' })}
            </Text>
          </View>

          {/* Header Actions: Filter + Search + Add */}
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            {farms && farms.length > 1 && !showSearchBar && (
              <Pressable
                style={{
                  minWidth: 40,
                  height: 40,
                  borderRadius: borderRadius.sm,
                  borderWidth: 1,
                  borderColor: isReorderMode
                    ? m3.colorScheme.primary
                    : m3.colorScheme.outlineVariant,
                  backgroundColor: isReorderMode
                    ? colorWithOpacity(m3.colorScheme.primary, 0.1)
                    : m3.surface.surfaceContainerLow,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: isReorderMode ? spacing[3] : 0,
                }}
                onPress={onToggleReorderMode}
                disabled={!canReorder && !isReorderMode}
                accessibilityRole="button"
                accessibilityLabel={t(isReorderMode ? 'farms.reorder.done' : 'farms.reorder.start')}
                accessibilityState={{ selected: isReorderMode, disabled: !canReorder }}
              >
                {isReorderMode ? (
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: m3.colorScheme.primary,
                    }}
                  >
                    {t('farms.reorder.done')}
                  </Text>
                ) : (
                  <SymbolIcon
                    name="chevron.up.chevron.down"
                    size={18}
                    color={
                      canReorder
                        ? m3.colorScheme.onSurfaceVariant
                        : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.38)
                    }
                  />
                )}
              </Pressable>
            )}

            {/* Filter Icon Button */}
            {farms && farms.length > 0 && !showSearchBar && (
              <Pressable
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: borderRadius.sm,
                  borderWidth: 1,
                  borderColor: isFilterActive
                    ? m3.colorScheme.primary
                    : m3.colorScheme.outlineVariant,
                  backgroundColor: isFilterActive
                    ? colorWithOpacity(m3.colorScheme.primary, 0.1)
                    : m3.surface.surfaceContainerLow,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => onFilterChange(activeFilter === 'all' ? 'needs_attention' : 'all')}
                accessibilityRole="button"
                accessibilityLabel={t('farms.filter.label', { defaultValue: 'Filter farms' })}
                accessibilityState={{ selected: isFilterActive }}
              >
                <SymbolIcon
                  name="line.3.horizontal.decrease"
                  size={18}
                  color={
                    isFilterActive
                      ? m3.colorScheme.primary
                      : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)
                  }
                />
              </Pressable>
            )}

            {/* Search Icon Button */}
            <Pressable
              style={{
                width: 40,
                height: 40,
                borderRadius: borderRadius.sm,
                borderWidth: 1,
                borderColor: m3.colorScheme.outlineVariant,
                backgroundColor: m3.surface.surfaceContainerLow,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={onSearchFocus}
              accessibilityRole="button"
              accessibilityLabel={t('farms.search.placeholder')}
            >
              <SymbolIcon
                name="magnifyingglass"
                size={18}
                color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
              />
            </Pressable>

            {/* Add Farm Icon Button */}
            <Pressable
              style={{
                width: 40,
                height: 40,
                borderRadius: borderRadius.sm,
                backgroundColor: m3.colorScheme.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={onAddFarm}
              accessibilityRole="button"
              accessibilityLabel={t('farms.addFarm')}
            >
              <SymbolIcon name="plus" size={20} color={m3.colorScheme.onPrimary} />
            </Pressable>
          </View>
        </View>

        {/* Filter chips strip — Design C (always visible when farms exist, hides during search) */}
        {farms && farms.length > 0 && !showSearchBar && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[2], paddingBottom: spacing[3] }}
            keyboardShouldPersistTaps="handled"
          >
            {FILTER_CHIPS.map((chip) => {
              const isActive = activeFilter === chip.key;
              return (
                <Pressable
                  key={chip.key}
                  onPress={() => onFilterChange(chip.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isActive }}
                  accessibilityLabel={`${chip.label}, ${chip.count}`}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    height: 30,
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
                      fontSize: 12,
                      fontWeight: fontWeight.semibold,
                      color: isActive
                        ? m3.colorScheme.onPrimary
                        : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.85),
                    }}
                  >
                    {chip.count > 0 ? `${chip.label} · ${chip.count}` : chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Summary Line — shown only during search (chips are hidden then) */}
        {farms && farms.length > 0 && showSearchBar && (
          <FarmsSummaryLine farms={farms} m3={m3} t={t} style={{ paddingBottom: spacing[3] }} />
        )}

        {/* Search Bar (shown when focused or has query) */}
        {showSearchBar && (
          <View style={[searchBarStyle, { marginBottom: spacing[3] }]}>
            <SymbolIcon
              name="magnifyingglass"
              size={20}
              color={
                isSearchFocused
                  ? m3.colorScheme.primary
                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)
              }
            />
            <TextInput
              style={searchInputStyle}
              placeholder={t('farms.search.placeholder')}
              placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
              value={searchQuery}
              onChangeText={onSearchChange}
              onFocus={onSearchFocus}
              onBlur={onSearchBlur}
              returnKeyType="search"
              accessibilityRole="search"
              accessibilityLabel={t('farms.search.placeholder')}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => onSearchChange('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={t('common.clearSearch')}
              >
                <SymbolIcon
                  name="xmark.circle.fill"
                  size={20}
                  color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                />
              </Pressable>
            )}
          </View>
        )}

        {/* Results Count when searching */}
        {searchQuery.trim() && (
          <Text
            style={{
              fontSize: fontSize.sm,
              color: m3.colorScheme.onSurfaceVariant,
            }}
          >
            {t('farms.search.found', { count: filteredFarms.length })}
          </Text>
        )}
      </View>
    );
  },
);

SearchHeader.displayName = 'SearchHeader';

export default function FarmsScreen() {
  const m3 = useM3();
  const { t } = useTranslation();

  const router = useRouter();
  const isScreenFocused = useIsFocused();
  const fabBottom = useFabBottomPosition();
  const { data: farms, isLoading, refetch } = useFarms();
  const deleteFarm = useDeleteFarm();
  const reorderFarms = useReorderFarms();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [today, setToday] = useState(() => new Date());
  const [activeFilter, setActiveFilter] = useState<FarmFilter>('all');
  const [isReorderMode, setIsReorderMode] = useState(false);

  const handleFilterChange = useCallback((filter: FarmFilter) => {
    setActiveFilter(filter);
    setIsReorderMode(false);
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (text.trim()) setIsReorderMode(false);
  }, []);

  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
  }, []);

  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setToday(new Date());
      return () => {
        setSearchQuery('');
        setIsSearchFocused(false);
        setIsReorderMode(false);
      };
    }, []),
  );

  const canReorder = !searchQuery.trim() && activeFilter === 'all';

  // Midnight tick — keeps `today` current if the screen stays open across midnight.
  // useFocusEffect handles focus/resume; this handles the in-session day rollover.
  useEffect(() => {
    function msUntilMidnight(): number {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      return midnight.getTime() - now.getTime();
    }

    let timer: ReturnType<typeof setTimeout>;

    function scheduleNextTick() {
      timer = setTimeout(() => {
        setToday(new Date());
        scheduleNextTick();
      }, msUntilMidnight());
    }

    scheduleNextTick();
    return () => clearTimeout(timer);
  }, []);

  // Filter farms by search query + active filter chip; base farm order comes from useFarms().
  const filteredFarms = useMemo(() => {
    if (!farms) return [];
    const query = searchQuery.toLowerCase().trim();

    // 1. Text search
    const afterSearch = query
      ? farms.filter(
          (farm) =>
            farm.name.toLowerCase().includes(query) ||
            farm.crop?.toLowerCase().includes(query) ||
            farm.crop_variety?.toLowerCase().includes(query) ||
            farm.region?.toLowerCase().includes(query),
        )
      : farms;

    // 2. Filter chip
    const afterFilter =
      activeFilter === 'healthy'
        ? afterSearch.filter((f) => !isLowWater(f))
        : activeFilter === 'needs_attention'
          ? afterSearch.filter(isLowWater)
          : afterSearch;

    return afterFilter;
  }, [farms, searchQuery, activeFilter]);

  const handleToggleReorderMode = useCallback(() => {
    if (isReorderMode) {
      setIsReorderMode(false);
      return;
    }
    if (!canReorder) return;
    setIsReorderMode(true);
  }, [canReorder, isReorderMode]);

  const handleMoveFarm = useCallback(
    async (farm: Farm, direction: 'up' | 'down') => {
      if (!farms || typeof farm.id !== 'number' || reorderFarms.isPending) return;
      const currentIndex = farms.findIndex((item) => item.id === farm.id);
      if (currentIndex < 0) return;

      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= farms.length) return;

      const nextFarms = [...farms];
      [nextFarms[currentIndex], nextFarms[nextIndex]] = [
        nextFarms[nextIndex],
        nextFarms[currentIndex],
      ];
      const orderedIds = nextFarms
        .map((item) => item.id)
        .filter((id): id is number => typeof id === 'number');

      try {
        await reorderFarms.mutateAsync(orderedIds);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t('farms.reorder.error');
        Alert.alert(t('common.error'), message);
      }
    },
    [farms, reorderFarms, t],
  );

  const handleFarmPress = useCallback(
    (farm: Farm) => {
      if (typeof farm.id !== 'number') return;
      router.push(`/farm/${farm.id}`);
    },
    [router],
  );

  const handleAddFarm = useCallback(() => {
    router.push('/farm/add');
  }, [router]);

  const handleEditFarm = useCallback(
    (farm: Farm) => {
      if (typeof farm.id !== 'number') return;
      router.push(`/farm/${farm.id}/edit`);
    },
    [router],
  );

  const handleDeleteFarm = useCallback(
    (farm: Farm) => {
      const farmId = farm.id;
      if (typeof farmId !== 'number') return;
      Alert.alert(
        t('farmDetails.deleteFarmTitle'),
        t('farmDetails.deleteFarmBody', { name: farm.name }),
        [
          {
            text: t('common.cancel'),
            style: 'cancel',
          },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteFarm.mutateAsync(farmId);
              } catch (error: unknown) {
                const errorMessage =
                  error instanceof Error ? error.message : t('farmDetails.errors.deleteFarmFailed');
                Alert.alert(t('common.error'), errorMessage);
              }
            },
          },
        ],
      );
    },
    [t, deleteFarm],
  );

  const renderFarm = useCallback(
    ({ item, index }: { item: Farm; index: number }) => (
      <View
        style={{
          paddingHorizontal: spacing[4],
          marginBottom: spacing[3],
          flexDirection: isReorderMode ? 'row' : 'column',
          alignItems: isReorderMode ? 'stretch' : undefined,
          gap: isReorderMode ? spacing[3] : 0,
        }}
      >
        {isReorderMode && (
          <View style={{ justifyContent: 'center', gap: spacing[2] }}>
            {[
              {
                direction: 'up' as const,
                icon: 'chevron.up',
                disabled: index === 0 || reorderFarms.isPending,
                label: t('farms.reorder.moveUp', { name: item.name }),
              },
              {
                direction: 'down' as const,
                icon: 'chevron.down',
                disabled: index === filteredFarms.length - 1 || reorderFarms.isPending,
                label: t('farms.reorder.moveDown', { name: item.name }),
              },
            ].map((control) => (
              <Pressable
                key={control.direction}
                onPress={() => handleMoveFarm(item, control.direction)}
                disabled={control.disabled}
                accessibilityRole="button"
                accessibilityLabel={control.label}
                accessibilityState={{ disabled: control.disabled }}
                style={({ pressed }) => ({
                  width: 36,
                  height: 36,
                  borderRadius: borderRadius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                  backgroundColor: pressed
                    ? colorWithOpacity(m3.colorScheme.primary, 0.12)
                    : m3.surface.surfaceContainerLow,
                  opacity: control.disabled ? 0.38 : 1,
                })}
              >
                <SymbolIcon name={control.icon} size={18} color={m3.colorScheme.onSurfaceVariant} />
              </Pressable>
            ))}
          </View>
        )}
        <View style={{ flex: 1 }}>
          <FarmCard
            farm={item}
            today={today}
            onPress={isReorderMode ? undefined : () => handleFarmPress(item)}
            onEdit={isReorderMode ? undefined : () => handleEditFarm(item)}
            onDelete={isReorderMode ? undefined : () => handleDeleteFarm(item)}
          />
        </View>
      </View>
    ),
    [
      filteredFarms.length,
      handleDeleteFarm,
      handleEditFarm,
      handleFarmPress,
      handleMoveFarm,
      isReorderMode,
      m3,
      reorderFarms.isPending,
      t,
      today,
    ],
  );

  const renderEmpty = () => {
    const emptyContainerStyle: ViewStyle = {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing[8],
    };

    if (isLoading) {
      return (
        <View style={emptyContainerStyle}>
          <ActivityIndicator size="large" color={m3.colorScheme.primary} />
          <Text
            style={{
              fontSize: fontSize.base,
              marginTop: spacing[4],
              color: m3.colorScheme.onSurfaceVariant,
            }}
          >
            {t('common.loading')}
          </Text>
          {/* Keep GuidedTourTarget mounted during loading so the controller can
              resolve the add-farm target before farms data finishes loading. */}
          <GuidedTourTarget
            targetId={GUIDED_TOUR_TARGET_IDS.ADD_FARM_PRIMARY}
            enabled={isScreenFocused}
            style={{
              position: 'absolute',
              opacity: 0,
              bottom: spacing[8],
              width: '100%',
              maxWidth: 360,
            }}
          >
            <Button
              title={t('farms.addFarm')}
              onPress={handleAddFarm}
              pointerEvents="none"
              importantForAccessibility="no-hide-descendants"
            />
          </GuidedTourTarget>
        </View>
      );
    }

    if (searchQuery.trim()) {
      return (
        <View style={emptyContainerStyle}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing[4],
              backgroundColor: m3.surface.surfaceContainerHigh,
            }}
          >
            <SymbolIcon
              name="magnifyingglass"
              size={36}
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
            />
          </View>
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              textAlign: 'center',
              color: m3.colorScheme.onSurface,
            }}
          >
            {t('common.noResultsFound')}
          </Text>
          <Text
            style={{
              fontSize: fontSize.base,
              textAlign: 'center',
              marginTop: spacing[2],
              color: m3.colorScheme.onSurfaceVariant,
            }}
          >
            {t('common.tryDifferentSearchTerm')}
          </Text>
          <Pressable
            onPress={() => setSearchQuery('')}
            style={{
              marginTop: spacing[4],
              borderRadius: m3.shape.cornerMedium,
              overflow: 'hidden',
            }}
            accessibilityRole="button"
            accessibilityLabel={t('common.clearSearch')}
          >
            {({ pressed }) => (
              <View style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
                <Text style={{ fontWeight: fontWeight.medium, color: m3.colorScheme.primary }}>
                  {t('common.clearSearch')}
                </Text>
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
            )}
          </Pressable>
        </View>
      );
    }

    return (
      <View style={emptyContainerStyle}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: borderRadius.full,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing[6],
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
          }}
        >
          <SymbolIcon name="leaf.fill" size={48} color={m3.colorScheme.primary} />
        </View>
        <Text
          style={{
            fontSize: fontSize.xl,
            fontWeight: fontWeight.semibold,
            textAlign: 'center',
            color: m3.colorScheme.onSurface,
          }}
        >
          {t('farms.empty.title')}
        </Text>
        <Text
          style={{
            fontSize: fontSize.base,
            textAlign: 'center',
            marginTop: spacing[2],
            color: m3.colorScheme.onSurfaceVariant,
          }}
        >
          {t('farms.empty.subtitle')}
        </Text>
        <View style={{ marginTop: spacing[6], alignSelf: 'center' }}>
          <GuidedTourTarget
            targetId={GUIDED_TOUR_TARGET_IDS.ADD_FARM_PRIMARY}
            enabled={isScreenFocused}
          >
            <Button title={t('farms.addFarm')} onPress={handleAddFarm} fullWidth={false} />
          </GuidedTourTarget>
        </View>
      </View>
    );
  };

  const showFab = Platform.OS === 'android' && (farms?.length || 0) > 0;
  const listBottomPadding = Math.max(spacing[16], (showFab ? fabBottom + 56 : 0) + spacing[8]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: m3.colorScheme.surface,
      }}
    >
      <FlatList
        data={filteredFarms}
        renderItem={renderFarm}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{
          paddingTop: spacing[4],
          paddingBottom: listBottomPadding,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <SearchHeader
            searchQuery={searchQuery}
            isSearchFocused={isSearchFocused}
            onSearchChange={handleSearchChange}
            onSearchFocus={handleSearchFocus}
            onSearchBlur={handleSearchBlur}
            filteredFarms={filteredFarms}
            farms={farms}
            onAddFarm={handleAddFarm}
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
            isReorderMode={isReorderMode}
            canReorder={canReorder}
            onToggleReorderMode={handleToggleReorderMode}
          />
        }
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && !searchQuery}
            onRefresh={refetch}
            tintColor={m3.colorScheme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />

      {/* FAB – Android only; iOS uses the header add button */}
      {Platform.OS === 'android' && showFab && (
        <GuidedTourTarget
          targetId={GUIDED_TOUR_TARGET_IDS.ADD_FARM_PRIMARY}
          enabled={isScreenFocused}
          style={{
            position: 'absolute',
            bottom: fabBottom,
            right: spacing[6],
            width: 56,
            height: 56,
          }}
        >
          <Pressable
            style={{
              width: '100%',
              height: '100%',
              borderRadius: borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: m3.colorScheme.primary,
              overflow: 'hidden',
            }}
            onPress={handleAddFarm}
            accessibilityRole="button"
            accessibilityLabel={t('farms.addFarm')}
          >
            {({ pressed }) => (
              <>
                <SymbolIcon name="plus" size={28} color={m3.colorScheme.onPrimary} />
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      backgroundColor: pressed
                        ? colorWithOpacity(m3.colorScheme.onPrimary, m3.stateLayerOpacity.pressed)
                        : 'transparent',
                    },
                  ]}
                />
              </>
            )}
          </Pressable>
        </GuidedTourTarget>
      )}
    </View>
  );
}
