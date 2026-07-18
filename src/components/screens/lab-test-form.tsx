/**
 * Add Lab Test Modal
 * Modal for adding soil or petiole test records
 */

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator, Platform, Modal } from 'react-native';
import DateTimePicker, { type DateTimePickerChangeEvent } from '@expo/ui/community/datetime-picker';
import { useTranslation } from 'react-i18next';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { FormModal, SectionHeader, FormInput } from '@/components/ui/form-components';
import { NoActiveSeasonBanner } from '@/components/ui/no-active-season-banner';
import { useFarmSeasonStatus } from '@/hooks/use-farm-seasons';
import { createStartSeasonHref } from '@/utils/add-log-navigation';
import { useRouter } from 'expo-router';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatDate } from '@/i18n/format';
import {
  useCreateSoilTest,
  useCreatePetioleTest,
  getParameterLabel,
} from '../../hooks/use-lab-tests';
import { useFarm } from '@/hooks/use-farms';
import { SOIL_PARAMETERS, PETIOLE_PARAMETERS } from '@/constants/lab-test-parameters';
import { parseLabTestFromImage } from '../../utils/pdf-parser';
import { normalizeParameterKey } from '../../utils/lab-test-utils';

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
  const m3 = useM3();

  const isVisible = visible ?? true;
  const createSoilTest = useCreateSoilTest();
  const createPetioleTest = useCreatePetioleTest();
  const { data: farm } = useFarm(farmId);
  const { activeSeason, hasResolvedSeasons } = useFarmSeasonStatus(farmId);
  // Block only on a confirmed no-season result — activeSeason is null while the
  // query loads or errors, so gate on hasResolvedSeasons.
  const isBlockedByNoSeason = hasResolvedSeasons && !activeSeason;
  const router = useRouter();
  const goStartSeason = () => {
    onClose();
    router.push(createStartSeasonHref(farmId));
  };

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [originalDate, setOriginalDate] = useState<Date | null>(null);
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
      const baseRecord = {
        farm_id: farmId,
        date: formatLocalDate(date),
        parameters: numericParams,
        recommendations: recommendations || null,
        notes: notes || null,
      };

      if (isSoil) {
        await createSoilTest.mutateAsync(baseRecord);
      } else {
        await createPetioleTest.mutateAsync({
          ...baseRecord,
          date_of_pruning: farm?.date_of_pruning ?? null,
        });
      }

      resetForm();
      onClose();
    } catch (error) {
      console.error('Error creating lab test:', error);
      Alert.alert(t('common.error'), t('common.errors.failedToSaveLabTest'));
    }
  };

  const handleDateChange = (_: DateTimePickerChangeEvent, selectedDate: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    setDate(selectedDate);
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

      await parseAndPopulateForm(file.uri);
    } catch (error) {
      console.error('Error selecting PDF:', error);
      Alert.alert(t('labTests.upload.uploadFailedTitle'), t('labTests.upload.failedToSelectPdf'));
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
          const normalizedKey = normalizeParameterKey(key, testType);
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

      toast.success(
        t('labTests.upload.successBody', { count: Object.keys(parsedData.parameters).length }),
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
      isSaveDisabled={!isValid || isBlockedByNoSeason}
      presentation={presentation}
    >
      {isBlockedByNoSeason ? <NoActiveSeasonBanner onStartSeason={goStartSeason} /> : null}
      <SectionHeader title={t('labTests.form.uploadSectionTitle')} style={{ marginBottom: 12 }} />
      <Pressable
        onPress={handleUploadFile}
        disabled={isParsingPDF || isLoading}
        style={{
          backgroundColor: m3.surface.s100,
          borderRadius: borderRadius.xl,
          padding: spacing[4],
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: m3.surface.s300,
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
                color: m3.primary.p500,
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
                color: m3.primary.p500,
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
        onPress={() => {
          setOriginalDate(date);
          setShowDatePicker(true);
        }}
        style={{
          backgroundColor: m3.surface.s100,
          borderRadius: borderRadius.xl,
          borderWidth: 2,
          borderColor: m3.surface.s200,
          paddingVertical: 14,
          paddingHorizontal: spacing[4],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing[6],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconSymbol name="calendar" size={18} color={m3.surface.s500} />
          <Text
            style={{
              fontSize: fontSize.base,
              color: m3.surface.s900,
              marginLeft: spacing[2],
            }}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {formatDate(date, { year: 'numeric', month: 'short', day: 'numeric' })}
          </Text>
        </View>
        <IconSymbol name="chevron.down" size={18} color={m3.surface.s500} />
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
            onPress={() => {
              if (originalDate) {
                setDate(originalDate);
              }
              setShowDatePicker(false);
              setOriginalDate(null);
            }}
          >
            <View
              style={{
                backgroundColor: m3.surface.s100,
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
                  {t('common.selectDate')}
                </Text>
                <Pressable
                  onPress={() => {
                    if (originalDate) {
                      setDate(originalDate);
                    }
                    setShowDatePicker(false);
                    setOriginalDate(null);
                  }}
                  accessibilityLabel={t('common.close')}
                  accessibilityRole="button"
                >
                  <IconSymbol name="xmark.circle.fill" size={24} color={m3.surface.s500} />
                </Pressable>
              </View>
              <DateTimePicker
                value={date}
                mode="date"
                display="spinner"
                onValueChange={handleDateChange}
              />
              <Button
                title={t('common.done')}
                variant="primary"
                fullWidth={false}
                onPress={() => {
                  setShowDatePicker(false);
                  setOriginalDate(null);
                }}
                accessibilityLabel={t('common.done')}
                style={{ marginTop: spacing[4] }}
              />
            </View>
          </Pressable>
        </Modal>
      )}
      {Platform.OS !== 'ios' && showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onValueChange={handleDateChange}
          onDismiss={() => setShowDatePicker(false)}
        />
      )}
    </FormModal>
  );
}
