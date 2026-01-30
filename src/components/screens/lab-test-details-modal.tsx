import React from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Symbol } from '@/components/ui/symbol';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { formatParameterKey } from '@/hooks/use-lab-tests';
import type { SoilTestRecord, PetioleTestRecord } from '@/types/database';

type TestType = 'soil' | 'petiole';

interface LabTestDetailsModalProps {
  visible: boolean;
  testType: TestType;
  test: SoilTestRecord | PetioleTestRecord | null;
  onClose: () => void;
}

type Section = {
  title: string;
  params: string[];
};

const soilSections: Section[] = [
  { title: '🧪 Chemical Properties', params: ['ph', 'ec', 'organicCarbon', 'organicMatter'] },
  { title: '🌿 Major Nutrients', params: ['nitrogen', 'phosphorus', 'potassium'] },
  { title: '⚗️ Secondary Nutrients', params: ['calcium', 'magnesium', 'sulfur'] },
  { title: '💧 Micro Nutrients', params: ['iron', 'manganese', 'zinc', 'copper', 'boron'] },
  { title: '📋 Other', params: ['sodium', 'chloride'] },
];

const petioleSections: Section[] = [
  {
    title: '🌿 Major Nutrients',
    params: [
      'total_nitrogen',
      'nitrate_nitrogen',
      'ammoniacal_nitrogen',
      'phosphorus',
      'potassium',
    ],
  },
  { title: '⚗️ Secondary Nutrients', params: ['calcium', 'magnesium', 'sulfur'] },
  { title: '💧 Micro Nutrients', params: ['iron', 'manganese', 'zinc', 'copper', 'boron'] },
  { title: '📋 Other', params: ['molybdenum', 'sodium', 'chloride'] },
];

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return value.toFixed(2);
  return String(value);
};

const normalizeParamKey = (key: string) => {
  if (key === 'ammonical_nitrogen') return 'ammoniacal_nitrogen';
  if (key === 'organic_carbon') return 'organicCarbon';
  if (key === 'organic_matter') return 'organicMatter';
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
};

const normalizeParameters = (parameters: Record<string, unknown>) => {
  const normalized: Record<string, unknown> = {};
  Object.entries(parameters).forEach(([key, value]) => {
    const normalizedKey = normalizeParamKey(key);
    if (normalized[normalizedKey] === undefined) {
      normalized[normalizedKey] = value;
    }
  });
  return normalized;
};

const getSections = (testType: TestType, parameters: Record<string, unknown>): Section[] => {
  const baseSections = testType === 'soil' ? soilSections : petioleSections;
  const knownKeys = baseSections.flatMap((section) => section.params);
  const unknownParams = Object.keys(parameters).filter((key) => !knownKeys.includes(key));

  if (unknownParams.length === 0) {
    return baseSections;
  }

  return [
    ...baseSections,
    {
      title: '📊 Additional Parameters',
      params: unknownParams,
    },
  ];
};

export function LabTestDetailsModal({
  visible,
  testType,
  test,
  onClose,
}: LabTestDetailsModalProps) {
  if (!test) {
    return null;
  }

  const rawParameters = (test.parameters ?? {}) as Record<string, unknown>;
  const parameters = normalizeParameters(rawParameters);
  const sections = getSections(testType, parameters);
  const accentColor = testType === 'soil' ? '#597A61' : '#4C806B';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Pressable
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
            }}
            onPress={onClose}
          />
          <View
            style={{
              marginHorizontal: spacing[4],
              maxHeight: '85%',
              backgroundColor: colors.white,
              borderRadius: borderRadius['2xl'],
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[4],
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing[3],
              }}
            >
              <View style={{ flex: 1, paddingRight: spacing[3] }}>
                <Text
                  style={{
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                    color: colors.gray[900],
                  }}
                >
                  {testType === 'soil' ? 'Soil Test Details' : 'Petiole Test Details'}
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: colors.gray[500] }}>{test.date}</Text>
              </View>
              <Pressable
                onPress={onClose}
                style={{
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: borderRadius.full,
                  backgroundColor: colors.gray[100],
                }}
              >
                <Symbol name="xmark" size={16} color={colors.gray[700]} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {sections.map((section) => {
                const available = section.params
                  .map((key) => [key, parameters[key]])
                  .filter(([, value]) => value !== null && value !== undefined && value !== '');

                if (available.length === 0) return null;

                return (
                  <View key={section.title} style={{ marginBottom: spacing[4] }}>
                    <Text
                      style={{
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.semibold,
                        color: colors.gray[800],
                        marginBottom: spacing[2],
                      }}
                    >
                      {section.title}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                      {available.map(([key, value]) => (
                        <View
                          key={key}
                          style={{
                            flexBasis: '48%',
                            backgroundColor: colors.gray[50],
                            borderRadius: borderRadius.lg,
                            paddingHorizontal: spacing[3],
                            paddingVertical: spacing[2],
                            borderWidth: 1,
                            borderColor: colors.gray[200],
                          }}
                        >
                          <Text style={{ fontSize: fontSize.xs, color: colors.gray[500] }}>
                            {formatParameterKey(String(key), testType)}
                          </Text>
                          <Text
                            style={{
                              fontSize: fontSize.base,
                              fontWeight: fontWeight.semibold,
                              color: accentColor,
                              marginTop: spacing[1],
                            }}
                          >
                            {formatValue(value)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}

              {test.notes && (
                <View
                  style={{
                    backgroundColor: colors.gray[50],
                    borderRadius: borderRadius.lg,
                    padding: spacing[3],
                    borderWidth: 1,
                    borderColor: colors.gray[200],
                    marginBottom: spacing[4],
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: colors.gray[800],
                      marginBottom: spacing[2],
                    }}
                  >
                    Notes
                  </Text>
                  <Text style={{ fontSize: fontSize.sm, color: colors.gray[600] }}>
                    {test.notes}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
