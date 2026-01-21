/**
 * Water Level Modal
 * Modal for updating soil water level with ET0 and growth stage
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Farm } from '@/types';
import { useUpdateFarmWaterLevel } from '@/hooks';
import { WATER_GROWTH_STAGES } from '@/constants/calculatorModels';
import type { WaterGrowthStage } from '@/constants/calculatorModels';

interface WaterLevelModalProps {
  visible: boolean;
  onClose: () => void;
  farm: Farm;
}

export function WaterLevelModal({ visible, onClose, farm }: WaterLevelModalProps) {
  const [manualWaterLevel, setManualWaterLevel] = useState('');
  const [useManual, setUseManual] = useState(false);
  const [eto, setEto] = useState('');
  const [selectedGrowthStage, setSelectedGrowthStage] = useState<WaterGrowthStage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showGrowthStagePicker, setShowGrowthStagePicker] = useState(false);
  const [calculatedWaterLevel, setCalculatedWaterLevel] = useState<number | null>(null);

  const updateWaterLevel = useUpdateFarmWaterLevel();

  const handleCalculate = () => {
    if (useManual) {
      const manualValue = parseFloat(manualWaterLevel);
      if (isNaN(manualValue) || manualValue < 0) {
        Alert.alert('Invalid Input', 'Please enter a valid water level in mm');
        return;
      }
      setCalculatedWaterLevel(manualValue);
    } else {
      const etoValue = parseFloat(eto);
      if (isNaN(etoValue) || etoValue < 0) {
        Alert.alert('Invalid Input', 'Please enter a valid ET0 value');
        return;
      }
      if (!selectedGrowthStage) {
        Alert.alert('Missing Selection', 'Please select a growth stage');
        return;
      }

      const currentWater = farm.remaining_water ?? 0;
      const kc = selectedGrowthStage.kc;
      const etc = etoValue * kc;

      setCalculatedWaterLevel(currentWater - etc);
    }
  };

  const handleSave = async () => {
    if (!farm.id) return;

    if (calculatedWaterLevel === null) {
      Alert.alert('Calculate First', 'Please calculate the water level first');
      return;
    }

    setIsSaving(true);
    try {
      await updateWaterLevel.mutateAsync({
        farmId: farm.id,
        remainingWater: calculatedWaterLevel,
      });
      Alert.alert('Success', `Water level updated to ${calculatedWaterLevel.toFixed(1)} mm`);
      onClose();
      setManualWaterLevel('');
      setEto('');
      setSelectedGrowthStage(null);
      setCalculatedWaterLevel(null);
      setUseManual(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update water level');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setManualWaterLevel('');
    setEto('');
    setSelectedGrowthStage(null);
    setShowGrowthStagePicker(false);
    setCalculatedWaterLevel(null);
    setUseManual(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-[#f2f2f7]">
        {/* Header */}
        <View className="bg-white px-4 py-4 border-b border-gray-200">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={handleClose} className="p-2">
              <Ionicons name="close" size={24} color="#8e8e93" />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-[#1c1c1e]">Update Soil Water Level</Text>
            <TouchableOpacity
              onPress={handleCalculate}
              className="p-2"
            >
              <Text className="font-semibold text-[#408059]">Calculate</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Current Water Level */}
          <View
            className="rounded-2xl p-4 mb-4"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            <Text className="text-xs font-semibold text-[#8e8e93] mb-1">
              CURRENT WATER LEVEL
            </Text>
            <View className="flex-row items-baseline">
              <Text className="text-3xl font-bold text-[#1c1c1e]">
                {farm.remaining_water?.toFixed(1) || '--'}
              </Text>
              <Text className="text-lg text-[#8e8e93] ml-1">mm</Text>
            </View>
          </View>

          {/* Calculated Water Level */}
          {calculatedWaterLevel !== null && (
            <View
              className="rounded-2xl p-4 mb-4"
              style={{
                backgroundColor: '#408059',
                shadowColor: '#408059',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 3,
              }}
            >
              <Text className="text-xs font-semibold text-white/80 mb-1">
                NEW WATER LEVEL
              </Text>
              <View className="flex-row items-baseline">
                <Text className="text-3xl font-bold text-white">
                  {calculatedWaterLevel.toFixed(1)}
                </Text>
                <Text className="text-lg text-white/80 ml-1">mm</Text>
              </View>
              <View className="mt-2 flex-row items-center">
                <Ionicons name="trending-down" size={16} color="white" />
                <Text className="text-sm text-white ml-1">
                  Change: {((farm.remaining_water ?? 0) - calculatedWaterLevel).toFixed(1)} mm
                </Text>
              </View>
            </View>
          )}

          {/* Calculation Method Toggle */}
          <View
            className="rounded-2xl overflow-hidden mb-4"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            <TouchableOpacity
              onPress={() => setUseManual(false)}
              className={`flex-row items-center justify-between px-4 py-4 ${!useManual ? 'bg-[#408059]/10' : ''}`}
            >
              <View className="flex-1">
                <Text className={`text-sm font-semibold ${!useManual ? 'text-[#408059]' : 'text-[#1c1c1e]'}`}>
                  Calculate with ET0
                </Text>
                <Text className="text-xs text-[#8e8e93] mt-1">
                  Enter ET0 and select growth stage to calculate
                </Text>
              </View>
              <View
                className={`w-6 h-6 rounded-full items-center justify-center border-2 ${
                  !useManual ? 'border-[#408059] bg-[#408059]' : 'border-[#c7c7cc]'
                }`}
              >
                {!useManual && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
            </TouchableOpacity>
            <View className="h-px bg-gray-200" />
            <TouchableOpacity
              onPress={() => setUseManual(true)}
              className={`flex-row items-center justify-between px-4 py-4 ${useManual ? 'bg-[#408059]/10' : ''}`}
            >
              <View className="flex-1">
                <Text className={`text-sm font-semibold ${useManual ? 'text-[#408059]' : 'text-[#1c1c1e]'}`}>
                  Manual Entry
                </Text>
                <Text className="text-xs text-[#8e8e93] mt-1">
                  Set the soil water level directly
                </Text>
              </View>
              <View
                className={`w-6 h-6 rounded-full items-center justify-center border-2 ${
                  useManual ? 'border-[#408059] bg-[#408059]' : 'border-[#c7c7cc]'
                }`}
              >
                {useManual && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
            </TouchableOpacity>
          </View>

          {/* ET0 Calculation Form */}
          {!useManual && (
            <View
              className="rounded-2xl p-4 mb-4"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
                elevation: 3,
              }}
            >
              <Text className="text-sm font-semibold text-[#1c1c1e] mb-3">ET0 (Reference Evapotranspiration)</Text>
              <View className="flex-row items-center bg-[#f9f9f9] rounded-xl px-4 py-3">
                <TextInput
                  className="flex-1 text-base text-[#1c1c1e]"
                  placeholder="Enter ET0 value"
                  value={eto}
                  onChangeText={setEto}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#c7c7cc"
                />
                <Text className="text-sm text-[#8e8e93] ml-2">mm/day</Text>
              </View>

              <Text className="text-sm font-semibold text-[#1c1c1e] mt-4 mb-3">Growth Stage</Text>
              <TouchableOpacity
                onPress={() => setShowGrowthStagePicker(true)}
                className="flex-row items-center justify-between bg-[#f9f9f9] rounded-xl px-4 py-3"
              >
                <Text className={`text-base ${selectedGrowthStage ? 'text-[#1c1c1e]' : 'text-[#c7c7cc]'}`}>
                  {selectedGrowthStage ? `${selectedGrowthStage.label} (Kc: ${selectedGrowthStage.kc.toFixed(2)})` : 'Select growth stage'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#8e8e93" />
              </TouchableOpacity>
            </View>
          )}

          {/* Manual Entry Form */}
          {useManual && (
            <View
              className="rounded-2xl p-4 mb-4"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
                elevation: 3,
              }}
            >
              <Text className="text-sm font-semibold text-[#1c1c1e] mb-3">Soil Water Level (mm)</Text>
              <View className="flex-row items-center bg-[#f9f9f9] rounded-xl px-4 py-3">
                <TextInput
                  className="flex-1 text-base text-[#1c1c1e]"
                  placeholder="Enter water level"
                  value={manualWaterLevel}
                  onChangeText={setManualWaterLevel}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#c7c7cc"
                />
                <Text className="text-sm text-[#8e8e93] ml-2">mm</Text>
              </View>
            </View>
          )}

          {/* Info Box */}
          <View
            className="rounded-2xl p-4"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            <View className="flex-row items-start">
              <Ionicons name="information-circle" size={20} color="#408059" />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-[#1c1c1e] mb-1">
                  About Soil Water Levels
                </Text>
                <Text className="text-xs text-[#8e8e93] leading-5">
                  Critical: &lt;6mm | Low: 6-10mm | Medium: 10-25mm | Good: &gt;25mm
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View className="bg-white px-4 py-4 border-t border-gray-200">
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving || calculatedWaterLevel === null}
            className={`py-4 rounded-xl items-center ${
              isSaving || calculatedWaterLevel === null ? 'bg-gray-300' : 'bg-[#408059]'
            }`}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="font-semibold text-white">Save Water Level</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Growth Stage Picker Modal */}
        <Modal
          visible={showGrowthStagePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowGrowthStagePicker(false)}
        >
          <View className="flex-1 bg-black/30 items-center justify-center px-4">
            <View
              className="bg-white rounded-2xl w-full"
              style={{
                maxHeight: '60%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <View className="px-4 py-4 border-b border-gray-200">
                <Text className="text-lg font-bold text-[#1c1c1e] text-center">Select Growth Stage</Text>
              </View>
              <ScrollView style={{ maxHeight: 400 }}>
                {WATER_GROWTH_STAGES.map((stage) => (
                  <TouchableOpacity
                    key={stage.id}
                    onPress={() => {
                      setSelectedGrowthStage(stage);
                      setShowGrowthStagePicker(false);
                    }}
                    className={`px-4 py-3 border-b border-gray-100 ${
                      selectedGrowthStage?.id === stage.id ? 'bg-[#408059]/10' : ''
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className={`text-base font-medium ${
                          selectedGrowthStage?.id === stage.id ? 'text-[#408059]' : 'text-[#1c1c1e]'
                        }`}>
                          {stage.label}
                        </Text>
                        <Text className="text-sm text-[#8e8e93] mt-0.5">
                          Kc: {stage.kc.toFixed(2)}
                        </Text>
                      </View>
                      {selectedGrowthStage?.id === stage.id && (
                        <Ionicons name="checkmark-circle" size={24} color="#408059" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                onPress={() => setShowGrowthStagePicker(false)}
                className="py-4 border-t border-gray-200"
              >
                <Text className="text-center font-semibold text-[#8e8e93]">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}
