/**
 * System Discharge Calculator Screen
 * Calculate irrigation system discharge rates
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
} from 'react-native';

import { Stack } from 'expo-router';
import { Symbol } from '@/components/ui/Symbol';

type SystemDischargeResults = {
  plantsPerHectare?: number | null;
  systemDischarge: number;
  irrigationHours?: number | null;
  method: 1 | 2;
};

export default function SystemDischargeScreen() {
  const [dbl, setDbl] = useState('');
  const [refillTankValue, setRefillTankValue] = useState('');

  const [selectedMethod, setSelectedMethod] = useState<1 | 2 | null>(null);

  const [dbp, setDbp] = useState('');
  const [drippersPerPlant, setDrippersPerPlant] = useState('');
  const [dischargePerHour1, setDischargePerHour1] = useState('');

  const [dbd, setDbd] = useState('');
  const [dischargePerHour2, setDischargePerHour2] = useState('');
  const [numberOfLines, setNumberOfLines] = useState('');

  const [results, setResults] = useState<SystemDischargeResults | null>(null);

  const canSelectMethod = useMemo(() => {
    const dblVal = parseFloat(dbl);
    return dblVal > 0;
  }, [dbl]);

  const canCalculateMethod1 = useMemo(() => {
    const dblVal = parseFloat(dbl);
    const dbpVal = parseFloat(dbp);
    const drippersVal = parseFloat(drippersPerPlant);
    const dischargeVal = parseFloat(dischargePerHour1);
    return dblVal > 0 && dbpVal > 0 && drippersVal > 0 && dischargeVal > 0;
  }, [dbl, dbp, drippersPerPlant, dischargePerHour1]);

  const canCalculateMethod2 = useMemo(() => {
    const dblVal = parseFloat(dbl);
    const dbdVal = parseFloat(dbd);
    const dischargeVal = parseFloat(dischargePerHour2);
    const linesVal = parseFloat(numberOfLines);
    return dblVal > 0 && dbdVal > 0 && dischargeVal > 0 && linesVal > 0;
  }, [dbl, dbd, dischargePerHour2, numberOfLines]);

  const formatDuration = (hours: number) => {
    if (hours < 1 / 60) {
      const seconds = Math.round(hours * 3600);
      if (seconds === 60) return '1 minute';
      return `${seconds} seconds`;
    }
    if (hours < 1) {
      const minutesRounded = Math.round(hours * 60);
      if (minutesRounded === 60) return '1 hour';
      return `${minutesRounded} minutes`;
    }
    let wholeHours = Math.floor(hours);
    let minutes = Math.round((hours - wholeHours) * 60);
    if (minutes === 60) {
      wholeHours += 1;
      minutes = 0;
    }
    if (minutes === 0) {
      return `${wholeHours} hours`;
    }
    return `${wholeHours}h ${minutes}m`;
  };

  const calculateMethod1 = () => {
    if (!canCalculateMethod1) return;
    const dblVal = parseFloat(dbl);
    const dbpVal = parseFloat(dbp);
    const drippersVal = parseFloat(drippersPerPlant);
    const dischargeVal = parseFloat(dischargePerHour1);

    const plantsPerHectare = 10000 / (dblVal * dbpVal);
    const systemDischarge = (plantsPerHectare * drippersVal * dischargeVal) / 10000;

    const refillVal = parseFloat(refillTankValue);
    const irrigationHours = refillVal > 0 ? refillVal / systemDischarge : null;

    setResults({
      plantsPerHectare,
      systemDischarge,
      irrigationHours,
      method: 1,
    });
  };

  const calculateMethod2 = () => {
    if (!canCalculateMethod2) return;
    const dblVal = parseFloat(dbl);
    const dbdVal = parseFloat(dbd);
    const dischargeVal = parseFloat(dischargePerHour2);
    const linesVal = parseFloat(numberOfLines);

    const systemDischarge = ((100 / dblVal) * (100 / dbdVal) * dischargeVal * linesVal) / 10000;

    const refillVal = parseFloat(refillTankValue);
    const irrigationHours = refillVal > 0 ? refillVal / systemDischarge : null;

    setResults({
      plantsPerHectare: null,
      systemDischarge,
      irrigationHours,
      method: 2,
    });
  };

  const reset = () => {
    setDbl('');
    setRefillTankValue('');
    setSelectedMethod(null);
    setDbp('');
    setDrippersPerPlant('');
    setDischargePerHour1('');
    setDbd('');
    setDischargePerHour2('');
    setNumberOfLines('');
    setResults(null);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'System Discharge',
          headerTitleStyle: { fontWeight: '600' },
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
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
            <View className="bg-white rounded-2xl p-4 shadow-sm">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 bg-primary-100 rounded-lg items-center justify-center">
                  <Symbol name="speedometer" size={18} color="#408059" />
                </View>
                <Text className="text-base font-semibold text-surface-900 ml-2">
                  System Parameters
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
                label="Refill Tank Value (optional)"
                value={refillTankValue}
                onChangeText={setRefillTankValue}
                unit=""
                placeholder="From MAD calc"
              />

              <Text className="text-xs text-surface-500 mt-2">
                Use the refill tank value from MAD to estimate irrigation hours.
              </Text>
            </View>

            {canSelectMethod && (
              <View className="bg-white rounded-2xl p-4 shadow-sm">
                <View className="flex-row items-center mb-4">
                  <View className="w-8 h-8 bg-primary-100 rounded-lg items-center justify-center">
                    <Symbol name="git-branch" size={18} color="#408059" />
                  </View>
                  <Text className="text-base font-semibold text-surface-900 ml-2">
                    Select Calculation Method
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setSelectedMethod(1);
                    setResults(null);
                  }}
                  className="rounded-xl p-3 mb-2"
                  style={{
                    backgroundColor: selectedMethod === 1 ? '#E7F2EC' : '#F3F4F6',
                  }}
                >
                  <View className="flex-row items-center">
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-surface-900">
                        System Discharge 1
                      </Text>
                      <Text className="text-xs text-surface-500">
                        Using plants per hectare and drippers
                      </Text>
                    </View>
                    {selectedMethod === 1 ? (
                      <Symbol name="checkmark.circle.fill" size={18} color="#408059" />
                    ) : null}
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setSelectedMethod(2);
                    setResults(null);
                  }}
                  className="rounded-xl p-3"
                  style={{
                    backgroundColor: selectedMethod === 2 ? '#E7F2EC' : '#F3F4F6',
                  }}
                >
                  <View className="flex-row items-center">
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-surface-900">
                        System Discharge 2
                      </Text>
                      <Text className="text-xs text-surface-500">Using dripper spacing</Text>
                    </View>
                    {selectedMethod === 2 ? (
                      <Symbol name="checkmark.circle.fill" size={18} color="#408059" />
                    ) : null}
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {selectedMethod === 1 && (
              <View className="bg-white rounded-2xl p-4 shadow-sm">
                <View className="flex-row items-center mb-4">
                  <View className="w-8 h-8 bg-primary-100 rounded-lg items-center justify-center">
                    <Symbol name="leaf.fill" size={18} color="#408059" />
                  </View>
                  <Text className="text-base font-semibold text-surface-900 ml-2">
                    Method 1: Plants per Hectare
                  </Text>
                </View>

                <InputRow
                  label="Distance Between Plants (DBP)"
                  value={dbp}
                  onChangeText={setDbp}
                  unit="m"
                  placeholder="1.5"
                />
                <InputRow
                  label="Drippers per Plant"
                  value={drippersPerPlant}
                  onChangeText={setDrippersPerPlant}
                  unit=""
                  placeholder="4"
                />
                <InputRow
                  label="Discharge per Dripper"
                  value={dischargePerHour1}
                  onChangeText={setDischargePerHour1}
                  unit="L/hr"
                  placeholder="2.0"
                />

                <View className="bg-blue-50 rounded-xl p-3 mt-3">
                  <Text className="text-xs font-medium text-blue-700 mb-1">Formula</Text>
                  <Text className="text-xs text-blue-600">
                    P/H = 10000 ÷ (DBL × DBP){'\n'}
                    System Discharge = (P/H × Drippers × Discharge) ÷ 10000
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={calculateMethod1}
                  disabled={!canCalculateMethod1 || results !== null}
                  className="mt-4 py-3 rounded-xl items-center"
                  style={{
                    backgroundColor: canCalculateMethod1 && !results ? '#408059' : '#E5E7EB',
                  }}
                >
                  <Text
                    className="font-semibold"
                    style={{ color: canCalculateMethod1 && !results ? '#FFFFFF' : '#9CA3AF' }}
                  >
                    Calculate
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {selectedMethod === 2 && (
              <View className="bg-white rounded-2xl p-4 shadow-sm">
                <View className="flex-row items-center mb-4">
                  <View className="w-8 h-8 bg-primary-100 rounded-lg items-center justify-center">
                    <Symbol name="square.grid.2x2.fill" size={18} color="#408059" />
                  </View>
                  <Text className="text-base font-semibold text-surface-900 ml-2">
                    Method 2: Dripper Spacing
                  </Text>
                </View>

                <InputRow
                  label="Distance Between Drippers (DBD)"
                  value={dbd}
                  onChangeText={setDbd}
                  unit="m"
                  placeholder="0.5"
                />
                <InputRow
                  label="Discharge per Dripper"
                  value={dischargePerHour2}
                  onChangeText={setDischargePerHour2}
                  unit="L/hr"
                  placeholder="2.0"
                />
                <InputRow
                  label="Number of Lines"
                  value={numberOfLines}
                  onChangeText={setNumberOfLines}
                  unit=""
                  placeholder="10"
                />

                <View className="bg-blue-50 rounded-xl p-3 mt-3">
                  <Text className="text-xs font-medium text-blue-700 mb-1">Formula</Text>
                  <Text className="text-xs text-blue-600">
                    System Discharge = ((100 ÷ DBL) × (100 ÷ DBD) × Discharge × Lines) ÷ 10000
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={calculateMethod2}
                  disabled={!canCalculateMethod2 || results !== null}
                  className="mt-4 py-3 rounded-xl items-center"
                  style={{
                    backgroundColor: canCalculateMethod2 && !results ? '#408059' : '#E5E7EB',
                  }}
                >
                  <Text
                    className="font-semibold"
                    style={{ color: canCalculateMethod2 && !results ? '#FFFFFF' : '#9CA3AF' }}
                  >
                    Calculate
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {results && (
              <View className="bg-white rounded-2xl p-4 shadow-sm">
                <View className="flex-row items-center mb-4">
                  <View className="w-8 h-8 bg-primary-100 rounded-lg items-center justify-center">
                    <Symbol name="checkmark.circle.fill" size={18} color="#408059" />
                  </View>
                  <Text className="text-base font-semibold text-surface-900 ml-2">
                    Calculation Results
                  </Text>
                </View>

                {results.plantsPerHectare ? (
                  <View className="bg-surface-50 rounded-xl p-3 mb-3">
                    <Text className="text-xs text-surface-500">Plants per Hectare (P/H)</Text>
                    <Text className="text-lg font-semibold text-surface-900">
                      {results.plantsPerHectare.toFixed(2)}
                    </Text>
                  </View>
                ) : null}

                <View className="bg-primary-50 rounded-xl p-4 items-center">
                  <Text className="text-3xl font-bold text-primary-700">
                    {results.systemDischarge.toFixed(2)}
                  </Text>
                  <Text className="text-sm text-primary-600 mt-1">m³/hr System Discharge</Text>
                </View>
                <Text className="text-xs text-surface-500 text-center mt-2">
                  Equivalent: {(results.systemDischarge * 1000).toFixed(0)} L/hr
                </Text>

                {results.irrigationHours ? (
                  <View className="bg-surface-50 rounded-xl p-3 mt-3">
                    <Text className="text-xs text-surface-500">Irrigation Duration</Text>
                    <Text className="text-lg font-semibold text-surface-900">
                      {formatDuration(results.irrigationHours)}
                    </Text>
                  </View>
                ) : null}

                <View className="bg-surface-50 rounded-xl p-3 mt-3">
                  <Text className="text-xs font-medium text-surface-600 mb-1">What this means</Text>
                  <Text className="text-xs text-surface-500">
                    Your system can deliver {(results.systemDischarge * 1000).toFixed(0)} liters per
                    hour. Use this value for pump sizing and irrigation scheduling.
                  </Text>
                </View>
              </View>
            )}

            {results && (
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
      </View>
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
