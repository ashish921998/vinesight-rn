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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Symbol } from '@/components/ui/Symbol';
import { LinearGradient } from 'expo-linear-gradient';
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
    return dblVal > 0 && depthVal > 0 && widthVal > 0 && retentionVal > 0 && retentionVal <= 100;
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
    const span = REFILL_SPANS.find((s) => s.id === selectedRefillSpan);
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
          headerTintColor: '#408059',
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f2f7' }} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
          style={{ backgroundColor: '#f2f2f7' }}
        >
          <LinearGradient
            colors={['rgba(64, 128, 89, 0.08)', 'transparent']}
            style={{ height: 300, position: 'absolute', top: 0, left: 0, right: 0 }}
          />
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 16, paddingBottom: 32 }}
            contentInsetAdjustmentBehavior="never"
            keyboardShouldPersistTaps="handled"
          >
            {/* Step 1: MAD Calculation Card */}
            <View
              className="rounded-2xl p-4 overflow-hidden"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
              }}
            >
              <View className="flex-row items-center mb-4">
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center"
                  style={{ backgroundColor: 'rgba(64, 128, 89, 0.1)' }}
                >
                  <Symbol name="drop.fill" size={18} color="#408059" />
                </View>
                <Text className="text-base font-semibold ml-2" style={{ color: '#1c1c1e' }}>
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
              <View className="rounded-xl p-3 mt-3" style={{ backgroundColor: '#f9f9f9' }}>
                <Text className="text-xs font-medium mb-2" style={{ color: '#8e8e93' }}>
                  Typical water retention by soil type:
                </Text>
                {SOIL_TYPES.map((soil) => (
                  <Text key={soil.id} className="text-xs" style={{ color: '#8e8e93' }}>
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
                  backgroundColor: canCalculateMAD && !madResult ? '#408059' : '#e5e5ea',
                }}
              >
                <Text
                  className="font-semibold"
                  style={{ color: canCalculateMAD && !madResult ? '#ffffff' : '#8e8e93' }}
                >
                  Calculate MAD
                </Text>
              </TouchableOpacity>

              {/* MAD Result */}
              {madResult !== null && (
                <View className="mt-4">
                  <View
                    className="rounded-xl p-4 items-center"
                    style={{ backgroundColor: 'rgba(64, 128, 89, 0.08)' }}
                  >
                    <Text className="text-3xl font-bold" style={{ color: '#408059' }}>
                      {madResult.toFixed(4)}
                    </Text>
                    <Text className="text-sm mt-1" style={{ color: '#408059' }}>
                      Maximum Allowable Deficit
                    </Text>
                  </View>
                  <View className="rounded-xl p-3 mt-3" style={{ backgroundColor: '#f9f9f9' }}>
                    <Text className="text-xs font-medium mb-1" style={{ color: '#8e8e93' }}>
                      Interpretation
                    </Text>
                    <Text className="text-xs" style={{ color: '#8e8e93' }}>
                      {interpretMAD(madResult)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Step 2: Refill Tank Calculator */}
            {madResult !== null && (
              <View
                className="rounded-2xl p-4 overflow-hidden"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                }}
              >
                <View className="flex-row items-center mb-4">
                  <View
                    className="w-8 h-8 rounded-lg items-center justify-center"
                    style={{ backgroundColor: 'rgba(64, 128, 89, 0.1)' }}
                  >
                    <Symbol name="arrow-up-circle" size={18} color="#408059" />
                  </View>
                  <Text className="text-base font-semibold ml-2" style={{ color: '#1c1c1e' }}>
                    Step 2: Refill Tank Calculator
                  </Text>
                </View>

                <Text className="text-sm font-medium mb-2" style={{ color: '#3a3a3c' }}>
                  Select Refill Span
                </Text>
                {REFILL_SPANS.map((span) => (
                  <TouchableOpacity
                    key={span.id}
                    onPress={() => setSelectedRefillSpan(span.id)}
                    className="flex-row items-center p-3 rounded-xl mb-2"
                    style={{
                      backgroundColor:
                        selectedRefillSpan === span.id ? 'rgba(64, 128, 89, 0.08)' : '#f9f9f9',
                      borderWidth: 1,
                      borderColor: selectedRefillSpan === span.id ? '#408059' : '#e5e5ea',
                    }}
                  >
                    <Text className="flex-1 text-sm" style={{ color: '#1c1c1e' }}>
                      {span.label}
                    </Text>
                    {selectedRefillSpan === span.id && (
                      <Symbol name="checkmark.circle.fill" size={20} color="#408059" />
                    )}
                  </TouchableOpacity>
                ))}

                {/* Guidance */}
                <View className="rounded-xl p-3 mt-2" style={{ backgroundColor: '#f9f9f9' }}>
                  <Text className="text-xs font-medium mb-2" style={{ color: '#8e8e93' }}>
                    Refill span guidance:
                  </Text>
                  <Text className="text-xs" style={{ color: '#8e8e93' }}>
                    • Heavy Growth (0.2): Fruit set - maintain turgor
                  </Text>
                  <Text className="text-xs" style={{ color: '#8e8e93' }}>
                    • Normal Growth (0.3): Flowering - balance growth/stress
                  </Text>
                  <Text className="text-xs" style={{ color: '#8e8e93' }}>
                    • Controlled Stress (0.4): Veraison - improve quality/sugar
                  </Text>
                </View>

                {/* Calculate Button */}
                <TouchableOpacity
                  onPress={calculateRefillTank}
                  disabled={!canCalculateRefillTank || refillTankResult !== null}
                  className="mt-4 py-3 rounded-xl items-center"
                  style={{
                    backgroundColor:
                      canCalculateRefillTank && !refillTankResult ? '#408059' : '#e5e5ea',
                  }}
                >
                  <Text
                    className="font-semibold"
                    style={{
                      color: canCalculateRefillTank && !refillTankResult ? '#ffffff' : '#8e8e93',
                    }}
                  >
                    Calculate Refill Tank
                  </Text>
                </TouchableOpacity>

                {/* Refill Tank Result */}
                {refillTankResult !== null && (
                  <View className="mt-4">
                    <View
                      className="rounded-xl p-4 items-center"
                      style={{ backgroundColor: 'rgba(64, 128, 89, 0.08)' }}
                    >
                      <Text className="text-3xl font-bold" style={{ color: '#408059' }}>
                        {refillTankResult.toFixed(4)}
                      </Text>
                      <Text className="text-sm mt-1" style={{ color: '#408059' }}>
                        Refill Tank Requirement
                      </Text>
                    </View>
                    <View className="rounded-xl p-3 mt-3" style={{ backgroundColor: '#f9f9f9' }}>
                      <Text className="text-xs font-medium mb-1" style={{ color: '#8e8e93' }}>
                        What this means
                      </Text>
                      <Text className="text-xs" style={{ color: '#8e8e93' }}>
                        Apply {refillTankResult.toFixed(4)} units of water when soil moisture drops
                        to{' '}
                        {(
                          (REFILL_SPANS.find((s) => s.id === selectedRefillSpan)?.value ?? 0) * 100
                        ).toFixed(0)}
                        % of MAD to maintain optimal vine health.
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
                className="rounded-2xl py-4 items-center overflow-hidden"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                }}
              >
                <View className="flex-row items-center">
                  <Symbol name="refresh" size={18} color="#8e8e93" />
                  <Text className="font-medium ml-2" style={{ color: '#8e8e93' }}>
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
      <Text className="text-sm mb-1" style={{ color: '#8e8e93' }}>
        {label}
      </Text>
      <View className="flex-row items-center rounded-xl" style={{ backgroundColor: '#f9f9f9' }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#8e8e93"
          keyboardType="decimal-pad"
          className="flex-1 px-4 py-3 text-base"
          style={{ color: '#1c1c1e' }}
        />
        <Text className="text-sm pr-4" style={{ color: '#8e8e93' }}>
          {unit}
        </Text>
      </View>
    </View>
  );
}
