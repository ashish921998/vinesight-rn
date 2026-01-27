/**
 * Nutrient Calculator Screen
 * Fertilizer requirements & application planning
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView } from 'react-native';

import { Stack } from 'expo-router';
import { Symbol } from '@/components/ui/Symbol';
import { GRAPE_GROWTH_STAGES, type GrapeGrowthStageId } from '@/constants/calculatorModels';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

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

    const stage = GRAPE_GROWTH_STAGES.find((s) => s.id === selectedStage);
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
            {/* Calculator Card */}
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
                    backgroundColor: '#EDE9FE',
                    borderRadius: borderRadius.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Symbol name="flask.fill" size={18} color="#8B5CF6" />
                </View>
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: colors.surface[900],
                    marginLeft: spacing[2],
                  }}
                >
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
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  color: colors.surface[700],
                  marginBottom: spacing[2],
                  marginTop: spacing[2],
                }}
              >
                Growth Stage
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing[2],
                  marginBottom: spacing[3],
                }}
              >
                {GRAPE_GROWTH_STAGES.map((stage) => (
                  <Pressable
                    key={stage.id}
                    onPress={() => setSelectedStage(stage.id)}
                    style={{
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      borderRadius: borderRadius.lg,
                      backgroundColor:
                        selectedStage === stage.id ? colors.primary[600] : colors.gray[100],
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.medium,
                        color: selectedStage === stage.id ? colors.white : colors.gray[700],
                      }}
                    >
                      {stage.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Info */}
              <View
                style={{
                  backgroundColor: '#F5F3FF',
                  borderRadius: borderRadius.xl,
                  padding: spacing[3],
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.medium,
                    color: '#6D28D9',
                    marginBottom: spacing[1],
                  }}
                >
                  How it works
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: '#7C3AED' }}>
                  Nutrient requirements vary by growth stage. The calculator adjusts N-P-K
                  recommendations based on crop demand at each stage.
                </Text>
              </View>

              {/* Calculate Button */}
              <Pressable
                onPress={calculate}
                disabled={!canCalculate || result !== null}
                style={{
                  marginTop: spacing[4],
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius.xl,
                  alignItems: 'center',
                  backgroundColor: canCalculate && !result ? colors.primary[600] : colors.gray[200],
                }}
              >
                <Text
                  style={{
                    fontWeight: fontWeight.semibold,
                    color: canCalculate && !result ? colors.white : colors.gray[400],
                  }}
                >
                  Calculate Requirements
                </Text>
              </Pressable>

              {/* Results */}
              {result !== null && (
                <View style={{ marginTop: spacing[4] }}>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: colors.surface[700],
                      marginBottom: spacing[3],
                    }}
                  >
                    Recommended Nutrients
                  </Text>
                  <View style={{ gap: spacing[2] }}>
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
                      Note
                    </Text>
                    <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                      These are estimated values. For precise recommendations, conduct soil and
                      petiole tests and consult an agronomist.
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Reset Button */}
            {result !== null && (
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
        <Text
          style={{ fontSize: fontSize.sm, color: colors.surface[500], paddingRight: spacing[4] }}
        >
          {unit}
        </Text>
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
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing[3],
        borderRadius: borderRadius.xl,
        backgroundColor: bgColor,
      }}
    >
      <Text style={{ fontSize: fontSize.sm, color: colors.surface[700] }}>{label}</Text>
      <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color }}>
        {value.toFixed(1)} kg
      </Text>
    </View>
  );
}
