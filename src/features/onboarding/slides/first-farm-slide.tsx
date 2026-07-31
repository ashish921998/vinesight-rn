import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Button, CropIcon, FormInput } from '@/components/ui';
import { CropPickerSheet } from '@/components/screens/farm-form/crop-picker-sheet';
import { CROP_I18N_KEY_MAP, KNOWN_CROPS } from '@/components/screens/farm-form/constants';
import {
  buildFarmInsertFromCoreFields,
  getErrorMessage,
  isFarmCoreFieldsValid,
} from '@/components/screens/farm-form/utils';
import { useCreateFarm, useFarms } from '@/hooks';
import { telemetry } from '@/services/telemetry';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { CropType } from '@/constants/crop-varieties';
import { getCropVisual, KnownCrop } from '@/utils/farm-crop-visuals';
import { useM3 } from '@/styles/use-theme';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { triggerHapticSuccess } from '@/utils/haptics';

interface FirstFarmSlideProps {
  isActive: boolean;
  onResolved: (farmId: number | null) => void;
}

interface KnownCropOption {
  value: KnownCrop;
  label: string;
  sublabel: string;
}

interface FarmSetupState {
  name: string;
  region: string;
  area: string;
  selectedCrop: CropType;
  customCropName: string;
  cropVariety: string;
  customVariety: string;
  cropSearchQuery: string;
  showCropPicker: boolean;
}

const INITIAL_STATE: FarmSetupState = {
  name: '',
  region: '',
  area: '',
  selectedCrop: 'Grapes',
  customCropName: '',
  cropVariety: '',
  customVariety: '',
  cropSearchQuery: '',
  showCropPicker: false,
};

