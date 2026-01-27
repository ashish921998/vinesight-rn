/**
 * Water Level Modal
 * Modal for updating soil water level with ET0 and growth stage
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Symbol } from '@/components/ui/Symbol';
import type { Farm } from '@/types';
import { useUpdateFarmWaterLevel } from '@/hooks';
import { WATER_GROWTH_STAGES } from '@/constants/calculatorModels';
import type { WaterGrowthStage } from '@/constants/calculatorModels';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

interface WaterLevelModalProps {
  visible?: boolean;
  onClose: () => void;
  farm: Farm;
  presentation?: 'modal' | 'screen';
}

export function WaterLevelModal({
  visible,
  onClose,
  farm,
  presentation = 'modal',
}: WaterLevelModalProps) {
  const isVisible = visible ?? true;
  const [manualWaterLevel, setManualWaterLevel] = useState('');
  const [useManual, setUseManual] = useState(false);
  const [eto, setEto] = useState('');
  const [selectedGrowthStage, setSelectedGrowthStage] = useState<WaterGrowthStage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showGrowthStagePicker, setShowGrowthStagePicker] = useState(false);
  const [calculatedWaterLevel, setCalculatedWaterLevel] = useState<number | null>(null);

  const updateWaterLevel = useUpdateFarmWaterLevel();

  const handleCalculate = () => {
    if (useManual) {
      const manualValue = parseFloat(manualWaterLevel);
      if (isNaN(manualValue) || manualValue < 0) {
        Alert.alert('Invalid Input', 'Please enter a valid water level in mm');
        return;
      }
      setCalculatedWaterLevel(manualValue);
    } else {
      const etoValue = parseFloat(eto);
      if (isNaN(etoValue) || etoValue < 0) {
        Alert.alert('Invalid Input', 'Please enter a valid ET0 value');
        return;
      }
      if (!selectedGrowthStage) {
        Alert.alert('Missing Selection', 'Please select a growth stage');
        return;
      }

      const currentWater = farm.remaining_water ?? 0;
      const kc = selectedGrowthStage.kc;
      const etc = etoValue * kc;

      setCalculatedWaterLevel(currentWater - etc);
    }
  };

  const handleSave = async () => {
    if (!farm.id) return;

    if (calculatedWaterLevel === null) {
      Alert.alert('Calculate First', 'Please calculate the water level first');
      return;
    }

    setIsSaving(true);
    try {
      await updateWaterLevel.mutateAsync({
        farmId: farm.id,
        remainingWater: calculatedWaterLevel,
      });
      Alert.alert('Success', `Water level updated to ${calculatedWaterLevel.toFixed(1)} mm`);
      onClose();
      setManualWaterLevel('');
      setEto('');
      setSelectedGrowthStage(null);
      setCalculatedWaterLevel(null);
      setUseManual(false);
    } catch (_error) {
      Alert.alert('Error', 'Failed to update water level');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setManualWaterLevel('');
    setEto('');
    setSelectedGrowthStage(null);
    setShowGrowthStagePicker(false);
    setCalculatedWaterLevel(null);
    setUseManual(false);
    onClose();
  };

  const content = (
    <View style={{ flex: 1, backgroundColor: colors.surface[50] }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: colors.white,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[4],
          borderBottomWidth: 1,
          borderBottomColor: colors.gray[200],
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <TouchableOpacity onPress={handleClose} style={{ padding: spacing[2] }}>
            <Symbol name="xmark" size={24} color="#8e8e93" />
          </TouchableOpacity>
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
              color: colors.surface[900],
            }}
          >
            Update Soil Water Level
          </Text>
          <TouchableOpacity onPress={handleCalculate} style={{ padding: spacing[2] }}>
            <Text style={{ fontWeight: fontWeight.semibold, color: colors.primary[500] }}>
              Calculate
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing[4] }}>
        {/* Current Water Level */}
        <View
          style={{
            borderRadius: borderRadius['2xl'],
            padding: spacing[4],
            marginBottom: spacing[4],
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
          }}
        >
          <Text
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.semibold,
              color: colors.surface[500],
              marginBottom: spacing[1],
            }}
          >
            CURRENT WATER LEVEL
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text
              style={{
                fontSize: fontSize['3xl'],
                fontWeight: fontWeight.bold,
                color: colors.surface[900],
              }}
            >
              {farm.remaining_water?.toFixed(1) || '--'}
            </Text>
            <Text
              style={{
                fontSize: fontSize.lg,
                color: colors.surface[500],
                marginLeft: spacing[1],
              }}
            >
              mm
            </Text>
          </View>
        </View>

        {/* Calculated Water Level */}
        {calculatedWaterLevel !== null && (
          <View
            style={{
              borderRadius: borderRadius['2xl'],
              padding: spacing[4],
              marginBottom: spacing[4],
              backgroundColor: colors.primary[500],
            }}
          >
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
                color: 'rgba(255,255,255,0.8)',
                marginBottom: spacing[1],
              }}
            >
              NEW WATER LEVEL
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text
                style={{
                  fontSize: fontSize['3xl'],
                  fontWeight: fontWeight.bold,
                  color: colors.white,
                }}
              >
                {calculatedWaterLevel.toFixed(1)}
              </Text>
              <Text
                style={{
                  fontSize: fontSize.lg,
                  color: 'rgba(255,255,255,0.8)',
                  marginLeft: spacing[1],
                }}
              >
                mm
              </Text>
            </View>
            <View style={{ marginTop: spacing[2], flexDirection: 'row', alignItems: 'center' }}>
              <Symbol name="chart.line.downtrend.xyaxis" size={16} color="white" />
              <Text style={{ fontSize: fontSize.sm, color: colors.white, marginLeft: spacing[1] }}>
                Change: {((farm.remaining_water ?? 0) - calculatedWaterLevel).toFixed(1)} mm
              </Text>
            </View>
          </View>
        )}

        {/* Calculation Method Toggle */}
        <View
          style={{
            borderRadius: borderRadius['2xl'],
            overflow: 'hidden',
            marginBottom: spacing[4],
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
          }}
        >
          <TouchableOpacity
            onPress={() => setUseManual(false)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[4],
              backgroundColor: !useManual ? 'rgba(64, 128, 89, 0.1)' : 'transparent',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: !useManual ? colors.primary[500] : colors.surface[900],
                }}
              >
                Calculate with ET0
              </Text>
              <Text
                style={{
                  fontSize: fontSize.xs,
                  color: colors.surface[500],
                  marginTop: spacing[1],
                }}
              >
                Enter ET0 and select growth stage to calculate
              </Text>
            </View>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: !useManual ? colors.primary[500] : '#c7c7cc',
                backgroundColor: !useManual ? colors.primary[500] : 'transparent',
              }}
            >
              {!useManual && <Symbol name="checkmark" size={14} color="#fff" />}
            </View>
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: colors.gray[200] }} />
          <TouchableOpacity
            onPress={() => setUseManual(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[4],
              backgroundColor: useManual ? 'rgba(64, 128, 89, 0.1)' : 'transparent',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: useManual ? colors.primary[500] : colors.surface[900],
                }}
              >
                Manual Entry
              </Text>
              <Text
                style={{
                  fontSize: fontSize.xs,
                  color: colors.surface[500],
                  marginTop: spacing[1],
                }}
              >
                Set the soil water level directly
              </Text>
            </View>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: useManual ? colors.primary[500] : '#c7c7cc',
                backgroundColor: useManual ? colors.primary[500] : 'transparent',
              }}
            >
              {useManual && <Symbol name="checkmark" size={14} color="#fff" />}
            </View>
          </TouchableOpacity>
        </View>

        {/* ET0 Calculation Form */}
        {!useManual && (
          <View
            style={{
              borderRadius: borderRadius['2xl'],
              padding: spacing[4],
              marginBottom: spacing[4],
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
            }}
          >
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                color: colors.surface[900],
                marginBottom: spacing[3],
              }}
            >
              ET0 (Reference Evapotranspiration)
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#f9f9f9',
                borderRadius: borderRadius.xl,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
              }}
            >
              <TextInput
                style={{ flex: 1, fontSize: fontSize.base, color: colors.surface[900] }}
                placeholder="Enter ET0 value"
                value={eto}
                onChangeText={setEto}
                keyboardType="decimal-pad"
                placeholderTextColor="#c7c7cc"
              />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  color: colors.surface[500],
                  marginLeft: spacing[2],
                }}
              >
                mm/day
              </Text>
            </View>

            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                color: colors.surface[900],
                marginTop: spacing[4],
                marginBottom: spacing[3],
              }}
            >
              Growth Stage
            </Text>
            <TouchableOpacity
              onPress={() => setShowGrowthStagePicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#f9f9f9',
                borderRadius: borderRadius.xl,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.base,
                  color: selectedGrowthStage ? colors.surface[900] : '#c7c7cc',
                }}
              >
                {selectedGrowthStage
                  ? `${selectedGrowthStage.label} (Kc: ${selectedGrowthStage.kc.toFixed(2)})`
                  : 'Select growth stage'}
              </Text>
              <Symbol name="chevron.down" size={20} color="#8e8e93" />
            </TouchableOpacity>
          </View>
        )}

        {/* Manual Entry Form */}
        {useManual && (
          <View
            style={{
              borderRadius: borderRadius['2xl'],
              padding: spacing[4],
              marginBottom: spacing[4],
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
            }}
          >
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                color: colors.surface[900],
                marginBottom: spacing[3],
              }}
            >
              Soil Water Level (mm)
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#f9f9f9',
                borderRadius: borderRadius.xl,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
              }}
            >
              <TextInput
                style={{ flex: 1, fontSize: fontSize.base, color: colors.surface[900] }}
                placeholder="Enter water level"
                value={manualWaterLevel}
                onChangeText={setManualWaterLevel}
                keyboardType="decimal-pad"
                placeholderTextColor="#c7c7cc"
              />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  color: colors.surface[500],
                  marginLeft: spacing[2],
                }}
              >
                mm
              </Text>
            </View>
          </View>
        )}

        {/* Info Box */}
        <View
          style={{
            borderRadius: borderRadius['2xl'],
            padding: spacing[4],
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Symbol name="info.circle" size={20} color="#408059" />
            <View style={{ marginLeft: spacing[3], flex: 1 }}>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[900],
                  marginBottom: spacing[1],
                }}
              >
                About Soil Water Levels
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.surface[500], lineHeight: 20 }}>
                Critical: &lt;6mm | Low: 6-10mm | Medium: 10-25mm | Good: &gt;25mm
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View
        style={{
          backgroundColor: colors.white,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[4],
          borderTopWidth: 1,
          borderTopColor: colors.gray[200],
        }}
      >
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving || calculatedWaterLevel === null}
          style={{
            paddingVertical: spacing[4],
            borderRadius: borderRadius.xl,
            alignItems: 'center',
            backgroundColor:
              isSaving || calculatedWaterLevel === null ? colors.gray[300] : colors.primary[500],
          }}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontWeight: fontWeight.semibold, color: colors.white }}>
              Save Water Level
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Growth Stage Picker Modal */}
      <Modal
        visible={showGrowthStagePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGrowthStagePicker(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing[4],
          }}
        >
          <View
            style={{
              backgroundColor: colors.white,
              borderRadius: borderRadius['2xl'],
              width: '100%',
              maxHeight: '60%',
            }}
          >
            <View
              style={{
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[4],
                borderBottomWidth: 1,
                borderBottomColor: colors.gray[200],
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.bold,
                  color: colors.surface[900],
                  textAlign: 'center',
                }}
              >
                Select Growth Stage
              </Text>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {WATER_GROWTH_STAGES.map((stage) => (
                <TouchableOpacity
                  key={stage.id}
                  onPress={() => {
                    setSelectedGrowthStage(stage);
                    setShowGrowthStagePicker(false);
                  }}
                  style={{
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                    borderBottomWidth: 1,
                    borderBottomColor: colors.gray[100],
                    backgroundColor:
                      selectedGrowthStage?.id === stage.id
                        ? 'rgba(64, 128, 89, 0.1)'
                        : 'transparent',
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          fontSize: fontSize.base,
                          fontWeight: fontWeight.medium,
                          color:
                            selectedGrowthStage?.id === stage.id
                              ? colors.primary[500]
                              : colors.surface[900],
                        }}
                      >
                        {stage.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          color: colors.surface[500],
                          marginTop: 2,
                        }}
                      >
                        Kc: {stage.kc.toFixed(2)}
                      </Text>
                    </View>
                    {selectedGrowthStage?.id === stage.id && (
                      <Symbol name="checkmark.circle.fill" size={24} color="#408059" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowGrowthStagePicker(false)}
              style={{
                paddingVertical: spacing[4],
                borderTopWidth: 1,
                borderTopColor: colors.gray[200],
              }}
            >
              <Text
                style={{
                  textAlign: 'center',
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[500],
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );

  if (presentation === 'screen') {
    return content;
  }

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      {content}
    </Modal>
  );
}
