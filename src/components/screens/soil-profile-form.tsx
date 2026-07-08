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
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Button } from '@/components/ui';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { useCreateSoilProfile, SECTION_NAMES, SECTION_INFO } from '../../hooks/use-soil-profiles';
import { NoActiveSeasonBanner } from '@/components/ui/no-active-season-banner';
import { useFarmSeasonStatus } from '@/hooks/use-farm-seasons';
import { SoilSectionData } from '../../types/database';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatDate } from '@/i18n/format';

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
  const isVisible = visible ?? true;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const m3 = useM3();
  const createProfile = useCreateSoilProfile();
  const { activeSeason } = useFarmSeasonStatus(farmId);

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

  const handleDateChange = (_: DateTimePickerEvent, date?: Date) => {
    if (date) {
      setSelectedDate(date);
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
      style={{ flex: 1, backgroundColor: m3.colorScheme.background }}
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
          backgroundColor: colorWithOpacity(m3.surface.s100, 0.85),
          borderBottomWidth: 0.5,
          borderBottomColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
        }}
      >
        <Pressable onPress={onClose}>
          <Text style={{ color: m3.surface.s500, fontSize: fontSize.base }}>
            {t('common.cancel')}
          </Text>
        </Pressable>
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            color: m3.surface.s900,
          }}
        >
          {t('soilProfileForm.titleAdd')}
        </Text>
        <Pressable onPress={handleSubmit} disabled={isLoading}>
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              color: isLoading
                ? colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5)
                : m3.colorScheme.primary,
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
        {!activeSeason ? (
          <View style={{ marginTop: spacing[4] }}>
            <NoActiveSeasonBanner />
          </View>
        ) : null}
        {/* Date Picker */}
        <View
          style={{
            borderRadius: borderRadius['2xl'],
            padding: spacing[4],
            marginTop: spacing[4],
            backgroundColor: colorWithOpacity(m3.surface.s100, 0.85),
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: m3.surface.s500,
              marginBottom: spacing[1],
            }}
          >
            {t('soilProfileForm.date.label')}
          </Text>
          <Text
            style={{
              fontSize: fontSize.xs,
              color: m3.surface.s500,
              marginBottom: spacing[3],
            }}
          >
            {t('soilProfileForm.date.hint')}
          </Text>
          <Pressable
            onPress={() => {
              if (Platform.OS === 'android') {
                DateTimePickerAndroid.open({
                  value: selectedDate,
                  mode: 'date',
                  onChange: (event, date) => {
                    if (event.type === 'set' && date) {
                      setSelectedDate(date);
                    }
                  },
                });
              } else {
                setShowDatePicker(true);
              }
            }}
            style={{
              backgroundColor: m3.surface.s50,
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
              borderRadius: borderRadius.xl,
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: fontSize.base, color: m3.surface.s900 }}>
              {formatDate(selectedDate, { year: 'numeric', month: 'short', day: 'numeric' })}
            </Text>
            <IconSymbol name="calendar" size={20} color={m3.colorScheme.onSurfaceVariant} />
          </Pressable>
        </View>

        {/* Date Picker Modal - iOS only */}
        {Platform.OS === 'ios' && (
          <Modal
            visible={showDatePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <Pressable
              onPress={() => setShowDatePicker(false)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              accessibilityHint={t('soilProfileForm.date.closeHint')}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.3),
                }}
              />
            </Pressable>
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: borderRadius['2xl'],
                  padding: spacing[4],
                  width: '85%',
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                    color: m3.surface.s900,
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
                <Button
                  title={t('common.done')}
                  onPress={() => setShowDatePicker(false)}
                  style={{ marginTop: spacing[4] }}
                />
              </View>
            </View>
          </Modal>
        )}

        {/* Section Moisture Inputs */}
        <View
          style={{
            borderRadius: borderRadius['2xl'],
            padding: spacing[4],
            marginTop: spacing[4],
            backgroundColor: colorWithOpacity(m3.surface.s100, 0.85),
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: m3.surface.s500,
              marginBottom: spacing[1],
            }}
          >
            {t('soilProfileForm.moisture.title')}
          </Text>
          <Text
            style={{
              fontSize: fontSize.xs,
              color: m3.surface.s500,
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
                        backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.2),
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          fontWeight: fontWeight.bold,
                          color: m3.primary.p500,
                        }}
                      >
                        {info.abbr}
                      </Text>
                    </View>
                    <Text style={{ fontSize: fontSize.sm, color: m3.surface.s900 }}>
                      {t(info.labelKey)}
                    </Text>
                  </View>
                  <TextInput
                    style={{
                      backgroundColor: m3.surface.s50,
                      borderWidth: 1,
                      borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                      borderRadius: borderRadius.xl,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[3],
                      color: m3.surface.s900,
                      fontSize: fontSize.base,
                    }}
                    placeholder="0.0"
                    placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5)}
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
            backgroundColor: colorWithOpacity(m3.surface.s100, 0.85),
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: m3.surface.s500,
              marginBottom: spacing[1],
            }}
          >
            {t('soilProfileForm.ec.title')}
          </Text>
          <Text
            style={{
              fontSize: fontSize.xs,
              color: m3.surface.s500,
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
                      color: m3.surface.s500,
                      marginBottom: spacing[1],
                    }}
                  >
                    {t(info.labelKey)} {t('soilProfileForm.ec.fieldSuffix')}
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: m3.surface.s50,
                      borderWidth: 1,
                      borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                      borderRadius: borderRadius.xl,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      color: m3.surface.s900,
                      fontSize: fontSize.base,
                    }}
                    placeholder="0.0"
                    placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5)}
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
            backgroundColor: colorWithOpacity(m3.surface.s100, 0.85),
          }}
          onLayout={(event) => recordFieldPosition('fusarium', event.nativeEvent.layout.y ?? 0)}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: m3.surface.s500,
              marginBottom: spacing[1],
            }}
          >
            {t('soilProfileForm.fusarium.title')}
          </Text>
          <Text
            style={{
              fontSize: fontSize.xs,
              color: m3.surface.s500,
              marginBottom: spacing[3],
            }}
          >
            {t('soilProfileForm.fusarium.hint')}
          </Text>
          <TextInput
            style={{
              backgroundColor: m3.surface.s50,
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
              borderRadius: borderRadius.xl,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[3],
              color: m3.surface.s900,
              fontSize: fontSize.base,
            }}
            placeholder="0.0"
            placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5)}
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
