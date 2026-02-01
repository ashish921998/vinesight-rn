/**
 * Farm Form
 * Shared add/edit form for farms.
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCreateFarm, useFarm, useUpdateFarm } from '@/hooks';
import { CROP_VARIETIES, type CropType } from '@/constants/crop-varieties';
import type { Farm, FarmInsert, FarmUpdate } from '@/types';
import {
  FullScreenForm,
  SectionHeader,
  CardSelector,
  FormInput,
  InfoCard,
  CropIcon,
  Button,
} from '@/components/ui';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import LocationPicker from './location-picker';

const SOIL_TEXTURE_CLASSES = [
  'Sand',
  'Loamy sand',
  'Sandy loam',
  'Loam',
  'Silt loam',
  'Silt',
  'Sandy clay loam',
  'Clay loam',
  'Silty clay loam',
  'Sandy clay',
  'Silty clay',
  'Clay',
];

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
      return `Sand + Silt + Clay should total approximately 100% (currently ${total.toFixed(1)}%)`;
    }
    return null;
  }, [formState.sandPercentage, formState.siltPercentage, formState.clayPercentage]);

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
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    const finalVariety =
      formState.cropVariety === 'Custom' ? formState.customVariety : formState.cropVariety;

    if (isEdit) {
      if (!farmId) {
        Alert.alert('Error', 'Missing farm ID for update.');
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
        onClose();
      } catch (_error: unknown) {
        const errorMessage =
          _error instanceof Error ? _error.message : 'Failed to update farm. Please try again.';
        Alert.alert('Error', errorMessage);
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
      await createFarm.mutateAsync(farmData);
      onClose();
    } catch (_error: unknown) {
      const errorMessage =
        _error instanceof Error ? _error.message : 'Failed to create farm. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  type CropOption = {
    value: CropType;
    label: string;
    sublabel: string;
    renderIcon?: (args: { selected: boolean; size: number }) => React.ReactNode;
    icon?: string;
    iconColor: string;
    iconLibrary?: 'ionicons' | 'symbols';
  };

  const cropOptions: CropOption[] = [
    {
      value: 'Grapes' as CropType,
      label: 'Grapes',
      sublabel: 'Vines',
      renderIcon: ({ selected, size }) => <CropIcon name="grapes" size={size} muted={!selected} />,
      iconColor: '#DDD6FE',
    },
    {
      value: 'Mango' as CropType,
      label: 'Mango',
      sublabel: 'Trees',
      renderIcon: ({ selected, size }) => <CropIcon name="mango" size={size} muted={!selected} />,
      iconColor: '#FED7AA',
    },
    {
      value: 'Pomegranate' as CropType,
      label: 'Pomegranate',
      sublabel: 'Fruit',
      renderIcon: ({ selected, size }) => (
        <CropIcon name="pomegranate" size={size} muted={!selected} />
      ),
      iconColor: '#FECACA',
    },
    {
      value: 'Citrus' as CropType,
      label: 'Citrus',
      sublabel: 'Trees',
      renderIcon: ({ selected, size }) => <CropIcon name="citrus" size={size} muted={!selected} />,
      iconColor: '#FEF08A',
    },
    {
      value: 'Banana' as CropType,
      label: 'Banana',
      sublabel: 'Plants',
      renderIcon: ({ selected, size }) => <CropIcon name="banana" size={size} muted={!selected} />,
      iconColor: '#FEF3C7',
    },
    {
      value: 'Other' as CropType,
      label: 'Other',
      sublabel: 'Custom',
      icon: 'ellipsis-horizontal' as const,
      iconColor: '#E5E7EB',
      iconLibrary: 'ionicons' as const,
    },
  ];

  if (isEdit && farmLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.white, justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <FullScreenForm
        title={isEdit ? 'Edit Farm' : 'Add Farm'}
        onClose={onClose}
        onSave={handleSave}
        saveLabel={isEdit ? 'Save Changes' : 'Create Farm'}
        isLoading={createFarm.isPending || updateFarm.isPending}
        isSaveDisabled={!isValid}
        showResetButton={!isEdit}
        onReset={handleReset}
      >
        <SectionHeader title="Farm Details" style={{ marginBottom: 16 }} />

        <FormInput
          label="Farm Name"
          value={formState.name}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, name: v }))}
          placeholder="e.g., Sunset Vineyards"
          required
          autoFocus={!isEdit}
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label="Location"
          value={formState.region}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, region: v }))}
          placeholder="e.g., Nashik, Maharashtra"
          required
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label="Area"
          value={formState.area}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, area: v }))}
          placeholder="10"
          keyboardType="decimal-pad"
          suffix="acres"
          required
          style={{ marginBottom: 20 }}
        />

        <SectionHeader title="Crop Type" style={{ marginBottom: 16 }} />

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

        <SectionHeader title="Variety" style={{ marginBottom: 16 }} />

        <Pressable
          style={{
            backgroundColor: colors.white,
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
            {formState.cropVariety || 'Select variety'}
          </Text>
          <UISymbol name="chevron.down" size={20} color="#6B7280" />
        </Pressable>

        {formState.cropVariety === 'Custom' && (
          <FormInput
            label="Custom Variety Name"
            value={formState.customVariety}
            onChangeText={(v) => setFormState((prev) => ({ ...prev, customVariety: v }))}
            placeholder="Enter variety name"
            required
            style={{ marginBottom: 20 }}
          />
        )}

        <SectionHeader title="Planting Date" style={{ marginBottom: 16 }} />

        <Pressable
          style={{
            backgroundColor: colors.white,
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
          <UISymbol name="calendar" size={24} color="#6B7280" />
          <Text
            style={{
              fontSize: fontSize.base,
              color: colors.surface[900],
              fontWeight: fontWeight.medium,
              marginLeft: spacing[3],
            }}
          >
            {formState.plantingDate
              ? formState.plantingDate.toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Select date'}
          </Text>
        </Pressable>

        <SectionHeader title="Plant Spacing (Optional)" style={{ marginBottom: 16 }} />

        <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] }}>
          <View style={{ flex: 1 }}>
            <FormInput
              label="Vine Spacing"
              value={formState.vineSpacing}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, vineSpacing: v }))}
              placeholder="6"
              keyboardType="decimal-pad"
              suffix="ft"
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput
              label="Row Spacing"
              value={formState.rowSpacing}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, rowSpacing: v }))}
              placeholder="10"
              keyboardType="decimal-pad"
              suffix="ft"
              style={{ marginBottom: 0 }}
            />
          </View>
        </View>

        <SectionHeader title="Irrigation Details (Optional)" style={{ marginBottom: 16 }} />

        <FormInput
          label="Tank Capacity"
          value={formState.totalTankCapacity}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, totalTankCapacity: v }))}
          placeholder="1000"
          keyboardType="decimal-pad"
          suffix="mm"
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label="System Discharge"
          value={formState.systemDischarge}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, systemDischarge: v }))}
          placeholder="10"
          keyboardType="decimal-pad"
          suffix="mm/hr"
          style={{ marginBottom: 20 }}
        />

        <SectionHeader title="Pruning Date (Optional)" style={{ marginBottom: 16 }} />

        <Pressable
          style={{
            backgroundColor: colors.white,
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
            <UISymbol name="cut-outline" size={24} color="#6B7280" />
            <View style={{ marginLeft: spacing[3], flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.surface[500] }}>
                Pruning Date
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
                  ? formState.dateOfPruning.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Not set'}
              </Text>
            </View>
          </View>
          {formState.dateOfPruning && (
            <Pressable
              onPress={() => setFormState((prev) => ({ ...prev, dateOfPruning: null }))}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <UISymbol name="xmark.circle.fill" size={24} color="#9CA3AF" />
            </Pressable>
          )}
        </Pressable>

        <SectionHeader title="Location (Optional)" style={{ marginBottom: 16 }} />

        <FormInput
          label="Location Name"
          value={formState.locationName}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, locationName: v }))}
          placeholder="e.g., North Field"
          style={{ marginBottom: 12 }}
        />

        <Button
          title="Select Location on Map"
          variant="outline"
          size="sm"
          leftIcon={<UISymbol name="location.fill" size={20} color={colors.primary[500]} />}
          onPress={handleOpenMapPicker}
          style={{ marginBottom: 12 }}
        />

        <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] }}>
          <View style={{ flex: 1 }}>
            <FormInput
              label="Latitude"
              value={formState.latitude}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, latitude: v }))}
              placeholder="0.000000"
              keyboardType="decimal-pad"
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput
              label="Longitude"
              value={formState.longitude}
              onChangeText={(v) => setFormState((prev) => ({ ...prev, longitude: v }))}
              placeholder="0.000000"
              keyboardType="decimal-pad"
              style={{ marginBottom: 0 }}
            />
          </View>
        </View>

        <FormInput
          label="Elevation"
          value={formState.elevation}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, elevation: v }))}
          placeholder="0"
          keyboardType="decimal-pad"
          suffix="ft"
          style={{ marginBottom: 20 }}
        />

        <SectionHeader title="Soil Properties (Optional)" style={{ marginBottom: 16 }} />

        <FormInput
          label="Bulk Density"
          value={formState.bulkDensity}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, bulkDensity: v }))}
          placeholder="1200"
          keyboardType="decimal-pad"
          suffix="kg/m³"
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label="Cation Exchange Capacity"
          value={formState.cationExchangeCapacity}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, cationExchangeCapacity: v }))}
          placeholder="15"
          keyboardType="decimal-pad"
          suffix="cmol/kg"
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label="Soil Water Retention"
          value={formState.soilWaterRetention}
          onChangeText={(v) => setFormState((prev) => ({ ...prev, soilWaterRetention: v }))}
          placeholder="25"
          keyboardType="decimal-pad"
          suffix="%"
          style={{ marginBottom: 20 }}
        />

        <SectionHeader title="Soil Texture" style={{ marginBottom: 16 }} />

        <Pressable
          style={{
            backgroundColor: colors.white,
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
            {formState.soilTextureClass || 'Select texture'}
          </Text>
          <UISymbol name="chevron.down" size={20} color="#6B7280" />
        </Pressable>

        <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] }}>
          <View style={{ flex: 1 }}>
            <FormInput
              label="Sand"
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
              label="Silt"
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
              label="Clay"
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
            iconColor="#F59E0B"
            backgroundColor="#FEF3C7"
            message={soilCompositionWarning}
            style={{ marginBottom: 20 }}
          />
        )}

        <InfoCard
          icon="information-circle"
          iconColor="#10B981"
          backgroundColor="#D1FAE5"
          message="You can always update these details later from your farm settings."
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
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.white,
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
                Select Variety
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
                <UISymbol name="xmark" size={20} color="#111827" />
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
                      formState.cropVariety === variety ? colors.surface[50] : colors.white,
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
                      {variety}
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
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.white,
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
                Select Soil Texture
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
                <UISymbol name="xmark" size={20} color="#111827" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 384 }}>
              {SOIL_TEXTURE_CLASSES.map((texture) => (
                <Pressable
                  key={texture}
                  style={{
                    paddingHorizontal: spacing[6],
                    paddingVertical: spacing[4],
                    borderBottomWidth: 1,
                    borderBottomColor: colors.surface[100],
                    backgroundColor:
                      formState.soilTextureClass === texture ? colors.surface[50] : colors.white,
                  }}
                  onPress={() => {
                    setFormState((prev) => ({
                      ...prev,
                      soilTextureClass: texture,
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
                          formState.soilTextureClass === texture
                            ? colors.surface[900]
                            : colors.surface[700],
                        fontWeight:
                          formState.soilTextureClass === texture
                            ? fontWeight.semibold
                            : fontWeight.normal,
                      }}
                    >
                      {texture}
                    </Text>
                    {formState.soilTextureClass === texture && (
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
