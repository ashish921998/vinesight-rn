/**
 * MAD Calculator Screen
 * Maximum Allowable Deficit & Tank Requirements Calculator
 * Ported from iOS MADCalculatorView.swift
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
import { REFILL_SPANS, SOIL_TYPES, type RefillSpanId } from '@/constants/calculatorModels';

export default function MADCalculatorScreen() {
  // Step 1: MAD Calculation inputs
  const [dbl, setDbl] = useState('');
  const [rootDepth, setRootDepth] = useState('');
  const [rootWidth, setRootWidth] = useState('');
  const [waterRetention, setWaterRetention] = useState('');

  // Step 1: Results
  const [madResult, setMadResult] = useState<number | null>(null);

  // Step 2: Refill tank
  const [selectedRefillSpan, setSelectedRefillSpan] = useState<RefillSpanId | null>(null);
  const [refillTankResult, setRefillTankResult] = useState<number | null>(null);

  const canCalculateMAD = useMemo(() => {
    const dblVal = parseFloat(dbl);
    const depthVal = parseFloat(rootDepth);
    const widthVal = parseFloat(rootWidth);
    const retentionVal = parseFloat(waterRetention);
    return (
      dblVal > 0 &&
      depthVal > 0 &&
      widthVal > 0 &&
      retentionVal > 0 &&
      retentionVal <= 100
    );
  }, [dbl, rootDepth, rootWidth, waterRetention]);

  const canCalculateRefillTank = madResult !== null && selectedRefillSpan !== null;

  const calculateMAD = () => {
    if (!canCalculateMAD) return;
    const dblVal = parseFloat(dbl);
    const depthVal = parseFloat(rootDepth);
    const widthVal = parseFloat(rootWidth);
    const retentionVal = parseFloat(waterRetention);
    const mad = ((100 / dblVal) * depthVal * widthVal * retentionVal * 100) / 10000;
    setMadResult(mad);
  };

  const calculateRefillTank = () => {
    if (!canCalculateRefillTank || !madResult || !selectedRefillSpan) return;
    const span = REFILL_SPANS.find(s => s.id === selectedRefillSpan);
    if (span) {
      setRefillTankResult(madResult * span.value);
    }
  };

  const resetCalculator = () => {
    setDbl('');
    setRootDepth('');
    setRootWidth('');
    setWaterRetention('');
    setMadResult(null);
    setSelectedRefillSpan(null);
    setRefillTankResult(null);
  };

  const interpretMAD = (mad: number): string => {
    if (mad < 1.0) {
      return 'Shallow root zone - very frequent irrigation needed (daily to twice daily)';
    } else if (mad < 2.5) {
      return 'Moderate root zone - irrigation every 1-2 days recommended';
    } else if (mad < 5.0) {
      return 'Deep root zone - irrigation every 2-3 days is typically sufficient';
    } else {
      return 'Very deep roots - irrigation every 3-5 days may be adequate';
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'MAD Calculator',
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
          {/* Step 1: MAD Calculation Card */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <View className="flex-row items-center mb-4">
              <View className="w-8 h-8 bg-blue-100 rounded-lg items-center justify-center">
                <Ionicons name="water" size={18} color="#3B82F6" />
              </View>
              <Text className="text-base font-semibold text-surface-900 ml-2">
                Step 1: MAD Calculation
              </Text>
            </View>

            <InputRow
              label="Distance Between Lines (DBL)"
              value={dbl}
              onChangeText={setDbl}
              unit="m"
              placeholder="3.0"
            />
            <InputRow
              label="Root Depth"
              value={rootDepth}
              onChangeText={setRootDepth}
              unit="m"
              placeholder="0.6"
            />
            <InputRow
              label="Root Width"
              value={rootWidth}
              onChangeText={setRootWidth}
              unit="m"
              placeholder="1.5"
            />
            <InputRow
              label="Water Retention"
              value={waterRetention}
              onChangeText={setWaterRetention}
              unit="%"
              placeholder="15"
            />

            {/* Soil type guidance */}
            <View className="bg-surface-50 rounded-xl p-3 mt-3">
              <Text className="text-xs font-medium text-surface-600 mb-2">
                Typical water retention by soil type:
              </Text>
              {SOIL_TYPES.map((soil) => (
                <Text key={soil.id} className="text-xs text-surface-500">
                  • {soil.label}: {soil.waterRetentionMin}-{soil.waterRetentionMax}%
                </Text>
              ))}
            </View>

            {/* Calculate Button */}
            <TouchableOpacity
              onPress={calculateMAD}
              disabled={!canCalculateMAD || madResult !== null}
              className="mt-4 py-3 rounded-xl items-center"
              style={{
                backgroundColor: canCalculateMAD && !madResult ? '#408059' : '#E5E7EB',
              }}
            >
              <Text
                className="font-semibold"
                style={{ color: canCalculateMAD && !madResult ? '#FFFFFF' : '#9CA3AF' }}
              >
                Calculate MAD
              </Text>
            </TouchableOpacity>

            {/* MAD Result */}
            {madResult !== null && (
              <View className="mt-4">
                <View className="bg-primary-50 rounded-xl p-4 items-center">
                  <Text className="text-3xl font-bold text-primary-700">
                    {madResult.toFixed(4)}
                  </Text>
                  <Text className="text-sm text-primary-600 mt-1">
                    Maximum Allowable Deficit
                  </Text>
                </View>
                <View className="bg-surface-50 rounded-xl p-3 mt-3">
                  <Text className="text-xs font-medium text-surface-600 mb-1">
                    Interpretation
                  </Text>
                  <Text className="text-xs text-surface-500">
                    {interpretMAD(madResult)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Step 2: Refill Tank Calculator */}
          {madResult !== null && (
            <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 bg-green-100 rounded-lg items-center justify-center">
                  <Ionicons name="arrow-up-circle" size={18} color="#22C55E" />
                </View>
                <Text className="text-base font-semibold text-surface-900 ml-2">
                  Step 2: Refill Tank Calculator
                </Text>
              </View>

              <Text className="text-sm font-medium text-surface-700 mb-2">
                Select Refill Span
              </Text>
              {REFILL_SPANS.map((span) => (
                <TouchableOpacity
                  key={span.id}
                  onPress={() => setSelectedRefillSpan(span.id)}
                  className="flex-row items-center p-3 rounded-xl mb-2"
                  style={{
                    backgroundColor: selectedRefillSpan === span.id ? '#F0FDF4' : '#F9FAFB',
                    borderWidth: 1,
                    borderColor: selectedRefillSpan === span.id ? '#22C55E' : '#E5E7EB',
                  }}
                >
                  <Text className="flex-1 text-sm text-surface-700">{span.label}</Text>
                  {selectedRefillSpan === span.id && (
                    <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                  )}
                </TouchableOpacity>
              ))}

              {/* Guidance */}
              <View className="bg-surface-50 rounded-xl p-3 mt-2">
                <Text className="text-xs font-medium text-surface-600 mb-2">
                  Refill span guidance:
                </Text>
                <Text className="text-xs text-surface-500">
                  • Heavy Growth (0.2): Fruit set - maintain turgor
                </Text>
                <Text className="text-xs text-surface-500">
                  • Normal Growth (0.3): Flowering - balance growth/stress
                </Text>
                <Text className="text-xs text-surface-500">
                  • Controlled Stress (0.4): Veraison - improve quality/sugar
                </Text>
              </View>

              {/* Calculate Button */}
              <TouchableOpacity
                onPress={calculateRefillTank}
                disabled={!canCalculateRefillTank || refillTankResult !== null}
                className="mt-4 py-3 rounded-xl items-center"
                style={{
                  backgroundColor: canCalculateRefillTank && !refillTankResult ? '#408059' : '#E5E7EB',
                }}
              >
                <Text
                  className="font-semibold"
                  style={{ color: canCalculateRefillTank && !refillTankResult ? '#FFFFFF' : '#9CA3AF' }}
                >
                  Calculate Refill Tank
                </Text>
              </TouchableOpacity>

              {/* Refill Tank Result */}
              {refillTankResult !== null && (
                <View className="mt-4">
                  <View className="bg-green-50 rounded-xl p-4 items-center">
                    <Text className="text-3xl font-bold text-green-700">
                      {refillTankResult.toFixed(4)}
                    </Text>
                    <Text className="text-sm text-green-600 mt-1">
                      Refill Tank Requirement
                    </Text>
                  </View>
                  <View className="bg-surface-50 rounded-xl p-3 mt-3">
                    <Text className="text-xs font-medium text-surface-600 mb-1">
                      What this means
                    </Text>
                    <Text className="text-xs text-surface-500">
                      Apply {refillTankResult.toFixed(4)} units of water when soil moisture drops
                      to {((REFILL_SPANS.find(s => s.id === selectedRefillSpan)?.value ?? 0) * 100).toFixed(0)}% of MAD to maintain
                      optimal vine health.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Reset Button */}
          {madResult !== null && refillTankResult !== null && (
            <TouchableOpacity
              onPress={resetCalculator}
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
        <Text className="text-sm text-surface-500 pr-4">{unit}</Text>
      </View>
    </View>
  );
}
