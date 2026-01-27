import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Symbol } from '@/components/ui/Symbol';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

// Calculator data (Irrigation Planning section)
const calculators = [
  {
    id: 'weather',
    title: 'Weather & Irrigation',
    description: 'Farm weather data, forecasts & irrigation needs',
    icon: 'sun.max.fill' as const,
    color: '#F59E0B',
    route: '/weather' as Href,
  },
  {
    id: 'mad',
    title: 'MAD Calculator',
    description: 'Maximum allowable deficit & tank requirements',
    icon: 'gauge' as const,
    color: '#3B82F6',
    route: '/calculator/mad' as Href,
  },
  {
    id: 'system-discharge',
    title: 'System Discharge',
    description: 'Irrigation system design & discharge rates',
    icon: 'drop.fill' as const,
    color: '#408059',
    route: '/calculator/system-discharge' as Href,
  },
  {
    id: 'lai',
    title: 'LAI Calculator',
    description: 'Leaf area index & canopy management',
    icon: 'leaf.fill' as const,
    color: '#22C55E',
    route: '/calculator/lai' as Href,
  },
  {
    id: 'nutrients',
    title: 'Nutrient Calculator',
    description: 'Fertilizer requirements & application planning',
    icon: 'flask.fill' as const,
    color: '#8B5CF6',
    route: '/calculator/nutrients' as Href,
  },
];

export default function ToolsScreen() {
  const router = useRouter();

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8] }}
      style={{ backgroundColor: '#f2f2f7' }}
    >
      {/* Header */}
      <View style={{ marginBottom: spacing[4] }}>
        <Text style={{ color: colors.surface[500], fontSize: fontSize.base }}>
          Scientific calculators for precision vineyard management
        </Text>
      </View>

      {/* Calculators Section */}
      <View style={{ marginBottom: spacing[6] }}>
        <Text
          style={{
            color: colors.surface[500],
            fontSize: fontSize.xs,
            fontWeight: fontWeight.bold,
            letterSpacing: 1,
            marginBottom: spacing[3],
          }}
        >
          CALCULATORS
        </Text>
        {calculators.map((calc) => (
          <TouchableOpacity
            key={calc.id}
            onPress={() => router.push(calc.route)}
            activeOpacity={0.7}
            style={{
              backgroundColor: colors.surface[100],
              borderRadius: borderRadius['2xl'],
              padding: spacing[4],
              marginBottom: spacing[3],
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: borderRadius.xl,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${calc.color}15`,
              }}
            >
              <Symbol name={calc.icon} size={22} color={calc.color} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing[3] }}>
              <Text
                style={{
                  color: colors.surface[900],
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                }}
              >
                {calc.title}
              </Text>
              <Text
                style={{ color: colors.surface[500], fontSize: fontSize.xs, marginTop: 2 }}
                numberOfLines={1}
              >
                {calc.description}
              </Text>
            </View>
            <Symbol name="chevron.right" size={20} color="#D1D5DB" />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
