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
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { Stack } from 'expo-router';
import { Symbol as Icon } from '@/components/ui/symbol';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { GRAPE_GROWTH_STAGES, type GrapeGrowthStageId } from '@/constants/calculator-models';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { telemetry } from '@/services/telemetry';

interface NutrientResult {
  nitrogen: number;
  phosphorus: number;
  potassium: number;
}

export default function NutrientCalculatorScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
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

    telemetry.capture('analysis_run', {
      analysis_type: 'NPK',
      inputs_provided: 3,
      used_defaults: false,
      result_saved: false,
      source: 'manual',
    });
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
      <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, backgroundColor: m3.colorScheme.background }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingTop: spacing[4],
              paddingHorizontal: 16,
              paddingBottom: 32,
            }}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Calculator Card */}
            <View
              style={{
                backgroundColor: colors.surface[100],
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
                    backgroundColor: colorWithOpacity(m3.colorScheme.tertiary, 0.12),
                    borderRadius: borderRadius.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon
                    name={resolveSymbolIconName(ICON_REGISTRY.spray)}
                    size={18}
                    color={m3.colorScheme.tertiary}
                  />
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
                        selectedStage === stage.id ? m3.colorScheme.primary : colors.surface[100],
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.medium,
                        color:
                          selectedStage === stage.id
                            ? m3.colorScheme.onPrimary
                            : m3.colorScheme.onSurface,
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
                  backgroundColor: colorWithOpacity(m3.colorScheme.tertiary, 0.12),
                  borderRadius: borderRadius.xl,
                  padding: spacing[3],
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.medium,
                    color: m3.colorScheme.tertiary,
                    marginBottom: spacing[1],
                  }}
                >
                  How it works
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.tertiary }}>
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
                  backgroundColor:
                    canCalculate && !result
                      ? m3.colorScheme.primary
                      : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                }}
              >
                <Text
                  style={{
                    fontWeight: fontWeight.semibold,
                    color:
                      canCalculate && !result
                        ? m3.colorScheme.onPrimary
                        : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
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
                      color={colors.success}
                      bgColor={colorWithOpacity(colors.success, 0.12)}
                    />
                    <NutrientRow
                      label="Phosphorus (P₂O₅)"
                      value={result.phosphorus}
                      color={colors.warning}
                      bgColor={colorWithOpacity(colors.warning, 0.12)}
                    />
                    <NutrientRow
                      label="Potassium (K₂O)"
                      value={result.potassium}
                      color={m3.colorScheme.tertiary}
                      bgColor={colorWithOpacity(m3.colorScheme.tertiary, 0.12)}
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
                  backgroundColor: colors.surface[100],
                  borderRadius: borderRadius['2xl'],
                  paddingVertical: spacing[4],
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                  marginTop: spacing[4],
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="refresh" size={18} color={m3.colorScheme.onSurfaceVariant} />
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
  const colors = useThemeColors();
  const m3 = useM3();
  const handleChangeText = (text: string) => {
    if (text === '.') {
      onChangeText('0.');
    } else {
      onChangeText(text);
    }
  };

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
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
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
  const colors = useThemeColors();
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
