import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFarm, useUpdateFarm } from '@/hooks';
import { CROPS, CROP_VARIETIES, type CropType } from '@/constants/cropVarieties';
import type { FarmUpdate } from '@/types';

function Section({
  title,
  children,
  isExpanded = true,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  isExpanded?: boolean;
  onToggle?: () => void;
}) {
  return (
    <View className="bg-white rounded-2xl mb-4 overflow-hidden">
      <TouchableOpacity
        className="flex-row items-center justify-between p-4 border-b border-surface-100"
        onPress={onToggle}
        activeOpacity={onToggle ? 0.7 : 1}
      >
        <Text className="text-base font-semibold text-surface-900">{title}</Text>
        {onToggle && (
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
        )}
      </TouchableOpacity>
      {isExpanded && <View className="p-4">{children}</View>}
    </View>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-surface-700 mb-1.5">
        {label}
        {required && <Text className="text-red-500"> *</Text>}
      </Text>
      {children}
    </View>
  );
}

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function EditFarmScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const farmId = id ? parseInt(id, 10) : undefined;
  const { data: farm, isLoading: farmLoading } = useFarm(farmId);
  const updateFarm = useUpdateFarm();

  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [area, setArea] = useState('');
  const [selectedCrop, setSelectedCrop] = useState<CropType>('Grapes');
  const [cropVariety, setCropVariety] = useState('');
  const [customVariety, setCustomVariety] = useState('');
  const [plantingDate, setPlantingDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [vineSpacing, setVineSpacing] = useState('');
  const [rowSpacing, setRowSpacing] = useState('');

  const [totalTankCapacity, setTotalTankCapacity] = useState('');
  const [systemDischarge, setSystemDischarge] = useState('');

  const [dateOfPruning, setDateOfPruning] = useState<Date | null>(null);
  const [showPruningDatePicker, setShowPruningDatePicker] = useState(false);

  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    spacing: false,
    irrigation: false,
    dates: false,
  });

  const [showVarietyPicker, setShowVarietyPicker] = useState(false);
  const [varietySearchText, setVarietySearchText] = useState('');

  // Track previous farm ID and updated_at to detect when farm data changes
  const prevFarmIdRef = useRef<number | undefined>(undefined);
  const prevUpdatedAtRef = useRef<string | null | undefined>(undefined);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Update form when we get a new farm (different ID) or when farm data is updated
    if (
      farm &&
      (farm.id !== prevFarmIdRef.current || farm.updated_at !== prevUpdatedAtRef.current)
    ) {
      setName(farm.name || '');
      setRegion(farm.region || '');
      setArea(farm.area?.toString() || '');
      setSelectedCrop((farm.crop as CropType) || 'Grapes');
      setCropVariety(farm.crop_variety || '');
      if (farm.planting_date) {
        setPlantingDate(new Date(farm.planting_date));
      }
      setVineSpacing(farm.vine_spacing?.toString() || '');
      setRowSpacing(farm.row_spacing?.toString() || '');
      setTotalTankCapacity(farm.total_tank_capacity?.toString() || '');
      setSystemDischarge(farm.system_discharge?.toString() || '');
      if (farm.date_of_pruning) {
        setDateOfPruning(new Date(farm.date_of_pruning));
      }
      prevFarmIdRef.current = farm.id;
      prevUpdatedAtRef.current = farm.updated_at;
    }
  }, [farm]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const varieties = useMemo(() => {
    return CROP_VARIETIES[selectedCrop] || ['Custom'];
  }, [selectedCrop]);

  const filteredVarieties = useMemo(() => {
    if (!varietySearchText.trim()) return varieties;
    const query = varietySearchText.toLowerCase();
    return varieties.filter((v) => v.toLowerCase().includes(query));
  }, [varieties, varietySearchText]);

  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    if (!region.trim()) return false;
    const parsedArea = parseFloat(area);
    if (!Number.isFinite(parsedArea) || parsedArea <= 0) return false;
    if (cropVariety === 'Custom' && !customVariety.trim()) return false;
    if (!cropVariety && !customVariety.trim()) return false;
    return true;
  }, [name, region, area, cropVariety, customVariety]);

  const handleToggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleSelectVariety = (variety: string) => {
    setCropVariety(variety);
    setShowVarietyPicker(false);
    setVarietySearchText('');
    if (variety === 'Custom') {
      setCustomVariety('');
    }
  };

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }
    if (!farmId) {
      Alert.alert('Error', 'Invalid farm ID');
      return;
    }

    const finalVariety = cropVariety === 'Custom' ? customVariety : cropVariety;

    const farmData: FarmUpdate = {
      name: name.trim(),
      region: region.trim(),
      area: parseFloat(area),
      crop: selectedCrop,
      crop_variety: finalVariety,
      planting_date: plantingDate ? formatLocalDate(plantingDate) : undefined,
      vine_spacing: vineSpacing ? parseFloat(vineSpacing) : null,
      row_spacing: rowSpacing ? parseFloat(rowSpacing) : null,
      total_tank_capacity: totalTankCapacity ? parseFloat(totalTankCapacity) : null,
      system_discharge: systemDischarge ? parseFloat(systemDischarge) : null,
      date_of_pruning: dateOfPruning ? formatLocalDate(dateOfPruning) : null,
    };

    try {
      await updateFarm.mutateAsync({ id: farmId, updates: farmData });
      router.back();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update farm. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  if (farmLoading) {
    return (
      <View className="flex-1 bg-surface-50 justify-center items-center">
        <ActivityIndicator size="large" color="#408059" />
        <Text className="text-surface-500 mt-4">Loading farm...</Text>
      </View>
    );
  }

  if (!farm) {
    return (
      <View className="flex-1 bg-surface-50 justify-center items-center px-8">
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text className="text-xl font-bold text-surface-900 mt-4">Farm Not Found</Text>
        <Text className="text-surface-500 text-center mt-2">
          The farm you&apos;re looking for doesn&apos;t exist or has been deleted.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 bg-primary-500 px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Farm',
          headerStyle: { backgroundColor: '#F9FAFB' },
          headerTintColor: '#111827',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 bg-surface-50"
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <Section title="Basic Information" isExpanded={expandedSections.basic}>
            <FormField label="Farm Name" required>
              <TextInput
                className="bg-surface-50 rounded-xl px-4 py-3 text-base text-surface-900 border border-surface-200"
                placeholder="Enter farm name"
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={setName}
              />
            </FormField>

            <FormField label="Region / Location" required>
              <TextInput
                className="bg-surface-50 rounded-xl px-4 py-3 text-base text-surface-900 border border-surface-200"
                placeholder="Enter region or location"
                placeholderTextColor="#9CA3AF"
                value={region}
                onChangeText={setRegion}
              />
            </FormField>

            <FormField label="Area (acres)" required>
              <TextInput
                className="bg-surface-50 rounded-xl px-4 py-3 text-base text-surface-900 border border-surface-200"
                placeholder="Enter area in acres"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={area}
                onChangeText={setArea}
              />
            </FormField>

            <FormField label="Crop Type" required>
              <View className="flex-row flex-wrap gap-2">
                {CROPS.map((crop) => (
                  <TouchableOpacity
                    key={crop}
                    className={`px-4 py-2.5 rounded-xl border ${
                      selectedCrop === crop
                        ? 'bg-primary-500 border-primary-500'
                        : 'bg-white border-surface-200'
                    }`}
                    onPress={() => {
                      setSelectedCrop(crop);
                      setCropVariety('');
                      setCustomVariety('');
                    }}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        selectedCrop === crop ? 'text-white' : 'text-surface-700'
                      }`}
                    >
                      {crop}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FormField>

            <FormField label="Variety" required>
              <TouchableOpacity
                className="bg-surface-50 rounded-xl px-4 py-3 border border-surface-200 flex-row items-center justify-between"
                onPress={() => setShowVarietyPicker(true)}
              >
                <Text
                  className={`text-base ${cropVariety ? 'text-surface-900' : 'text-surface-400'}`}
                >
                  {cropVariety || 'Select variety'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>

              {cropVariety === 'Custom' && (
                <TextInput
                  className="bg-surface-50 rounded-xl px-4 py-3 text-base text-surface-900 border border-surface-200 mt-3"
                  placeholder="Enter custom variety name"
                  placeholderTextColor="#9CA3AF"
                  value={customVariety}
                  onChangeText={setCustomVariety}
                />
              )}
            </FormField>

            <FormField label="Planting Date">
              <TouchableOpacity
                className="bg-surface-50 rounded-xl px-4 py-3 border border-surface-200 flex-row items-center"
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                <Text
                  className={`text-base ml-3 ${plantingDate ? 'text-surface-900' : 'text-surface-400'}`}
                >
                  {plantingDate ? plantingDate.toLocaleDateString() : 'Select date'}
                </Text>
              </TouchableOpacity>
            </FormField>
          </Section>

          <Section
            title="Spacing (Optional)"
            isExpanded={expandedSections.spacing}
            onToggle={() => handleToggleSection('spacing')}
          >
            <FormField label="Vine Spacing (feet)">
              <TextInput
                className="bg-surface-50 rounded-xl px-4 py-3 text-base text-surface-900 border border-surface-200"
                placeholder="Distance between vines"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={vineSpacing}
                onChangeText={setVineSpacing}
              />
            </FormField>

            <FormField label="Row Spacing (feet)">
              <TextInput
                className="bg-surface-50 rounded-xl px-4 py-3 text-base text-surface-900 border border-surface-200"
                placeholder="Distance between rows"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={rowSpacing}
                onChangeText={setRowSpacing}
              />
            </FormField>
          </Section>

          <Section
            title="Irrigation (Optional)"
            isExpanded={expandedSections.irrigation}
            onToggle={() => handleToggleSection('irrigation')}
          >
            <FormField label="Total Tank Capacity (mm)">
              <TextInput
                className="bg-surface-50 rounded-xl px-4 py-3 text-base text-surface-900 border border-surface-200"
                placeholder="Available water storage capacity"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={totalTankCapacity}
                onChangeText={setTotalTankCapacity}
              />
            </FormField>

            <FormField label="System Discharge (mm/hr)">
              <TextInput
                className="bg-surface-50 rounded-xl px-4 py-3 text-base text-surface-900 border border-surface-200"
                placeholder="Irrigation system discharge rate"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={systemDischarge}
                onChangeText={setSystemDischarge}
              />
            </FormField>
          </Section>

          <Section
            title="Important Dates (Optional)"
            isExpanded={expandedSections.dates}
            onToggle={() => handleToggleSection('dates')}
          >
            <FormField label="Date of Pruning">
              <TouchableOpacity
                className="bg-surface-50 rounded-xl px-4 py-3 border border-surface-200 flex-row items-center justify-between"
                onPress={() => setShowPruningDatePicker(true)}
              >
                <View className="flex-row items-center">
                  <Ionicons name="cut-outline" size={20} color="#6B7280" />
                  <Text
                    className={`text-base ml-3 ${
                      dateOfPruning ? 'text-surface-900' : 'text-surface-400'
                    }`}
                  >
                    {dateOfPruning ? dateOfPruning.toLocaleDateString() : 'Select date'}
                  </Text>
                </View>
                {dateOfPruning && (
                  <TouchableOpacity
                    onPress={() => setDateOfPruning(null)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </FormField>
          </Section>
        </ScrollView>

        <View className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-surface-200">
          <TouchableOpacity
            className={`py-4 rounded-xl items-center ${
              isValid && !updateFarm.isPending ? 'bg-primary-600' : 'bg-surface-300'
            }`}
            onPress={handleSave}
            disabled={!isValid || updateFarm.isPending}
          >
            {updateFarm.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-white">Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {showVarietyPicker && (
        <TouchableOpacity
          className="absolute inset-0 bg-black/50 justify-end"
          activeOpacity={1}
          onPress={() => setShowVarietyPicker(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View className="bg-white rounded-t-3xl max-h-[70%]">
              <View className="flex-row items-center justify-between p-4 border-b border-surface-200">
                <Text className="text-lg font-semibold text-surface-900">Select Variety</Text>
                <TouchableOpacity onPress={() => setShowVarietyPicker(false)}>
                  <Ionicons name="close" size={24} color="#111827" />
                </TouchableOpacity>
              </View>

              <View className="px-4 py-3 border-b border-surface-100">
                <View className="flex-row items-center bg-surface-50 rounded-xl px-4 py-2.5">
                  <Ionicons name="search" size={20} color="#9CA3AF" />
                  <TextInput
                    className="flex-1 ml-2 text-base text-surface-900"
                    placeholder="Search varieties..."
                    placeholderTextColor="#9CA3AF"
                    value={varietySearchText}
                    onChangeText={setVarietySearchText}
                  />
                </View>
              </View>

              <ScrollView className="max-h-80">
                {filteredVarieties.map((variety) => (
                  <TouchableOpacity
                    key={variety}
                    className={`px-4 py-3.5 border-b border-surface-100 ${
                      cropVariety === variety ? 'bg-primary-50' : ''
                    }`}
                    onPress={() => handleSelectVariety(variety)}
                  >
                    <Text
                      className={`text-base ${
                        cropVariety === variety
                          ? 'text-primary-600 font-medium'
                          : 'text-surface-900'
                      }`}
                    >
                      {variety}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {showDatePicker && (
        <DateTimePicker
          value={plantingDate || new Date()}
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
