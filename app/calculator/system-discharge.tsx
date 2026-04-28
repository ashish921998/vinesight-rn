/**
 * System Discharge Calculator Screen
 * Calculate irrigation system discharge rates
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  StyleSheet,
} from 'react-native';

import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { telemetry } from '@/services/telemetry';
import { useTranslation } from 'react-i18next';

interface SystemDischargeResults {
  plantsPerHectare?: number | null;
  systemDischarge: number;
  irrigationHours?: number | null;
  method: 1 | 2;
}

// Standard iOS navigation bar height for keyboard offset calculations

// Offset to ensure focused input appears below the header/toolbar area
const INPUT_FOCUS_SCROLL_OFFSET = 140;

export default function SystemDischargeScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
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
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollContentRef = useRef<View>(null);
  const focusedFieldKeyRef = useRef<string | null>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyboardShowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputPositionsRef = useRef<Record<string, number>>({});
  const inputRowRefs = useRef<Record<string, React.RefObject<View | null>>>({
    dbl: React.createRef<View>(),
    refillTankValue: React.createRef<View>(),
    dbp: React.createRef<View>(),
    drippersPerPlant: React.createRef<View>(),
    dischargePerHour1: React.createRef<View>(),
    dbd: React.createRef<View>(),
    dischargePerHour2: React.createRef<View>(),
    numberOfLines: React.createRef<View>(),
  });

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

    telemetry.capture('analysis_run', {
      analysis_type: 'system_discharge',
      inputs_provided: 4,
      used_defaults: false,
      result_saved: false,
      source: 'manual',
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

    telemetry.capture('analysis_run', {
      analysis_type: 'system_discharge',
      inputs_provided: 4,
      used_defaults: false,
      result_saved: false,
      source: 'manual',
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

  const scrollToField = useCallback((fieldKey: string, animated = true) => {
    const rowRef = inputRowRefs.current[fieldKey];
    const scrollContentNode = scrollContentRef.current;
    if (rowRef?.current && scrollContentNode) {
      rowRef.current.measureLayout(
        scrollContentNode,
        (_x, y) => {
          inputPositionsRef.current[fieldKey] = y;
          scrollViewRef.current?.scrollTo({
            y: Math.max(0, y - INPUT_FOCUS_SCROLL_OFFSET),
            animated,
          });
        },
        () => {
          const fallbackY = inputPositionsRef.current[fieldKey];
          if (typeof fallbackY === 'number') {
            scrollViewRef.current?.scrollTo({
              y: Math.max(0, fallbackY - INPUT_FOCUS_SCROLL_OFFSET),
              animated,
            });
            return;
          }
          if (__DEV__) {
            console.warn(`Failed to measure layout for field "${fieldKey}"`);
          }
        },
      );
    }
  }, []);

  const handleInputLayout = (fieldKey: string) => {
    const rowRef = inputRowRefs.current[fieldKey];
    const scrollContentNode = scrollContentRef.current;
    if (rowRef?.current && scrollContentNode) {
      rowRef.current.measureLayout(
        scrollContentNode,
        (_x, y) => {
          inputPositionsRef.current[fieldKey] = y;
        },
        () => {},
      );
    }
  };

  const handleInputFocus = (fieldKey: string) => {
    focusedFieldKeyRef.current = fieldKey;
    scrollToField(fieldKey, true);

    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }
    // A second pass after keyboard animation improves reliability on both iOS/Android.
    focusTimeoutRef.current = setTimeout(() => {
      if (focusedFieldKeyRef.current === fieldKey) {
        scrollToField(fieldKey, true);
      }
    }, 120);
  };

  useEffect(() => {
    const onKeyboardDidShow = () => {
      const focusedFieldKey = focusedFieldKeyRef.current;
      if (!focusedFieldKey) return;
      if (keyboardShowTimeoutRef.current) {
        clearTimeout(keyboardShowTimeoutRef.current);
      }
      keyboardShowTimeoutRef.current = setTimeout(() => {
        if (focusedFieldKeyRef.current === focusedFieldKey) {
          scrollToField(focusedFieldKey, true);
        }
      }, 80);
    };

    const showSub = Keyboard.addListener('keyboardDidShow', onKeyboardDidShow);
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      focusedFieldKeyRef.current = null;
      if (keyboardShowTimeoutRef.current) {
        clearTimeout(keyboardShowTimeoutRef.current);
        keyboardShowTimeoutRef.current = null;
      }
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    });

    return () => {
      if (keyboardShowTimeoutRef.current) {
        clearTimeout(keyboardShowTimeoutRef.current);
        keyboardShowTimeoutRef.current = null;
      }
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
      focusedFieldKeyRef.current = null;
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToField]);

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
                  <UISymbol name="chevron.left" size={22} color={m3.colorScheme.onSurface} />
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
                {t('calculator.systemDischarge.title', { defaultValue: 'System Discharge' })}
              </Text>
            </View>

            <View style={{ width: 44, height: 44 }} />
          </View>
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          style={{ flex: 1, backgroundColor: m3.colorScheme.background }}
        >
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 16, paddingBottom: 32 }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View ref={scrollContentRef} collapsable={false}>
              <View
                style={{
                  backgroundColor: colors.surface[100],
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
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                      borderRadius: borderRadius.lg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <UISymbol name="speedometer" size={18} color={m3.colorScheme.primary} />
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
                  fieldKey="dbl"
                  label="Distance Between Lines (DBL)"
                  value={dbl}
                  onChangeText={setDbl}
                  unit="m"
                  placeholder="3.0"
                  onInputFocus={handleInputFocus}
                  onInputLayout={handleInputLayout}
                  inputRowRefs={inputRowRefs}
                />
                <InputRow
                  fieldKey="refillTankValue"
                  label="Refill Tank Value (optional)"
                  value={refillTankValue}
                  onChangeText={setRefillTankValue}
                  unit=""
                  placeholder="From MAD calc"
                  onInputFocus={handleInputFocus}
                  onInputLayout={handleInputLayout}
                  inputRowRefs={inputRowRefs}
                />

                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: colors.surface[500],
                    marginTop: spacing[2],
                  }}
                >
                  Use the refill tank value from MAD to estimate irrigation hours.
                </Text>
              </View>

              {canSelectMethod && (
                <View
                  style={{
                    backgroundColor: colors.surface[100],
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
                        backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                        borderRadius: borderRadius.lg,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <UISymbol name="git-branch" size={18} color={m3.colorScheme.primary} />
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
                      backgroundColor:
                        selectedMethod === 1
                          ? colorWithOpacity(m3.colorScheme.primary, 0.12)
                          : colors.surface[100],
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
                        <UISymbol
                          name="checkmark.circle.fill"
                          size={18}
                          color={m3.colorScheme.primary}
                        />
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
                      backgroundColor:
                        selectedMethod === 2
                          ? colorWithOpacity(m3.colorScheme.primary, 0.12)
                          : colors.surface[100],
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
                        <UISymbol
                          name="checkmark.circle.fill"
                          size={18}
                          color={m3.colorScheme.primary}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                </View>
              )}

              {selectedMethod === 1 && (
                <View
                  style={{
                    backgroundColor: colors.surface[100],
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
                        backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                        borderRadius: borderRadius.lg,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <UISymbol
                        name={resolveSymbolIconName(ICON_REGISTRY.irrigation)}
                        size={18}
                        color={m3.colorScheme.primary}
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
                      Method 1: Plants per Hectare
                    </Text>
                  </View>

                  <InputRow
                    fieldKey="dbp"
                    label="Distance Between Plants (DBP)"
                    value={dbp}
                    onChangeText={setDbp}
                    unit="m"
                    placeholder="1.5"
                    onInputFocus={handleInputFocus}
                    onInputLayout={handleInputLayout}
                    inputRowRefs={inputRowRefs}
                  />
                  <InputRow
                    fieldKey="drippersPerPlant"
                    label="Drippers per Plant"
                    value={drippersPerPlant}
                    onChangeText={setDrippersPerPlant}
                    unit=""
                    placeholder="4"
                    onInputFocus={handleInputFocus}
                    onInputLayout={handleInputLayout}
                    inputRowRefs={inputRowRefs}
                  />
                  <InputRow
                    fieldKey="dischargePerHour1"
                    label="Discharge per Dripper"
                    value={dischargePerHour1}
                    onChangeText={setDischargePerHour1}
                    unit="L/hr"
                    placeholder="2.0"
                    onInputFocus={handleInputFocus}
                    onInputLayout={handleInputLayout}
                    inputRowRefs={inputRowRefs}
                  />

                  <Pressable
                    onPress={calculateMethod1}
                    disabled={!canCalculateMethod1 || results !== null}
                    style={{
                      marginTop: spacing[4],
                      paddingVertical: spacing[3],
                      borderRadius: borderRadius.xl,
                      alignItems: 'center',
                      backgroundColor:
                        canCalculateMethod1 && !results
                          ? m3.colorScheme.primary
                          : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: fontWeight.semibold,
                        color:
                          canCalculateMethod1 && !results
                            ? m3.colorScheme.onPrimary
                            : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
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
                    backgroundColor: colors.surface[100],
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
                        backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                        borderRadius: borderRadius.lg,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <UISymbol
                        name="square.grid.2x2.fill"
                        size={18}
                        color={m3.colorScheme.primary}
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
                      Method 2: Dripper Spacing
                    </Text>
                  </View>

                  <InputRow
                    fieldKey="dbd"
                    label="Distance Between Drippers (DBD)"
                    value={dbd}
                    onChangeText={setDbd}
                    unit="m"
                    placeholder="0.5"
                    onInputFocus={handleInputFocus}
                    onInputLayout={handleInputLayout}
                    inputRowRefs={inputRowRefs}
                  />
                  <InputRow
                    fieldKey="dischargePerHour2"
                    label="Discharge per Dripper"
                    value={dischargePerHour2}
                    onChangeText={setDischargePerHour2}
                    unit="L/hr"
                    placeholder="2.0"
                    onInputFocus={handleInputFocus}
                    onInputLayout={handleInputLayout}
                    inputRowRefs={inputRowRefs}
                  />
                  <InputRow
                    fieldKey="numberOfLines"
                    label="Number of Lines"
                    value={numberOfLines}
                    onChangeText={setNumberOfLines}
                    unit=""
                    placeholder="10"
                    onInputFocus={handleInputFocus}
                    onInputLayout={handleInputLayout}
                    inputRowRefs={inputRowRefs}
                  />

                  <Pressable
                    onPress={calculateMethod2}
                    disabled={!canCalculateMethod2 || results !== null}
                    style={{
                      marginTop: spacing[4],
                      paddingVertical: spacing[3],
                      borderRadius: borderRadius.xl,
                      alignItems: 'center',
                      backgroundColor:
                        canCalculateMethod2 && !results
                          ? m3.colorScheme.primary
                          : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: fontWeight.semibold,
                        color:
                          canCalculateMethod2 && !results
                            ? m3.colorScheme.onPrimary
                            : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
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
                    backgroundColor: colors.surface[100],
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
                        backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                        borderRadius: borderRadius.lg,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <UISymbol
                        name="checkmark.circle.fill"
                        size={18}
                        color={m3.colorScheme.primary}
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
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                      borderRadius: borderRadius.xl,
                      padding: spacing[4],
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 28,
                        fontWeight: fontWeight.bold,
                        color: m3.colorScheme.primary,
                      }}
                    >
                      {results.systemDischarge.toFixed(2)}
                    </Text>
                    <Text
                      style={{
                        fontSize: fontSize.sm,
                        color: colorWithOpacity(m3.colorScheme.primary, 0.85),
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
                  {/* Formula - italic style per wireframe */}
                  <Text
                    style={{
                      fontSize: 10,
                      color: colors.surface[500],
                      fontStyle: 'italic',
                      textAlign: 'center',
                      marginTop: spacing[2],
                    }}
                  >
                    {results.method === 1
                      ? 'P/H = 10000 / (DBL × DBP) • SD = (P/H × Drippers × L/hr) / 10000'
                      : 'SD = (100 / DBL) × (100 / DBD) × Discharge × Lines / 10000'}
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
                      Your system can deliver {(results.systemDischarge * 1000).toFixed(0)} liters
                      per hour. Use this value for pump sizing and irrigation scheduling.
                    </Text>
                  </View>
                </View>
              )}

              {results && (
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
                    <UISymbol name="refresh" size={18} color={m3.colorScheme.onSurfaceVariant} />
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
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

// Input Row Component
interface InputRowProps {
  fieldKey: string;
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  unit: string;
  placeholder: string;
  onInputLayout: (fieldKey: string) => void;
  onInputFocus: (fieldKey: string) => void;
  inputRowRefs: React.MutableRefObject<Record<string, React.RefObject<View | null>>>;
}

function InputRow({
  fieldKey,
  label,
  value,
  onChangeText,
  unit,
  placeholder,
  onInputLayout,
  onInputFocus,
  inputRowRefs,
}: InputRowProps) {
  const colors = useThemeColors();
  const m3 = useM3();

  // Use the pre-initialized ref from parent
  const rowRef = inputRowRefs.current[fieldKey];

  const handleLayout = () => {
    onInputLayout(fieldKey);
  };

  return (
    <View
      ref={rowRef}
      style={{ marginBottom: spacing[3] }}
      onLayout={handleLayout}
      collapsable={false}
    >
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
          onFocus={() => onInputFocus(fieldKey)}
          placeholder={placeholder}
          placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
          keyboardType="decimal-pad"
          accessibilityLabel={label}
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
