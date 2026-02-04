/**
 * Farm Form
 * Shared add/edit form for farms.
 */

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCreateFarm, useFarm, useUpdateFarm } from '@/hooks';
import { CROP_VARIETIES, type CropType } from '@/constants/crop-varieties';
import type { Farm, FarmInsert, FarmUpdate } from '@/types';
import { useTranslation } from 'react-i18next';
import {
  FullScreenForm,
  SectionHeader,
  CardSelector,
  FormInput,
  InfoCard,
  CropIcon,
  Button,
} from '@/components/ui';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import LocationPicker from './location-picker';
import { formatDate } from '@/i18n/format';
import { telemetry } from '@/services/telemetry';

const SOIL_TEXTURE_OPTIONS = [
  { value: 'Sand', labelKey: 'farmForm.soilTexture.options.sand' },
  { value: 'Loamy sand', labelKey: 'farmForm.soilTexture.options.loamySand' },
  { value: 'Sandy loam', labelKey: 'farmForm.soilTexture.options.sandyLoam' },
  { value: 'Loam', labelKey: 'farmForm.soilTexture.options.loam' },
  { value: 'Silt loam', labelKey: 'farmForm.soilTexture.options.siltLoam' },
  { value: 'Silt', labelKey: 'farmForm.soilTexture.options.silt' },
  { value: 'Sandy clay loam', labelKey: 'farmForm.soilTexture.options.sandyClayLoam' },
  { value: 'Clay loam', labelKey: 'farmForm.soilTexture.options.clayLoam' },
  { value: 'Silty clay loam', labelKey: 'farmForm.soilTexture.options.siltyClayLoam' },
  { value: 'Sandy clay', labelKey: 'farmForm.soilTexture.options.sandyClay' },
  { value: 'Silty clay', labelKey: 'farmForm.soilTexture.options.siltyClay' },
  { value: 'Clay', labelKey: 'farmForm.soilTexture.options.clay' },
] as const;

type FarmFormMode = 'add' | 'edit';

