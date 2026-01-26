/**
 * LAI Calculator Screen
 * Leaf Area Index & Canopy Management Calculator
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Symbol } from '@/components/ui/Symbol';

export default function LAICalculatorScreen() {
  const [shootLength, setShootLength] = useState(''); // cm
  const [shootsPerVine, setShootsPerVine] = useState('');
  const [vineSpacing, setVineSpacing] = useState(''); // m
  const [rowSpacing, setRowSpacing] = useState(''); // m
  const [result, setResult] = useState<{ lai: number; canopyWidth: number } | null>(null);

  const canCalculate = useMemo(() => {
    const sl = parseFloat(shootLength);
    const spv = parseFloat(shootsPerVine);
    const vs = parseFloat(vineSpacing);
    const rs = parseFloat(rowSpacing);
    return sl > 0 && spv > 0 && vs > 0 && rs > 0;
  }, [shootLength, shootsPerVine, vineSpacing, rowSpacing]);

  const calculate = () => {
    if (!canCalculate) return;
    const sl = parseFloat(shootLength);
    const spv = parseFloat(shootsPerVine);
    const vs = parseFloat(vineSpacing);
    const rs = parseFloat(rowSpacing);

    // Estimate leaf area per shoot (cm²) - using empirical relationship
    // Leaf area ≈ 0.7 × shoot length² (simplified)
    const leafAreaPerShoot = 0.7 * sl * sl;

    // Total leaf area per vine (cm²)
    const totalLeafAreaPerVine = leafAreaPerShoot * spv;

    // Ground area per vine (m²)
    const groundAreaPerVine = vs * rs;

    // LAI = Total leaf area / Ground area (convert cm² to m²)
    const lai = totalLeafAreaPerVine / 10000 / groundAreaPerVine;

    // Canopy width estimate (m)
    const canopyWidth = (sl / 100) * 0.8; // 80% of shoot length

    setResult({ lai, canopyWidth });
  };

  const reset = () => {
    setShootLength('');
    setShootsPerVine('');
    setVineSpacing('');
    setRowSpacing('');
    setResult(null);
  };

  const getLAIInterpretation = (lai: number): { label: string; color: string; message: string } => {
    if (lai < 1.0) {
      return {
        label: 'Low',
        color: '#F59E0B',
        message: 'Canopy underdeveloped. May need more shoots or improved vigor.',
      };
    } else if (lai < 2.5) {
      return {
        label: 'Optimal',
        color: '#22C55E',
        message: 'Good balance between vegetative growth and fruit exposure.',
      };
    } else if (lai < 4.0) {
      return {
        label: 'High',
        color: '#3B82F6',
        message: 'Dense canopy. Consider hedging or leaf removal for better fruit exposure.',
      };
    } else {
      return {
        label: 'Excessive',
        color: '#EF4444',
        message: 'Very dense canopy. Risk of disease and poor fruit quality. Reduce vigor.',
      };
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'LAI Calculator',
          headerTitleStyle: { fontWeight: '600' },
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f2f7' }} edges={['top']}>
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-surface-50"
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 16, paddingBottom: 32 }}
            contentInsetAdjustmentBehavior="never"
            keyboardShouldPersistTaps="handled"
          >
            {/* Calculator Card */}
            <View className="bg-white rounded-2xl p-4 shadow-sm">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 bg-green-100 rounded-lg items-center justify-center">
                  <Symbol name="leaf.fill" size={18} color="#22C55E" />
                </View>
                <Text className="text-base font-semibold text-surface-900 ml-2">
                  Leaf Area Index Calculator
                </Text>
              </View>

              <InputRow
                label="Average Shoot Length"
                value={shootLength}
                onChangeText={setShootLength}
                unit="cm"
                placeholder="100"
              />
              <InputRow
                label="Shoots per Vine"
                value={shootsPerVine}
                onChangeText={setShootsPerVine}
                unit=""
                placeholder="20"
              />
              <InputRow
                label="Vine Spacing"
                value={vineSpacing}
                onChangeText={setVineSpacing}
                unit="m"
                placeholder="1.8"
              />
              <InputRow
                label="Row Spacing"
                value={rowSpacing}
                onChangeText={setRowSpacing}
                unit="m"
                placeholder="3.0"
              />

              {/* Info */}
              <View className="bg-green-50 rounded-xl p-3 mt-3">
                <Text className="text-xs font-medium text-green-700 mb-1">About LAI</Text>
                <Text className="text-xs text-green-600">
                  Leaf Area Index is the ratio of total leaf area to ground area. Optimal LAI for
                  table grapes is 1.5-2.5.
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
                  Calculate LAI
                </Text>
              </TouchableOpacity>

              {/* Results */}
              {result !== null && (
                <View className="mt-4">
                  <View className="flex-row gap-3">
                    <View className="flex-1 bg-primary-50 rounded-xl p-4 items-center">
                      <Text className="text-2xl font-bold text-primary-700">
                        {result.lai.toFixed(2)}
                      </Text>
                      <Text className="text-xs text-primary-600 mt-1">Leaf Area Index</Text>
                    </View>
                    <View className="flex-1 bg-blue-50 rounded-xl p-4 items-center">
                      <Text className="text-2xl font-bold text-blue-700">
                        {result.canopyWidth.toFixed(1)} m
                      </Text>
                      <Text className="text-xs text-blue-600 mt-1">Est. Canopy Width</Text>
                    </View>
                  </View>

                  {/* Interpretation */}
                  {(() => {
                    const interp = getLAIInterpretation(result.lai);
                    return (
                      <View
                        className="rounded-xl p-3 mt-3"
                        style={{ backgroundColor: `${interp.color}15` }}
                      >
                        <View className="flex-row items-center mb-1">
                          <View
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: interp.color }}
                          />
                          <Text className="text-sm font-semibold" style={{ color: interp.color }}>
                            {interp.label}
                          </Text>
                        </View>
                        <Text className="text-xs text-surface-600">{interp.message}</Text>
                      </View>
                    );
                  })()}
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
                  <Symbol name="refresh" size={18} color="#6B7280" />
                  <Text className="text-surface-600 font-medium ml-2">Reset Calculator</Text>
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
        {unit ? <Text className="text-sm text-surface-500 pr-4">{unit}</Text> : null}
      </View>
    </View>
  );
}
