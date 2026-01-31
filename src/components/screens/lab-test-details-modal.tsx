import React from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { formatParameterKey } from '@/hooks/use-lab-tests';
import {
  soilParamOptions,
  petioleParamOptions,
  type ParamOption,
} from '@/constants/lab-test-parameters';
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
  {
    title: '🧪 Chemical Properties',
    params: ['ph', 'ec', 'organic_carbon', 'calcium_carbonate', 'carbonate', 'bicarbonate'],
  },
  {
    title: '🌿 Major Nutrients',
    params: ['nitrogen', 'phosphorus', 'potassium'],
  },
  {
    title: '⚗️ Secondary Nutrients',
    params: ['calcium', 'magnesium', 'sulfur'],
  },
  {
    title: '💧 Micro Nutrients',
    params: ['iron', 'manganese', 'zinc', 'copper', 'boron', 'molybdenum'],
  },
  {
    title: '📋 Other',
    params: ['sodium', 'chloride'],
  },
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
  {
    title: '⚗️ Secondary Nutrients',
    params: ['calcium', 'magnesium', 'sulfur'],
  },
  {
    title: '💧 Micro Nutrients',
    params: ['iron', 'manganese', 'zinc', 'copper', 'boron', 'molybdenum'],
  },
  {
    title: '📋 Other',
    params: ['sodium', 'chloride'],
  },
];

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return value.toFixed(2);
  return String(value);
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const normalizeParamKey = (key: string) => {
  const keyMap: Record<string, string> = {
    organic_carbon: 'organicCarbon',
    organic_matter: 'organicMatter',
    ammonical_nitrogen: 'ammoniacal_nitrogen',
    calcium_carbonate: 'calciumCarbonate',
    total_nitrogen: 'totalNitrogen',
    nitrate_nitrogen: 'nitrateNitrogen',
  };
  return keyMap[key] || key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
};

const normalizeParameters = (parameters: Record<string, unknown>) => {
  const normalized: Record<string, unknown> = {};
  Object.entries(parameters).forEach(([key, value]) => {
    normalized[key] = value;
  });
  return normalized;
};

const getSections = (testType: TestType, parameters: Record<string, unknown>): Section[] => {
  const baseSections = testType === 'soil' ? soilSections : petioleSections;

  // Create a set of normalized known keys (convert both snake_case and camelCase to a canonical form)
  const knownKeys = new Set(baseSections.flatMap((section) => section.params));

  // Check each parameter against known keys (both original and normalized forms)
  const unknownParams = Object.keys(parameters).filter((key) => {
    const normalizedKey = normalizeParamKey(key);
    // Check if either the original key or normalized key is in known keys
    return !knownKeys.has(key) && !knownKeys.has(normalizedKey);
  });

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

const getParamValue = (
  key: string,
  parameters: Record<string, unknown>,
): [string, unknown] | null => {
  const aliasMap: Record<string, string[]> = {
    ammoniacal_nitrogen: ['ammonical_nitrogen'],
    ammonical_nitrogen: ['ammoniacal_nitrogen'],
  };

  // Try the key as-is first
  if (parameters[key] !== undefined) {
    return [key, parameters[key]];
  }
  // Try normalized key
  const normalizedKey = normalizeParamKey(key);
  if (parameters[normalizedKey] !== undefined) {
    return [key, parameters[normalizedKey]];
  }
  // Try known aliases for legacy keys
  const aliases = aliasMap[key] ?? aliasMap[normalizedKey] ?? [];
  for (const alias of aliases) {
    if (parameters[alias] !== undefined) {
      return [key, parameters[alias]];
    }
  }
  return null;
};

const getParamOption = (key: string, testType: TestType): ParamOption | null => {
  const options = testType === 'soil' ? soilParamOptions : petioleParamOptions;
  return options.find((opt) => opt.key === key) || null;
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
                <Text style={{ fontSize: fontSize.xs, color: colors.gray[500] }}>
                  {formatDate(test.date)}
                </Text>
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
                <SymbolIcon name="xmark" size={16} color={colors.gray[700]} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {sections.map((section) => {
                const available = section.params
                  .map((key) => getParamValue(key, parameters))
                  .filter((item): item is NonNullable<typeof item> => item !== null)
                  .filter((item) => {
                    const [, value] = item;
                    return value !== null && value !== undefined && value !== '';
                  });

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
                      {available.map(([key, value]) => {
                        const paramOption = getParamOption(String(key), testType);
                        const numericValue =
                          typeof value === 'number' ? value : parseFloat(String(value));
                        const isNumeric = !Number.isNaN(numericValue);
                        const isOutOfRange =
                          isNumeric && paramOption
                            ? numericValue < paramOption.optimalMin ||
                              numericValue > paramOption.optimalMax
                            : false;

                        return (
                          <View
                            key={String(key)}
                            style={{
                              flexBasis: '48%',
                              backgroundColor: colors.gray[50],
                              borderRadius: borderRadius.lg,
                              paddingHorizontal: spacing[3],
                              paddingVertical: spacing[2],
                              borderWidth: 1,
                              borderColor: isOutOfRange ? colors.errorRed[500] : colors.gray[200],
                            }}
                          >
                            <Text style={{ fontSize: fontSize.xs, color: colors.gray[500] }}>
                              {formatParameterKey(String(key), testType)}
                            </Text>
                            <Text
                              style={{
                                fontSize: fontSize.base,
                                fontWeight: fontWeight.semibold,
                                color: isOutOfRange ? colors.errorRed[500] : accentColor,
                                marginTop: spacing[1],
                              }}
                            >
                              {formatValue(value)}
                            </Text>
                            {paramOption && (
                              <Text
                                style={{
                                  fontSize: fontSize.xs,
                                  color: isOutOfRange ? colors.errorRed[500] : colors.gray[400],
                                  marginTop: spacing[1],
                                }}
                              >
                                Optimal: {paramOption.optimalMin}-{paramOption.optimalMax}
                                {paramOption.unit && ` ${paramOption.unit}`}
                              </Text>
                            )}
                          </View>
                        );
                      })}
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
