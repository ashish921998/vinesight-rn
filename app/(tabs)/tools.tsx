import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Calculator data (Irrigation Planning section)
const calculators = [
  {
    id: 'weather',
    title: 'Weather & Irrigation',
    description: 'Farm weather data, forecasts & irrigation needs',
    icon: 'sunny' as const,
    color: '#F59E0B',
    route: '/weather' as Href,
  },
  {
    id: 'mad',
    title: 'MAD Calculator',
    description: 'Maximum allowable deficit & tank requirements',
    icon: 'speedometer' as const,
    color: '#3B82F6',
    route: '/calculator/mad' as Href,
  },
  {
    id: 'system-discharge',
    title: 'System Discharge',
    description: 'Irrigation system design & discharge rates',
    icon: 'water' as const,
    color: '#408059',
    route: '/calculator/system-discharge' as Href,
  },
  {
    id: 'lai',
    title: 'LAI Calculator',
    description: 'Leaf area index & canopy management',
    icon: 'leaf' as const,
    color: '#22C55E',
    route: '/calculator/lai' as Href,
  },
  {
    id: 'nutrients',
    title: 'Nutrient Calculator',
    description: 'Fertilizer requirements & application planning',
    icon: 'flask' as const,
    color: '#8B5CF6',
    route: '/calculator/nutrients' as Href,
  },
];

export default function ToolsScreen() {
  const router = useRouter();

  return (
    <ScrollView
      className="flex-1 bg-surface-50"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      style={{ backgroundColor: '#f2f2f7' }}
    >
      {/* Header */}
      <View className="mb-4">
        <Text className="text-base text-surface-500">
          Scientific calculators for precision vineyard management
        </Text>
      </View>

      {/* Calculators Section */}
      <View className="mb-6">
        <Text className="text-xs font-bold text-surface-500 tracking-wider mb-3">CALCULATORS</Text>
        {calculators.map((calc) => (
          <TouchableOpacity
            key={calc.id}
            onPress={() => router.push(calc.route)}
            className="bg-white rounded-2xl p-4 mb-3 flex-row items-center"
            activeOpacity={0.7}
          >
            <View
              className="w-12 h-12 rounded-xl items-center justify-center"
              style={{ backgroundColor: `${calc.color}15` }}
            >
              <Ionicons name={calc.icon} size={22} color={calc.color} />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-base font-semibold text-surface-900">{calc.title}</Text>
              <Text className="text-xs text-surface-500 mt-0.5" numberOfLines={1}>
                {calc.description}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