interface FarmFormProps {
  mode: FarmFormMode;
  farmId?: number;
  onClose: () => void;
}

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDbDateToLocalDate = (value: string): Date => {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const buildFormStateFromFarm = (farm?: Farm | null) => ({
  name: farm?.name ?? '',
  region: farm?.region ?? '',
  area: farm?.area?.toString() ?? '',
  selectedCrop: (farm?.crop as CropType) ?? 'Grapes',
  cropVariety: farm?.crop_variety ?? '',
  customVariety: '',
  plantingDate: farm?.planting_date ? parseDbDateToLocalDate(farm.planting_date) : new Date(),
  vineSpacing: farm?.vine_spacing?.toString() ?? '',
  rowSpacing: farm?.row_spacing?.toString() ?? '',
  totalTankCapacity: farm?.total_tank_capacity?.toString() ?? '',
  systemDischarge: farm?.system_discharge?.toString() ?? '',
  dateOfPruning: farm?.date_of_pruning ? parseDbDateToLocalDate(farm.date_of_pruning) : null,
  locationName: farm?.location_name ?? '',
  latitude: farm?.latitude?.toString() ?? '',
  longitude: farm?.longitude?.toString() ?? '',
  elevation: farm?.elevation?.toString() ?? '',
  bulkDensity: farm?.bulk_density?.toString() ?? '',
  cationExchangeCapacity: farm?.cation_exchange_capacity?.toString() ?? '',
  soilWaterRetention: farm?.soil_water_retention?.toString() ?? '',
  soilTextureClass: farm?.soil_texture_class ?? '',
  sandPercentage: farm?.sand_percentage?.toString() ?? '',
  siltPercentage: farm?.silt_percentage?.toString() ?? '',
  clayPercentage: farm?.clay_percentage?.toString() ?? '',
  showDatePicker: false,
  showPruningDatePicker: false,
  showVarietyPicker: false,
  showTexturePicker: false,
  showMapPicker: false,
  plantingDateChanged: false,
});

type FormState = ReturnType<typeof buildFormStateFromFarm>;

export function FarmForm({ mode, farmId, onClose }: FarmFormProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();

  const isEdit = mode === 'edit';
  const createFarm = useCreateFarm();
  const updateFarm = useUpdateFarm();
  const { data: farm, isLoading: farmLoading } = useFarm(isEdit ? farmId : undefined);
  const initializedFarmIdRef = useRef<number | null>(null);

  const [formState, setFormState] = useState<FormState>(() =>
    isEdit && farm ? buildFormStateFromFarm(farm) : buildFormStateFromFarm(undefined),
  );

  useEffect(() => {
    if (!isEdit) {
      initializedFarmIdRef.current = null;
      return;
    }
    if (!farmId || !farm) return;
    if (initializedFarmIdRef.current === farmId) return;

    initializedFarmIdRef.current = farmId;
    const timer = setTimeout(() => {
      setFormState(buildFormStateFromFarm(farm));
    }, 0);
    return () => clearTimeout(timer);
  }, [farm, farmId, isEdit]);

  const varieties = useMemo(
    () => CROP_VARIETIES[formState.selectedCrop] || ['Custom'],
    [formState.selectedCrop],
  );

  const soilCompositionWarning = useMemo(() => {
    const sandRaw = formState.sandPercentage.trim();
    const siltRaw = formState.siltPercentage.trim();
    const clayRaw = formState.clayPercentage.trim();
    const anyProvided = sandRaw !== '' || siltRaw !== '' || clayRaw !== '';
    if (!anyProvided) return null;
    if (sandRaw === '' || siltRaw === '' || clayRaw === '') return null;

    const sand = Number(sandRaw);
    const silt = Number(siltRaw);
    const clay = Number(clayRaw);
    if (!Number.isFinite(sand) || !Number.isFinite(silt) || !Number.isFinite(clay)) {
      return null;
    }
    const total = sand + silt + clay;
    if (Math.abs(total - 100) > 1) {
      return t('farmForm.soilCompositionWarning', { total: total.toFixed(1) });
    }
    return null;
  }, [formState.sandPercentage, formState.siltPercentage, formState.clayPercentage, t]);

  const handleOpenMapPicker = () => {
    setFormState((prev) => ({ ...prev, showMapPicker: true }));
  };

  const handleLocationSelected = (latitude: number, longitude: number, locationName?: string) => {
    setFormState((prev) => ({
      ...prev,
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
      locationName: locationName || prev.locationName,
    }));
  };

  const isValid = useMemo(() => {
    if (!formState.name.trim()) return false;
    if (!formState.region.trim()) return false;
    const areaValue = Number(formState.area);
    if (!Number.isFinite(areaValue) || areaValue <= 0) return false;
    if (formState.cropVariety === 'Custom' && !formState.customVariety.trim()) return false;
    if (!formState.cropVariety && !formState.customVariety.trim()) return false;
    return true;
  }, [
    formState.name,
    formState.region,
    formState.area,
    formState.cropVariety,
    formState.customVariety,
  ]);

  const handleSelectVariety = (variety: string) => {
    setFormState((prev) => ({
      ...prev,
      cropVariety: variety,
      showVarietyPicker: false,
      customVariety: variety === 'Custom' ? '' : prev.customVariety,
    }));
  };

  const handleReset = () => {
    const initialState = isEdit ? buildFormStateFromFarm(farm) : buildFormStateFromFarm(undefined);
    setFormState(initialState);
  };

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert(
        t('common.alerts.missingInformationTitle'),
        t('common.alerts.fillAllRequiredFields'),
      );
      return;
    }

    const finalVariety =
      formState.cropVariety === 'Custom' ? formState.customVariety : formState.cropVariety;

    if (isEdit) {
      if (!farmId) {
        Alert.alert(t('common.error'), t('common.errors.missingFarmIdForUpdate'));
        return;
      }
      const updates: FarmUpdate = {
        name: formState.name.trim(),
        region: formState.region.trim(),
        area: parseFloat(formState.area),
        crop: formState.selectedCrop,
        crop_variety: finalVariety,
        ...(formState.plantingDateChanged && {
          planting_date: formatLocalDate(formState.plantingDate as Date),
        }),
        vine_spacing: formState.vineSpacing ? parseFloat(formState.vineSpacing) : undefined,
        row_spacing: formState.rowSpacing ? parseFloat(formState.rowSpacing) : undefined,
        total_tank_capacity: formState.totalTankCapacity
          ? parseFloat(formState.totalTankCapacity)
          : undefined,
        system_discharge: formState.systemDischarge
          ? parseFloat(formState.systemDischarge)
          : undefined,
        date_of_pruning: formState.dateOfPruning
          ? formatLocalDate(formState.dateOfPruning)
          : undefined,
        location_name: formState.locationName.trim() || undefined,
        latitude: formState.latitude ? parseFloat(formState.latitude) : undefined,
        longitude: formState.longitude ? parseFloat(formState.longitude) : undefined,
        elevation: formState.elevation ? parseInt(formState.elevation, 10) : undefined,
        bulk_density: formState.bulkDensity ? parseFloat(formState.bulkDensity) : undefined,
        cation_exchange_capacity: formState.cationExchangeCapacity
          ? parseFloat(formState.cationExchangeCapacity)
          : undefined,
        soil_water_retention: formState.soilWaterRetention
          ? parseFloat(formState.soilWaterRetention)
          : undefined,
        soil_texture_class: formState.soilTextureClass || undefined,
        sand_percentage: formState.sandPercentage
          ? parseFloat(formState.sandPercentage)
          : undefined,
        silt_percentage: formState.siltPercentage
          ? parseFloat(formState.siltPercentage)
          : undefined,
        clay_percentage: formState.clayPercentage
          ? parseFloat(formState.clayPercentage)
          : undefined,
      };
      try {
        await updateFarm.mutateAsync({ id: farmId, updates });
        telemetry.capture('farm_updated', {
          farm_id: farmId,
          crop: formState.selectedCrop,
          variety: finalVariety,
          region: formState.region,
          area_acres: parseFloat(formState.area),
        });
        onClose();
      } catch (_error: unknown) {
        const errorMessage =
          _error instanceof Error ? _error.message : t('common.errors.failedToUpdateFarm');
        Alert.alert(t('common.error'), errorMessage);
      }
      return;
    }

    const farmData: FarmInsert = {
      name: formState.name.trim(),
      region: formState.region.trim(),
      area: parseFloat(formState.area),
      crop: formState.selectedCrop,
      crop_variety: finalVariety,
      planting_date: formatLocalDate(formState.plantingDate),
      vine_spacing: formState.vineSpacing ? parseFloat(formState.vineSpacing) : undefined,
      row_spacing: formState.rowSpacing ? parseFloat(formState.rowSpacing) : undefined,
      total_tank_capacity: formState.totalTankCapacity
        ? parseFloat(formState.totalTankCapacity)
        : undefined,
      system_discharge: formState.systemDischarge
        ? parseFloat(formState.systemDischarge)
        : undefined,
      date_of_pruning: formState.dateOfPruning
        ? formatLocalDate(formState.dateOfPruning)
        : undefined,
      location_name: formState.locationName.trim() || undefined,
      latitude: formState.latitude ? parseFloat(formState.latitude) : undefined,
      longitude: formState.longitude ? parseFloat(formState.longitude) : undefined,
      elevation: formState.elevation ? parseInt(formState.elevation, 10) : undefined,
      bulk_density: formState.bulkDensity ? parseFloat(formState.bulkDensity) : undefined,
      cation_exchange_capacity: formState.cationExchangeCapacity
        ? parseFloat(formState.cationExchangeCapacity)
        : undefined,
      soil_water_retention: formState.soilWaterRetention
        ? parseFloat(formState.soilWaterRetention)
        : undefined,
      soil_texture_class: formState.soilTextureClass || undefined,
      sand_percentage: formState.sandPercentage ? parseFloat(formState.sandPercentage) : undefined,
      silt_percentage: formState.siltPercentage ? parseFloat(formState.siltPercentage) : undefined,
      clay_percentage: formState.clayPercentage ? parseFloat(formState.clayPercentage) : undefined,
    };

    try {
      const result = await createFarm.mutateAsync(farmData);
      telemetry.capture('farm_created', {
        farm_id: result?.id ?? null,
        crop: formState.selectedCrop,
        variety: finalVariety,
        region: formState.region,
        area_acres: parseFloat(formState.area),
      });
      onClose();
    } catch (_error: unknown) {
      const errorMessage =
        _error instanceof Error ? _error.message : t('common.errors.failedToCreateFarm');
      Alert.alert(t('common.error'), errorMessage);
    }
  };

  interface CropOption {
    value: CropType;
    label: string;
    sublabel: string;
    renderIcon?: (args: { selected: boolean; size: number }) => React.ReactNode;
    icon?: string;
    iconColor: string;
    iconLibrary?: 'ionicons' | 'symbols';
  }

  const cropOptions: CropOption[] = useMemo(
    () => [
      {
        value: 'Grapes' as CropType,
        label: t('farmForm.cropOptions.grapes.label'),
        sublabel: t('farmForm.cropOptions.grapes.sublabel'),
        renderIcon: ({ selected, size }) => (
          <CropIcon name="grapes" size={size} muted={!selected} />
        ),
        iconColor: colorWithOpacity(m3.colorScheme.tertiary, 0.18),
      },
      {
        value: 'Mango' as CropType,
        label: t('farmForm.cropOptions.mango.label'),
        sublabel: t('farmForm.cropOptions.mango.sublabel'),
        renderIcon: ({ selected, size }) => <CropIcon name="mango" size={size} muted={!selected} />,
        iconColor: colorWithOpacity(colors.warning, 0.18),
      },
      {
        value: 'Pomegranate' as CropType,
        label: t('farmForm.cropOptions.pomegranate.label'),
        sublabel: t('farmForm.cropOptions.pomegranate.sublabel'),
        renderIcon: ({ selected, size }) => (
          <CropIcon name="pomegranate" size={size} muted={!selected} />
        ),
        iconColor: colorWithOpacity(m3.colorScheme.error, 0.18),
      },
      {
        value: 'Citrus' as CropType,
        label: t('farmForm.cropOptions.citrus.label'),
        sublabel: t('farmForm.cropOptions.citrus.sublabel'),
        renderIcon: ({ selected, size }) => (
          <CropIcon name="citrus" size={size} muted={!selected} />
        ),
        iconColor: colorWithOpacity(colors.warning, 0.12),
      },
      {
        value: 'Banana' as CropType,
        label: t('farmForm.cropOptions.banana.label'),
        sublabel: t('farmForm.cropOptions.banana.sublabel'),
        renderIcon: ({ selected, size }) => (
          <CropIcon name="banana" size={size} muted={!selected} />
        ),
        iconColor: colorWithOpacity(colors.warning, 0.2),
      },
      {
        value: 'Other' as CropType,
        label: t('farmForm.cropOptions.other.label'),
        sublabel: t('farmForm.cropOptions.other.sublabel'),
        icon: 'ellipsis-horizontal' as const,
        iconColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
        iconLibrary: 'ionicons' as const,
      },
    ],
    [
      colors.warning,
      m3.colorScheme.error,
      m3.colorScheme.onSurfaceVariant,
      m3.colorScheme.tertiary,
      t,
    ],
  );

  const getSoilTextureLabel = useCallback(
    (value?: string) => {
      if (!value) return '';
      const match = SOIL_TEXTURE_OPTIONS.find((o) => o.value === value);
      return match ? t(match.labelKey) : value;
    },
    [t],
  );

  const getVarietyLabel = useCallback(
    (value?: string) => {
      if (!value) return '';
      if (value === 'Custom') return t('farmForm.variety.custom');
      return value;
    },
    [t],
  );

  if (isEdit && farmLoading) {
    return (
      <View
        style={{ flex: 1, backgroundColor: m3.colorScheme.background, justifyContent: 'center' }}
      >
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
      <FullScreenForm
        title={isEdit ? t('farmForm.title.edit') : t('farmForm.title.add')}
        onClose={onClose}
        onSave={handleSave}
        saveLabel={isEdit ? t('common.saveChanges') : t('farmForm.saveLabel.createFarm')}
        isLoading={createFarm.isPending || updateFarm.isPending}
        isSaveDisabled={!isValid}
        showResetButton={!isEdit}
        onReset={handleReset}
      >
        <SectionHeader title={t('farmForm.sections.details')} style={{ marginBottom: 16 }} />

        <FormInput
          label={t('farmForm.fields.name.label')}
          value={formState.name}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, name: v }))}
          placeholder={t('farmForm.fields.name.placeholder')}
          required
          autoFocus={!isEdit}
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label={t('farmForm.fields.region.label')}
          value={formState.region}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, region: v }))}
          placeholder={t('farmForm.fields.region.placeholder')}
          required
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label={t('farmForm.fields.area.label')}
          value={formState.area}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, area: v }))}
          placeholder={t('farmForm.fields.area.placeholder')}
          keyboardType="decimal-pad"
          suffix={t('units.acres')}
          required
          style={{ marginBottom: 20 }}
        />

        <SectionHeader title={t('farmForm.sections.cropType')} style={{ marginBottom: 16 }} />

        <CardSelector
          options={cropOptions}
          selectedValue={formState.selectedCrop}
          onSelect={(value) => {
            setFormState((prev) => ({
              ...prev,
              selectedCrop: value as CropType,
              cropVariety: '',
              customVariety: '',
            }));
          }}
          columns={3}
          style={{ marginBottom: 20 }}
        />

        <SectionHeader title={t('farmForm.sections.variety')} style={{ marginBottom: 16 }} />

        <Pressable
          style={{
            backgroundColor: colors.surface[100],
            borderWidth: 2,
            borderColor: colors.surface[200],
            borderRadius: borderRadius.xl,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[4],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[5],
          }}
          onPress={() => setFormState((prev) => ({ ...prev, showVarietyPicker: true }))}
        >
          <Text
            style={{
              fontSize: fontSize.base,
              color: formState.cropVariety ? colors.surface[900] : colors.surface[400],
              fontWeight: formState.cropVariety ? fontWeight.medium : fontWeight.normal,
            }}
          >
            {formState.cropVariety
              ? getVarietyLabel(formState.cropVariety)
              : t('farmForm.variety.selectPlaceholder')}
          </Text>
          <UISymbol name="chevron.down" size={20} color={m3.colorScheme.onSurfaceVariant} />
        </Pressable>

        {formState.cropVariety === 'Custom' && (
          <FormInput
            label={t('farmForm.variety.customNameLabel')}
            value={formState.customVariety}
            onChangeText={(v) => setFormState((prev) => ({ ...prev, customVariety: v }))}
            placeholder={t('farmForm.variety.customNamePlaceholder')}
            required
            style={{ marginBottom: 20 }}
          />
        )}

        <SectionHeader title={t('farmForm.sections.plantingDate')} style={{ marginBottom: 16 }} />

        <Pressable
          style={{
            backgroundColor: colors.surface[100],
            borderWidth: 2,
            borderColor: colors.surface[200],
            borderRadius: borderRadius.xl,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[4],
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: spacing[5],
          }}
          onPress={() => setFormState((prev) => ({ ...prev, showDatePicker: true }))}
        >
          <UISymbol name="calendar" size={24} color={m3.colorScheme.onSurfaceVariant} />
          <Text
            style={{
              fontSize: fontSize.base,
              color: colors.surface[900],
              fontWeight: fontWeight.medium,
              marginLeft: spacing[3],
            }}
          >
            {formState.plantingDate
              ? formatDate(formState.plantingDate, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
              : t('farmForm.plantingDate.selectPlaceholder')}
          </Text>
        </Pressable>

        <SectionHeader
          title={t('farmForm.sections.plantSpacingOptional')}
          style={{ marginBottom: 16 }}
        />

        <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] }}>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.vineSpacing.label')}
              value={formState.vineSpacing}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, vineSpacing: v }))}
              placeholder="1.8"
              keyboardType="decimal-pad"
              suffix={t('units.meter')}
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.rowSpacing.label')}
              value={formState.rowSpacing}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, rowSpacing: v }))}
              placeholder="3.0"
              keyboardType="decimal-pad"
              suffix={t('units.meter')}
              style={{ marginBottom: 0 }}
            />
          </View>
        </View>

        <SectionHeader
          title={t('farmForm.sections.irrigationDetailsOptional')}
          style={{ marginBottom: 16 }}
        />

        <FormInput
          label={t('farmForm.fields.tankCapacity.label')}
          value={formState.totalTankCapacity}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, totalTankCapacity: v }))}
          placeholder="1000"
          keyboardType="decimal-pad"
          suffix={t('units.millimeter')}
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label={t('farmForm.fields.systemDischarge.label')}
          value={formState.systemDischarge}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, systemDischarge: v }))}
          placeholder="10"
          keyboardType="decimal-pad"
          suffix={t('units.mmPerHour')}
          style={{ marginBottom: 20 }}
        />

        <SectionHeader
          title={t('farmForm.sections.pruningDateOptional')}
          style={{ marginBottom: 16 }}
        />

        <Pressable
          style={{
            backgroundColor: colors.surface[100],
            borderWidth: 2,
            borderColor: colors.surface[200],
            borderRadius: borderRadius.xl,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[4],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[5],
          }}
          onPress={() => setFormState((prev) => ({ ...prev, showPruningDatePicker: true }))}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <UISymbol name="cut-outline" size={24} color={m3.colorScheme.onSurfaceVariant} />
            <View style={{ marginLeft: spacing[3], flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.surface[500] }}>
                {t('farmForm.fields.pruningDate.label')}
              </Text>
              <Text
                style={{
                  fontSize: fontSize.base,
                  color: colors.surface[900],
                  fontWeight: fontWeight.medium,
                  marginTop: 2,
                }}
              >
                {formState.dateOfPruning
                  ? formatDate(formState.dateOfPruning, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : t('farmForm.fields.pruningDate.notSet')}
              </Text>
            </View>
          </View>
          {formState.dateOfPruning && (
            <Pressable
              onPress={() => setFormState((prev) => ({ ...prev, dateOfPruning: null }))}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <UISymbol
                name="xmark.circle.fill"
                size={24}
                color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
              />
            </Pressable>
          )}
        </Pressable>

        <SectionHeader
          title={t('farmForm.sections.locationOptional')}
          style={{ marginBottom: 16 }}
        />

        <FormInput
          label={t('farmForm.fields.locationName.label')}
          value={formState.locationName}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, locationName: v }))}
          placeholder={t('farmForm.fields.locationName.placeholder')}
          style={{ marginBottom: 12 }}
        />

        <Button
          title={t('farmForm.location.selectOnMap')}
          variant="outline"
          size="sm"
          leftIcon={<UISymbol name="location.fill" size={20} color={colors.primary[500]} />}
          onPress={handleOpenMapPicker}
          style={{ marginBottom: 12 }}
        />

        <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] }}>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.latitude.label')}
              value={formState.latitude}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, latitude: v }))}
              placeholder="0.000000"
              keyboardType="decimal-pad"
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.longitude.label')}
              value={formState.longitude}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, longitude: v }))}
              placeholder="0.000000"
              keyboardType="decimal-pad"
              style={{ marginBottom: 0 }}
            />
          </View>
        </View>

        <FormInput
          label={t('farmForm.fields.elevation.label')}
          value={formState.elevation}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, elevation: v }))}
          placeholder="0"
          keyboardType="decimal-pad"
          suffix={t('units.feet')}
          style={{ marginBottom: 20 }}
        />

        <SectionHeader
          title={t('farmForm.sections.soilPropertiesOptional')}
          style={{ marginBottom: 16 }}
        />

        <FormInput
          label={t('farmForm.fields.bulkDensity.label')}
          value={formState.bulkDensity}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, bulkDensity: v }))}
          placeholder="1200"
          keyboardType="decimal-pad"
          suffix={t('units.kilogramPerMeterCubed')}
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label={t('farmForm.fields.cationExchangeCapacity.label')}
          value={formState.cationExchangeCapacity}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, cationExchangeCapacity: v }))}
          placeholder="15"
          keyboardType="decimal-pad"
          suffix="cmol/kg"
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label={t('farmForm.fields.soilWaterRetention.label')}
          value={formState.soilWaterRetention}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, soilWaterRetention: v }))}
          placeholder="25"
          keyboardType="decimal-pad"
          suffix="%"
          style={{ marginBottom: 20 }}
        />

        <SectionHeader title={t('farmForm.sections.soilTexture')} style={{ marginBottom: 16 }} />

        <Pressable
          style={{
            backgroundColor: colors.surface[100],
            borderWidth: 2,
            borderColor: colors.surface[200],
            borderRadius: borderRadius.xl,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[4],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[5],
          }}
          onPress={() => setFormState((prev) => ({ ...prev, showTexturePicker: true }))}
        >
          <Text
            style={{
              fontSize: fontSize.base,
              color: formState.soilTextureClass ? colors.surface[900] : colors.surface[400],
              fontWeight: formState.soilTextureClass ? fontWeight.medium : fontWeight.normal,
            }}
          >
            {formState.soilTextureClass
              ? getSoilTextureLabel(formState.soilTextureClass)
              : t('farmForm.soilTexture.selectPlaceholder')}
          </Text>
          <UISymbol name="chevron.down" size={20} color={m3.colorScheme.onSurfaceVariant} />
        </Pressable>

        <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] }}>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.sandPercentage.label')}
              value={formState.sandPercentage}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, sandPercentage: v }))}
              placeholder="40"
              keyboardType="decimal-pad"
              suffix="%"
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.siltPercentage.label')}
              value={formState.siltPercentage}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, siltPercentage: v }))}
              placeholder="40"
              keyboardType="decimal-pad"
              suffix="%"
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput
              label={t('farmForm.fields.clayPercentage.label')}
              value={formState.clayPercentage}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, clayPercentage: v }))}
              placeholder="20"
              keyboardType="decimal-pad"
              suffix="%"
              style={{ marginBottom: 0 }}
            />
          </View>
        </View>

        {soilCompositionWarning && (
          <InfoCard
            icon="exclamationmark.triangle.fill"
            iconColor={colors.warning}
            backgroundColor={colorWithOpacity(colors.warning, 0.2)}
            message={soilCompositionWarning}
            style={{ marginBottom: 20 }}
          />
        )}

        <InfoCard
          icon="information-circle"
          iconColor={colors.success}
          backgroundColor={colorWithOpacity(colors.success, 0.2)}
          message={t('farmForm.infoCardMessage')}
        />
      </FullScreenForm>
      {formState.showDatePicker && (
        <DateTimePicker
          value={formState.plantingDate}
          mode="date"
          onChange={(_, date) => {
            setFormState((prev) => ({ ...prev, showDatePicker: false }));
            if (date) {
              setFormState((prev) => ({
                ...prev,
                plantingDate: date,
                plantingDateChanged: true,
              }));
            }
          }}
        />
      )}
      {formState.showPruningDatePicker && (
        <DateTimePicker
          value={formState.dateOfPruning ?? new Date()}
          mode="date"
          onChange={(_, date) => {
            setFormState((prev) => ({ ...prev, showPruningDatePicker: false }));
            if (date) setFormState((prev) => ({ ...prev, dateOfPruning: date }));
          }}
        />
      )}

      {formState.showVarietyPicker && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.5),
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface[100],
              borderTopLeftRadius: borderRadius['3xl'],
              borderTopRightRadius: borderRadius['3xl'],
              maxHeight: '70%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: spacing[6],
                paddingVertical: spacing[4],
                borderBottomWidth: 1,
                borderBottomColor: colors.surface[100],
              }}
            >
              <View style={{ width: 40 }} />
              <Text
                style={{
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[900],
                }}
              >
                {t('farmForm.variety.modalTitle')}
              </Text>
              <Pressable
                onPress={() => setFormState((prev) => ({ ...prev, showVarietyPicker: false }))}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: borderRadius.full,
                  backgroundColor: colors.surface[100],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UISymbol name="xmark" size={20} color={m3.colorScheme.onSurface} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 384 }}>
              {varieties.map((variety) => (
                <Pressable
                  key={variety}
                  style={{
                    paddingHorizontal: spacing[6],
                    paddingVertical: spacing[4],
                    borderBottomWidth: 1,
                    borderBottomColor: colors.surface[100],
                    backgroundColor:
                      formState.cropVariety === variety ? colors.surface[50] : colors.surface[100],
                  }}
                  onPress={() => handleSelectVariety(variety)}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.base,
                        color:
                          formState.cropVariety === variety
                            ? colors.surface[900]
                            : colors.surface[700],
                        fontWeight:
                          formState.cropVariety === variety
                            ? fontWeight.semibold
                            : fontWeight.normal,
                      }}
                    >
                      {getVarietyLabel(variety)}
                    </Text>
                    {formState.cropVariety === variety && (
                      <UISymbol name="checkmark" size={20} color={colors.primary[500]} />
                    )}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {formState.showTexturePicker && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.5),
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface[100],
              borderTopLeftRadius: borderRadius['3xl'],
              borderTopRightRadius: borderRadius['3xl'],
              maxHeight: '70%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: spacing[6],
                paddingVertical: spacing[4],
                borderBottomWidth: 1,
                borderBottomColor: colors.surface[100],
              }}
            >
              <View style={{ width: 40 }} />
              <Text
                style={{
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[900],
                }}
              >
                {t('farmForm.soilTexture.modalTitle')}
              </Text>
              <Pressable
                onPress={() => setFormState((prev) => ({ ...prev, showTexturePicker: false }))}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: borderRadius.full,
                  backgroundColor: colors.surface[100],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UISymbol name="xmark" size={20} color={m3.colorScheme.onSurface} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 384 }}>
              {SOIL_TEXTURE_OPTIONS.map((texture) => (
                <Pressable
                  key={texture.value}
                  style={{
                    paddingHorizontal: spacing[6],
                    paddingVertical: spacing[4],
                    borderBottomWidth: 1,
                    borderBottomColor: colors.surface[100],
                    backgroundColor:
                      formState.soilTextureClass === texture.value
                        ? colors.surface[50]
                        : colors.surface[100],
                  }}
                  onPress={() => {
                    setFormState((prev) => ({
                      ...prev,
                      soilTextureClass: texture.value,
                      showTexturePicker: false,
                    }));
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.base,
                        color:
                          formState.soilTextureClass === texture.value
                            ? colors.surface[900]
                            : colors.surface[700],
                        fontWeight:
                          formState.soilTextureClass === texture.value
                            ? fontWeight.semibold
                            : fontWeight.normal,
                      }}
                    >
                      {t(texture.labelKey)}
                    </Text>
                    {formState.soilTextureClass === texture.value && (
                      <UISymbol name="checkmark" size={20} color={colors.primary[500]} />
                    )}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      <LocationPicker
        visible={formState.showMapPicker}
        onClose={() => setFormState((prev) => ({ ...prev, showMapPicker: false }))}
        onLocationSelect={handleLocationSelected}
        initialLatitude={formState.latitude ? parseFloat(formState.latitude) : undefined}
        initialLongitude={formState.longitude ? parseFloat(formState.longitude) : undefined}
      />
    </View>
  );
}
