/**
 * Add Soil Profile Modal
 * Modal for adding soil moisture profile with section measurements
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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { useCreateSoilProfile, SECTION_NAMES, SECTION_INFO } from '../../hooks/use-soil-profiles';
import { SoilSectionData } from '../../types/database';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { formatDate } from '@/i18n/format';
import { useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

interface SoilProfileFormProps {
  visible?: boolean;
  onClose: () => void;
  farmId: number;
  presentation?: 'modal' | 'screen';
}

export default function SoilProfileForm({
  visible,
  onClose,
  farmId,
  presentation = 'modal',
}: SoilProfileFormProps) {
  const colors = useThemeColors();
  const isVisible = visible ?? true;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const createProfile = useCreateSoilProfile();

  const [sections, setSections] = useState<Record<string, string>>({
    top: '',
    bottom: '',
    right: '',
    left: '',
  });
  const [fusariumPct, setFusariumPct] = useState('');
  const [ecValues, setEcValues] = useState<Record<string, string>>({
    top: '',
    bottom: '',
    right: '',
    left: '',
  });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fieldPositions, setFieldPositions] = useState<Record<string, number>>({});
  const scrollRef = React.useRef<ScrollView>(null);

  const isLoading = createProfile.isPending;

  const resetForm = () => {
    setSections({ top: '', bottom: '', right: '', left: '' });
    setFusariumPct('');
    setEcValues({ top: '', bottom: '', right: '', left: '' });
    setSelectedDate(new Date());
    setShowDatePicker(false);
  };

  const handleSubmit = async () => {
    // Validate at least one section has moisture value
    const filledSections = Object.entries(sections).filter(([, value]) => value.trim() !== '');

    if (filledSections.length === 0) {
      Alert.alert(t('common.error'), t('common.errors.enterAtLeastOneMoistureValue'));
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
      Alert.alert(t('common.error'), t('common.errors.failedToSaveSoilProfile'));
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

  const recordFieldPosition = (key: string, y: number) => {
    setFieldPositions((prev) => {
      if (prev[key] === y) {
        return prev;
      }
      return { ...prev, [key]: y };
    });
  };

  const scrollToField = (key: string) => {
    const y = fieldPositions[key];
    if (y === undefined) {
      return;
    }
    scrollRef.current?.scrollTo({
      y: Math.max(0, y - spacing[6]),
      animated: true,
    });
  };

  const content = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
      style={{ flex: 1, backgroundColor: colors.surface[50] }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing[4],
          paddingTop: spacing[4] + insets.top,
          paddingBottom: spacing[4],
          backgroundColor: colors.surface[100],
          borderBottomWidth: 0.5,
          borderBottomColor: colors.surface[200],
        }}
      >
        <Pressable onPress={onClose}>
          <Text style={{ color: colors.surface[500], fontSize: fontSize.base }}>
            {t('common.cancel')}
          </Text>
        </Pressable>
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            color: colors.surface[900],
          }}
        >
          {t('soilProfileForm.titleAdd')}
        </Text>
        <Pressable onPress={handleSubmit} disabled={isLoading}>
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              color: isLoading ? colors.surface[400] : colors.primary[500],
            }}
          >
            {isLoading ? t('common.saving') : t('common.save')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={{
          paddingHorizontal: spacing[4],
          paddingBottom: spacing[16] + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Date Picker */}
        <View
          style={{
            borderRadius: borderRadius['2xl'],
            padding: spacing[4],
            marginTop: spacing[4],
            backgroundColor: colorWithOpacity(colors.surface[100], 0.9),
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: colors.surface[500],
              marginBottom: spacing[1],
            }}
          >
            {t('soilProfileForm.date.label')}
          </Text>
          <Text
            style={{
              fontSize: fontSize.xs,
              color: colors.surface[500],
              marginBottom: spacing[3],
            }}
          >
            {t('soilProfileForm.date.hint')}
          </Text>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={{
              backgroundColor: colors.surface[50],
              borderWidth: 1,
              borderColor: colors.surface[200],
              borderRadius: borderRadius.xl,
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: fontSize.base, color: colors.surface[900] }}>
              {formatDate(selectedDate, { year: 'numeric', month: 'short', day: 'numeric' })}
            </Text>
            <IconSymbol name="calendar" size={20} color={colors.surface[500]} />
          </Pressable>
        </View>

        {/* Date Picker Modal */}
        <Modal
          visible={showDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                width: '85%',
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.bold,
                  color: colors.surface[900],
                  marginBottom: spacing[4],
                  textAlign: 'center',
                }}
              >
                {t('soilProfileForm.date.modalTitle')}
              </Text>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                style={{ width: '100%' }}
              />
              <Pressable
                onPress={() => setShowDatePicker(false)}
                style={{
                  marginTop: spacing[4],
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius.xl,
                  alignItems: 'center',
                  backgroundColor: colors.primary[500],
                }}
              >
                <Text style={{ fontWeight: fontWeight.semibold, color: colors.white }}>
                  {t('common.done')}
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Section Moisture Inputs */}
        <View
          style={{
            borderRadius: borderRadius['2xl'],
            padding: spacing[4],
            marginTop: spacing[4],
            backgroundColor: colorWithOpacity(colors.surface[100], 0.9),
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: colors.surface[500],
              marginBottom: spacing[1],
            }}
          >
            {t('soilProfileForm.moisture.title')}
          </Text>
          <Text
            style={{
              fontSize: fontSize.xs,
              color: colors.surface[500],
              marginBottom: spacing[4],
            }}
          >
            {t('soilProfileForm.moisture.hint')}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
            {SECTION_NAMES.map((name) => {
              const info = SECTION_INFO[name];
              const fieldKey = `moisture-${name}`;
              return (
                <View
                  key={name}
                  style={{ width: '48%' }}
                  onLayout={(event) =>
                    recordFieldPosition(fieldKey, event.nativeEvent.layout.y ?? 0)
                  }
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: spacing[1],
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: borderRadius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: spacing[2],
                        backgroundColor: 'rgba(64, 128, 89, 0.2)',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          fontWeight: fontWeight.bold,
                          color: colors.primary[500],
                        }}
                      >
                        {info.abbr}
                      </Text>
                    </View>
                    <Text style={{ fontSize: fontSize.sm, color: colors.surface[900] }}>
                      {t(info.labelKey)}
                    </Text>
                  </View>
                  <TextInput
                    style={{
                      backgroundColor: colors.surface[50],
                      borderWidth: 1,
                      borderColor: colors.surface[200],
                      borderRadius: borderRadius.xl,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[3],
                      color: colors.surface[900],
                      fontSize: fontSize.base,
                    }}
                    placeholder="0.0"
                    placeholderTextColor={colors.gray[400]}
                    keyboardType="decimal-pad"
                    value={sections[name]}
                    onChangeText={(value) => updateSection(name, value)}
                    onFocus={() => scrollToField(fieldKey)}
                  />
                </View>
              );
            })}
          </View>
        </View>

        {/* EC Values (Optional) */}
        <View
          style={{
            borderRadius: borderRadius['2xl'],
            padding: spacing[4],
            marginTop: spacing[4],
            backgroundColor: colorWithOpacity(colors.surface[100], 0.9),
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: colors.surface[500],
              marginBottom: spacing[1],
            }}
          >
            {t('soilProfileForm.ec.title')}
          </Text>
          <Text
            style={{
              fontSize: fontSize.xs,
              color: colors.surface[500],
              marginBottom: spacing[4],
            }}
          >
            {t('soilProfileForm.ec.hint')}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
            {SECTION_NAMES.map((name) => {
              const info = SECTION_INFO[name];
              const fieldKey = `ec-${name}`;
              return (
                <View
                  key={`ec-${name}`}
                  style={{ width: '48%' }}
                  onLayout={(event) =>
                    recordFieldPosition(fieldKey, event.nativeEvent.layout.y ?? 0)
                  }
                >
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      color: colors.surface[500],
                      marginBottom: spacing[1],
                    }}
                  >
                    {t(info.labelKey)} {t('soilProfileForm.ec.fieldSuffix')}
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: colors.surface[50],
                      borderWidth: 1,
                      borderColor: colors.surface[200],
                      borderRadius: borderRadius.xl,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      color: colors.surface[900],
                      fontSize: fontSize.base,
                    }}
                    placeholder="0.0"
                    placeholderTextColor={colors.gray[400]}
                    keyboardType="decimal-pad"
                    value={ecValues[name]}
                    onChangeText={(value) => updateEc(name, value)}
                    onFocus={() => scrollToField(fieldKey)}
                  />
                </View>
              );
            })}
          </View>
        </View>

        {/* Fusarium Percentage (Optional) */}
        <View
          style={{
            borderRadius: borderRadius['2xl'],
            padding: spacing[4],
            marginTop: spacing[4],
            marginBottom: spacing[8],
            backgroundColor: colorWithOpacity(colors.surface[100], 0.9),
          }}
          onLayout={(event) => recordFieldPosition('fusarium', event.nativeEvent.layout.y ?? 0)}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: colors.surface[500],
              marginBottom: spacing[1],
            }}
          >
            {t('soilProfileForm.fusarium.title')}
          </Text>
          <Text
            style={{
              fontSize: fontSize.xs,
              color: colors.surface[500],
              marginBottom: spacing[3],
            }}
          >
            {t('soilProfileForm.fusarium.hint')}
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.surface[50],
              borderWidth: 1,
              borderColor: colors.surface[200],
              borderRadius: borderRadius.xl,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[3],
              color: colors.surface[900],
              fontSize: fontSize.base,
            }}
            placeholder="0.0"
            placeholderTextColor={colors.gray[400]}
            keyboardType="decimal-pad"
            value={fusariumPct}
            onChangeText={setFusariumPct}
            onFocus={() => scrollToField('fusarium')}
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
