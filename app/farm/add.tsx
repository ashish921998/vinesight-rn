/**
 * Add Farm Screen
 * Redesigned with Airbnb-style UI
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCreateFarm } from '@/hooks';
import { CROP_VARIETIES, type CropType } from '@/constants/cropVarieties';
import type { FarmInsert } from '@/types';
import {
  FullScreenForm,
  SectionHeader,
  CardSelector,
  FormInput,
  InfoCard,
  CropIcon,
} from '@/components/ui';

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AddFarmScreen() {
  const router = useRouter();
  const createFarm = useCreateFarm();

  // Form state - Required
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [area, setArea] = useState('');
  const [selectedCrop, setSelectedCrop] = useState<CropType>('Grapes');
  const [cropVariety, setCropVariety] = useState('');
  const [customVariety, setCustomVariety] = useState('');
  const [plantingDate, setPlantingDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form state - Optional Spacing
  const [vineSpacing, setVineSpacing] = useState('');
  const [rowSpacing, setRowSpacing] = useState('');

  // Form state - Optional Irrigation
  const [totalTankCapacity, setTotalTankCapacity] = useState('');
  const [systemDischarge, setSystemDischarge] = useState('');

  // Form state - Optional Dates
  const [dateOfPruning, setDateOfPruning] = useState<Date | null>(null);
  const [showPruningDatePicker, setShowPruningDatePicker] = useState(false);

  // Variety picker state
  const [showVarietyPicker, setShowVarietyPicker] = useState(false);

  // Get varieties for selected crop
  const varieties = useMemo(() => {
    return CROP_VARIETIES[selectedCrop] || ['Custom'];
  }, [selectedCrop]);

  // Form validation
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
    setName('');
    setRegion('');
    setArea('');
    setSelectedCrop('Grapes');
    setCropVariety('');
    setCustomVariety('');
    setPlantingDate(new Date());
    setVineSpacing('');
    setRowSpacing('');
    setTotalTankCapacity('');
    setSystemDischarge('');
    setDateOfPruning(null);
  };

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    const finalVariety = cropVariety === 'Custom' ? customVariety : cropVariety;

    const farmData: FarmInsert = {
      name: name.trim(),
      region: region.trim(),
      area: parseFloat(area),
      crop: selectedCrop,
      crop_variety: finalVariety,
      planting_date: formatLocalDate(plantingDate),
      vine_spacing: vineSpacing ? parseFloat(vineSpacing) : null,
      row_spacing: rowSpacing ? parseFloat(rowSpacing) : null,
      total_tank_capacity: totalTankCapacity ? parseFloat(totalTankCapacity) : null,
      system_discharge: systemDischarge ? parseFloat(systemDischarge) : null,
      date_of_pruning: dateOfPruning ? formatLocalDate(dateOfPruning) : null,
    };

    try {
      await createFarm.mutateAsync(farmData);
      router.back();
    } catch (_error: unknown) {
      const errorMessage =
        _error instanceof Error ? _error.message : 'Failed to create farm. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  // Crop options with specific icons for card selector
  const cropOptions = [
    {
      value: 'Grapes' as CropType,
      label: 'Grapes',
      sublabel: 'Vines',
      renderIcon: ({ selected, size }) => (
        <CropIcon name="grapes" size={size} muted={!selected} />
      ),
      iconColor: '#DDD6FE',
    },
    {
      value: 'Mango' as CropType,
      label: 'Mango',
      sublabel: 'Trees',
      renderIcon: ({ selected, size }) => (
        <CropIcon name="mango" size={size} muted={!selected} />
      ),
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
      renderIcon: ({ selected, size }) => (
        <CropIcon name="citrus" size={size} muted={!selected} />
      ),
      iconColor: '#FEF08A',
    },
    {
      value: 'Banana' as CropType,
      label: 'Banana',
      sublabel: 'Plants',
      renderIcon: ({ selected, size }) => (
        <CropIcon name="banana" size={size} muted={!selected} />
      ),
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

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
        <FullScreenForm
          title="Add Farm"
          onClose={() => router.back()}
          onSave={handleSave}
          saveLabel="Create Farm"
          isLoading={createFarm.isPending}
          isSaveDisabled={!isValid}
          showResetButton
          onReset={handleReset}
        >
          {/* Farm Details */}
          <SectionHeader title="Farm Details" style={{ marginBottom: 16 }} />

          <FormInput
            label="Farm Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g., Sunset Vineyards"
            required
            autoFocus
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

          {/* Crop Type */}
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

          {/* Variety Selection */}
          <SectionHeader title="Variety" style={{ marginBottom: 16 }} />

          <TouchableOpacity
            className="bg-white border-2 border-surface-200 rounded-xl px-4 py-4 flex-row items-center justify-between mb-5"
            onPress={() => setShowVarietyPicker(true)}
          >
            <Text
              className={`text-base ${cropVariety ? 'text-surface-900 font-medium' : 'text-surface-400'}`}
            >
              {cropVariety || 'Select variety'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#6B7280" />
          </TouchableOpacity>

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

          {/* Planting Date */}
          <SectionHeader title="Planting Date" style={{ marginBottom: 16 }} />

          <TouchableOpacity
            className="bg-white border-2 border-surface-200 rounded-xl px-4 py-4 flex-row items-center mb-5"
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={24} color="#6B7280" />
            <Text className="text-base text-surface-900 font-medium ml-3">
              {plantingDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </TouchableOpacity>

          {/* Optional: Spacing */}
          <SectionHeader title="Plant Spacing (Optional)" style={{ marginBottom: 16 }} />

          <View className="flex-row gap-3 mb-5">
            <View className="flex-1">
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
            <View className="flex-1">
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

          {/* Optional: Irrigation */}
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

          {/* Optional: Pruning Date */}
          <SectionHeader title="Pruning Date (Optional)" style={{ marginBottom: 16 }} />

          <TouchableOpacity
            className="bg-white border-2 border-surface-200 rounded-xl px-4 py-4 flex-row items-center justify-between mb-5"
            onPress={() => setShowPruningDatePicker(true)}
          >
            <View className="flex-row items-center flex-1">
              <Ionicons name="cut-outline" size={24} color="#6B7280" />
              <View className="ml-3 flex-1">
                <Text className="text-sm text-surface-500">Pruning Date</Text>
                <Text className="text-base text-surface-900 font-medium mt-0.5">
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
              <TouchableOpacity
                onPress={() => setDateOfPruning(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* Info Card */}
          <InfoCard
            icon="information-circle"
            iconColor="#10B981"
            backgroundColor="#D1FAE5"
            message="You can always update these details later from your farm settings."
          />
        </FullScreenForm>
      </SafeAreaView>

      {/* Variety Picker Modal */}
      {showVarietyPicker && (
        <View className="absolute inset-0 bg-black/50 justify-end">
          <SafeAreaView edges={['bottom']} className="bg-white rounded-t-3xl max-h-[70%]">
            <View className="flex-row items-center justify-between px-6 py-4 border-b border-surface-100">
              <View className="w-10" />
              <Text className="text-lg font-semibold text-surface-900">Select Variety</Text>
              <TouchableOpacity
                onPress={() => setShowVarietyPicker(false)}
                className="w-10 h-10 rounded-full bg-surface-100 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>

            <View className="max-h-96">
              {varieties.map((variety) => (
                <TouchableOpacity
                  key={variety}
                  className={`px-6 py-4 border-b border-surface-100 ${
                    cropVariety === variety ? 'bg-surface-50' : ''
                  }`}
                  onPress={() => handleSelectVariety(variety)}
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`text-base ${
                        cropVariety === variety
                          ? 'text-surface-900 font-semibold'
                          : 'text-surface-700'
                      }`}
                    >
                      {variety}
                    </Text>
                    {cropVariety === variety && (
                      <View className="w-6 h-6 rounded-full bg-surface-900 items-center justify-center">
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </SafeAreaView>
        </View>
      )}

      {/* Date Pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={plantingDate}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowDatePicker(false);
            if (date) setPlantingDate(date);
          }}
        />
      )}

      {showPruningDatePicker && (
        <DateTimePicker
          value={dateOfPruning || new Date()}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowPruningDatePicker(false);
            if (date) setDateOfPruning(date);
          }}
        />
      )}
    </>
  );
}
