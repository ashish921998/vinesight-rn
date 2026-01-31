/**
 * Water Level Modal
 * Modal for updating soil water level with ET0 and growth stage
 */

import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import {
  FormModal,
  SectionHeader,
  SegmentedControl,
  FormInput,
  InfoCard,
  PreviewCard,
} from '@/components/ui';
import type { Farm } from '@/types';
import { useIrrigationRecords, useUpdateFarmWaterLevel } from '@/hooks';
import { WATER_GROWTH_STAGES } from '@/constants/calculator-models';
import type { WaterGrowthStage } from '@/constants/calculator-models';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

interface WaterLevelSheetProps {
  visible?: boolean;
  onClose: () => void;
  farm: Farm;
  presentation?: 'modal' | 'screen';
}

export function WaterLevelSheet({
  visible,
  onClose,
  farm,
  presentation = 'modal',
}: WaterLevelSheetProps) {
  const isVisible = visible ?? true;
  const [manualWaterLevel, setManualWaterLevel] = useState('');
  const [useManual, setUseManual] = useState(false);
  const [eto, setEto] = useState('');
  const [selectedGrowthStage, setSelectedGrowthStage] = useState<WaterGrowthStage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showGrowthStagePicker, setShowGrowthStagePicker] = useState(false);
  const [calculatedWaterLevel, setCalculatedWaterLevel] = useState<number | null>(null);

  const updateWaterLevel = useUpdateFarmWaterLevel();
  const { data: irrigationRecords } = useIrrigationRecords(farm.id);

  const totalWaterUsed =
    irrigationRecords?.reduce(
      (sum, record) => sum + (record.duration || 0) * (record.system_discharge || 0),
      0,
    ) ?? null;

  const formatWaterUsed = (value: number | null) => {
    if (value === null || value === undefined) return '--';
    const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(digits)} L`;
  };

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

      const newLevel = Math.max(0, currentWater - etc);
      setCalculatedWaterLevel(newLevel);
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

  const currentWaterValue = farm.remaining_water;
  const currentWaterDisplay =
    currentWaterValue === null || currentWaterValue === undefined
      ? '--'
      : currentWaterValue.toFixed(1);
  const changeValue =
    calculatedWaterLevel === null || currentWaterValue === null || currentWaterValue === undefined
      ? null
      : currentWaterValue - calculatedWaterLevel;

  return (
    <FormModal
      visible={isVisible}
      onClose={handleClose}
      title="Update Soil Water Level"
      onSave={handleSave}
      saveLabel="Save Water Level"
      isLoading={isSaving}
      isSaveDisabled={calculatedWaterLevel === null}
      presentation={presentation}
    >
      <SectionHeader
        title="Water Levels"
        subtitle="Calculate from ET0 or set the level manually."
        style={{ marginBottom: spacing[4] }}
      />

      <PreviewCard
        title="Current Water Level"
        items={[
          { label: 'Remaining', value: `${currentWaterDisplay} mm` },
          { label: 'Total Water Used', value: formatWaterUsed(totalWaterUsed) },
        ]}
        backgroundColor={colors.surface[100]}
      />

      {calculatedWaterLevel !== null && (
        <PreviewCard
          title="New Water Level"
          items={[
            { label: 'Remaining', value: `${calculatedWaterLevel.toFixed(1)} mm` },
            {
              label: 'Change',
              value: `${changeValue === null ? '--' : changeValue.toFixed(1)} mm`,
            },
          ]}
          backgroundColor={colors.primary[50]}
        />
      )}

      <SectionHeader title="Calculation Method" style={{ marginBottom: spacing[4] }} />
      <SegmentedControl
        options={[
          { value: 'eto', label: 'ET0' },
          { value: 'manual', label: 'Manual' },
        ]}
        selectedValue={useManual ? 'manual' : 'eto'}
        onSelect={(value) => {
          setUseManual(value === 'manual');
          setCalculatedWaterLevel(null);
        }}
      />

      {!useManual && (
        <>
          <SectionHeader title="ET0 Inputs" style={{ marginBottom: spacing[4] }} />
          <FormInput
            label="ET0 (Reference Evapotranspiration)"
            value={eto}
            onChangeText={(value) => {
              setEto(value);
              setCalculatedWaterLevel(null);
            }}
            placeholder="0.0"
            keyboardType="decimal-pad"
            suffix="mm/day"
            required
            style={{ marginBottom: spacing[5] }}
          />
          <View style={{ marginBottom: spacing[6] }}>
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: colors.surface[700],
                marginBottom: spacing[2],
              }}
            >
              Growth Stage
              <Text style={{ color: colors.error }}> *</Text>
            </Text>
            <Pressable
              onPress={() => setShowGrowthStagePicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: colors.surface[100],
                borderWidth: 2,
                borderColor: colors.surface[200],
                borderRadius: borderRadius.xl,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.base,
                  color: selectedGrowthStage ? colors.surface[900] : '#9CA3AF',
                }}
              >
                {selectedGrowthStage
                  ? `${selectedGrowthStage.label} (Kc: ${selectedGrowthStage.kc.toFixed(2)})`
                  : 'Select growth stage'}
              </Text>
              <SymbolIcon name="chevron.down" size={18} color={colors.surface[400]} />
            </Pressable>
          </View>
        </>
      )}

      {useManual && (
        <>
          <SectionHeader title="Manual Entry" style={{ marginBottom: spacing[4] }} />
          <FormInput
            label="Soil Water Level"
            value={manualWaterLevel}
            onChangeText={(value) => {
              setManualWaterLevel(value);
              setCalculatedWaterLevel(null);
            }}
            placeholder="0.0"
            keyboardType="decimal-pad"
            suffix="mm"
            required
            style={{ marginBottom: spacing[5] }}
          />
        </>
      )}

      <Pressable
        onPress={handleCalculate}
        style={{
          borderRadius: borderRadius.xl,
          borderWidth: 2,
          borderColor: colors.surface[300],
          backgroundColor: colors.surface[100],
          paddingVertical: spacing[3],
          alignItems: 'center',
          marginBottom: spacing[6],
        }}
      >
        <Text style={{ fontWeight: fontWeight.semibold, color: colors.surface[900] }}>
          Calculate Water Level
        </Text>
      </Pressable>

      <InfoCard
        icon="information-circle"
        iconColor={colors.primary[600]}
        backgroundColor={colors.primary[50]}
        title="About Soil Water Levels"
        message="Critical: <6mm | Low: 6-10mm | Medium: 10-25mm | Good: >25mm"
      />

      <Modal
        visible={showGrowthStagePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGrowthStagePicker(false)}
      >
        <SafeAreaView
          edges={['top', 'bottom']}
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
              maxHeight: '70%',
              overflow: 'hidden',
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
            <ScrollView style={{ maxHeight: 420 }}>
              {WATER_GROWTH_STAGES.map((stage) => (
                <Pressable
                  key={stage.id}
                  onPress={() => {
                    setSelectedGrowthStage(stage);
                    setCalculatedWaterLevel(null);
                    setShowGrowthStagePicker(false);
                  }}
                  style={{
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                    borderBottomWidth: 1,
                    borderBottomColor: colors.gray[100],
                    backgroundColor:
                      selectedGrowthStage?.id === stage.id ? colors.primary[50] : 'transparent',
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
                              ? colors.primary[600]
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
                      <SymbolIcon
                        name="checkmark.circle.fill"
                        size={24}
                        color={colors.primary[500]}
                      />
                    )}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
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
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </FormModal>
  );
}