export function FirstFarmSlide({ isActive, onResolved }: FirstFarmSlideProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const createFarm = useCreateFarm();
  const { data: farms = [], isLoading: farmsLoading } = useFarms();
  const [state, setState] = useState<FarmSetupState>(INITIAL_STATE);

  const knownCropOptions = useMemo<KnownCropOption[]>(
    () =>
      KNOWN_CROPS.map((crop) => {
        const keys = CROP_I18N_KEY_MAP[crop];
        return {
          value: crop,
          label: keys ? t(keys.labelKey) : crop,
          sublabel: keys ? t(keys.sublabelKey) : t('farmForm.cropPicker.defaultSublabel'),
        };
      }),
    [t],
  );

  const cropSearchQueryTrimmed = state.cropSearchQuery.trim();
  const cropSearchQueryLower = cropSearchQueryTrimmed.toLowerCase();

  const filteredCropOptions = useMemo(() => {
    if (!cropSearchQueryLower) return knownCropOptions;
    return knownCropOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(cropSearchQueryLower) ||
        option.value.toLowerCase().includes(cropSearchQueryLower),
    );
  }, [cropSearchQueryLower, knownCropOptions]);

  const canCreateCustomCrop = useMemo(() => {
    if (!cropSearchQueryTrimmed) return false;
    return !knownCropOptions.some(
      (option) =>
        option.value.toLowerCase() === cropSearchQueryLower ||
        option.label.toLowerCase() === cropSearchQueryLower,
    );
  }, [cropSearchQueryLower, cropSearchQueryTrimmed, knownCropOptions]);

  const selectedCropLabel = useMemo(() => {
    if (state.selectedCrop === 'Other') {
      return state.customCropName.trim() || t('farmForm.cropPicker.customCropLabel');
    }
    const selected = knownCropOptions.find((option) => option.value === state.selectedCrop);
    return selected?.label ?? state.selectedCrop;
  }, [knownCropOptions, state.customCropName, state.selectedCrop, t]);

  const isValid = isFarmCoreFieldsValid({
    name: state.name,
    region: state.region,
    area: state.area,
    selectedCrop: state.selectedCrop,
    customCropName: state.customCropName,
    cropVariety: '',
    customVariety: state.customVariety,
  });

  const hasFarm = farms.length > 0;
  const primaryFarm = farms[0];

  const renderCropVisual = useCallback(
    (crop: KnownCrop, size: number, selected = false) => {
      const visual = getCropVisual(crop);
      if ('iconName' in visual && visual.iconName) {
        return <CropIcon name={visual.iconName} size={size} muted={!selected} />;
      }
      return (
        <SymbolIcon
          name={visual.symbolName ?? 'leaf.fill'}
          size={size}
          color={selected ? m3.colorScheme.primary : '#7B8A7F'}
        />
      );
    },
    [m3],
  );

  const handleSelectCrop = useCallback((crop: CropType, customCropName?: string) => {
    setState((prev) => ({
      ...prev,
      selectedCrop: crop,
      customCropName: crop === 'Other' ? (customCropName?.trim() ?? prev.customCropName) : '',
      cropVariety: '',
      customVariety: '',
      cropSearchQuery: '',
      showCropPicker: false,
    }));
  }, []);

  const handleCreate = useCallback(async () => {
    const payload = buildFarmInsertFromCoreFields({
      name: state.name,
      region: state.region,
      area: state.area,
      selectedCrop: state.selectedCrop,
      customCropName: state.customCropName,
      cropVariety: '',
      customVariety: state.customVariety,
    });

    if (!payload) {
      Alert.alert(
        t('common.alerts.missingInformationTitle'),
        t('common.alerts.fillAllRequiredFields'),
      );
      return;
    }

    try {
      const createdFarm = await createFarm.mutateAsync(payload);
      triggerHapticSuccess();
      telemetry.capture('onboarding_first_farm_created', {
        farm_id: createdFarm?.id ?? null,
        crop: createdFarm?.crop ?? payload.crop,
        region: createdFarm?.region ?? payload.region,
      });
      const farmId = createdFarm?.id ?? null;
      if (farmId === null) {
        onResolved(null);
        return;
      }
      onResolved(farmId);
    } catch (error: unknown) {
      Alert.alert(t('common.error'), getErrorMessage(error, t('common.errors.failedToCreateFarm')));
    }
  }, [
    createFarm,
    onResolved,
    state.area,
    state.customCropName,
    state.customVariety,
    state.name,
    state.region,
    state.selectedCrop,
    t,
  ]);

  if (hasFarm) {
    return (
      <View style={[styles.container, { backgroundColor: m3.colorScheme.background }]}>
        <View style={styles.panel}>
          <Animated.View
            entering={isActive ? FadeInDown.duration(450) : undefined}
            style={styles.header}
          >
            <Text style={[styles.title, { color: m3.colorScheme.onSurface }]}>
              {t('onboarding.firstFarm.existingTitle')}
            </Text>
            <Text style={[styles.subtitle, { color: m3.colorScheme.onSurfaceVariant }]}>
              {t('onboarding.firstFarm.existingSubtitle')}
            </Text>
          </Animated.View>

          <Animated.View
            entering={isActive ? FadeInDown.delay(100).duration(450) : undefined}
            style={[
              styles.existingFarmCard,
              {
                backgroundColor: colorWithOpacity(m3.colorScheme.surface, 0.84),
                borderColor: colorWithOpacity(m3.colorScheme.outline, 0.1),
              },
            ]}
          >
            <View
              style={[
                styles.existingFarmIcon,
                { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12) },
              ]}
            >
              <SymbolIcon name="leaf.fill" size={20} color={m3.colorScheme.primary} />
            </View>
            <View style={styles.existingFarmText}>
              <Text style={[styles.existingFarmName, { color: m3.colorScheme.onSurface }]}>
                {primaryFarm?.name ?? t('onboarding.firstFarm.existingFarmFallback')}
              </Text>
              <Text style={[styles.existingFarmMeta, { color: m3.colorScheme.onSurfaceVariant }]}>
                {primaryFarm?.region ?? t('onboarding.firstFarm.existingRegionFallback')} ·{' '}
                {primaryFarm?.crop ?? t('onboarding.firstFarm.existingCropFallback')}
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={isActive ? FadeInDown.delay(180).duration(450) : undefined}>
            <Button
              title={t('onboarding.firstFarm.existingButton')}
              onPress={() => onResolved(primaryFarm?.id ?? null)}
              variant="primary"
              isLoading={farmsLoading}
            />
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: m3.colorScheme.background }]}>
      <View style={styles.panel}>
        <Animated.View
          entering={isActive ? FadeInDown.duration(450) : undefined}
          style={styles.header}
        >
          <Text style={[styles.title, { color: m3.colorScheme.onSurface }]}>
            {t('onboarding.firstFarm.title')}
          </Text>
          <Text style={[styles.subtitle, { color: m3.colorScheme.onSurfaceVariant }]}>
            {t('onboarding.firstFarm.subtitle')}
          </Text>
        </Animated.View>

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={isActive ? FadeInDown.delay(70).duration(450) : undefined}>
            <FormInput
              label={t('farmForm.fields.name.label')}
              value={state.name}
              onChangeText={(value) => setState((prev) => ({ ...prev, name: value }))}
              placeholder={t('farmForm.fields.name.placeholder')}
              required
              style={styles.field}
            />
          </Animated.View>

          <Animated.View entering={isActive ? FadeInDown.delay(110).duration(450) : undefined}>
            <FormInput
              label={t('farmForm.fields.area.label')}
              value={state.area}
              onChangeText={(value) =>
                setState((prev) => ({
                  ...prev,
                  area: value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'),
                }))
              }
              placeholder={t('farmForm.fields.area.placeholder')}
              keyboardType="decimal-pad"
              suffix={t('units.acres')}
              required
              style={styles.field}
            />
          </Animated.View>

          <Animated.View entering={isActive ? FadeInDown.delay(150).duration(450) : undefined}>
            <Text style={[styles.fieldLabel, { color: m3.colorScheme.onSurfaceVariant }]}>
              {t('farmForm.sections.cropType')}
            </Text>
            <Pressable
              onPress={() => setState((prev) => ({ ...prev, showCropPicker: true }))}
              style={[
                styles.selector,
                {
                  backgroundColor: colorWithOpacity(m3.colorScheme.surface, 0.84),
                  borderColor: colorWithOpacity(m3.colorScheme.outline, 0.1),
                },
              ]}
            >
              <View style={styles.selectorLeading}>
                <View
                  style={[
                    styles.selectorIcon,
                    { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08) },
                  ]}
                >
                  {state.selectedCrop !== 'Other' ? (
                    renderCropVisual(state.selectedCrop as KnownCrop, 18, true)
                  ) : (
                    <SymbolIcon name="leaf.fill" size={18} color={m3.colorScheme.primary} />
                  )}
                </View>
                <View style={styles.selectorText}>
                  <Text style={[styles.selectorValue, { color: m3.colorScheme.onSurface }]}>
                    {selectedCropLabel}
                  </Text>
                </View>
              </View>
              <SymbolIcon name="chevron.down" size={18} color={m3.colorScheme.onSurfaceVariant} />
            </Pressable>
          </Animated.View>

          <Animated.View entering={isActive ? FadeInDown.delay(190).duration(450) : undefined}>
            <Button
              title={t('onboarding.firstFarm.createButton')}
              onPress={handleCreate}
              variant="primary"
              isLoading={createFarm.isPending}
              disabled={!isValid}
            />
          </Animated.View>
        </ScrollView>
      </View>

      <CropPickerSheet
        visible={state.showCropPicker}
        selectedCrop={state.selectedCrop}
        customCropName={state.customCropName}
        cropSearchQuery={state.cropSearchQuery}
        cropSearchQueryTrimmed={cropSearchQueryTrimmed}
        cropSearchQueryLower={cropSearchQueryLower}
        filteredCropOptions={filteredCropOptions}
        canCreateCustomCrop={canCreateCustomCrop}
        onClose={() =>
          setState((prev) => ({ ...prev, showCropPicker: false, cropSearchQuery: '' }))
        }
        onSelectCrop={handleSelectCrop}
        onSearchChange={(query) => setState((prev) => ({ ...prev, cropSearchQuery: query }))}
        renderCropVisual={renderCropVisual}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
  },
  panel: {
    flex: 1,
    paddingVertical: spacing[2],
    gap: spacing[4],
  },
  header: {
    gap: spacing[1],
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  formContent: {
    gap: spacing[3],
    paddingBottom: spacing[4],
  },
  field: {
    marginBottom: 0,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing[1],
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: borderRadius['2xl'],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  selectorLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  selectorIcon: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorText: {
    flex: 1,
  },
  selectorValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  existingFarmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderRadius: borderRadius['2xl'],
    padding: spacing[4],
  },
  existingFarmIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  existingFarmText: {
    flex: 1,
    gap: spacing[1],
  },
  existingFarmName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  existingFarmMeta: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
