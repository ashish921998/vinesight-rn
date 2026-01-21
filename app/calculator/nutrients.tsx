/**
 * Nutrient Calculator Screen
 * Fertilizer requirements & application planning
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GRAPE_GROWTH_STAGES, type GrapeGrowthStageId } from '@/constants/calculatorModels';

interface NutrientResult {
  nitrogen: number;
  phosphorus: number;
  potassium: number;
}

export default function NutrientCalculatorScreen() {
  const [area, setArea] = useState(''); // acres
  const [targetYield, setTargetYield] = useState(''); // kg/acre
  const [selectedStage, setSelectedStage] = useState<GrapeGrowthStageId | null>(null);
  const [result, setResult] = useState<NutrientResult | null>(null);

  const canCalculate = useMemo(() => {
    const a = parseFloat(area);
    const ty = parseFloat(targetYield);
    return a > 0 && ty > 0 && selectedStage !== null;
  }, [area, targetYield, selectedStage]);

  const calculate = () => {
    if (!canCalculate || !selectedStage) return;
    const a = parseFloat(area);
    const ty = parseFloat(targetYield);
    
    const stage = GRAPE_GROWTH_STAGES.find(s => s.id === selectedStage);
    if (!stage) return;

    // Base nutrient requirements (kg/acre for 10 tons/acre target yield)
    const baseN = 8; // kg/acre
    const baseP = 3; // kg/acre
    const baseK = 12; // kg/acre

    // Scale by target yield (assuming 10 tons/acre = 10000 kg/acre base)
    const yieldFactor = ty / 10000;

    // Apply growth stage factors
    const nitrogen = baseN * yieldFactor * stage.nitrogenFactor * a;
    const phosphorus = baseP * yieldFactor * stage.phosphorusFactor * a;
    const potassium = baseK * yieldFactor * stage.potassiumFactor * a;

    setResult({ nitrogen, phosphorus, potassium });
  };

  const reset = () => {
    setArea('');
    setTargetYield('');
    setSelectedStage(null);
    setResult(null);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Nutrient Calculator',
          headerTitleStyle: { fontWeight: '600' },
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f2f7' }} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-surface-50"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Calculator Card */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <View className="flex-row items-center mb-4">
              <View className="w-8 h-8 bg-purple-100 rounded-lg items-center justify-center">
                <Ionicons name="flask" size={18} color="#8B5CF6" />
              </View>
              <Text className="text-base font-semibold text-surface-900 ml-2">
                Nutrient Calculator
              </Text>
            </View>

            <InputRow
              label="Total Area"
              value={area}
              onChangeText={setArea}
              unit="acres"
              placeholder="5"
            />
            <InputRow
              label="Target Yield"
              value={targetYield}
              onChangeText={setTargetYield}
              unit="kg/acre"
              placeholder="8000"
            />

            {/* Growth Stage Selection */}
            <Text className="text-sm font-medium text-surface-700 mb-2 mt-2">
              Growth Stage
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {GRAPE_GROWTH_STAGES.map((stage) => (
                <TouchableOpacity
                  key={stage.id}
                  onPress={() => setSelectedStage(stage.id)}
                  className="px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: selectedStage === stage.id ? '#408059' : '#F3F4F6',
                  }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{
                      color: selectedStage === stage.id ? '#FFFFFF' : '#374151',
                    }}
                  >
                    {stage.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Info */}
            <View className="bg-purple-50 rounded-xl p-3">
              <Text className="text-xs font-medium text-purple-700 mb-1">
                How it works
              </Text>
              <Text className="text-xs text-purple-600">
                Nutrient requirements vary by growth stage. The calculator adjusts 
                N-P-K recommendations based on crop demand at each stage.
              </Text>
            </View>

            {/* Calculate Button */}
            <TouchableOpacity
              onPress={calculate}
              disabled={!canCalculate || result !== null}
              className="mt-4 py-3 rounded-xl items-center"
              style={{
                backgroundColor: canCalculate && !result ? '#408059' : '#E5E7EB',
              }}
            >
              <Text
                className="font-semibold"
                style={{ color: canCalculate && !result ? '#FFFFFF' : '#9CA3AF' }}
              >
                Calculate Requirements
              </Text>
            </TouchableOpacity>

            {/* Results */}
            {result !== null && (
              <View className="mt-4">
                <Text className="text-sm font-semibold text-surface-700 mb-3">
                  Recommended Nutrients
                </Text>
                <View className="gap-2">
                  <NutrientRow
                    label="Nitrogen (N)"
                    value={result.nitrogen}
                    color="#22C55E"
                    bgColor="#F0FDF4"
                  />
                  <NutrientRow
                    label="Phosphorus (P₂O₅)"
                    value={result.phosphorus}
                    color="#F59E0B"
                    bgColor="#FFFBEB"
                  />
                  <NutrientRow
                    label="Potassium (K₂O)"
                    value={result.potassium}
                    color="#8B5CF6"
                    bgColor="#F5F3FF"
                  />
                </View>

                <View className="bg-surface-50 rounded-xl p-3 mt-3">
                  <Text className="text-xs font-medium text-surface-600 mb-1">
                    Note
                  </Text>
                  <Text className="text-xs text-surface-500">
                    These are estimated values. For precise recommendations, 
                    conduct soil and petiole tests and consult an agronomist.
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Reset Button */}
          {result !== null && (
            <TouchableOpacity
              onPress={reset}
              className="bg-white rounded-2xl py-4 items-center border border-surface-200"
            >
              <View className="flex-row items-center">
                <Ionicons name="refresh" size={18} color="#6B7280" />
                <Text className="text-surface-600 font-medium ml-2">
                  Reset Calculator
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

// Input Row Component
function InputRow({
  label,
  value,
  onChangeText,
  unit,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  unit: string;
  placeholder: string;
}) {
  return (
    <View className="mb-3">
      <Text className="text-sm text-surface-600 mb-1">{label}</Text>
      <View className="flex-row items-center bg-surface-50 rounded-xl">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          keyboardType="decimal-pad"
          className="flex-1 px-4 py-3 text-base text-surface-900"
        />
        <Text className="text-sm text-surface-500 pr-4">{unit}</Text>
      </View>
    </View>
  );
}

// Nutrient Row Component
function NutrientRow({
  label,
  value,
  color,
  bgColor,
}: {
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  return (
    <View 
      className="flex-row items-center justify-between p-3 rounded-xl"
      style={{ backgroundColor: bgColor }}
    >
      <Text className="text-sm text-surface-700">{label}</Text>
      <Text className="text-lg font-bold" style={{ color }}>
        {value.toFixed(1)} kg
      </Text>
    </View>
  );
}
