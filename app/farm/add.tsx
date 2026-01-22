import React, { useState, useMemo } from 'react';
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
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useCreateFarm } from '@/hooks';
import { CROPS, CROP_VARIETIES, type CropType } from '@/constants/cropVarieties';
import type { FarmInsert } from '@/types';

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Section component for grouping form fields
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

// Form field component
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

  // Section expansion state
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    spacing: false,
    irrigation: false,
    dates: false,
  });

  // Variety picker state
  const [showVarietyPicker, setShowVarietyPicker] = useState(false);
  const [varietySearchText, setVarietySearchText] = useState('');

  // Get varieties for selected crop
  const varieties = useMemo(() => {
    return CROP_VARIETIES[selectedCrop] || ['Custom'];
  }, [selectedCrop]);

  // Filter varieties based on search
  const filteredVarieties = useMemo(() => {
    if (!varietySearchText.trim()) return varieties;
    const query = varietySearchText.toLowerCase();
    return varieties.filter((v) => v.toLowerCase().includes(query));
  }, [varieties, varietySearchText]);

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

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add Farm',
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
          {/* Basic Information */}
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
                <Text className="text-base text-surface-900 ml-3">
                  {plantingDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </FormField>
          </Section>

          {/* Spacing Information */}
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

          {/* Irrigation Information */}
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

          {/* Important Dates */}
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

        {/* Save Button */}
        <View className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-surface-200">
          <TouchableOpacity
            className={`py-4 rounded-xl items-center ${
              isValid && !createFarm.isPending ? 'bg-primary-600' : 'bg-surface-300'
            }`}
            onPress={handleSave}
            disabled={!isValid || createFarm.isPending}
          >
            {createFarm.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-white">Save Farm</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Variety Picker Modal */}
      {showVarietyPicker && (
        <View className="absolute inset-0 bg-black/50 justify-end">
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
                      cropVariety === variety ? 'text-primary-600 font-medium' : 'text-surface-900'
                    }`}
                  >
                    {variety}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
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
