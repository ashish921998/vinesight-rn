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
import { useFarms, useDeleteFarm } from '@/hooks';
import { FarmCard } from '@/components/cards';
import { Symbol } from '@/components/ui/symbol';
import { Button } from '@/components/ui';
import { useFabBottomInset } from '@/hooks/use-fab-bottom-inset';
import type { Farm } from '@/types';
import { m3, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';

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
          <Symbol
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
            placeholder="Search farms..."
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
              accessibilityLabel="Clear search"
            >
              <Symbol
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
            {filteredFarms.length} farm{filteredFarms.length !== 1 ? 's' : ''} found
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
                  <Symbol name="leaf.fill" size={16} color={m3.colorScheme.primary} />
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
                    Total Farms
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
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                  }}
                >
                  <Symbol
                    name="arrow.up.left.and.arrow.down.right"
                    size={16}
                    color={m3.colorScheme.primary}
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
                    Total Acres
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
  const router = useRouter();
  const fabBottomInset = useFabBottomInset();
  const { data: farms, isLoading, refetch } = useFarms();
  const deleteFarm = useDeleteFarm();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const isAndroid = process.env.EXPO_OS === 'android';

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
      'Delete Farm',
      `Are you sure you want to delete "${farm.name}"? This will also delete all associated data including irrigation records, spray records, harvests, expenses, soil profiles, and other farm-related data. This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFarm.mutateAsync(farmId);
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to delete farm';
              Alert.alert('Error', errorMessage);
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
            Loading farms...
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
            <Symbol
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
            No Results Found
          </Text>
          <Text
            style={{
              fontSize: fontSize.base,
              textAlign: 'center',
              marginTop: spacing[2],
              color: m3.colorScheme.onSurfaceVariant,
            }}
          >
            Try a different search term
          </Text>
          <Pressable
            onPress={() => setSearchQuery('')}
            style={{
              marginTop: spacing[4],
              borderRadius: m3.shape.cornerMedium,
              overflow: 'hidden',
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            {({ pressed }) => (
              <View style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
                <Text style={{ fontWeight: fontWeight.medium, color: m3.colorScheme.primary }}>
                  Clear Search
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
          <Symbol name="leaf.fill" size={48} color={m3.colorScheme.primary} />
        </View>
        <Text
          style={{
            fontSize: fontSize.xl,
            fontWeight: fontWeight.semibold,
            textAlign: 'center',
            color: m3.colorScheme.onSurface,
          }}
        >
          No Farms Yet
        </Text>
        <Text
          style={{
            fontSize: fontSize.base,
            textAlign: 'center',
            marginTop: spacing[2],
            color: m3.colorScheme.onSurfaceVariant,
          }}
        >
          Add your first farm to start tracking irrigation, sprays, and harvests.
        </Text>
        <View style={{ marginTop: spacing[6], width: '100%', maxWidth: 360 }}>
          <Button title="Add Farm" onPress={handleAddFarm} />
        </View>
      </View>
    );
  };

  const showFab = isAndroid && (farms?.length || 0) > 0;
  const listBottomPadding = Math.max(
    spacing[16] + fabBottomInset,
    (showFab ? spacing[14] + fabBottomInset + 56 : 0) + spacing[8],
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
            bottom: spacing[14] + fabBottomInset,
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
          accessibilityLabel="Add farm"
        >
          {({ pressed }) => (
            <>
              <Symbol name="plus" size={28} color={m3.colorScheme.onPrimary} />
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
