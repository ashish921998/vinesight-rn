/**
 * Add Lab Test Modal
 * Modal for adding soil or petiole test records
 */

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator, Platform, Modal } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { Button } from '@/components/ui';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { FormModal, SectionHeader, FormInput } from '@/components/ui/form-components';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatDate } from '@/i18n/format';
import {
  useCreateSoilTest,
  useCreatePetioleTest,
  SOIL_PARAMETERS,
  PETIOLE_PARAMETERS,
  getParameterLabel,
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
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();

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
  const testTypeLabel = isSoil ? t('labTests.form.types.soil') : t('labTests.form.types.petiole');
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
      Alert.alert(t('common.error'), t('common.errors.enterAtLeastOneParameterValue'));
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
      Alert.alert(t('common.error'), t('common.errors.failedToSaveLabTest'));
    }
  };

  const handleDateChange = (_: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
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
    Alert.alert(t('labTests.upload.chooseMethodTitle'), t('labTests.upload.chooseMethodBody'), [
      {
        text: t('common.actions.takePhoto'),
        onPress: () => handleTakePhoto(),
      },
      {
        text: t('common.actions.selectImage'),
        onPress: () => handleSelectImage(),
      },
      {
        text: t('common.actions.selectPdf'),
        onPress: () => handleSelectPDF(),
      },
      {
        text: t('common.cancel'),
        style: 'cancel',
      },
    ]);
  };

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          t('labTests.upload.permissionDeniedTitle'),
          t('labTests.upload.permissionDeniedBody'),
        );
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
        Alert.alert(
          t('labTests.upload.uploadFailedTitle'),
          t('labTests.upload.noValidImageSelected'),
        );
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert(t('labTests.upload.uploadFailedTitle'), t('labTests.upload.failedToTakePhoto'));
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
        Alert.alert(
          t('labTests.upload.uploadFailedTitle'),
          t('labTests.upload.noValidImageSelected'),
        );
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert(t('labTests.upload.uploadFailedTitle'), t('labTests.upload.failedToSelectImage'));
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
        Alert.alert(t('labTests.upload.uploadFailedTitle'), t('labTests.upload.invalidPdfFile'));
        return;
      }

      try {
        const extractedText = await extractTextFromPDF(file.uri);

        if (!extractedText) {
          Alert.alert(
            t('labTests.upload.pdfProcessingTitle'),
            t('labTests.upload.pdfProcessingBody'),
            [
              {
                text: t('common.ok'),
                style: 'default',
              },
            ],
          );
          return;
        }

        const parsedData = await parseLabTestFromText(extractedText, testType);

        if (Object.keys(parsedData.parameters).length === 0) {
          Alert.alert(
            t('labTests.upload.noDataFoundTitle'),
            t('labTests.upload.noDataFoundPdfBody'),
            [{ text: t('common.ok') }],
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
          t('labTests.upload.successTitle'),
          t('labTests.upload.successBody', { count: Object.keys(parsedData.parameters).length }),
          [{ text: t('common.ok') }],
        );
      } catch (parseError) {
        console.error('Parsing error:', parseError);
        Alert.alert(
          t('labTests.upload.parsingFailedTitle'),
          t('labTests.upload.parsingFailedBody'),
          [{ text: t('common.ok') }],
        );
      }
    } catch (error) {
      console.error('Error selecting PDF:', error);
      Alert.alert(t('labTests.upload.uploadFailedTitle'), t('labTests.upload.failedToSelectPdf'));
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
          t('labTests.upload.noDataFoundTitle'),
          t('labTests.upload.noDataFoundImageBody'),
          [{ text: t('common.ok') }],
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
        t('labTests.upload.successTitle'),
        t('labTests.upload.successBody', { count: Object.keys(parsedData.parameters).length }),
        [{ text: t('common.ok') }],
      );
    } catch (parseError) {
      console.error('Parsing error:', parseError);
      Alert.alert(t('labTests.upload.parsingFailedTitle'), t('labTests.upload.parsingFailedBody'), [
        { text: t('common.ok') },
      ]);
    } finally {
      setIsParsingPDF(false);
    }
  };

  return (
    <FormModal
      visible={isVisible}
      onClose={onClose}
      title={t('labTests.form.title', { type: testTypeLabel })}
      onSave={handleSubmit}
      saveLabel={t('labTests.form.saveLabel')}
      isLoading={isLoading}
      isSaveDisabled={!isValid}
      presentation={presentation}
    >
      <SectionHeader title={t('labTests.form.uploadSectionTitle')} style={{ marginBottom: 12 }} />
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
            <ActivityIndicator color={m3.colorScheme.primary} size="small" />
            <Text
              style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.medium,
                color: colors.primary[500],
                marginLeft: spacing[2],
              }}
              textBreakStrategy="highQuality"
              lineBreakStrategyIOS="standard"
            >
              {t('labTests.form.parsingWithAi')}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <IconSymbol name="document" size={22} color={m3.colorScheme.primary} />
            <Text
              style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.medium,
                color: colors.primary[500],
                marginLeft: spacing[2],
              }}
              textBreakStrategy="highQuality"
              lineBreakStrategyIOS="standard"
            >
              {t('labTests.form.uploadButton')}
            </Text>
          </View>
        )}
      </Pressable>

      <SectionHeader title={t('labTests.form.detailsSectionTitle')} style={{ marginBottom: 12 }} />
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
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {formatDate(date, { year: 'numeric', month: 'short', day: 'numeric' })}
          </Text>
        </View>
        <IconSymbol name="chevron.down" size={18} color={colors.surface[500]} />
      </Pressable>

      <SectionHeader
        title={t('labTests.form.parametersSectionTitle', { type: testTypeLabel })}
        subtitle={t('labTests.form.parametersSectionSubtitle')}
        style={{ marginBottom: 12 }}
      />
      {parameterList.map((param) => (
        <FormInput
          key={param.key}
          label={getParameterLabel(param.key, testType)}
          value={parameters[param.key] || ''}
          onChangeText={(value) => updateParameter(param.key, value)}
          placeholder="0"
          keyboardType="decimal-pad"
          suffix={param.unit || undefined}
          style={{ marginBottom: 12 }}
        />
      ))}

      <SectionHeader
        title={t('labTests.form.recommendationsSectionTitle')}
        style={{ marginBottom: 12 }}
      />
      <FormInput
        label={t('labTests.form.recommendationsSectionTitle')}
        value={recommendations}
        onChangeText={setRecommendations}
        placeholder={t('labTests.form.optionalPlaceholder')}
        multiline
        numberOfLines={3}
      />

      <SectionHeader title={t('labTests.form.notesSectionTitle')} style={{ marginBottom: 12 }} />
      <FormInput
        label={t('labTests.form.notesSectionTitle')}
        value={notes}
        onChangeText={setNotes}
        placeholder={t('labTests.form.optionalPlaceholder')}
        multiline
        numberOfLines={3}
      />

      {Platform.OS === 'ios' && showDatePicker && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
          <Pressable
            style={{
              flex: 1,
              backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.5),
              justifyContent: 'flex-end',
            }}
            onPress={() => setShowDatePicker(false)}
          >
            <View
              style={{
                backgroundColor: colors.surface[100],
                borderTopLeftRadius: borderRadius['2xl'],
                borderTopRightRadius: borderRadius['2xl'],
                padding: spacing[4],
              }}
              onStartShouldSetResponder={() => true}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[4],
                }}
              >
                <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>
                  {t('labTests.form.testDateLabel')}
                </Text>
                <Pressable
                  onPress={() => setShowDatePicker(false)}
                  accessibilityLabel={t('common.actions.close')}
                  accessibilityRole="button"
                >
                  <IconSymbol name="xmark.circle.fill" size={24} color={colors.surface[500]} />
                </Pressable>
              </View>
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={handleDateChange}
              />
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: spacing[4],
                }}
              >
                <Button
                  title={t('common.actions.cancel')}
                  variant="secondary"
                  onPress={() => setShowDatePicker(false)}
                  accessibilityLabel={t('common.actions.cancel')}
                />
                <Button
                  title={t('common.actions.done')}
                  variant="primary"
                  onPress={() => setShowDatePicker(false)}
                  accessibilityLabel={t('common.actions.done')}
                  style={{ marginLeft: spacing[3] }}
                />
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
      {Platform.OS !== 'ios' && showDatePicker && (
        <DateTimePicker value={date} mode="date" display="default" onChange={handleDateChange} />
      )}
    </FormModal>
  );
}
