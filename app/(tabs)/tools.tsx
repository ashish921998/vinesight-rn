import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Calculator data (Irrigation Planning section)
const calculators = [
  {
    id: 'mad',
    title: 'MAD Calculator',
    description: 'Maximum allowable deficit & tank requirements',
    icon: 'speedometer' as const,
    color: '#3B82F6',
    route: '/calculator/mad',
  },
  {
    id: 'system-discharge',
    title: 'System Discharge',
    description: 'Irrigation system design & discharge rates',
    icon: 'water' as const,
    color: '#408059',
    route: '/calculator/system-discharge',
  },
  {
    id: 'lai',
    title: 'LAI Calculator',
    description: 'Leaf area index & canopy management',
    icon: 'leaf' as const,
    color: '#22C55E',
    route: '/calculator/lai',
  },
  {
    id: 'nutrients',
    title: 'Nutrient Calculator',
    description: 'Fertilizer requirements & application planning',
    icon: 'flask' as const,
    color: '#8B5CF6',
    route: '/calculator/nutrients',
  },
];

// Other tools
const otherTools = [
  {
    id: 'warehouse',
    title: 'Warehouse',
    description: 'Track inventory and stock levels',
    icon: 'cube' as const,
    color: '#EC4899',
    route: '/warehouse',
  },
  {
    id: 'tasks',
    title: 'Tasks',
    description: 'Manage tasks and reminders',
    icon: 'checkbox' as const,
    color: '#10B981',
    route: '/tasks',
  },
  {
    id: 'analytics',
    title: 'Analytics',
    description: 'View performance and insights',
    icon: 'bar-chart' as const,
    color: '#6366F1',
    route: '/analytics',
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Export PDF & CSV reports',
    icon: 'document-text' as const,
    color: '#EF4444',
    route: '/reports',
  },
  {
    id: 'lab-tests',
    title: 'Lab Tests',
    description: 'Soil and petiole analysis records',
    icon: 'flask' as const,
    color: '#8B5CF6',
    route: '/lab-tests',
  },
  {
    id: 'soil-profiling',
    title: 'Soil Profiling',
    description: 'Create and manage soil profiles',
    icon: 'layers' as const,
    color: '#6366F1',
    route: '/soil-profiling',
  },
];

export default function ToolsScreen() {
  const router = useRouter();

  return (
    <ScrollView
      className="flex-1 bg-surface-50"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      {/* Header */}
      <View className="mb-4">
        <Text className="text-base text-surface-500">
          Scientific calculators for precision vineyard management
        </Text>
      </View>

      {/* Calculators Section */}
      <View className="mb-6">
        <Text className="text-xs font-bold text-surface-500 tracking-wider mb-3">
          CALCULATORS
        </Text>
        {calculators.map((calc) => (
          <TouchableOpacity
            key={calc.id}
            onPress={() => router.push(calc.route as any)}
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
              <Text className="text-base font-semibold text-surface-900">
                {calc.title}
              </Text>
              <Text className="text-xs text-surface-500 mt-0.5" numberOfLines={1}>
                {calc.description}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Other Tools Section */}
      <View>
        <Text className="text-xs font-bold text-surface-500 tracking-wider mb-3">
          OTHER TOOLS
        </Text>
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {otherTools.map((tool) => (
            <TouchableOpacity
              key={tool.id}
              onPress={() => tool.route && router.push(tool.route as any)}
              className="bg-white rounded-2xl p-4"
              style={{ width: '48%' }}
              activeOpacity={0.7}
            >
              <View
                className="w-10 h-10 rounded-xl items-center justify-center mb-2"
                style={{ backgroundColor: `${tool.color}15` }}
              >
                <Ionicons name={tool.icon} size={20} color={tool.color} />
              </View>
              <Text className="text-sm font-semibold text-surface-900">
                {tool.title}
              </Text>
              <Text className="text-xs text-surface-500 mt-0.5" numberOfLines={2}>
                {tool.description}
              </Text>
              {!tool.route && (
                <View className="bg-surface-100 px-2 py-0.5 rounded mt-2 self-start">
                  <Text className="text-xs text-surface-500">Coming Soon</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
