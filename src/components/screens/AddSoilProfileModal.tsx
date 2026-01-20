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
import { Ionicons } from '@expo/vector-icons';
import {
  useCreateSoilProfile,
  SECTION_NAMES,
  SECTION_INFO,
} from '../../hooks/useSoilProfiles';
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

  const isLoading = createProfile.isPending;

  const resetForm = () => {
    setSections({ left: '', center: '', right: '', down: '' });
    setFusariumPct('');
    setEcValues({ left: '', center: '', right: '', down: '' });
  };

  const handleSubmit = async () => {
    // Validate at least one section has moisture value
    const filledSections = Object.entries(sections).filter(
      ([, value]) => value.trim() !== ''
    );

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
      });

      resetForm();
      onClose();
    } catch (error) {
      console.error('Error creating soil profile:', error);
      Alert.alert('Error', 'Failed to save soil profile');
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
        className="flex-1 bg-gray-50"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
          <TouchableOpacity onPress={onClose}>
            <Text className="text-gray-600 text-base">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-800">Add Soil Profile</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isLoading}>
            <Text
              className={`text-base font-semibold ${
                isLoading ? 'text-gray-400' : 'text-indigo-600'
              }`}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {/* Section Moisture Inputs */}
          <View className="bg-white rounded-xl p-4 mt-4 shadow-sm">
            <Text className="text-sm font-medium text-gray-500 mb-1">
              Moisture Readings (%)
            </Text>
            <Text className="text-xs text-gray-400 mb-4">
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
                        style={{ backgroundColor: `${info.color}20` }}
                      >
                        <Text
                          className="text-xs font-bold"
                          style={{ color: info.color }}
                        >
                          {info.abbr}
                        </Text>
                      </View>
                      <Text className="text-sm text-gray-700">{info.label}</Text>
                    </View>
                    <TextInput
                      className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-gray-800"
                      placeholder="0.0"
                      placeholderTextColor="#9ca3af"
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
          <View className="bg-white rounded-xl p-4 mt-4 shadow-sm">
            <Text className="text-sm font-medium text-gray-500 mb-1">
              EC Values (dS/m) - Optional
            </Text>
            <Text className="text-xs text-gray-400 mb-4">
              Electrical conductivity readings for each section.
            </Text>

            <View className="flex-row flex-wrap gap-3">
              {SECTION_NAMES.map((name) => {
                const info = SECTION_INFO[name];
                return (
                  <View key={`ec-${name}`} className="w-[48%]">
                    <Text className="text-xs text-gray-500 mb-1">
                      {info.label} EC
                    </Text>
                    <TextInput
                      className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800"
                      placeholder="0.0"
                      placeholderTextColor="#9ca3af"
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
          <View className="bg-white rounded-xl p-4 mt-4 mb-8 shadow-sm">
            <Text className="text-sm font-medium text-gray-500 mb-1">
              Fusarium (%) - Optional
            </Text>
            <Text className="text-xs text-gray-400 mb-3">
              Fusarium wilt percentage if applicable.
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-gray-800"
              placeholder="0.0"
              placeholderTextColor="#9ca3af"
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
