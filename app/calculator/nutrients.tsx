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
  StyleSheet,
} from 'react-native';

import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol as Icon } from '@/components/ui/symbol';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { GRAPE_GROWTH_STAGES, type GrapeGrowthStageId } from '@/constants/calculator-models';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { useDomainColors } from '@/styles/use-domain-colors';
import { colorWithOpacity } from '@/utils/color';
import { telemetry } from '@/services/telemetry';

interface NutrientResult {
  nitrogen: number;
  phosphorus: number;
  potassium: number;
}

export default function NutrientCalculatorScreen() {
  const m3 = useM3();
  const domain = useDomainColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
        {/* Custom JS header (avoids iOS 26 native bar-button glass capsule) */}
        <View style={{ paddingTop: insets.top, backgroundColor: m3.colorScheme.surface }}>
          <View
            style={{
              height: 56,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing[2],
            }}
          >
            <Pressable
              onPress={() => router.back()}
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.xl,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                backgroundColor: 'transparent',
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              {({ pressed }) => (
                <View
                  style={{
                    width: '100%',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="chevron.left" size={22} color={m3.colorScheme.onSurface} />
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        borderRadius: radius.xl,
                        backgroundColor: pressed
                          ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                          : 'transparent',
                      },
                    ]}
                  />
                </View>
              )}
            </Pressable>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text
                numberOfLines={1}
                style={{
                  color: m3.colorScheme.onSurface,
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.bold,
                }}
              >
                Nutrient Calculator
              </Text>
            </View>

            <View style={{ width: 44, height: 44 }} />
          </View>
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, backgroundColor: m3.colorScheme.background }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingTop: spacing[4],
              paddingHorizontal: 16,
              paddingBottom: Math.max(insets.bottom + spacing[4], spacing[8]),
            }}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Calculator Card */}
            <View
              style={{
                backgroundColor: m3.surface.s100,
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
                    color: m3.surface.s900,
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
                  color: m3.surface.s700,
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
                        selectedStage === stage.id ? m3.colorScheme.primary : m3.surface.s100,
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
                  Usage tip
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.tertiary }}>
                  Use stage-wise results as a planning baseline, then fine-tune with field
                  observations and lab reports.
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
                      color: m3.surface.s700,
                      marginBottom: spacing[3],
                    }}
                  >
                    Recommended Nutrients
                  </Text>
                  <View style={{ gap: spacing[2] }}>
                    <NutrientRow
                      label="Nitrogen (N)"
                      value={result.nitrogen}
                      color={domain.category.fertigation}
                      bgColor={colorWithOpacity(domain.category.fertigation, 0.12)}
                      dotColor={domain.category.fertigation}
                    />
                    <NutrientRow
                      label="Phosphorus (P₂O₅)"
                      value={result.phosphorus}
                      color="#D0A14A"
                      bgColor={colorWithOpacity('#D0A14A', 0.12)}
                      dotColor="#D0A14A"
                    />
                    <NutrientRow
                      label="Potassium (K₂O)"
                      value={result.potassium}
                      color="#A56B4F"
                      bgColor={colorWithOpacity('#A56B4F', 0.12)}
                      dotColor="#A56B4F"
                    />
                  </View>

                  {/* Total NPK Summary Row */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      paddingTop: spacing[3],
                      marginTop: spacing[2],
                      borderTopWidth: 1,
                      borderTopColor: m3.surface.s300,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.semibold,
                        color: m3.colorScheme.primary,
                      }}
                    >
                      Total NPK
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <Text
                        style={{
                          fontSize: fontSize['2xl'],
                          fontWeight: fontWeight.bold,
                          color: m3.colorScheme.primary,
                        }}
                      >
                        {(result.nitrogen + result.phosphorus + result.potassium).toFixed(1)}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.normal,
                          color: m3.surface.s500,
                          marginLeft: spacing[1],
                        }}
                      >
                        kg
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      backgroundColor: m3.surface.s50,
                      borderRadius: borderRadius.xl,
                      padding: spacing[3],
                      marginTop: spacing[3],
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.medium,
                        color: m3.surface.s600,
                        marginBottom: spacing[1],
                      }}
                    >
                      Note
                    </Text>
                    <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
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
                  backgroundColor: m3.surface.s100,
                  borderRadius: borderRadius['2xl'],
                  paddingVertical: spacing[4],
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: m3.surface.s200,
                  marginTop: spacing[4],
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="refresh" size={18} color={m3.colorScheme.onSurfaceVariant} />
                  <Text
                    style={{
                      color: m3.surface.s600,
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
      <Text style={{ fontSize: fontSize.sm, color: m3.surface.s600, marginBottom: spacing[1] }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: m3.surface.s50,
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
            color: m3.surface.s900,
          }}
        />
        <Text style={{ fontSize: fontSize.sm, color: m3.surface.s500, paddingRight: spacing[4] }}>
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
  dotColor,
}: {
  label: string;
  value: number;
  color: string;
  bgColor: string;
  dotColor: string;
}) {
  const m3 = useM3();
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: radius.xs,
            backgroundColor: dotColor,
          }}
        />
        <Text style={{ fontSize: fontSize.sm, color: m3.surface.s700 }}>{label}</Text>
      </View>
      <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color }}>
        {value.toFixed(1)} kg
      </Text>
    </View>
  );
}
