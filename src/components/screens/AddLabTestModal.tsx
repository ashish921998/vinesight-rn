/**
 * Add Lab Test Modal
 * Modal for adding soil or petiole test records
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
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  useCreateSoilTest,
  useCreatePetioleTest,
  SOIL_PARAMETERS,
  PETIOLE_PARAMETERS,
} from '../../hooks/useLabTests';

interface AddLabTestModalProps {
  visible: boolean;
  onClose: () => void;
  farmId: number;
  testType: 'soil' | 'petiole';
}

export default function AddLabTestModal({
  visible,
  onClose,
  farmId,
  testType,
}: AddLabTestModalProps) {
  const createSoilTest = useCreateSoilTest();
  const createPetioleTest = useCreatePetioleTest();

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [recommendations, setRecommendations] = useState('');
  const [notes, setNotes] = useState('');

  const isSoil = testType === 'soil';
  const parameterList = isSoil ? SOIL_PARAMETERS : PETIOLE_PARAMETERS;
  const isLoading = createSoilTest.isPending || createPetioleTest.isPending;

  const resetForm = () => {
    setDate(new Date());
    setParameters({});
    setRecommendations('');
    setNotes('');
  };

  const handleSubmit = async () => {
    // Convert string parameters to numbers
    const numericParams: Record<string, number> = {};
    Object.entries(parameters).forEach(([key, value]) => {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        numericParams[key] = num;
      }
    });

    if (Object.keys(numericParams).length === 0) {
      Alert.alert('Error', 'Please enter at least one parameter value');
      return;
    }

    try {
      const record = {
        farm_id: farmId,
        date: date.toISOString().split('T')[0],
        parameters: numericParams,
        recommendations: recommendations || null,
        notes: notes || null,
      };

      if (isSoil) {
        await createSoilTest.mutateAsync(record);
      } else {
        await createPetioleTest.mutateAsync(record);
      }

      resetForm();
      onClose();
    } catch (error) {
      console.error('Error creating lab test:', error);
      Alert.alert('Error', 'Failed to save lab test');
    }
  };

  const handleDateChange = (_: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const updateParameter = (key: string, value: string) => {
    setParameters((prev) => ({
      ...prev,
      [key]: value,
    }));
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
          <Text className="text-lg font-bold text-gray-800">
            Add {isSoil ? 'Soil' : 'Petiole'} Test
          </Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isLoading}>
            <Text
              className={`text-base font-semibold ${
                isLoading ? 'text-gray-400' : 'text-green-600'
              }`}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {/* Date Picker */}
          <View className="bg-white rounded-xl p-4 mt-4 shadow-sm">
            <Text className="text-sm font-medium text-gray-500 mb-2">Test Date</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="flex-row items-center justify-between bg-gray-50 p-3 rounded-lg"
            >
              <View className="flex-row items-center">
                <Ionicons name="calendar" size={20} color="#666" />
                <Text className="text-base text-gray-800 ml-2">
                  {date.toLocaleDateString()}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>

          {/* Parameters */}
          <View className="bg-white rounded-xl p-4 mt-4 shadow-sm">
            <Text className="text-sm font-medium text-gray-500 mb-3">
              Test Parameters
            </Text>
            <Text className="text-xs text-gray-400 mb-4">
              Enter values for the parameters you have. Leave empty for unknown values.
            </Text>

            <View className="flex-row flex-wrap gap-3">
              {parameterList.map((param) => (
                <View key={param.key} className="w-[48%]">
                  <Text className="text-xs text-gray-500 mb-1">
                    {param.label} {param.unit && `(${param.unit})`}
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800"
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                    value={parameters[param.key] || ''}
                    onChangeText={(value) => updateParameter(param.key, value)}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Recommendations */}
          <View className="bg-white rounded-xl p-4 mt-4 shadow-sm">
            <Text className="text-sm font-medium text-gray-500 mb-2">
              Recommendations (Optional)
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-gray-800 min-h-[80px]"
              placeholder="Enter lab recommendations..."
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              value={recommendations}
              onChangeText={setRecommendations}
            />
          </View>

          {/* Notes */}
          <View className="bg-white rounded-xl p-4 mt-4 mb-8 shadow-sm">
            <Text className="text-sm font-medium text-gray-500 mb-2">
              Notes (Optional)
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-gray-800 min-h-[60px]"
              placeholder="Add any additional notes..."
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
