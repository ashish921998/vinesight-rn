/**
 * System Discharge Calculator Screen
 * Calculate irrigation system discharge rates
 */

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView } from 'react-native';

import { Stack } from 'expo-router';
import { Symbol } from '@/components/ui/Symbol';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

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
          style={{ flex: 1, backgroundColor: colors.surface[50] }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 16, paddingBottom: 32 }}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={{
                backgroundColor: colors.white,
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
              }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: colors.primary[100],
                    borderRadius: borderRadius.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Symbol name="speedometer" size={18} color="#408059" />
                </View>
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: colors.surface[900],
                    marginLeft: spacing[2],
                  }}
                >
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

              <Text
                style={{ fontSize: fontSize.xs, color: colors.surface[500], marginTop: spacing[2] }}
              >
                Use the refill tank value from MAD to estimate irrigation hours.
              </Text>
            </View>

            {canSelectMethod && (
              <View
                style={{
                  backgroundColor: colors.white,
                  borderRadius: borderRadius['2xl'],
                  padding: spacing[4],
                  marginTop: spacing[4],
                }}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      backgroundColor: colors.primary[100],
                      borderRadius: borderRadius.lg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Symbol name="git-branch" size={18} color="#408059" />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.semibold,
                      color: colors.surface[900],
                      marginLeft: spacing[2],
                    }}
                  >
                    Select Calculation Method
                  </Text>
                </View>

                <Pressable
                  onPress={() => {
                    setSelectedMethod(1);
                    setResults(null);
                  }}
                  style={{
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    marginBottom: spacing[2],
                    backgroundColor: selectedMethod === 1 ? '#E7F2EC' : colors.gray[100],
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.medium,
                          color: colors.surface[900],
                        }}
                      >
                        System Discharge 1
                      </Text>
                      <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                        Using plants per hectare and drippers
                      </Text>
                    </View>
                    {selectedMethod === 1 ? (
                      <Symbol name="checkmark.circle.fill" size={18} color="#408059" />
                    ) : null}
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setSelectedMethod(2);
                    setResults(null);
                  }}
                  style={{
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    backgroundColor: selectedMethod === 2 ? '#E7F2EC' : colors.gray[100],
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.medium,
                          color: colors.surface[900],
                        }}
                      >
                        System Discharge 2
                      </Text>
                      <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                        Using dripper spacing
                      </Text>
                    </View>
                    {selectedMethod === 2 ? (
                      <Symbol name="checkmark.circle.fill" size={18} color="#408059" />
                    ) : null}
                  </View>
                </Pressable>
              </View>
            )}

            {selectedMethod === 1 && (
              <View
                style={{
                  backgroundColor: colors.white,
                  borderRadius: borderRadius['2xl'],
                  padding: spacing[4],
                  marginTop: spacing[4],
                }}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      backgroundColor: colors.primary[100],
                      borderRadius: borderRadius.lg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Symbol name="leaf.fill" size={18} color="#408059" />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.semibold,
                      color: colors.surface[900],
                      marginLeft: spacing[2],
                    }}
                  >
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

                <View
                  style={{
                    backgroundColor: '#EFF6FF',
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    marginTop: spacing[3],
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                      color: '#1D4ED8',
                      marginBottom: spacing[1],
                    }}
                  >
                    Formula
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: '#2563EB' }}>
                    P/H = 10000 ÷ (DBL × DBP){'\n'}
                    System Discharge = (P/H × Drippers × Discharge) ÷ 10000
                  </Text>
                </View>

                <Pressable
                  onPress={calculateMethod1}
                  disabled={!canCalculateMethod1 || results !== null}
                  style={{
                    marginTop: spacing[4],
                    paddingVertical: spacing[3],
                    borderRadius: borderRadius.xl,
                    alignItems: 'center',
                    backgroundColor:
                      canCalculateMethod1 && !results ? colors.primary[600] : colors.gray[200],
                  }}
                >
                  <Text
                    style={{
                      fontWeight: fontWeight.semibold,
                      color: canCalculateMethod1 && !results ? colors.white : colors.gray[400],
                    }}
                  >
                    Calculate
                  </Text>
                </Pressable>
              </View>
            )}

            {selectedMethod === 2 && (
              <View
                style={{
                  backgroundColor: colors.white,
                  borderRadius: borderRadius['2xl'],
                  padding: spacing[4],
                  marginTop: spacing[4],
                }}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      backgroundColor: colors.primary[100],
                      borderRadius: borderRadius.lg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Symbol name="square.grid.2x2.fill" size={18} color="#408059" />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.semibold,
                      color: colors.surface[900],
                      marginLeft: spacing[2],
                    }}
                  >
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

                <View
                  style={{
                    backgroundColor: '#EFF6FF',
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    marginTop: spacing[3],
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                      color: '#1D4ED8',
                      marginBottom: spacing[1],
                    }}
                  >
                    Formula
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: '#2563EB' }}>
                    System Discharge = ((100 ÷ DBL) × (100 ÷ DBD) × Discharge × Lines) ÷ 10000
                  </Text>
                </View>

                <Pressable
                  onPress={calculateMethod2}
                  disabled={!canCalculateMethod2 || results !== null}
                  style={{
                    marginTop: spacing[4],
                    paddingVertical: spacing[3],
                    borderRadius: borderRadius.xl,
                    alignItems: 'center',
                    backgroundColor:
                      canCalculateMethod2 && !results ? colors.primary[600] : colors.gray[200],
                  }}
                >
                  <Text
                    style={{
                      fontWeight: fontWeight.semibold,
                      color: canCalculateMethod2 && !results ? colors.white : colors.gray[400],
                    }}
                  >
                    Calculate
                  </Text>
                </Pressable>
              </View>
            )}

            {results && (
              <View
                style={{
                  backgroundColor: colors.white,
                  borderRadius: borderRadius['2xl'],
                  padding: spacing[4],
                  marginTop: spacing[4],
                }}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      backgroundColor: colors.primary[100],
                      borderRadius: borderRadius.lg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Symbol name="checkmark.circle.fill" size={18} color="#408059" />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.semibold,
                      color: colors.surface[900],
                      marginLeft: spacing[2],
                    }}
                  >
                    Calculation Results
                  </Text>
                </View>

                {results.plantsPerHectare ? (
                  <View
                    style={{
                      backgroundColor: colors.surface[50],
                      borderRadius: borderRadius.xl,
                      padding: spacing[3],
                      marginBottom: spacing[3],
                    }}
                  >
                    <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                      Plants per Hectare (P/H)
                    </Text>
                    <Text
                      style={{
                        fontSize: fontSize.lg,
                        fontWeight: fontWeight.semibold,
                        color: colors.surface[900],
                      }}
                    >
                      {results.plantsPerHectare.toFixed(2)}
                    </Text>
                  </View>
                ) : null}

                <View
                  style={{
                    backgroundColor: colors.primary[50],
                    borderRadius: borderRadius.xl,
                    padding: spacing[4],
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize['3xl'],
                      fontWeight: fontWeight.bold,
                      color: colors.primary[700],
                    }}
                  >
                    {results.systemDischarge.toFixed(2)}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      color: colors.primary[600],
                      marginTop: spacing[1],
                    }}
                  >
                    m³/hr System Discharge
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: colors.surface[500],
                    textAlign: 'center',
                    marginTop: spacing[2],
                  }}
                >
                  Equivalent: {(results.systemDischarge * 1000).toFixed(0)} L/hr
                </Text>

                {results.irrigationHours ? (
                  <View
                    style={{
                      backgroundColor: colors.surface[50],
                      borderRadius: borderRadius.xl,
                      padding: spacing[3],
                      marginTop: spacing[3],
                    }}
                  >
                    <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                      Irrigation Duration
                    </Text>
                    <Text
                      style={{
                        fontSize: fontSize.lg,
                        fontWeight: fontWeight.semibold,
                        color: colors.surface[900],
                      }}
                    >
                      {formatDuration(results.irrigationHours)}
                    </Text>
                  </View>
                ) : null}

                <View
                  style={{
                    backgroundColor: colors.surface[50],
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    marginTop: spacing[3],
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                      color: colors.surface[600],
                      marginBottom: spacing[1],
                    }}
                  >
                    What this means
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                    Your system can deliver {(results.systemDischarge * 1000).toFixed(0)} liters per
                    hour. Use this value for pump sizing and irrigation scheduling.
                  </Text>
                </View>
              </View>
            )}

            {results && (
              <Pressable
                onPress={reset}
                style={{
                  backgroundColor: colors.white,
                  borderRadius: borderRadius['2xl'],
                  paddingVertical: spacing[4],
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                  marginTop: spacing[4],
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Symbol name="refresh" size={18} color="#6B7280" />
                  <Text
                    style={{
                      color: colors.surface[600],
                      fontWeight: fontWeight.medium,
                      marginLeft: spacing[2],
                    }}
                  >
                    Reset Calculator
                  </Text>
                </View>
              </Pressable>
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
    <View style={{ marginBottom: spacing[3] }}>
      <Text style={{ fontSize: fontSize.sm, color: colors.surface[600], marginBottom: spacing[1] }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface[50],
          borderRadius: borderRadius.xl,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          keyboardType="decimal-pad"
          style={{
            flex: 1,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
            fontSize: fontSize.base,
            color: colors.surface[900],
          }}
        />
        {unit ? (
          <Text
            style={{ fontSize: fontSize.sm, color: colors.surface[500], paddingRight: spacing[4] }}
          >
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
