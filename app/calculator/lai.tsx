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
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';

import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol as Icon } from '@/components/ui/symbol';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { telemetry } from '@/services/telemetry';
import { useTranslation } from 'react-i18next';

export default function LAICalculatorScreen() {
  const m3 = useM3();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
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

    // Track inputs_provided count
    const inputsProvided = 4; // shootLength, shootsPerVine, vineSpacing, rowSpacing

    // Check if using defaults (placeholders are typical values)
    const usedDefaults =
      shootLength === '100' ||
      shootsPerVine === '20' ||
      vineSpacing === '1.8' ||
      rowSpacing === '3.0';

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

    telemetry.capture('analysis_run', {
      analysis_type: 'LAI',
      inputs_provided: inputsProvided,
      used_defaults: usedDefaults,
      result_saved: false,
      source: 'manual',
    });
    telemetry.capture('meaningful_action', {
      action_type: 'analysis_completed',
      feature_name: 'LAI_calculator',
    });
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
        color: m3.colorScheme.warning,
        message: 'Canopy underdeveloped. May need more shoots or improved vigor.',
      };
    } else if (lai < 2.5) {
      return {
        label: 'Optimal',
        color: m3.colorScheme.success,
        message: 'Good balance between vegetative growth and fruit exposure.',
      };
    } else if (lai < 4.0) {
      return {
        label: 'High',
        color: m3.colorScheme.primary,
        message: 'Dense canopy. Consider hedging or leaf removal for better fruit exposure.',
      };
    } else {
      return {
        label: 'Excessive',
        color: m3.colorScheme.error,
        message: 'Very dense canopy. Risk of disease and poor fruit quality. Reduce vigor.',
      };
    }
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
              accessibilityLabel={t('common.goBack')}
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
                {t('calculator.lai.title', { defaultValue: 'LAI Calculator' })}
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
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                    borderRadius: borderRadius.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="leaf.fill" size={18} color={m3.colorScheme.success} />
                </View>
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: m3.surface.s900,
                    marginLeft: spacing[2],
                  }}
                >
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
              <View
                style={{
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
                  borderRadius: borderRadius.xl,
                  padding: spacing[3],
                  marginTop: spacing[3],
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.medium,
                    color: m3.colorScheme.primary,
                    marginBottom: spacing[1],
                  }}
                >
                  About LAI
                </Text>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: colorWithOpacity(m3.colorScheme.primary, 0.85),
                  }}
                >
                  For table grapes, an LAI range around 1.5-2.5 is generally considered balanced.
                </Text>
              </View>

              {/* Calculate Button */}
              <Pressable
                onPress={calculate}
                disabled={!canCalculate || result !== null}
                style={{
                  backgroundColor:
                    canCalculate && !result
                      ? m3.colorScheme.primary
                      : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                  marginTop: spacing[4],
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius.xl,
                  alignItems: 'center',
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
                  Calculate LAI
                </Text>
              </Pressable>

              {/* Results */}
              {result !== null && (
                <View style={{ marginTop: spacing[4] }}>
                  <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
                        borderRadius: radius.lg,
                        padding: spacing[4],
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize['2xl'],
                          fontWeight: fontWeight.bold,
                          color: m3.colorScheme.primary,
                        }}
                      >
                        {result.lai.toFixed(2)}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          color: colorWithOpacity(m3.colorScheme.primary, 0.85),
                          marginTop: spacing[1],
                        }}
                      >
                        Leaf Area Index
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
                        borderRadius: radius.lg,
                        padding: spacing[4],
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize['2xl'],
                          fontWeight: fontWeight.bold,
                          color: m3.colorScheme.primary,
                        }}
                      >
                        {result.canopyWidth.toFixed(1)} m
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          color: colorWithOpacity(m3.colorScheme.primary, 0.85),
                          marginTop: spacing[1],
                        }}
                      >
                        Est. Canopy Width
                      </Text>
                    </View>
                  </View>

                  {/* Interpretation */}
                  {(() => {
                    const interp = getLAIInterpretation(result.lai);
                    return (
                      <View
                        style={{
                          borderRadius: borderRadius.lg,
                          padding: spacing[3],
                          marginTop: spacing[3],
                          backgroundColor: colorWithOpacity(interp.color, 0.12),
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginBottom: spacing[1],
                          }}
                        >
                          <View
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: borderRadius.full,
                              marginRight: spacing[2],
                              backgroundColor: interp.color,
                            }}
                          />
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.semibold,
                              color: interp.color,
                            }}
                          >
                            {interp.label}
                          </Text>
                        </View>
                        <Text
                          style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}
                        >
                          {interp.message}
                        </Text>
                      </View>
                    );
                  })()}
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
        {unit ? (
          <Text style={{ fontSize: fontSize.sm, color: m3.surface.s500, paddingRight: spacing[4] }}>
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
