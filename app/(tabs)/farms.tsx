import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useFarms, useDeleteFarm, useFabBottomPosition } from '@/hooks';
import { FarmCard } from '@/components/cards';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { Button } from '@/components/ui';
import type { Farm } from '@/types';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3 } from '@/styles/use-theme';
import { GUIDED_TOUR_TARGET_IDS, GuidedTourTarget } from '@/features/guided-tour';

interface SearchHeaderProps {
  searchQuery: string;
  isSearchFocused: boolean;
  onSearchChange: (text: string) => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  filteredFarms: Farm[];
  farms: Farm[] | undefined;
  onAddFarm: () => void;
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

    // Header area matching wireframe-farms-list.html
    const showSearchBar = searchQuery.trim() || isSearchFocused;

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
          {/* Screen Title */}
          <Text
            style={{
              fontSize: 26,
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.onSurface,
              lineHeight: 32,
            }}
          >
            {t('farms.title', { defaultValue: 'Farms' })}
          </Text>

          {/* Header Actions: Search + Add */}
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
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

        {/* Summary Line */}
        {farms && farms.length > 0 && !showSearchBar && (
          <Text
            style={{
              fontSize: 13,
              color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7),
              fontWeight: fontWeight.medium,
              lineHeight: 16,
              paddingBottom: spacing[3],
            }}
          >
            {(() => {
              const totalArea = farms.reduce((sum, f) => sum + (f.area || 0), 0).toFixed(1);
              return `${t('farms.summary.count', { count: farms.length })} · ${t('farms.summary.area', { value: totalArea })}`;
            })()}
          </Text>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
  }, []);

  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSearchQuery('');
        setIsSearchFocused(false);
      };
    }, []),
  );

  // Filter farms based on search query
  const filteredFarms = useMemo(() => {
    if (!farms) return [];
    if (!searchQuery.trim()) return farms;

    const query = searchQuery.toLowerCase().trim();
    return farms.filter(
      (farm) =>
        farm.name.toLowerCase().includes(query) ||
        farm.crop?.toLowerCase().includes(query) ||
        farm.crop_variety?.toLowerCase().includes(query) ||
        farm.region?.toLowerCase().includes(query),
    );
  }, [farms, searchQuery]);

  const handleFarmPress = (farm: Farm) => {
    if (typeof farm.id !== 'number') return;
    router.push(`/farm/${farm.id}`);
  };

  const handleAddFarm = () => {
    router.push('/farm/add');
  };

  const handleEditFarm = (farm: Farm) => {
    if (typeof farm.id !== 'number') return;
    router.push(`/farm/${farm.id}/edit`);
  };

  const handleDeleteFarm = (farm: Farm) => {
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
  };

  const renderFarm = ({ item }: { item: Farm }) => (
    <View
      style={{
        paddingHorizontal: spacing[4],
        marginBottom: spacing[3],
      }}
    >
      <FarmCard
        farm={item}
        onPress={() => handleFarmPress(item)}
        onEdit={() => handleEditFarm(item)}
        onDelete={() => handleDeleteFarm(item)}
      />
    </View>
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

  const showFab = (farms?.length || 0) > 0;
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

      {/* FAB */}
      {showFab && (
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
