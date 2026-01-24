/**
 * Add Soil Profile Modal
 * Modal for adding soil moisture profile with section measurements
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useCreateSoilProfile, SECTION_NAMES, SECTION_INFO } from '../../hooks/useSoilProfiles';
import { SoilSectionData } from '../../types/database';

interface AddSoilProfileModalProps {
  visible: boolean;
  onClose: () => void;
  farmId: number;
}

export default function AddSoilProfileModal({
  visible,
  onClose,
  farmId,
}: AddSoilProfileModalProps) {
  const createProfile = useCreateSoilProfile();

  const [sections, setSections] = useState<Record<string, string>>({
    left: '',
    center: '',
    right: '',
    down: '',
  });
  const [fusariumPct, setFusariumPct] = useState('');
  const [ecValues, setEcValues] = useState<Record<string, string>>({
    left: '',
    center: '',
    right: '',
    down: '',
  });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const isLoading = createProfile.isPending;

  const resetForm = () => {
    setSections({ left: '', center: '', right: '', down: '' });
    setFusariumPct('');
    setEcValues({ left: '', center: '', right: '', down: '' });
    setSelectedDate(new Date());
    setShowDatePicker(false);
  };

  const handleSubmit = async () => {
    // Validate at least one section has moisture value
    const filledSections = Object.entries(sections).filter(([, value]) => value.trim() !== '');

    if (filledSections.length === 0) {
      Alert.alert('Error', 'Please enter at least one moisture value');
      return;
    }

    try {
      // Build sections array
      const sectionData: SoilSectionData[] = filledSections.map(([name, value]) => ({
        name,
        moisture_pct_user: parseFloat(value) || 0,
        ec_ds_m: ecValues[name] ? parseFloat(ecValues[name]) : undefined,
      }));

      await createProfile.mutateAsync({
        farm_id: farmId,
        sections: sectionData,
        fusarium_pct: fusariumPct ? parseFloat(fusariumPct) : null,
        created_at: selectedDate.toISOString(),
      });

      resetForm();
      onClose();
    } catch (error) {
      console.error('Error creating soil profile:', error);
      Alert.alert('Error', 'Failed to save soil profile');
    }
  };

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (date) {
      setSelectedDate(date);
    }
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
  };

  const updateSection = (name: string, value: string) => {
    setSections((prev) => ({ ...prev, [name]: value }));
  };

  const updateEc = (name: string, value: string) => {
    setEcValues((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        style={{ backgroundColor: '#f2f2f7' }}
      >
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-4 py-4"
          style={{
            backgroundColor: 'rgba(255,255,255, 0.8)',
            borderBottomWidth: 0.5,
            borderBottomColor: 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <TouchableOpacity onPress={onClose}>
            <Text className="text-[#8e8e93] text-base">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-[#1c1c1e]">Add Soil Profile</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isLoading}>
            <Text
              className={`text-base font-semibold ${
                isLoading ? 'text-[#c7c7cc]' : 'text-[#408059]'
              }`}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {/* Date Picker */}
          <View
            className="rounded-2xl p-4 mt-4"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
            }}
          >
            <Text className="text-sm font-semibold text-[#8e8e93] mb-1">Profile Date</Text>
            <Text className="text-xs text-[#8e8e93] mb-3">
              Select the date when this soil profile was taken.
            </Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="bg-[#f9f9f9] border border-[#e5e5e5] rounded-xl px-4 py-3 flex-row items-center justify-between"
            >
              <Text className="text-base text-[#1c1c1e]">
                {selectedDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              <Ionicons name="calendar" size={20} color="#8e8e93" />
            </TouchableOpacity>
          </View>

          {/* Date Picker Modal */}
          <Modal
            visible={showDatePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View className="flex-1 bg-black/30 items-center justify-center">
              <View
                className="bg-white rounded-2xl p-4"
                style={{
                  width: '85%',
                }}
              >
                <Text className="text-lg font-bold text-[#1c1c1e] mb-4 text-center">
                  Select Profile Date
                </Text>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  style={{ width: '100%' }}
                />
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  className="mt-4 py-3 rounded-xl items-center"
                  style={{ backgroundColor: '#408059' }}
                >
                  <Text className="font-semibold text-white">Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Section Moisture Inputs */}
          <View
            className="rounded-2xl p-4 mt-4"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
            }}
          >
            <Text className="text-sm font-semibold text-[#8e8e93] mb-1">Moisture Readings (%)</Text>
            <Text className="text-xs text-[#8e8e93] mb-4">
              Enter soil moisture percentage for each section. At least one is required.
            </Text>

            <View className="flex-row flex-wrap gap-3">
              {SECTION_NAMES.map((name) => {
                const info = SECTION_INFO[name];
                return (
                  <View key={name} className="w-[48%]">
                    <View className="flex-row items-center mb-1">
                      <View
                        className="w-6 h-6 rounded-full items-center justify-center mr-2"
                        style={{ backgroundColor: 'rgba(64, 128, 89, 0.2)' }}
                      >
                        <Text className="text-xs font-bold" style={{ color: '#408059' }}>
                          {info.abbr}
                        </Text>
                      </View>
                      <Text className="text-sm text-[#1c1c1e]">{info.label}</Text>
                    </View>
                    <TextInput
                      className="bg-[#f9f9f9] border border-[#e5e5e5] rounded-xl px-3 py-3 text-[#1c1c1e]"
                      placeholder="0.0"
                      placeholderTextColor="#c7c7cc"
                      keyboardType="decimal-pad"
                      value={sections[name]}
                      onChangeText={(value) => updateSection(name, value)}
                    />
                  </View>
                );
              })}
            </View>
          </View>

          {/* EC Values (Optional) */}
          <View
            className="rounded-2xl p-4 mt-4"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
            }}
          >
            <Text className="text-sm font-semibold text-[#8e8e93] mb-1">
              EC Values (dS/m) - Optional
            </Text>
            <Text className="text-xs text-[#8e8e93] mb-4">
              Electrical conductivity readings for each section.
            </Text>

            <View className="flex-row flex-wrap gap-3">
              {SECTION_NAMES.map((name) => {
                const info = SECTION_INFO[name];
                return (
                  <View key={`ec-${name}`} className="w-[48%]">
                    <Text className="text-xs text-[#8e8e93] mb-1">{info.label} EC</Text>
                    <TextInput
                      className="bg-[#f9f9f9] border border-[#e5e5e5] rounded-xl px-3 py-2 text-[#1c1c1e]"
                      placeholder="0.0"
                      placeholderTextColor="#c7c7cc"
                      keyboardType="decimal-pad"
                      value={ecValues[name]}
                      onChangeText={(value) => updateEc(name, value)}
                    />
                  </View>
                );
              })}
            </View>
          </View>

          {/* Fusarium Percentage (Optional) */}
          <View
            className="rounded-2xl p-4 mt-4 mb-8"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
            }}
          >
            <Text className="text-sm font-semibold text-[#8e8e93] mb-1">
              Fusarium (%) - Optional
            </Text>
            <Text className="text-xs text-[#8e8e93] mb-3">
              Fusarium wilt percentage if applicable.
            </Text>
            <TextInput
              className="bg-[#f9f9f9] border border-[#e5e5e5] rounded-xl px-3 py-3 text-[#1c1c1e]"
              placeholder="0.0"
              placeholderTextColor="#c7c7cc"
              keyboardType="decimal-pad"
              value={fusariumPct}
              onChangeText={setFusariumPct}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
