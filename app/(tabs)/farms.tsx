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
  Platform,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useFarms, useDeleteFarm, useFabBottomPosition } from '@/hooks';
import { FarmCard } from '@/components/cards';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { Button } from '@/components/ui';
import type { Farm } from '@/types';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3 } from '@/styles/use-theme';

interface SearchHeaderProps {
  searchQuery: string;
  isSearchFocused: boolean;
  onSearchChange: (text: string) => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  filteredFarms: Farm[];
  farms: Farm[] | undefined;
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

    return (
      <View
        style={{
          paddingHorizontal: spacing[4],
          paddingBottom: spacing[4],
        }}
      >
        {/* Search Bar */}
        <View style={searchBarStyle}>
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

        {/* Results Count */}
        {searchQuery.trim() && (
          <Text
            style={{
              fontSize: fontSize.sm,
              marginTop: spacing[3],
              color: m3.colorScheme.onSurfaceVariant,
            }}
          >
            {t('farms.search.found', { count: filteredFarms.length })}
          </Text>
        )}

        {/* Quick Stats */}
        {!searchQuery.trim() && farms && farms.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              marginTop: spacing[4],
              gap: spacing[3],
            }}
          >
            <View
              style={{
                flex: 1,
                borderRadius: borderRadius.xl,
                borderCurve: 'continuous',
                minHeight: 72,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                justifyContent: 'center',
                backgroundColor: m3.surface.surfaceContainerLow,
                borderWidth: 1,
                borderColor: m3.colorScheme.outlineVariant,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: borderRadius.full,
                    borderCurve: 'continuous',
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                  }}
                >
                  <SymbolIcon name="leaf.fill" size={16} color={m3.colorScheme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: m3.colorScheme.onSurface,
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {farms.length}
                  </Text>
                  <Text
                    style={{
                      color: m3.colorScheme.onSurfaceVariant,
                      ...m3.typography.labelSmall,
                    }}
                  >
                    {t('farms.stats.totalFarms')}
                  </Text>
                </View>
              </View>
            </View>
            <View
              style={{
                flex: 1,
                borderRadius: borderRadius.xl,
                borderCurve: 'continuous',
                minHeight: 72,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                justifyContent: 'center',
                backgroundColor: m3.surface.surfaceContainerLow,
                borderWidth: 1,
                borderColor: m3.colorScheme.outlineVariant,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: borderRadius.full,
                    borderCurve: 'continuous',
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: m3.surface.surfaceContainerHigh,
                  }}
                >
                  <SymbolIcon
                    name="square.grid.2x2"
                    size={18}
                    color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: m3.colorScheme.onSurface,
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {farms.reduce((sum, f) => sum + (f.area || 0), 0).toFixed(1)}
                  </Text>
                  <Text
                    style={{
                      color: m3.colorScheme.onSurfaceVariant,
                      ...m3.typography.labelSmall,
                    }}
                  >
                    {t('farms.stats.totalArea')}
                  </Text>
                </View>
              </View>
            </View>
          </View>
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
  const fabBottom = useFabBottomPosition();
  const { data: farms, isLoading, refetch } = useFarms();
  const deleteFarm = useDeleteFarm();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const isAndroid = Platform.OS === 'android';

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
  }, []);

  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false);
  }, []);

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
        <View style={{ marginTop: spacing[6], width: '100%', maxWidth: 360 }}>
          <Button title={t('farms.addFarm')} onPress={handleAddFarm} />
        </View>
      </View>
    );
  };

  const showFab = isAndroid && (farms?.length || 0) > 0;
  const listBottomPadding = Math.max(
    spacing[16] + (isAndroid ? 16 : 0),
    (showFab ? fabBottom + 56 : 0) + spacing[8],
  );

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
      />

      {/* FAB */}
      {showFab && (
        <Pressable
          style={{
            position: 'absolute',
            bottom: fabBottom,
            right: spacing[6],
            width: 56,
            height: 56,
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
      )}
    </View>
  );
}
