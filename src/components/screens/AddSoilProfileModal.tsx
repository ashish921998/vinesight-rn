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
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Symbol } from '@/components/ui/Symbol';
import { useCreateSoilProfile, SECTION_NAMES, SECTION_INFO } from '../../hooks/useSoilProfiles';
import { SoilSectionData } from '../../types/database';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

interface AddSoilProfileModalProps {
  visible?: boolean;
  onClose: () => void;
  farmId: number;
  presentation?: 'modal' | 'screen';
}

export default function AddSoilProfileModal({
  visible,
  onClose,
  farmId,
  presentation = 'modal',
}: AddSoilProfileModalProps) {
  const isVisible = visible ?? true;
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
    if (process.env.EXPO_OS === 'android') {
      setShowDatePicker(false);
    }
  };

  const updateSection = (name: string, value: string) => {
    setSections((prev) => ({ ...prev, [name]: value }));
  };

  const updateEc = (name: string, value: string) => {
    setEcValues((prev) => ({ ...prev, [name]: value }));
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
          backgroundColor: 'rgba(255,255,255, 0.8)',
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <Pressable onPress={onClose}>
          <Text style={{ color: colors.surface[500], fontSize: fontSize.base }}>Cancel</Text>
        </Pressable>
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            color: colors.surface[900],
          }}
        >
          Add Soil Profile
        </Text>
        <Pressable onPress={handleSubmit} disabled={isLoading}>
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              color: isLoading ? '#c7c7cc' : colors.primary[500],
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
        {/* Date Picker */}
        <View
          style={{
            borderRadius: borderRadius['2xl'],
            padding: spacing[4],
            marginTop: spacing[4],
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
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
            Profile Date
          </Text>
          <Text
            style={{
              fontSize: fontSize.xs,
              color: colors.surface[500],
              marginBottom: spacing[3],
            }}
          >
            Select the date when this soil profile was taken.
          </Text>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={{
              backgroundColor: '#f9f9f9',
              borderWidth: 1,
              borderColor: '#e5e5e5',
              borderRadius: borderRadius.xl,
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: fontSize.base, color: colors.surface[900] }}>
              {selectedDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
            <Symbol name="calendar" size={20} color="#8e8e93" />
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
                backgroundColor: colors.white,
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
                Select Profile Date
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
                <Text style={{ fontWeight: fontWeight.semibold, color: colors.white }}>Done</Text>
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
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
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
            Moisture Readings (%)
          </Text>
          <Text
            style={{
              fontSize: fontSize.xs,
              color: colors.surface[500],
              marginBottom: spacing[4],
            }}
          >
            Enter soil moisture percentage for each section. At least one is required.
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
            {SECTION_NAMES.map((name) => {
              const info = SECTION_INFO[name];
              return (
                <View key={name} style={{ width: '48%' }}>
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
                      {info.label}
                    </Text>
                  </View>
                  <TextInput
                    style={{
                      backgroundColor: '#f9f9f9',
                      borderWidth: 1,
                      borderColor: '#e5e5e5',
                      borderRadius: borderRadius.xl,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[3],
                      color: colors.surface[900],
                      fontSize: fontSize.base,
                    }}
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
          style={{
            borderRadius: borderRadius['2xl'],
            padding: spacing[4],
            marginTop: spacing[4],
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
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
            EC Values (dS/m) - Optional
          </Text>
          <Text
            style={{
              fontSize: fontSize.xs,
              color: colors.surface[500],
              marginBottom: spacing[4],
            }}
          >
            Electrical conductivity readings for each section.
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
            {SECTION_NAMES.map((name) => {
              const info = SECTION_INFO[name];
              return (
                <View key={`ec-${name}`} style={{ width: '48%' }}>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      color: colors.surface[500],
                      marginBottom: spacing[1],
                    }}
                  >
                    {info.label} EC
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: '#f9f9f9',
                      borderWidth: 1,
                      borderColor: '#e5e5e5',
                      borderRadius: borderRadius.xl,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      color: colors.surface[900],
                      fontSize: fontSize.base,
                    }}
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
          style={{
            borderRadius: borderRadius['2xl'],
            padding: spacing[4],
            marginTop: spacing[4],
            marginBottom: spacing[8],
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
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
            Fusarium (%) - Optional
          </Text>
          <Text
            style={{
              fontSize: fontSize.xs,
              color: colors.surface[500],
              marginBottom: spacing[3],
            }}
          >
            Fusarium wilt percentage if applicable.
          </Text>
          <TextInput
            style={{
              backgroundColor: '#f9f9f9',
              borderWidth: 1,
              borderColor: '#e5e5e5',
              borderRadius: borderRadius.xl,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[3],
              color: colors.surface[900],
              fontSize: fontSize.base,
            }}
            placeholder="0.0"
            placeholderTextColor="#c7c7cc"
            keyboardType="decimal-pad"
            value={fusariumPct}
            onChangeText={setFusariumPct}
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
