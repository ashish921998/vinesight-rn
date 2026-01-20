/**
 * System Discharge Calculator Screen
 * Calculate irrigation system discharge rates
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
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SystemDischargeScreen() {
  const [emitterDischarge, setEmitterDischarge] = useState(''); // L/hr
  const [emittersPerVine, setEmittersPerVine] = useState('');
  const [vineSpacing, setVineSpacing] = useState(''); // m
  const [rowSpacing, setRowSpacing] = useState(''); // m
  const [result, setResult] = useState<number | null>(null);

  const canCalculate = useMemo(() => {
    const ed = parseFloat(emitterDischarge);
    const epv = parseFloat(emittersPerVine);
    const vs = parseFloat(vineSpacing);
    const rs = parseFloat(rowSpacing);
    return ed > 0 && epv > 0 && vs > 0 && rs > 0;
  }, [emitterDischarge, emittersPerVine, vineSpacing, rowSpacing]);

  const calculate = () => {
    if (!canCalculate) return;
    const ed = parseFloat(emitterDischarge);
    const epv = parseFloat(emittersPerVine);
    const vs = parseFloat(vineSpacing);
    const rs = parseFloat(rowSpacing);

    // System discharge = (Emitter discharge × Emitters per vine) / (Vine spacing × Row spacing)
    // Result is in mm/hr
    const discharge = (ed * epv) / (vs * rs);
    setResult(discharge);
  };

  const reset = () => {
    setEmitterDischarge('');
    setEmittersPerVine('');
    setVineSpacing('');
    setRowSpacing('');
    setResult(null);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'System Discharge',
          headerTitleStyle: { fontWeight: '600' },
        }}
      />
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
              <View className="w-8 h-8 bg-primary-100 rounded-lg items-center justify-center">
                <Ionicons name="speedometer" size={18} color="#408059" />
              </View>
              <Text className="text-base font-semibold text-surface-900 ml-2">
                System Discharge Calculator
              </Text>
            </View>

            <InputRow
              label="Emitter Discharge"
              value={emitterDischarge}
              onChangeText={setEmitterDischarge}
              unit="L/hr"
              placeholder="2.0"
            />
            <InputRow
              label="Emitters per Vine"
              value={emittersPerVine}
              onChangeText={setEmittersPerVine}
              unit=""
              placeholder="4"
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
            <View className="bg-blue-50 rounded-xl p-3 mt-3">
              <Text className="text-xs font-medium text-blue-700 mb-1">Formula</Text>
              <Text className="text-xs text-blue-600">
                System Discharge (mm/hr) = (Emitter Discharge × Emitters per Vine) ÷ (Vine Spacing × Row Spacing)
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
                Calculate
              </Text>
            </TouchableOpacity>

            {/* Result */}
            {result !== null && (
              <View className="mt-4">
                <View className="bg-primary-50 rounded-xl p-4 items-center">
                  <Text className="text-3xl font-bold text-primary-700">
                    {result.toFixed(2)}
                  </Text>
                  <Text className="text-sm text-primary-600 mt-1">
                    mm/hr System Discharge
                  </Text>
                </View>
                <View className="bg-surface-50 rounded-xl p-3 mt-3">
                  <Text className="text-xs font-medium text-surface-600 mb-1">
                    What this means
                  </Text>
                  <Text className="text-xs text-surface-500">
                    Your irrigation system delivers {result.toFixed(2)} mm of water per hour 
                    across your vineyard. Use this value when planning irrigation schedules.
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
