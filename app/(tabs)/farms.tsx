import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFarms } from '@/hooks';
import { FarmCard } from '@/components/cards';
import type { Farm } from '@/types';

export default function FarmsScreen() {
  const router = useRouter();
  const { data: farms, isLoading, refetch } = useFarms();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Filter farms based on search query
  const filteredFarms = useMemo(() => {
    if (!farms) return [];
    if (!searchQuery.trim()) return farms;
    
    const query = searchQuery.toLowerCase().trim();
    return farms.filter(farm => 
      farm.name.toLowerCase().includes(query) ||
      farm.crop?.toLowerCase().includes(query) ||
      farm.crop_variety?.toLowerCase().includes(query) ||
      farm.region?.toLowerCase().includes(query)
    );
  }, [farms, searchQuery]);

  const handleFarmPress = (farm: Farm) => {
    router.push(`/farm/${farm.id}`);
  };

  const handleAddFarm = () => {
    router.push('/farm/add');
  };

  const renderFarm = ({ item }: { item: Farm }) => (
    <View className="px-4 mb-3">
      <FarmCard 
        farm={item} 
        onPress={() => handleFarmPress(item)} 
      />
    </View>
  );

  const renderHeader = () => (
    <View className="px-4 pb-4">
      {/* Search Bar */}
      <View 
        className={`
          flex-row items-center bg-white rounded-xl px-4 py-3
          border ${isSearchFocused ? 'border-primary-500' : 'border-surface-200'}
        `}
      >
        <Ionicons 
          name="search-outline" 
          size={20} 
          color={isSearchFocused ? '#408059' : '#9CA3AF'} 
        />
        <TextInput
          className="flex-1 ml-3 text-base text-surface-900"
          placeholder="Search farms..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Results Count */}
      {searchQuery.trim() && (
        <Text className="text-sm text-surface-500 mt-3">
          {filteredFarms.length} farm{filteredFarms.length !== 1 ? 's' : ''} found
        </Text>
      )}

      {/* Quick Stats */}
      {!searchQuery.trim() && farms && farms.length > 0 && (
        <View className="flex-row mt-4 gap-3">
          <View className="flex-1 bg-white rounded-xl p-3">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-primary-100 rounded-lg items-center justify-center">
                <Ionicons name="leaf" size={16} color="#408059" />
              </View>
              <View className="ml-2">
                <Text className="text-lg font-bold text-surface-900">
                  {farms.length}
                </Text>
                <Text className="text-xs text-surface-500">Total Farms</Text>
              </View>
            </View>
          </View>
          <View className="flex-1 bg-white rounded-xl p-3">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-blue-100 rounded-lg items-center justify-center">
                <Ionicons name="resize" size={16} color="#3B82F6" />
              </View>
              <View className="ml-2">
                <Text className="text-lg font-bold text-surface-900">
                  {farms.reduce((sum, f) => sum + (f.area || 0), 0).toFixed(1)}
                </Text>
                <Text className="text-xs text-surface-500">Total Acres</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View className="flex-1 items-center justify-center p-8">
          <ActivityIndicator size="large" color="#408059" />
          <Text className="text-base text-surface-500 mt-4">Loading farms...</Text>
        </View>
      );
    }

    if (searchQuery.trim()) {
      return (
        <View className="flex-1 items-center justify-center p-8">
          <View className="w-20 h-20 bg-surface-100 rounded-full items-center justify-center mb-4">
            <Ionicons name="search-outline" size={36} color="#9CA3AF" />
          </View>
          <Text className="text-lg font-semibold text-surface-900 text-center">
            No Results Found
          </Text>
          <Text className="text-base text-surface-500 text-center mt-2">
            Try a different search term
          </Text>
          <TouchableOpacity 
            onPress={() => setSearchQuery('')}
            className="mt-4"
          >
            <Text className="text-primary-600 font-medium">Clear Search</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View className="flex-1 items-center justify-center p-8">
        <View className="w-24 h-24 bg-primary-100 rounded-full items-center justify-center mb-6">
          <Ionicons name="leaf-outline" size={48} color="#408059" />
        </View>
        <Text className="text-xl font-semibold text-surface-900 text-center">
          No Farms Yet
        </Text>
        <Text className="text-base text-surface-500 text-center mt-2">
          Add your first farm to start tracking irrigation, sprays, and harvests.
        </Text>
        <TouchableOpacity 
          className="bg-primary-600 px-6 py-3 rounded-xl mt-6"
          onPress={handleAddFarm}
        >
          <Text className="text-white font-semibold">Add Farm</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-surface-50">
      <FlatList
        data={filteredFarms}
        renderItem={renderFarm}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: 100,
          flexGrow: 1,
        }}
        ListHeaderComponent={renderHeader}
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
          className="absolute bottom-6 right-6 w-14 h-14 bg-primary-600 rounded-full items-center justify-center"
          activeOpacity={0.8}
          onPress={handleAddFarm}
          style={{
            shadowColor: '#408059',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}
