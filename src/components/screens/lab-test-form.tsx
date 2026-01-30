/**
 * Add Lab Test Modal
 * Modal for adding soil or petiole test records
 */

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { FormModal, SectionHeader, FormInput } from '@/components/ui/form-components';
import {
  useCreateSoilTest,
  useCreatePetioleTest,
  SOIL_PARAMETERS,
  PETIOLE_PARAMETERS,
} from '../../hooks/use-lab-tests';
import { parseLabTestFromImage, parseLabTestFromText } from '../../utils/pdf-parser';
import { extractTextFromPDF } from '../../utils/pdf-to-image';

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

interface LabTestFormProps {
  visible?: boolean;
  onClose: () => void;
  farmId: number;
  testType: 'soil' | 'petiole';
  presentation?: 'modal' | 'screen';
}

export default function LabTestForm({
  visible,
  onClose,
  farmId,
  testType,
  presentation = 'modal',
}: LabTestFormProps) {
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
  const isValid = useMemo(
    () => Object.values(parameters).some((value) => value.trim().length > 0),
    [parameters],
  );
  const formatLocalDate = (value: Date) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const resetForm = () => {
    setDate(new Date());
    setParameters({});
    setRecommendations('');
    setNotes('');
  };

  const handleSubmit = async () => {
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
        date: formatLocalDate(date),
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
        text: 'Select PDF',
        onPress: () => handleSelectPDF(),
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

      if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0].uri) {
        await parseAndPopulateForm(result.assets[0].uri);
      } else if (!result.canceled) {
        Alert.alert('Upload Failed', 'No valid image was selected. Please try again.');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Upload Failed', 'Failed to take photo. Please try again.');
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

      if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0].uri) {
        await parseAndPopulateForm(result.assets[0].uri);
      } else if (!result.canceled) {
        Alert.alert('Upload Failed', 'No valid image was selected. Please try again.');
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Upload Failed', 'Failed to select image. Please try again.');
    }
  };

  const handleSelectPDF = async () => {
    try {
      setIsParsingPDF(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      if (!file.uri) {
        Alert.alert('Upload Failed', 'Invalid PDF file. Please try again.');
        return;
      }

      try {
        const extractedText = await extractTextFromPDF(file.uri);

        if (!extractedText) {
          Alert.alert(
            'PDF Processing',
            'Unable to extract text from PDF automatically. Please take a photo or screenshot of your lab report for best results.',
            [
              {
                text: 'OK',
                style: 'default',
              },
            ],
          );
          return;
        }

        const parsedData = await parseLabTestFromText(extractedText, testType);

        if (Object.keys(parsedData.parameters).length === 0) {
          Alert.alert(
            'No Data Found',
            'Could not extract test parameters from PDF. Please try again with a clearer document or enter data manually.',
            [{ text: 'OK' }],
          );
          return;
        }

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
            stringParams[normalizedKey] = (value as number).toString();
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
          'Could not extract data from PDF. Please take a photo or screenshot of your lab report for best results.',
          [{ text: 'OK' }],
        );
      }
    } catch (error) {
      console.error('Error selecting PDF:', error);
      Alert.alert('Upload Failed', 'Failed to select PDF. Please try again.');
    } finally {
      setIsParsingPDF(false);
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
        return;
      }

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

  return (
    <FormModal
      visible={isVisible}
      onClose={onClose}
      title={`Add ${isSoil ? 'Soil' : 'Petiole'} Test`}
      onSave={handleSubmit}
      saveLabel="Save Test"
      isLoading={isLoading}
      isSaveDisabled={!isValid}
      presentation={presentation}
    >
      <SectionHeader title="Upload Lab Report" style={{ marginBottom: 12 }} />
      <Pressable
        onPress={handleUploadFile}
        disabled={isParsingPDF || isLoading}
        style={{
          backgroundColor: colors.surface[100],
          borderRadius: borderRadius.xl,
          padding: spacing[4],
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: colors.surface[300],
          marginBottom: spacing[6],
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
            <IconSymbol name="document" size={22} color="#408059" />
            <Text
              style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.medium,
                color: colors.primary[500],
                marginLeft: spacing[2],
              }}
            >
              Upload Lab Report
            </Text>
          </View>
        )}
      </Pressable>

      <SectionHeader title="Test Details" style={{ marginBottom: 12 }} />
      <Pressable
        onPress={() => setShowDatePicker(true)}
        style={{
          backgroundColor: colors.surface[100],
          borderRadius: borderRadius.xl,
          borderWidth: 2,
          borderColor: colors.surface[200],
          paddingVertical: 14,
          paddingHorizontal: spacing[4],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing[6],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconSymbol name="calendar" size={18} color={colors.surface[500]} />
          <Text
            style={{
              fontSize: fontSize.base,
              color: colors.surface[900],
              marginLeft: spacing[2],
            }}
          >
            {date.toLocaleDateString()}
          </Text>
        </View>
        <IconSymbol name="chevron.down" size={18} color={colors.surface[500]} />
      </Pressable>

      <SectionHeader
        title={`${isSoil ? 'Soil' : 'Petiole'} Parameters`}
        subtitle="Enter values from your lab report"
        style={{ marginBottom: 12 }}
      />
      {parameterList.map((param) => (
        <FormInput
          key={param.key}
          label={param.label}
          value={parameters[param.key] || ''}
          onChangeText={(value) => updateParameter(param.key, value)}
          placeholder="0"
          keyboardType="decimal-pad"
          suffix={param.unit || undefined}
          style={{ marginBottom: 12 }}
        />
      ))}

      <SectionHeader title="Recommendations" style={{ marginBottom: 12 }} />
      <FormInput
        label="Recommendations"
        value={recommendations}
        onChangeText={setRecommendations}
        placeholder="Optional"
        multiline
        numberOfLines={3}
      />

      <SectionHeader title="Notes" style={{ marginBottom: 12 }} />
      <FormInput
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
        multiline
        numberOfLines={3}
      />

      {showDatePicker && (
        <DateTimePicker value={date} mode="date" display="default" onChange={handleDateChange} />
      )}
    </FormModal>
  );
}
