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
} from 'react-native';

import { Stack } from 'expo-router';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { LinearGradient } from 'expo-linear-gradient';
import { REFILL_SPANS, type RefillSpanId } from '@/constants/calculator-models';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { telemetry } from '@/services/telemetry';
import { colorWithOpacity } from '@/utils/color';

export default function MADCalculatorScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
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
          headerTitleStyle: { fontWeight: '600', color: m3.colorScheme.onSurface },
          headerStyle: { backgroundColor: colors.surface[100] },
          headerTintColor: m3.colorScheme.primary,
        }}
      />
      <View style={{ flex: 1, backgroundColor: colors.surface[50] }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, backgroundColor: colors.surface[50] }}
        >
          <LinearGradient
            colors={[colorWithOpacity(m3.colorScheme.primary, 0.08), 'transparent']}
            style={{ height: 300, position: 'absolute', top: 0, left: 0, right: 0 }}
          />
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingTop: spacing[4],
              paddingHorizontal: 16,
              paddingBottom: 32,
            }}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
          >
            {/* Step 1: MAD Calculation Card */}
            <View
              style={{
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                overflow: 'hidden',
                backgroundColor: colors.surface[100],
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
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                  }}
                >
                  <IconSymbol name="drop.fill" size={18} color={m3.colorScheme.primary} />
                </View>
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    marginLeft: spacing[2],
                    color: m3.colorScheme.onSurface,
                  }}
                >
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
                    canCalculateMAD && !madResult ? m3.colorScheme.primary : colors.surface[300],
                }}
              >
                <Text
                  style={{
                    fontWeight: fontWeight.semibold,
                    color:
                      canCalculateMAD && !madResult
                        ? m3.colorScheme.onPrimary
                        : colors.surface[500],
                  }}
                >
                  Calculate MAD
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
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
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
                        color: m3.colorScheme.primary,
                      }}
                    >
                      Maximum Allowable Deficit
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
                        color: colors.surface[500],
                      }}
                    >
                      Interpretation
                    </Text>
                    <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
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
                  backgroundColor: colors.surface[100],
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
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
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
                    Step 2: Refill Tank Calculator
                  </Text>
                </View>

                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.medium,
                    marginBottom: spacing[2],
                    color: colors.surface[700],
                  }}
                >
                  Select Refill Span
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
                          ? colorWithOpacity(m3.colorScheme.primary, 0.12)
                          : colors.surface[50],
                      borderWidth: 1,
                      borderColor:
                        selectedRefillSpan === span.id
                          ? m3.colorScheme.primary
                          : colors.surface[200],
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
                        color={m3.colorScheme.primary}
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
                      color: colors.surface[500],
                    }}
                  >
                    Refill span guidance:
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                    • Heavy Growth (0.2): Fruit set - maintain turgor
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                    • Normal Growth (0.3): Flowering - balance growth/stress
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                    • Controlled Stress (0.4): Veraison - improve quality/sugar
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
                        : colors.surface[300],
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
                          : colors.surface[500],
                    }}
                  >
                    Calculate Refill Tank
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
                        backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize['3xl'],
                          fontWeight: fontWeight.bold,
                          color: m3.colorScheme.primary,
                        }}
                      >
                        {refillTankResult.toFixed(4)}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          marginTop: spacing[1],
                          color: m3.colorScheme.primary,
                        }}
                      >
                        Refill Tank Requirement
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
                          color: colors.surface[500],
                        }}
                      >
                        What this means
                      </Text>
                      <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
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
              <Pressable
                onPress={resetCalculator}
                style={{
                  borderRadius: borderRadius['2xl'],
                  paddingVertical: spacing[4],
                  alignItems: 'center',
                  overflow: 'hidden',
                  backgroundColor: colors.surface[100],
                  marginTop: spacing[4],
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconSymbol name="refresh" size={18} color={colors.surface[500]} />
                  <Text
                    style={{
                      fontWeight: fontWeight.medium,
                      marginLeft: spacing[2],
                      color: colors.surface[500],
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

  const handleChangeText = (text: string) => {
    if (text === '.') {
      onChangeText('0.');
    } else {
      onChangeText(text);
    }
  };

  return (
    <View style={{ marginBottom: spacing[3] }}>
      <Text style={{ fontSize: fontSize.sm, marginBottom: spacing[1], color: colors.surface[500] }}>
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
          placeholderTextColor={colors.gray[400]}
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
          style={{ fontSize: fontSize.sm, paddingRight: spacing[4], color: colors.surface[500] }}
        >
          {unit}
        </Text>
      </View>
    </View>
  );
}
