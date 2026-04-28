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
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';

import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { LinearGradient } from 'expo-linear-gradient';
import { REFILL_SPANS, type RefillSpanId } from '@/constants/calculator-models';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { telemetry } from '@/services/telemetry';
import { useTranslation } from 'react-i18next';

export default function MADCalculatorScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    return dblVal > 0 && depthVal > 0 && widthVal > 0 && retentionVal > 0 && retentionVal <= 3000;
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

    telemetry.capture('analysis_run', {
      analysis_type: 'MAD',
      inputs_provided: 4,
      used_defaults: false,
      result_saved: false,
      source: 'manual',
    });
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
      return t('calculator.mad.results.interpretationMessages.shallow');
    } else if (mad < 2.5) {
      return t('calculator.mad.results.interpretationMessages.moderate');
    } else if (mad < 5.0) {
      return t('calculator.mad.results.interpretationMessages.deep');
    } else {
      return t('calculator.mad.results.interpretationMessages.veryDeep');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
        <LinearGradient
          pointerEvents="none"
          colors={[colorWithOpacity(m3.colorScheme.primary, 0.08), 'transparent']}
          style={{ height: 300, position: 'absolute', top: 0, left: 0, right: 0 }}
        />
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
                borderRadius: 22,
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
                  <IconSymbol name="chevron.left" size={22} color={m3.colorScheme.onSurface} />
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFillObject,
                      {
                        borderRadius: 22,
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
                {t('calculator.mad.title')}
              </Text>
            </View>

            <View style={{ width: 44, height: 44 }} />
          </View>
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, backgroundColor: 'transparent' }}
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
            {/* Step 1: MAD Calculation Card */}
            <View
              style={{
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                overflow: 'hidden',
                backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
              }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: borderRadius.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
                  }}
                >
                  <IconSymbol
                    name={resolveSymbolIconName(ICON_REGISTRY.irrigation)}
                    size={18}
                    color={m3.colorScheme.primary}
                  />
                </View>
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    marginLeft: spacing[2],
                    color: m3.colorScheme.onSurface,
                  }}
                >
                  {t('calculator.mad.step1.title')}
                </Text>
              </View>

              <InputRow
                label={t('calculator.mad.step1.label.dbl')}
                value={dbl}
                onChangeText={setDbl}
                unit={t('calculator.mad.step1.unit.meters')}
                placeholder={t('calculator.mad.step1.placeholder.dbl')}
              />
              <InputRow
                label={t('calculator.mad.step1.label.rootDepth')}
                value={rootDepth}
                onChangeText={setRootDepth}
                unit={t('calculator.mad.step1.unit.meters')}
                placeholder={t('calculator.mad.step1.placeholder.rootDepth')}
              />
              <InputRow
                label={t('calculator.mad.step1.label.rootWidth')}
                value={rootWidth}
                onChangeText={setRootWidth}
                unit={t('calculator.mad.step1.unit.meters')}
                placeholder={t('calculator.mad.step1.placeholder.rootWidth')}
              />
              <InputRow
                label={t('calculator.mad.step1.label.waterRetention')}
                value={waterRetention}
                onChangeText={setWaterRetention}
                unit={t('calculator.mad.step1.unit.percent')}
                placeholder={t('calculator.mad.step1.placeholder.waterRetention')}
              />

              {/* Calculate Button */}
              <Pressable
                onPress={calculateMAD}
                disabled={!canCalculateMAD || madResult !== null}
                style={{
                  marginTop: spacing[4],
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius.xl,
                  alignItems: 'center',
                  backgroundColor:
                    canCalculateMAD && !madResult
                      ? m3.colorScheme.primary
                      : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                }}
              >
                <Text
                  style={{
                    fontWeight: fontWeight.semibold,
                    color:
                      canCalculateMAD && !madResult
                        ? m3.colorScheme.onPrimary
                        : m3.colorScheme.onSurfaceVariant,
                  }}
                >
                  {t('calculator.mad.step1.calculateButton')}
                </Text>
              </Pressable>

              {/* MAD Result */}
              {madResult !== null && (
                <View style={{ marginTop: spacing[4] }}>
                  <View
                    style={{
                      borderRadius: borderRadius.xl,
                      padding: spacing[4],
                      alignItems: 'center',
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize['3xl'],
                        fontWeight: fontWeight.bold,
                        color: m3.colorScheme.primary,
                      }}
                    >
                      {madResult.toFixed(4)}
                    </Text>
                    <Text
                      style={{
                        fontSize: fontSize.sm,
                        marginTop: spacing[1],
                        color: m3.colorScheme.onSurfaceVariant,
                      }}
                    >
                      {t('calculator.mad.results.madTitle')}
                    </Text>
                  </View>
                  <View
                    style={{
                      borderRadius: borderRadius.xl,
                      padding: spacing[3],
                      marginTop: spacing[3],
                      backgroundColor: colors.surface[50],
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.medium,
                        marginBottom: spacing[1],
                        color: m3.colorScheme.onSurface,
                      }}
                    >
                      {t('calculator.mad.results.interpretation')}
                    </Text>
                    <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                      {interpretMAD(madResult)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Step 2: Refill Tank Calculator */}
            {madResult !== null && (
              <View
                style={{
                  borderRadius: borderRadius['2xl'],
                  padding: spacing[4],
                  overflow: 'hidden',
                  backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
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
                      borderRadius: borderRadius.lg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
                    }}
                  >
                    <IconSymbol name="arrow-up-circle" size={18} color={m3.colorScheme.primary} />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.semibold,
                      marginLeft: spacing[2],
                      color: m3.colorScheme.onSurface,
                    }}
                  >
                    {t('calculator.mad.step2.title')}
                  </Text>
                </View>

                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.medium,
                    marginBottom: spacing[2],
                    color: m3.colorScheme.onSurfaceVariant,
                  }}
                >
                  {t('calculator.mad.step2.selectRefillSpan')}
                </Text>
                {REFILL_SPANS.map((span) => (
                  <Pressable
                    key={span.id}
                    onPress={() => setSelectedRefillSpan(span.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: spacing[3],
                      borderRadius: borderRadius.xl,
                      marginBottom: spacing[2],
                      backgroundColor:
                        selectedRefillSpan === span.id
                          ? colorWithOpacity(colors.irrigation[500], 0.08)
                          : colors.surface[50],
                      borderWidth: 1,
                      borderColor:
                        selectedRefillSpan === span.id
                          ? colors.irrigation[500]
                          : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                    }}
                  >
                    <Text
                      style={{ flex: 1, fontSize: fontSize.sm, color: m3.colorScheme.onSurface }}
                    >
                      {span.label}
                    </Text>
                    {selectedRefillSpan === span.id && (
                      <IconSymbol
                        name="checkmark.circle.fill"
                        size={20}
                        color={colors.irrigation[500]}
                      />
                    )}
                  </Pressable>
                ))}

                {/* Guidance */}
                <View
                  style={{
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    marginTop: spacing[2],
                    backgroundColor: colors.surface[50],
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                      marginBottom: spacing[2],
                      color: m3.colorScheme.onSurface,
                    }}
                  >
                    {t('calculator.mad.step2.refillSpanGuidance')}
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                    • {t('calculator.mad.step2.guidance.heavy')}
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                    • {t('calculator.mad.step2.guidance.normal')}
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                    • {t('calculator.mad.step2.guidance.controlled')}
                  </Text>
                </View>

                {/* Calculate Button */}
                <Pressable
                  onPress={calculateRefillTank}
                  disabled={!canCalculateRefillTank || refillTankResult !== null}
                  style={{
                    backgroundColor:
                      canCalculateRefillTank && !refillTankResult
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
                        canCalculateRefillTank && !refillTankResult
                          ? m3.colorScheme.onPrimary
                          : m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {t('calculator.mad.step2.calculateButton')}
                  </Text>
                </Pressable>

                {/* Refill Tank Result */}
                {refillTankResult !== null && (
                  <View style={{ marginTop: spacing[4] }}>
                    <View
                      style={{
                        borderRadius: borderRadius.xl,
                        padding: spacing[4],
                        alignItems: 'center',
                        backgroundColor: colorWithOpacity(colors.irrigation[500], 0.1),
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize['3xl'],
                          fontWeight: fontWeight.bold,
                          color: colors.irrigation[500],
                        }}
                      >
                        {refillTankResult.toFixed(4)}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          marginTop: spacing[1],
                          color: m3.colorScheme.onSurfaceVariant,
                        }}
                      >
                        {t('calculator.mad.results.refillTankTitle')}
                      </Text>
                    </View>
                    <View
                      style={{
                        borderRadius: borderRadius.xl,
                        padding: spacing[3],
                        marginTop: spacing[3],
                        backgroundColor: colors.surface[50],
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          fontWeight: fontWeight.medium,
                          marginBottom: spacing[1],
                          color: m3.colorScheme.onSurface,
                        }}
                      >
                        {t('calculator.mad.results.whatThisMeans')}
                      </Text>
                      <Text
                        style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}
                      >
                        {t('calculator.mad.results.refillExplanation', {
                          value: refillTankResult.toFixed(4),
                          percentage: (
                            (REFILL_SPANS.find((s) => s.id === selectedRefillSpan)?.value ?? 0) *
                            100
                          ).toFixed(0),
                        })}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Reset Button */}
            {madResult !== null && refillTankResult !== null && (
              <Pressable
                onPress={resetCalculator}
                style={{
                  borderRadius: borderRadius['2xl'],
                  paddingVertical: spacing[4],
                  alignItems: 'center',
                  overflow: 'hidden',
                  backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
                  marginTop: spacing[4],
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconSymbol name="refresh" size={18} color={m3.colorScheme.onSurfaceVariant} />
                  <Text
                    style={{
                      fontWeight: fontWeight.medium,
                      marginLeft: spacing[2],
                      color: m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {t('calculator.mad.actions.reset')}
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
      <Text
        style={{
          fontSize: fontSize.sm,
          marginBottom: spacing[1],
          color: m3.colorScheme.onSurfaceVariant,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: borderRadius.xl,
          backgroundColor: colors.surface[50],
        }}
      >
        <TextInput
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={m3.colorScheme.onSurfaceVariant}
          keyboardType="decimal-pad"
          style={{
            flex: 1,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
            fontSize: fontSize.base,
            color: m3.colorScheme.onSurface,
          }}
        />
        <Text
          style={{
            fontSize: fontSize.sm,
            paddingRight: spacing[4],
            color: m3.colorScheme.onSurfaceVariant,
          }}
        >
          {unit}
        </Text>
      </View>
    </View>
  );
}
