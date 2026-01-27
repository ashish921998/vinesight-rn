/**
 * Add Lab Test Modal
 * Modal for adding soil or petiole test records
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Symbol } from '@/components/ui/symbol';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import {
  useCreateSoilTest,
  useCreatePetioleTest,
  SOIL_PARAMETERS,
  PETIOLE_PARAMETERS,
} from '../../hooks/use-lab-tests';
import { parseLabTestFromImage } from '../../utils/pdf-parser';

function normalizeParameterKey(key: string, isSoil: boolean): string {
  if (isSoil) {
    const soilKeyMap: Record<string, string> = {
      pH: 'ph',
      EC: 'ec',
      OC: 'organicCarbon',
      OM: 'organicMatter',
      N: 'nitrogen',
      P: 'phosphorus',
      K: 'potassium',
      Ca: 'calcium',
      Mg: 'magnesium',
      S: 'sulfur',
      Fe: 'iron',
      Mn: 'manganese',
      Zn: 'zinc',
      Cu: 'copper',
      B: 'boron',
    };
    return soilKeyMap[key] || key;
  } else {
    const petioleKeyMap: Record<string, string> = {
      N: 'total_nitrogen',
      P: 'phosphorus',
      K: 'potassium',
      Ca: 'calcium',
      Mg: 'magnesium',
      S: 'sulfur',
      Fe: 'iron',
      Mn: 'manganese',
      Zn: 'zinc',
      Cu: 'copper',
      B: 'boron',
      Mo: 'molybdenum',
      Na: 'sodium',
      Cl: 'chloride',
    };
    return petioleKeyMap[key] || key;
  }
}

interface AddLabTestModalProps {
  visible?: boolean;
  onClose: () => void;
  farmId: number;
  testType: 'soil' | 'petiole';
  presentation?: 'modal' | 'screen';
}

export default function AddLabTestModal({
  visible,
  onClose,
  farmId,
  testType,
  presentation = 'modal',
}: AddLabTestModalProps) {
  const isVisible = visible ?? true;
  const createSoilTest = useCreateSoilTest();
  const createPetioleTest = useCreatePetioleTest();

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [recommendations, setRecommendations] = useState('');
  const [notes, setNotes] = useState('');
  const [isParsingPDF, setIsParsingPDF] = useState(false);

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

  const handleDateChange = (_: DateTimePickerEvent, selectedDate?: Date) => {
    if (process.env.EXPO_OS === 'android') {
      setShowDatePicker(false);
    }
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

  const handleUploadFile = async () => {
    Alert.alert('Choose Upload Method', 'How would you like to upload the lab test report?', [
      {
        text: 'Take Photo',
        onPress: () => handleTakePhoto(),
      },
      {
        text: 'Select Image',
        onPress: () => handleSelectImage(),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission denied', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await parseAndPopulateForm(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleSelectImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await parseAndPopulateForm(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const parseAndPopulateForm = async (uri: string) => {
    try {
      setIsParsingPDF(true);

      const parsedData = await parseLabTestFromImage(uri, testType);

      if (Object.keys(parsedData.parameters).length === 0) {
        Alert.alert(
          'No Data Found',
          'Could not extract test parameters from the image. Please try again with a clearer image or enter data manually.',
          [{ text: 'OK' }],
        );
        setIsParsingPDF(false);
        return;
      }

      // Update form with parsed data
      if (parsedData.testDate) {
        const parsedDate = new Date(parsedData.testDate);
        if (!isNaN(parsedDate.getTime())) {
          setDate(parsedDate);
        }
      }

      if (parsedData.parameters) {
        const stringParams: Record<string, string> = {};
        Object.entries(parsedData.parameters).forEach(([key, value]) => {
          const normalizedKey = normalizeParameterKey(key, isSoil);
          stringParams[normalizedKey] = value.toString();
        });
        setParameters(stringParams);
      }

      if (parsedData.recommendations) {
        setRecommendations(parsedData.recommendations);
      }

      if (parsedData.notes) {
        setNotes(parsedData.notes);
      }

      Alert.alert(
        'Success',
        `Successfully extracted ${Object.keys(parsedData.parameters).length} parameters. Please review and save.`,
        [{ text: 'OK' }],
      );
    } catch (parseError) {
      console.error('Parsing error:', parseError);
      Alert.alert(
        'Parsing Failed',
        'Could not extract data from the image. Please try again with a clearer image or enter data manually.',
        [{ text: 'OK' }],
      );
    } finally {
      setIsParsingPDF(false);
    }
  };

  const content = (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.surface[50] }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[4],
          backgroundColor: 'rgba(255,255,255,0.8)',
          borderBottomWidth: 1,
          borderBottomColor: colors.gray[200],
        }}
      >
        <Pressable onPress={onClose}>
          <Text style={{ color: colors.gray[600], fontSize: fontSize.base }}>Cancel</Text>
        </Pressable>
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            color: colors.primary[500],
          }}
        >
          Add {isSoil ? 'Soil' : 'Petiole'} Test
        </Text>
        <Pressable onPress={handleSubmit} disabled={isLoading}>
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              color: isLoading ? colors.gray[400] : colors.primary[500],
            }}
          >
            {isLoading ? 'Saving...' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Upload Button */}
        <Pressable
          onPress={handleUploadFile}
          disabled={isParsingPDF || isLoading}
          style={{
            backgroundColor: colors.white,
            borderRadius: borderRadius.xl,
            padding: spacing[4],
            marginTop: spacing[4],
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: 'rgba(64, 128, 89, 0.3)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          {isParsingPDF ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#408059" size="small" />
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.medium,
                  color: colors.primary[500],
                  marginLeft: spacing[2],
                }}
              >
                Parsing with AI...
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Symbol name="document" size={24} color="#408059" />
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.medium,
                  color: colors.primary[500],
                  marginLeft: spacing[2],
                }}
              >
                Upload Lab Report (Photo, Image, or PDF)
              </Text>
            </View>
          )}
        </Pressable>

        {/* Date Picker */}
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: borderRadius.xl,
            padding: spacing[4],
            marginTop: spacing[4],
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.gray[500],
              marginBottom: spacing[2],
            }}
          >
            Test Date
          </Text>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.surface[50],
              padding: spacing[3],
              borderRadius: borderRadius.lg,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Symbol name="calendar" size={20} color="#666" />
              <Text
                style={{
                  fontSize: fontSize.base,
                  color: colors.gray[800],
                  marginLeft: spacing[2],
                }}
              >
                {date.toLocaleDateString()}
              </Text>
            </View>
            <Symbol name="chevron.down" size={20} color="#666" />
          </Pressable>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={process.env.EXPO_OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}
        </View>

        {/* Parameters */}
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: borderRadius.xl,
            padding: spacing[4],
            marginTop: spacing[4],
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.gray[500],
              marginBottom: spacing[3],
            }}
          >
            Test Parameters
          </Text>
          <Text
            style={{ fontSize: fontSize.xs, color: colors.gray[400], marginBottom: spacing[4] }}
          >
            Enter values for the parameters you have. Leave empty for unknown values.
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
            {parameterList.map((param) => (
              <View key={param.key} style={{ width: '48%' }}>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: colors.gray[500],
                    marginBottom: spacing[1],
                  }}
                >
                  {param.label} {param.unit && `(${param.unit})`}
                </Text>
                <TextInput
                  style={{
                    backgroundColor: colors.surface[50],
                    borderWidth: 1,
                    borderColor: colors.gray[200],
                    borderRadius: borderRadius.lg,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    color: colors.gray[800],
                    fontSize: fontSize.base,
                  }}
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
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: borderRadius.xl,
            padding: spacing[4],
            marginTop: spacing[4],
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.gray[500],
              marginBottom: spacing[2],
            }}
          >
            Recommendations (Optional)
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.surface[50],
              borderWidth: 1,
              borderColor: colors.gray[200],
              borderRadius: borderRadius.lg,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[3],
              color: colors.gray[800],
              fontSize: fontSize.base,
              minHeight: 80,
            }}
            placeholder="Enter lab recommendations..."
            placeholderTextColor="#9ca3af"
            multiline
            textAlignVertical="top"
            value={recommendations}
            onChangeText={setRecommendations}
          />
        </View>

        {/* Notes */}
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: borderRadius.xl,
            padding: spacing[4],
            marginTop: spacing[4],
            marginBottom: spacing[8],
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.gray[500],
              marginBottom: spacing[2],
            }}
          >
            Notes (Optional)
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.surface[50],
              borderWidth: 1,
              borderColor: colors.gray[200],
              borderRadius: borderRadius.lg,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[3],
              color: colors.gray[800],
              fontSize: fontSize.base,
              minHeight: 60,
            }}
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
  );

  if (presentation === 'screen') {
    return content;
  }

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
}
