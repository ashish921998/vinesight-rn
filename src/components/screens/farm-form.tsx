/**
 * Farm Form
 * Shared add/edit form for farms.
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
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
} from '@/components/ui';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

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

const buildFormStateFromFarm = (farm?: Farm | null) => ({
  name: farm?.name ?? '',
  region: farm?.region ?? '',
  area: farm?.area?.toString() ?? '',
  selectedCrop: (farm?.crop as CropType) ?? 'Grapes',
  cropVariety: farm?.crop_variety ?? '',
  customVariety: '',
  plantingDate: farm?.planting_date ? new Date(farm.planting_date) : new Date(),
  vineSpacing: farm?.vine_spacing?.toString() ?? '',
  rowSpacing: farm?.row_spacing?.toString() ?? '',
  totalTankCapacity: farm?.total_tank_capacity?.toString() ?? '',
  systemDischarge: farm?.system_discharge?.toString() ?? '',
  dateOfPruning: farm?.date_of_pruning ? new Date(farm.date_of_pruning) : null,
});

export function FarmForm({ mode, farmId, onClose }: FarmFormProps) {
  const isEdit = mode === 'edit';
  const createFarm = useCreateFarm();
  const updateFarm = useUpdateFarm();
  const { data: farm, isLoading: farmLoading } = useFarm(isEdit ? farmId : undefined);

  const initialStateRef = useRef(buildFormStateFromFarm(undefined));

  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [area, setArea] = useState('');
  const [selectedCrop, setSelectedCrop] = useState<CropType>('Grapes');
  const [cropVariety, setCropVariety] = useState('');
  const [customVariety, setCustomVariety] = useState('');
  const [plantingDate, setPlantingDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [vineSpacing, setVineSpacing] = useState('');
  const [rowSpacing, setRowSpacing] = useState('');
  const [totalTankCapacity, setTotalTankCapacity] = useState('');
  const [systemDischarge, setSystemDischarge] = useState('');
  const [dateOfPruning, setDateOfPruning] = useState<Date | null>(null);
  const [showPruningDatePicker, setShowPruningDatePicker] = useState(false);
  const [showVarietyPicker, setShowVarietyPicker] = useState(false);
  const [plantingDateChanged, setPlantingDateChanged] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isEdit) return;
    if (!farm) return;
    const initial = buildFormStateFromFarm(farm);
    initialStateRef.current = initial;
    setName(initial.name);
    setRegion(initial.region);
    setArea(initial.area);
    setSelectedCrop(initial.selectedCrop);
    setCropVariety(initial.cropVariety);
    setCustomVariety(initial.customVariety);
    setPlantingDate(initial.plantingDate);
    setVineSpacing(initial.vineSpacing);
    setRowSpacing(initial.rowSpacing);
    setTotalTankCapacity(initial.totalTankCapacity);
    setSystemDischarge(initial.systemDischarge);
    setDateOfPruning(initial.dateOfPruning);
    setPlantingDateChanged(false);
  }, [farm, isEdit]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const varieties = useMemo(() => CROP_VARIETIES[selectedCrop] || ['Custom'], [selectedCrop]);

  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    if (!region.trim()) return false;
    const areaValue = Number(area);
    if (!Number.isFinite(areaValue) || areaValue <= 0) return false;
    if (cropVariety === 'Custom' && !customVariety.trim()) return false;
    if (!cropVariety && !customVariety.trim()) return false;
    return true;
  }, [name, region, area, cropVariety, customVariety]);

  const handleSelectVariety = (variety: string) => {
    setCropVariety(variety);
    setShowVarietyPicker(false);
    if (variety === 'Custom') {
      setCustomVariety('');
    }
  };

  const handleReset = () => {
    const initial = isEdit ? initialStateRef.current : buildFormStateFromFarm(undefined);
    setName(initial.name);
    setRegion(initial.region);
    setArea(initial.area);
    setSelectedCrop(initial.selectedCrop);
    setCropVariety(initial.cropVariety);
    setCustomVariety(initial.customVariety);
    setPlantingDate(initial.plantingDate);
    setVineSpacing(initial.vineSpacing);
    setRowSpacing(initial.rowSpacing);
    setTotalTankCapacity(initial.totalTankCapacity);
    setSystemDischarge(initial.systemDischarge);
    setDateOfPruning(initial.dateOfPruning);
  };

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    const finalVariety = cropVariety === 'Custom' ? customVariety : cropVariety;

    if (isEdit) {
      if (!farmId) {
        Alert.alert('Error', 'Missing farm ID for update.');
        return;
      }
      const updates: FarmUpdate = {
        name: name.trim(),
        region: region.trim(),
        area: parseFloat(area),
        crop: selectedCrop,
        crop_variety: finalVariety,
        ...(plantingDateChanged && { planting_date: formatLocalDate(plantingDate as Date) }),
        vine_spacing: vineSpacing ? parseFloat(vineSpacing) : undefined,
        row_spacing: rowSpacing ? parseFloat(rowSpacing) : undefined,
        total_tank_capacity: totalTankCapacity ? parseFloat(totalTankCapacity) : undefined,
        system_discharge: systemDischarge ? parseFloat(systemDischarge) : undefined,
        date_of_pruning: dateOfPruning ? formatLocalDate(dateOfPruning) : undefined,
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
      name: name.trim(),
      region: region.trim(),
      area: parseFloat(area),
      crop: selectedCrop,
      crop_variety: finalVariety,
      planting_date: formatLocalDate(plantingDate),
      vine_spacing: vineSpacing ? parseFloat(vineSpacing) : undefined,
      row_spacing: rowSpacing ? parseFloat(rowSpacing) : undefined,
      total_tank_capacity: totalTankCapacity ? parseFloat(totalTankCapacity) : undefined,
      system_discharge: systemDischarge ? parseFloat(systemDischarge) : undefined,
      date_of_pruning: dateOfPruning ? formatLocalDate(dateOfPruning) : undefined,
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
          value={name}
          onChangeText={setName}
          placeholder="e.g., Sunset Vineyards"
          required
          autoFocus={!isEdit}
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label="Location"
          value={region}
          onChangeText={setRegion}
          placeholder="e.g., Nashik, Maharashtra"
          required
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label="Area"
          value={area}
          onChangeText={setArea}
          placeholder="10"
          keyboardType="decimal-pad"
          suffix="acres"
          required
          style={{ marginBottom: 20 }}
        />

        <SectionHeader title="Crop Type" style={{ marginBottom: 16 }} />

        <CardSelector
          options={cropOptions}
          selectedValue={selectedCrop}
          onSelect={(value) => {
            setSelectedCrop(value as CropType);
            setCropVariety('');
            setCustomVariety('');
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
          onPress={() => setShowVarietyPicker(true)}
        >
          <Text
            style={{
              fontSize: fontSize.base,
              color: cropVariety ? colors.surface[900] : colors.surface[400],
              fontWeight: cropVariety ? fontWeight.medium : fontWeight.normal,
            }}
          >
            {cropVariety || 'Select variety'}
          </Text>
          <UISymbol name="chevron.down" size={20} color="#6B7280" />
        </Pressable>

        {cropVariety === 'Custom' && (
          <FormInput
            label="Custom Variety Name"
            value={customVariety}
            onChangeText={setCustomVariety}
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
          onPress={() => setShowDatePicker(true)}
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
            {plantingDate
              ? plantingDate.toLocaleDateString('en-US', {
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
              value={vineSpacing}
              onChangeText={setVineSpacing}
              placeholder="6"
              keyboardType="decimal-pad"
              suffix="ft"
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput
              label="Row Spacing"
              value={rowSpacing}
              onChangeText={setRowSpacing}
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
          value={totalTankCapacity}
          onChangeText={setTotalTankCapacity}
          placeholder="1000"
          keyboardType="decimal-pad"
          suffix="mm"
          style={{ marginBottom: 12 }}
        />

        <FormInput
          label="System Discharge"
          value={systemDischarge}
          onChangeText={setSystemDischarge}
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
          onPress={() => setShowPruningDatePicker(true)}
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
                {dateOfPruning
                  ? dateOfPruning.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Not set'}
              </Text>
            </View>
          </View>
          {dateOfPruning && (
            <Pressable
              onPress={() => setDateOfPruning(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <UISymbol name="xmark.circle.fill" size={24} color="#9CA3AF" />
            </Pressable>
          )}
        </Pressable>

        <InfoCard
          icon="information-circle"
          iconColor="#10B981"
          backgroundColor="#D1FAE5"
          message="You can always update these details later from your farm settings."
        />
      </FullScreenForm>
      {showDatePicker && (
        <DateTimePicker
          value={plantingDate}
          mode="date"
          onChange={(_, date) => {
            setShowDatePicker(false);
            if (date) {
              setPlantingDate(date);
              setPlantingDateChanged(true);
            }
          }}
        />
      )}
      {showPruningDatePicker && (
        <DateTimePicker
          value={dateOfPruning ?? new Date()}
          mode="date"
          onChange={(_, date) => {
            setShowPruningDatePicker(false);
            if (date) setDateOfPruning(date);
          }}
        />
      )}

      {showVarietyPicker && (
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
                onPress={() => setShowVarietyPicker(false)}
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

            <View style={{ maxHeight: 384 }}>
              {varieties.map((variety) => (
                <Pressable
                  key={variety}
                  style={{
                    paddingHorizontal: spacing[6],
                    paddingVertical: spacing[4],
                    borderBottomWidth: 1,
                    borderBottomColor: colors.surface[100],
                    backgroundColor: cropVariety === variety ? colors.surface[50] : colors.white,
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
                        color: cropVariety === variety ? colors.surface[900] : colors.surface[700],
                        fontWeight:
                          cropVariety === variety ? fontWeight.semibold : fontWeight.normal,
                      }}
                    >
                      {variety}
                    </Text>
                    {cropVariety === variety && (
                      <UISymbol name="checkmark" size={20} color={colors.primary[500]} />
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
