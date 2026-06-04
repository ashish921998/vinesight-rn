/**
 * Water Level Modal
 * Modal for updating soil water level with ET0 and growth stage
 */

import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { toast } from '@/components/ui/toast';
import {
  FormModal,
  SectionHeader,
  SegmentedControl,
  FormInput,
  PreviewCard,
} from '@/components/ui';
import type { Farm } from '@/types';
import { useIrrigationRecords, useUpdateFarmWaterLevel } from '@/hooks';
import { WATER_GROWTH_STAGES } from '@/constants/calculator-models';
import type { WaterGrowthStage } from '@/constants/calculator-models';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useNotificationStore } from '@/stores';
import { ensureNotificationPermissions, notifyLowWaterAlert } from '@/services/notifications';
import { useTranslation } from 'react-i18next';
import { formatNumber, formatDate } from '@/i18n/format';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { triggerHapticMedium } from '@/utils/haptics';

interface WaterLevelSheetProps {
  visible?: boolean;
  onClose: () => void;
  farm: Farm;
  presentation?: 'modal' | 'screen';
}

const LOW_WATER_THRESHOLD_PERCENT = 30;

export function WaterLevelSheet({
  visible,
  onClose,
  farm,
  presentation = 'modal',
}: WaterLevelSheetProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();

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

  const lowWaterAlertsEnabled = useNotificationStore((s) => s.lowWaterAlertsEnabled);

  const totalWaterUsed =
    irrigationRecords?.reduce(
      (sum, record) => sum + (record.duration || 0) * (record.system_discharge || 0),
      0,
    ) ?? null;

  const formatWaterUsed = (value: number | null) => {
    if (value === null || value === undefined) return '--';
    const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${formatNumber(value, { maximumFractionDigits: digits })} mm`;
  };

  const formatLastUpdated = (timestamp: string | null | undefined) => {
    if (!timestamp) return '--';
    try {
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return '--';
      return formatDate(date, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '--';
    }
  };

  const handleCalculate = () => {
    triggerHapticMedium();
    if (useManual) {
      const manualValue = parseFloat(manualWaterLevel);
      if (isNaN(manualValue) || manualValue < 0) {
        Alert.alert(
          t('waterLevelSheet.alerts.invalidInputTitle'),
          t('waterLevelSheet.alerts.invalidWaterLevel'),
        );
        return;
      }
      setCalculatedWaterLevel(manualValue);
    } else {
      const etoValue = parseFloat(eto);
      if (isNaN(etoValue) || etoValue < 0) {
        Alert.alert(
          t('waterLevelSheet.alerts.invalidInputTitle'),
          t('waterLevelSheet.alerts.invalidEto'),
        );
        return;
      }
      if (!selectedGrowthStage) {
        Alert.alert(
          t('waterLevelSheet.alerts.missingSelectionTitle'),
          t('waterLevelSheet.alerts.selectGrowthStage'),
        );
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
      Alert.alert(
        t('waterLevelSheet.alerts.calculateFirstTitle'),
        t('waterLevelSheet.alerts.calculateFirstMessage'),
      );
      return;
    }

    setIsSaving(true);
    try {
      await updateWaterLevel.mutateAsync({
        farmId: farm.id,
        remainingWater: calculatedWaterLevel,
      });
      // If user enabled low-water alerts, notify immediately when the new level is critical.
      if (lowWaterAlertsEnabled && farm.total_tank_capacity && farm.total_tank_capacity > 0) {
        const pct = (calculatedWaterLevel / farm.total_tank_capacity) * 100;
        if (pct < LOW_WATER_THRESHOLD_PERCENT) {
          try {
            const granted = await ensureNotificationPermissions();
            if (granted) {
              await notifyLowWaterAlert(farm.name ?? undefined);
            }
          } catch {
            // Notification failure should not affect save success
          }
        }
      }
      // Keep the success message numeric display in Latin digits.
      toast.success(
        t('waterLevelSheet.alerts.successUpdated', {
          valueMm: formatNumber(calculatedWaterLevel, { maximumFractionDigits: 1 }),
        }),
      );
      onClose();
      setManualWaterLevel('');
      setEto('');
      setSelectedGrowthStage(null);
      setCalculatedWaterLevel(null);
      setUseManual(false);
    } catch (_error) {
      Alert.alert(
        t('waterLevelSheet.alerts.errorTitle'),
        t('waterLevelSheet.alerts.failedToUpdate'),
      );
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
      title={t('waterLevelSheet.title')}
      onSave={calculatedWaterLevel !== null ? handleSave : undefined}
      saveLabel={t('waterLevelSheet.saveLabel')}
      isLoading={isSaving}
      isSaveDisabled={calculatedWaterLevel === null}
      presentation={presentation}
    >
      <Text
        style={{
          fontSize: fontSize.base,
          color: colors.surface[500],
          marginBottom: spacing[4],
        }}
      >
        {t('waterLevelSheet.sections.waterLevels.subtitle')}
      </Text>

      <PreviewCard
        title={t('waterLevelSheet.preview.current.title')}
        items={[
          {
            label: t('waterLevelSheet.preview.labels.remaining'),
            value: `${currentWaterDisplay} mm`,
          },
          {
            label: t('waterLevelSheet.preview.labels.totalWaterUsed'),
            value: formatWaterUsed(totalWaterUsed),
          },
          {
            label: t('waterLevelSheet.preview.labels.lastUpdated'),
            value: formatLastUpdated(farm.water_calculation_updated_at),
            compactValue: true,
          },
        ]}
        backgroundColor={colors.surface[100]}
      />

      {calculatedWaterLevel !== null && (
        <PreviewCard
          title={t('waterLevelSheet.preview.new.title')}
          items={[
            {
              label: t('waterLevelSheet.preview.labels.remaining'),
              value: `${formatNumber(calculatedWaterLevel, { maximumFractionDigits: 1 })} mm`,
            },
            {
              label: t('waterLevelSheet.preview.labels.change'),
              value: `${
                changeValue === null
                  ? '--'
                  : formatNumber(changeValue, { maximumFractionDigits: 1 })
              } mm`,
            },
          ]}
          backgroundColor={colors.primary[50]}
        />
      )}

      <SectionHeader
        title={t('waterLevelSheet.sections.method.title')}
        style={{ marginBottom: spacing[4] }}
      />
      <SegmentedControl
        options={[
          { value: 'eto', label: t('waterLevelSheet.method.eto') },
          { value: 'manual', label: t('waterLevelSheet.method.manual') },
        ]}
        selectedValue={useManual ? 'manual' : 'eto'}
        onSelect={(value) => {
          setUseManual(value === 'manual');
          setCalculatedWaterLevel(null);
        }}
      />

      {!useManual && (
        <>
          <SectionHeader
            title={t('waterLevelSheet.sections.etoInputs.title')}
            style={{ marginBottom: spacing[4] }}
          />
          <FormInput
            label={t('waterLevelSheet.eto.label')}
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
              {t('waterLevelSheet.growthStage.label')}
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
                  color: selectedGrowthStage
                    ? colors.surface[900]
                    : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
                }}
              >
                {selectedGrowthStage
                  ? t('waterLevelSheet.growthStage.selected', {
                      label: t(
                        `waterLevelSheet.growthStagePicker.stages.${selectedGrowthStage.id}`,
                      ),
                    })
                  : t('waterLevelSheet.growthStage.placeholder')}
              </Text>
              <SymbolIcon name="chevron.down" size={18} color={colors.surface[400]} />
            </Pressable>
          </View>
        </>
      )}

      {useManual && (
        <>
          <SectionHeader
            title={t('waterLevelSheet.sections.manualEntry.title')}
            style={{ marginBottom: spacing[4] }}
          />
          <FormInput
            label={t('waterLevelSheet.manual.label')}
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
          {t('waterLevelSheet.calculate')}
        </Text>
      </Pressable>

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
            backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.3),
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing[4],
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface[100],
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
                borderBottomColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
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
                {t('waterLevelSheet.growthStagePicker.title')}
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
                    borderBottomColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.15),
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
                        {t(`waterLevelSheet.growthStagePicker.stages.${stage.id}`)}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          color: colors.surface[500],
                          marginTop: spacing[1],
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
                borderTopColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
              }}
            >
              <Text
                style={{
                  textAlign: 'center',
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[500],
                }}
              >
                {t('common.cancel')}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </FormModal>
  );
}
