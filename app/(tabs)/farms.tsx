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
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFarms, useDeleteFarm } from '@/hooks';
import { FarmCard } from '@/components/cards';
import { Symbol } from '@/components/ui/symbol';
import type { Farm } from '@/types';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

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
      backgroundColor: colors.white,
      borderRadius: borderRadius.xl,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderWidth: 1,
      borderColor: isSearchFocused ? colors.primary[500] : colors.gray[200],
    };

    const searchInputStyle: TextStyle = {
      flex: 1,
      marginLeft: spacing[3],
      fontSize: fontSize.base,
      color: colors.black,
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
            color={isSearchFocused ? colors.primary[500] : colors.gray[300]}
          />
          <TextInput
            style={searchInputStyle}
            placeholder="Search farms..."
            placeholderTextColor={colors.gray[300]}
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
            >
              <Symbol name="xmark.circle.fill" size={20} color={colors.gray[300]} />
            </Pressable>
          )}
        </View>

        {/* Results Count */}
        {searchQuery.trim() && (
          <Text
            style={{
              fontSize: fontSize.sm,
              marginTop: spacing[3],
              color: colors.gray[400],
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
                padding: spacing[3],
                backgroundColor: colors.white,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: borderRadius.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(64, 128, 89, 0.1)',
                  }}
                >
                  <Symbol name="leaf.fill" size={16} color={colors.primary[500]} />
                </View>
                <View style={{ marginLeft: spacing[2] }}>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: colors.black,
                    }}
                  >
                    {farms.length}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      color: colors.gray[400],
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
                padding: spacing[3],
                backgroundColor: colors.white,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: borderRadius.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(64, 128, 89, 0.1)',
                  }}
                >
                  <Symbol
                    name="arrow.up.left.and.arrow.down.right"
                    size={16}
                    color={colors.primary[500]}
                  />
                </View>
                <View style={{ marginLeft: spacing[2] }}>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: colors.black,
                    }}
                  >
                    {farms.reduce((sum, f) => sum + (f.area || 0), 0).toFixed(1)}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      color: colors.gray[400],
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
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text
            style={{
              fontSize: fontSize.base,
              marginTop: spacing[4],
              color: colors.gray[400],
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
              backgroundColor: colors.gray[100],
            }}
          >
            <Symbol name="magnifyingglass" size={36} color={colors.gray[300]} />
          </View>
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              textAlign: 'center',
              color: colors.black,
            }}
          >
            No Results Found
          </Text>
          <Text
            style={{
              fontSize: fontSize.base,
              textAlign: 'center',
              marginTop: spacing[2],
              color: colors.gray[400],
            }}
          >
            Try a different search term
          </Text>
          <Pressable onPress={() => setSearchQuery('')} style={{ marginTop: spacing[4] }}>
            <Text
              style={{
                fontWeight: fontWeight.medium,
                color: colors.primary[500],
              }}
            >
              Clear Search
            </Text>
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
            backgroundColor: 'rgba(64, 128, 89, 0.1)',
          }}
        >
          <Symbol name="leaf.fill" size={48} color={colors.primary[500]} />
        </View>
        <Text
          style={{
            fontSize: fontSize.xl,
            fontWeight: fontWeight.semibold,
            textAlign: 'center',
            color: colors.black,
          }}
        >
          No Farms Yet
        </Text>
        <Text
          style={{
            fontSize: fontSize.base,
            textAlign: 'center',
            marginTop: spacing[2],
            color: colors.gray[400],
          }}
        >
          Add your first farm to start tracking irrigation, sprays, and harvests.
        </Text>
        <Pressable
          style={{
            paddingHorizontal: spacing[6],
            paddingVertical: spacing[3],
            borderRadius: borderRadius.xl,
            marginTop: spacing[6],
            backgroundColor: colors.primary[500],
          }}
          onPress={handleAddFarm}
        >
          <Text
            style={{
              color: colors.white,
              fontWeight: fontWeight.semibold,
            }}
          >
            Add Farm
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.gray[100],
      }}
    >
      <FlatList
        data={filteredFarms}
        renderItem={renderFarm}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{
          paddingTop: spacing[4],
          paddingBottom: 100,
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
            tintColor={colors.primary[500]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      {(farms?.length || 0) > 0 && (
        <Pressable
          style={{
            position: 'absolute',
            bottom: spacing[6],
            right: spacing[6],
            width: 56,
            height: 56,
            borderRadius: borderRadius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary[500],
          }}
          onPress={handleAddFarm}
        >
          <Symbol name="plus" size={28} color={colors.white} />
        </Pressable>
      )}
    </View>
  );
}
