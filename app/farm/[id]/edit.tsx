import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Symbol } from '@/components/ui/symbol';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFarm, useUpdateFarm } from '@/hooks';
import { CROPS, CROP_VARIETIES, type CropType } from '@/constants/crop-varieties';
import type { FarmUpdate } from '@/types';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

function Section({
  title,
  children,
  isExpanded = true,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  isExpanded?: boolean;
  onToggle?: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: borderRadius['2xl'],
        marginBottom: spacing[4],
        overflow: 'hidden',
      }}
    >
      <Pressable
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing[4],
          borderBottomWidth: 1,
          borderBottomColor: colors.surface[100],
        }}
        onPress={onToggle}
      >
        <Text
          style={{
            fontSize: fontSize.base,
            fontWeight: fontWeight.semibold,
            color: colors.surface[900],
          }}
        >
          {title}
        </Text>
        {onToggle && (
          <Symbol name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
        )}
      </Pressable>
      {isExpanded && <View style={{ padding: spacing[4] }}>{children}</View>}
    </View>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: spacing[4] }}>
      <Text
        style={{
          fontSize: fontSize.sm,
          fontWeight: fontWeight.medium,
          color: colors.surface[700],
          marginBottom: spacing[2] - 1,
        }}
      >
        {label}
        {required && <Text style={{ color: colors.error }}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function EditFarmScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const farmId = id ? parseInt(id, 10) : undefined;
  const { data: farm, isLoading: farmLoading } = useFarm(farmId);
  const updateFarm = useUpdateFarm();

  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [area, setArea] = useState('');
  const [selectedCrop, setSelectedCrop] = useState<CropType>('Grapes');
  const [cropVariety, setCropVariety] = useState('');
  const [customVariety, setCustomVariety] = useState('');
  const [plantingDate, setPlantingDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [vineSpacing, setVineSpacing] = useState('');
  const [rowSpacing, setRowSpacing] = useState('');

  const [totalTankCapacity, setTotalTankCapacity] = useState('');
  const [systemDischarge, setSystemDischarge] = useState('');

  const [dateOfPruning, setDateOfPruning] = useState<Date | null>(null);
  const [showPruningDatePicker, setShowPruningDatePicker] = useState(false);

  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    spacing: false,
    irrigation: false,
    dates: false,
  });

  const [showVarietyPicker, setShowVarietyPicker] = useState(false);
  const [varietySearchText, setVarietySearchText] = useState('');

  // Track previous farm ID and updated_at to detect when farm data changes
  const prevFarmIdRef = useRef<number | undefined>(undefined);
  const prevUpdatedAtRef = useRef<string | null | undefined>(undefined);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Update form when we get a new farm (different ID) or when farm data is updated
    if (
      farm &&
      (farm.id !== prevFarmIdRef.current || farm.updated_at !== prevUpdatedAtRef.current)
    ) {
      setName(farm.name || '');
      setRegion(farm.region || '');
      setArea(farm.area?.toString() || '');
      setSelectedCrop((farm.crop as CropType) || 'Grapes');
      setCropVariety(farm.crop_variety || '');
      if (farm.planting_date) {
        setPlantingDate(new Date(farm.planting_date));
      }
      setVineSpacing(farm.vine_spacing?.toString() || '');
      setRowSpacing(farm.row_spacing?.toString() || '');
      setTotalTankCapacity(farm.total_tank_capacity?.toString() || '');
      setSystemDischarge(farm.system_discharge?.toString() || '');
      if (farm.date_of_pruning) {
        setDateOfPruning(new Date(farm.date_of_pruning));
      }
      prevFarmIdRef.current = farm.id;
      prevUpdatedAtRef.current = farm.updated_at;
    }
  }, [farm]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const varieties = useMemo(() => {
    return CROP_VARIETIES[selectedCrop] || ['Custom'];
  }, [selectedCrop]);

  const filteredVarieties = useMemo(() => {
    if (!varietySearchText.trim()) return varieties;
    const query = varietySearchText.toLowerCase();
    return varieties.filter((v) => v.toLowerCase().includes(query));
  }, [varieties, varietySearchText]);

  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    if (!region.trim()) return false;
    const parsedArea = parseFloat(area);
    if (!Number.isFinite(parsedArea) || parsedArea <= 0) return false;
    if (cropVariety === 'Custom' && !customVariety.trim()) return false;
    if (!cropVariety && !customVariety.trim()) return false;
    return true;
  }, [name, region, area, cropVariety, customVariety]);

  const handleToggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleSelectVariety = (variety: string) => {
    setCropVariety(variety);
    setShowVarietyPicker(false);
    setVarietySearchText('');
    if (variety === 'Custom') {
      setCustomVariety('');
    }
  };

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }
    if (!farmId) {
      Alert.alert('Error', 'Invalid farm ID');
      return;
    }

    const finalVariety = cropVariety === 'Custom' ? customVariety : cropVariety;

    const farmData: FarmUpdate = {
      name: name.trim(),
      region: region.trim(),
      area: parseFloat(area),
      crop: selectedCrop,
      crop_variety: finalVariety,
      planting_date: plantingDate ? formatLocalDate(plantingDate) : undefined,
      vine_spacing: vineSpacing ? parseFloat(vineSpacing) : null,
      row_spacing: rowSpacing ? parseFloat(rowSpacing) : null,
      total_tank_capacity: totalTankCapacity ? parseFloat(totalTankCapacity) : null,
      system_discharge: systemDischarge ? parseFloat(systemDischarge) : null,
      date_of_pruning: dateOfPruning ? formatLocalDate(dateOfPruning) : null,
    };

    try {
      await updateFarm.mutateAsync({ id: farmId, updates: farmData });
      router.back();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update farm. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  if (farmLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface[50],
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#408059" />
        <Text style={{ color: colors.surface[500], marginTop: spacing[4] }}>Loading farm...</Text>
      </View>
    );
  }

  if (!farm) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface[50],
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: spacing[8],
        }}
      >
        <Symbol name="alert-circle-outline" size={48} color="#EF4444" />
        <Text
          style={{
            fontSize: fontSize.xl,
            fontWeight: fontWeight.bold,
            color: colors.surface[900],
            marginTop: spacing[4],
          }}
        >
          Farm Not Found
        </Text>
        <Text style={{ color: colors.surface[500], textAlign: 'center', marginTop: spacing[2] }}>
          The farm you&apos;re looking for doesn&apos;t exist or has been deleted.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: spacing[6],
            backgroundColor: colors.primary[500],
            paddingHorizontal: spacing[6],
            paddingVertical: spacing[3],
            borderRadius: borderRadius.xl,
          }}
        >
          <Text style={{ color: colors.white, fontWeight: fontWeight.semibold }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Farm',
          headerStyle: { backgroundColor: '#F9FAFB' },
          headerTintColor: '#111827',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ marginRight: spacing[4] }}>
              <Symbol name="xmark" size={24} color="#111827" />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.surface[50] }}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <Section title="Basic Information" isExpanded={expandedSections.basic}>
            <FormField label="Farm Name" required>
              <TextInput
                style={{
                  backgroundColor: colors.surface[50],
                  borderRadius: borderRadius.xl,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  fontSize: fontSize.base,
                  color: colors.surface[900],
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                }}
                placeholder="Enter farm name"
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={setName}
              />
            </FormField>

            <FormField label="Region / Location" required>
              <TextInput
                style={{
                  backgroundColor: colors.surface[50],
                  borderRadius: borderRadius.xl,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  fontSize: fontSize.base,
                  color: colors.surface[900],
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                }}
                placeholder="Enter region or location"
                placeholderTextColor="#9CA3AF"
                value={region}
                onChangeText={setRegion}
              />
            </FormField>

            <FormField label="Area (acres)" required>
              <TextInput
                style={{
                  backgroundColor: colors.surface[50],
                  borderRadius: borderRadius.xl,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  fontSize: fontSize.base,
                  color: colors.surface[900],
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                }}
                placeholder="Enter area in acres"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={area}
                onChangeText={setArea}
              />
            </FormField>

            <FormField label="Crop Type" required>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                {CROPS.map((crop) => (
                  <Pressable
                    key={crop}
                    style={{
                      paddingHorizontal: spacing[4],
                      paddingVertical: 10,
                      borderRadius: borderRadius.xl,
                      borderWidth: 1,
                      backgroundColor: selectedCrop === crop ? colors.primary[500] : colors.white,
                      borderColor:
                        selectedCrop === crop ? colors.primary[500] : colors.surface[200],
                    }}
                    onPress={() => {
                      setSelectedCrop(crop);
                      setCropVariety('');
                      setCustomVariety('');
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.medium,
                        color: selectedCrop === crop ? colors.white : colors.surface[700],
                      }}
                    >
                      {crop}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </FormField>

            <FormField label="Variety" required>
              <Pressable
                style={{
                  backgroundColor: colors.surface[50],
                  borderRadius: borderRadius.xl,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                onPress={() => setShowVarietyPicker(true)}
              >
                <Text
                  style={{
                    fontSize: fontSize.base,
                    color: cropVariety ? colors.surface[900] : colors.surface[400],
                  }}
                >
                  {cropVariety || 'Select variety'}
                </Text>
                <Symbol name="chevron.down" size={20} color="#6B7280" />
              </Pressable>

              {cropVariety === 'Custom' && (
                <TextInput
                  style={{
                    backgroundColor: colors.surface[50],
                    borderRadius: borderRadius.xl,
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                    fontSize: fontSize.base,
                    color: colors.surface[900],
                    borderWidth: 1,
                    borderColor: colors.surface[200],
                    marginTop: spacing[3],
                  }}
                  placeholder="Enter custom variety name"
                  placeholderTextColor="#9CA3AF"
                  value={customVariety}
                  onChangeText={setCustomVariety}
                />
              )}
            </FormField>

            <FormField label="Planting Date">
              <Pressable
                style={{
                  backgroundColor: colors.surface[50],
                  borderRadius: borderRadius.xl,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
                onPress={() => setShowDatePicker(true)}
              >
                <Symbol name="calendar" size={20} color="#6B7280" />
                <Text
                  style={{
                    fontSize: fontSize.base,
                    marginLeft: spacing[3],
                    color: plantingDate ? colors.surface[900] : colors.surface[400],
                  }}
                >
                  {plantingDate ? plantingDate.toLocaleDateString() : 'Select date'}
                </Text>
              </Pressable>
            </FormField>
          </Section>

          <Section
            title="Spacing (Optional)"
            isExpanded={expandedSections.spacing}
            onToggle={() => handleToggleSection('spacing')}
          >
            <FormField label="Vine Spacing (feet)">
              <TextInput
                style={{
                  backgroundColor: colors.surface[50],
                  borderRadius: borderRadius.xl,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  fontSize: fontSize.base,
                  color: colors.surface[900],
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                }}
                placeholder="Distance between vines"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={vineSpacing}
                onChangeText={setVineSpacing}
              />
            </FormField>

            <FormField label="Row Spacing (feet)">
              <TextInput
                style={{
                  backgroundColor: colors.surface[50],
                  borderRadius: borderRadius.xl,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  fontSize: fontSize.base,
                  color: colors.surface[900],
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                }}
                placeholder="Distance between rows"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={rowSpacing}
                onChangeText={setRowSpacing}
              />
            </FormField>
          </Section>

          <Section
            title="Irrigation (Optional)"
            isExpanded={expandedSections.irrigation}
            onToggle={() => handleToggleSection('irrigation')}
          >
            <FormField label="Total Tank Capacity (mm)">
              <TextInput
                style={{
                  backgroundColor: colors.surface[50],
                  borderRadius: borderRadius.xl,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  fontSize: fontSize.base,
                  color: colors.surface[900],
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                }}
                placeholder="Available water storage capacity"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={totalTankCapacity}
                onChangeText={setTotalTankCapacity}
              />
            </FormField>

            <FormField label="System Discharge (mm/hr)">
              <TextInput
                style={{
                  backgroundColor: colors.surface[50],
                  borderRadius: borderRadius.xl,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  fontSize: fontSize.base,
                  color: colors.surface[900],
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                }}
                placeholder="Irrigation system discharge rate"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={systemDischarge}
                onChangeText={setSystemDischarge}
              />
            </FormField>
          </Section>

          <Section
            title="Important Dates (Optional)"
            isExpanded={expandedSections.dates}
            onToggle={() => handleToggleSection('dates')}
          >
            <FormField label="Date of Pruning">
              <Pressable
                style={{
                  backgroundColor: colors.surface[50],
                  borderRadius: borderRadius.xl,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                onPress={() => setShowPruningDatePicker(true)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Symbol name="cut-outline" size={20} color="#6B7280" />
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      marginLeft: spacing[3],
                      color: dateOfPruning ? colors.surface[900] : colors.surface[400],
                    }}
                  >
                    {dateOfPruning ? dateOfPruning.toLocaleDateString() : 'Select date'}
                  </Text>
                </View>
                {dateOfPruning && (
                  <Pressable
                    onPress={() => setDateOfPruning(null)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Symbol name="xmark.circle.fill" size={20} color="#9CA3AF" />
                  </Pressable>
                )}
              </Pressable>
            </FormField>
          </Section>
        </ScrollView>

        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: spacing[4],
            backgroundColor: colors.white,
            borderTopWidth: 1,
            borderTopColor: colors.surface[200],
          }}
        >
          <Pressable
            style={{
              paddingVertical: spacing[4],
              borderRadius: borderRadius.xl,
              alignItems: 'center',
              backgroundColor:
                isValid && !updateFarm.isPending ? colors.primary[600] : colors.surface[300],
            }}
            onPress={handleSave}
            disabled={!isValid || updateFarm.isPending}
          >
            {updateFarm.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: colors.white,
                }}
              >
                Save Changes
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {showVarietyPicker && (
        <Pressable
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setShowVarietyPicker(false)}
        >
          <Pressable>
            <View
              style={{
                backgroundColor: colors.white,
                borderTopLeftRadius: borderRadius['3xl'],
                borderTopRightRadius: borderRadius['3xl'],
                maxHeight: '70%',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: spacing[4],
                  borderBottomWidth: 1,
                  borderBottomColor: colors.surface[200],
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.semibold,
                    color: colors.surface[900],
                  }}
                >
                  Select Variety
                </Text>
                <Pressable onPress={() => setShowVarietyPicker(false)}>
                  <Symbol name="xmark" size={24} color="#111827" />
                </Pressable>
              </View>

              <View
                style={{
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  borderBottomWidth: 1,
                  borderBottomColor: colors.surface[100],
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.surface[50],
                    borderRadius: borderRadius.xl,
                    paddingHorizontal: spacing[4],
                    paddingVertical: 10,
                  }}
                >
                  <Symbol name="search" size={20} color="#9CA3AF" />
                  <TextInput
                    style={{
                      flex: 1,
                      marginLeft: spacing[2],
                      fontSize: fontSize.base,
                      color: colors.surface[900],
                    }}
                    placeholder="Search varieties..."
                    placeholderTextColor="#9CA3AF"
                    value={varietySearchText}
                    onChangeText={setVarietySearchText}
                  />
                </View>
              </View>

              <ScrollView style={{ maxHeight: 320 }}>
                {filteredVarieties.map((variety) => (
                  <Pressable
                    key={variety}
                    style={{
                      paddingHorizontal: spacing[4],
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.surface[100],
                      backgroundColor: cropVariety === variety ? colors.primary[50] : colors.white,
                    }}
                    onPress={() => handleSelectVariety(variety)}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.base,
                        color: cropVariety === variety ? colors.primary[600] : colors.surface[900],
                        fontWeight: cropVariety === variety ? fontWeight.medium : fontWeight.normal,
                      }}
                    >
                      {variety}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      )}

      {showDatePicker && (
        <DateTimePicker
          value={plantingDate || new Date()}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowDatePicker(false);
            if (date) setPlantingDate(date);
          }}
        />
      )}

      {showPruningDatePicker && (
        <DateTimePicker
          value={dateOfPruning || new Date()}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowPruningDatePicker(false);
            if (date) setDateOfPruning(date);
          }}
        />
      )}
    </>
  );
}
