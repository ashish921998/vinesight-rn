import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFarms, useDeleteFarm } from '@/hooks';
import { FarmCard } from '@/components/cards';
import type { Farm } from '@/types';

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
    return (
      <View className="px-4 pb-4">
        {/* Search Bar */}
        <View
          className={`
          flex-row items-center bg-white rounded-xl px-4 py-3
          border ${isSearchFocused ? 'border-primary-500' : 'border-gray-200'}
        `}
        >
          <Ionicons
            name="search-outline"
            size={20}
            color={isSearchFocused ? '#408059' : '#c7c7cc'}
          />
          <TextInput
            className="flex-1 ml-3 text-base"
            style={{ color: '#000000' }}
            placeholder="Search farms..."
            placeholderTextColor="#c7c7cc"
            value={searchQuery}
            onChangeText={onSearchChange}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => onSearchChange('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={20} color="#c7c7cc" />
            </TouchableOpacity>
          )}
        </View>

        {/* Results Count */}
        {searchQuery.trim() && (
          <Text className="text-sm mt-3" style={{ color: '#8e8e93' }}>
            {filteredFarms.length} farm{filteredFarms.length !== 1 ? 's' : ''} found
          </Text>
        )}

        {/* Quick Stats */}
        {!searchQuery.trim() && farms && farms.length > 0 && (
          <View className="flex-row mt-4 gap-3">
            <View className="flex-1 rounded-xl p-3" style={{ backgroundColor: '#ffffff' }}>
              <View className="flex-row items-center">
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center"
                  style={{ backgroundColor: 'rgba(64, 128, 89, 0.1)' }}
                >
                  <Ionicons name="leaf" size={16} color="#408059" />
                </View>
                <View className="ml-2">
                  <Text className="text-lg font-bold" style={{ color: '#000000' }}>
                    {farms.length}
                  </Text>
                  <Text className="text-xs" style={{ color: '#8e8e93' }}>
                    Total Farms
                  </Text>
                </View>
              </View>
            </View>
            <View className="flex-1 rounded-xl p-3" style={{ backgroundColor: '#ffffff' }}>
              <View className="flex-row items-center">
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center"
                  style={{ backgroundColor: 'rgba(64, 128, 89, 0.1)' }}
                >
                  <Ionicons name="resize" size={16} color="#408059" />
                </View>
                <View className="ml-2">
                  <Text className="text-lg font-bold" style={{ color: '#000000' }}>
                    {farms.reduce((sum, f) => sum + (f.area || 0), 0).toFixed(1)}
                  </Text>
                  <Text className="text-xs" style={{ color: '#8e8e93' }}>
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
    <View className="px-4 mb-3">
      <FarmCard
        farm={item}
        onPress={() => handleFarmPress(item)}
        onEdit={() => handleEditFarm(item)}
        onDelete={() => handleDeleteFarm(item)}
      />
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View className="flex-1 items-center justify-center p-8">
          <ActivityIndicator size="large" color="#408059" />
          <Text className="text-base mt-4" style={{ color: '#8e8e93' }}>
            Loading farms...
          </Text>
        </View>
      );
    }

    if (searchQuery.trim()) {
      return (
        <View className="flex-1 items-center justify-center p-8">
          <View
            className="w-20 h-20 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: '#f2f2f7' }}
          >
            <Ionicons name="search-outline" size={36} color="#c7c7cc" />
          </View>
          <Text className="text-lg font-semibold text-center" style={{ color: '#000000' }}>
            No Results Found
          </Text>
          <Text className="text-base text-center mt-2" style={{ color: '#8e8e93' }}>
            Try a different search term
          </Text>
          <TouchableOpacity onPress={() => setSearchQuery('')} className="mt-4">
            <Text className="font-medium" style={{ color: '#408059' }}>
              Clear Search
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View className="flex-1 items-center justify-center p-8">
        <View
          className="w-24 h-24 rounded-full items-center justify-center mb-6"
          style={{ backgroundColor: 'rgba(64, 128, 89, 0.1)' }}
        >
          <Ionicons name="leaf-outline" size={48} color="#408059" />
        </View>
        <Text className="text-xl font-semibold text-center" style={{ color: '#000000' }}>
          No Farms Yet
        </Text>
        <Text className="text-base text-center mt-2" style={{ color: '#8e8e93' }}>
          Add your first farm to start tracking irrigation, sprays, and harvests.
        </Text>
        <TouchableOpacity
          className="px-6 py-3 rounded-xl mt-6"
          style={{ backgroundColor: '#408059' }}
          onPress={handleAddFarm}
        >
          <Text className="text-white font-semibold">Add Farm</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#f2f2f7' }}>
      <FlatList
        data={filteredFarms}
        renderItem={renderFarm}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{
          paddingTop: 16,
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
            tintColor="#408059"
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      {(farms?.length || 0) > 0 && (
        <TouchableOpacity
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full items-center justify-center"
          activeOpacity={0.8}
          onPress={handleAddFarm}
          style={{
            backgroundColor: '#408059',
          }}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}
